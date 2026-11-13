/**
 * Turns the road-edge trace in src/tracks/MONZA.kml (two closed polygons drawn in Google Earth) into
 * per-row road widths for src/tracks/monza.csv, written to src/tracks/monza-widths.csv.
 *
 *   npx tsx tools/kml-to-widths.ts [file.kml] [outerName] [innerName]
 *
 * Steps: read both rings (longitude, latitude) -> convert to local metres -> fit the CSV centerline
 * onto the strip between the rings (rotation, shift, scale; the centerline should sit equally far
 * from both edges) -> at every CSV row, cast a line sideways across the road and measure the distance
 * to the left edge (outer ring) and the right edge (inner ring), looking in the driving direction.
 * Run it again whenever the trace is improved.
 */
import fs from 'node:fs';
import { parseTracedWidths } from '../track/tracedWidths';
import { createTrackFromCsv } from '../track/trackLoader';

const kmlPath = process.argv[2] ?? 'src/tracks/MONZA.kml';
const outerName = process.argv[3] ?? 'MNZA_OUTR_TRCK';
const innerName = process.argv[4] ?? 'MNZA_INNR_TRCK';
const csvPath = 'src/tracks/monza.csv';
const outPath = 'src/tracks/monza-widths.csv';

type P = [number, number];

// ---------- KML ----------
function readRings(text: string): Record<string, P[]> {
  const rings: Record<string, P[]> = {};
  for (const block of text.match(/<Placemark[\s\S]*?<\/Placemark>/g) ?? []) {
    const name = /<name>([\s\S]*?)<\/name>/.exec(block)?.[1]?.trim();
    const coords = /<coordinates>([\s\S]*?)<\/coordinates>/.exec(block)?.[1];
    if (!name || !coords) continue;
    rings[name] = coords
      .trim()
      .split(/\s+/)
      .map((t) => t.split(',').map(Number))
      .filter((v) => v.length >= 2 && v.every(Number.isFinite))
      .map((v) => [v[0], v[1]] as P);
  }
  return rings;
}
const rings = readRings(fs.readFileSync(kmlPath, 'utf8'));
for (const name of [outerName, innerName]) {
  if (!rings[name] || rings[name].length < 20) {
    throw new Error(`${kmlPath}: no polygon named "${name}" (found: ${Object.keys(rings).join(', ') || 'none'})`);
  }
}

// ---------- longitude/latitude -> local metres (east, north) ----------
const lon0 = rings[outerName].reduce((a, p) => a + p[0], 0) / rings[outerName].length;
const lat0 = rings[outerName].reduce((a, p) => a + p[1], 0) / rings[outerName].length;
const A = 6378137.0;
const E2 = 0.00669437999014;
const phi = (lat0 * Math.PI) / 180;
const N = A / Math.sqrt(1 - E2 * Math.sin(phi) ** 2);
const M = (A * (1 - E2)) / (1 - E2 * Math.sin(phi) ** 2) ** 1.5;
const toLocal = (p: P): P => [(((p[0] - lon0) * Math.PI) / 180) * N * Math.cos(phi), (((p[1] - lat0) * Math.PI) / 180) * M];
const outer = rings[outerName].map(toLocal);
const inner = rings[innerName].map(toLocal);

// ---------- CSV centerline ----------
const csv = fs
  .readFileSync(csvPath, 'utf8')
  .split(/\r?\n/)
  .filter((l) => l.trim() !== '' && !l.startsWith('#'));
const centre: P[] = csv.map((l) => {
  const v = l.split(',').map(Number);
  return [v[0], v[1]] as P;
});
const n = centre.length;

// ---------- distance from a point to a closed polyline ----------
function distToRing(p: P, ring: P[]): number {
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const len2 = ex * ex + ey * ey;
    let t = len2 > 0 ? ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / len2 : 0;
    t = Math.min(1, Math.max(0, t));
    const dx = p[0] - (a[0] + ex * t);
    const dy = p[1] - (a[1] + ey * t);
    best = Math.min(best, dx * dx + dy * dy);
  }
  return Math.sqrt(best);
}

// ---------- fit: rotation, shift, scale of the CSV centerline onto the strip ----------
const transform = (p: P, q: number[]): P => {
  const c = Math.cos(q[0]);
  const s = Math.sin(q[0]);
  return [q[3] * (p[0] * c - p[1] * s) + q[1], q[3] * (p[0] * s + p[1] * c) + q[2]];
};
const mean = (pts: P[]): P => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
const sample = centre.filter((_, i) => i % 3 === 0);
const F = 2; // soft-L1 scale (m)
function cost(q: number[]): number {
  let sum = 0;
  for (const p of sample) {
    const t = transform(p, q);
    const d = distToRing(t, outer) - distToRing(t, inner); // zero when equally far from both edges
    sum += 2 * F * F * (Math.sqrt(1 + (d / F) ** 2) - 1);
  }
  return sum / sample.length;
}
function nelderMead(f: (q: number[]) => number, start: number[], steps: number[], iterations: number): number[] {
  let simplex = [start, ...start.map((_, i) => start.map((w, j) => (j === i ? w + steps[i] : w)))];
  let values = simplex.map(f);
  for (let it = 0; it < iterations; it++) {
    const order = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
    simplex = order.map((i) => simplex[i]);
    values = order.map((i) => values[i]);
    const last = simplex.length - 1;
    const centroid = start.map((_, j) => simplex.slice(0, last).reduce((a, s) => a + s[j], 0) / last);
    const worst = simplex[last];
    const reflect = centroid.map((c, j) => c + (c - worst[j]));
    const fr = f(reflect);
    if (fr < values[0]) {
      const expand = centroid.map((c, j) => c + 2 * (c - worst[j]));
      const fe = f(expand);
      simplex[last] = fe < fr ? expand : reflect;
      values[last] = Math.min(fe, fr);
    } else if (fr < values[last - 1]) {
      simplex[last] = reflect;
      values[last] = fr;
    } else {
      const contract = centroid.map((c, j) => c + 0.5 * (worst[j] - c));
      const fc = f(contract);
      if (fc < values[last]) {
        simplex[last] = contract;
        values[last] = fc;
      } else {
        for (let i = 1; i < simplex.length; i++) {
          simplex[i] = simplex[i].map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j]));
          values[i] = f(simplex[i]);
        }
      }
    }
  }
  return simplex[values.indexOf(Math.min(...values))];
}
const cC = mean(centre);
const cR = mean([...outer, ...inner]);
let q = [0, cR[0] - cC[0], cR[1] - cC[1], 1];
// two rounds of the simplex search (coarse, then fine), starting with the centroids matched
q = nelderMead(cost, q, [0.02, 30, 30, 0.01], 250);
q = nelderMead(cost, q, [0.002, 3, 3, 0.001], 250);
const registered = centre.map((p) => transform(p, q));

// ---------- cast a line across the road at every row ----------
function cast(p: P, d: P, ring: P[]): number {
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i];
    const ex = ring[i + 1][0] - a[0];
    const ey = ring[i + 1][1] - a[1];
    const den = d[0] * ey - d[1] * ex;
    if (Math.abs(den) < 1e-9) continue;
    const wx = p[0] - a[0];
    const wy = p[1] - a[1];
    const t = -(wx * ey - wy * ex) / den; // distance along the ray
    const u = -(wx * d[1] - wy * d[0]) / den; // position along the edge segment
    if (t > 0 && u >= 0 && u <= 1 && t < best) best = t;
  }
  return best;
}
const left: number[] = [];
const right: number[] = [];
let outerOnLeft = 0;
for (let i = 0; i < n; i++) {
  const a = registered[(i - 1 + n) % n];
  const b = registered[(i + 1) % n];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const t: P = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const nl: P = [-t[1], t[0]]; // left of the driving direction (east, north)
  const lo = cast(registered[i], nl, outer);
  const li = cast(registered[i], nl, inner);
  const ro = cast(registered[i], [-nl[0], -nl[1]], outer);
  const ri = cast(registered[i], [-nl[0], -nl[1]], inner);
  if (lo < li) outerOnLeft++;
  left.push(Math.min(lo, li));
  right.push(Math.min(ro, ri));
}
const bad = left.concat(right).filter((v) => !Number.isFinite(v)).length;
if (bad > 0) throw new Error(`${bad} cross-sections did not reach a road edge; check the trace and the ring names.`);

// ---------- report and write ----------
const total = left.map((l, i) => l + right[i]);
const sorted = [...total].sort((a, b) => a - b);
const eqDiff = registered.map((p) => Math.abs(distToRing(p, outer) - distToRing(p, inner))).sort((a, b) => a - b);
console.log(`registration: rotation ${((q[0] * 180) / Math.PI).toFixed(2)} deg, shift (${q[1].toFixed(1)}, ${q[2].toFixed(1)}) m, scale ${q[3].toFixed(4)}`);
console.log(`centerline equally far from both edges: median difference ${eqDiff[Math.floor(n / 2)].toFixed(2)} m, 90th percentile ${eqDiff[Math.floor(n * 0.9)].toFixed(2)} m`);
console.log(`left edge is the outer ring in ${((100 * outerOnLeft) / n).toFixed(1)}% of rows`);
console.log(`total width: min ${sorted[0].toFixed(2)} m, median ${sorted[Math.floor(n / 2)].toFixed(2)} m, max ${sorted[n - 1].toFixed(2)} m`);
const lines = [
  `# Road widths traced from ${kmlPath} (ring "${outerName}" = left edge, ring "${innerName}" = right edge, in the driving direction).`,
  '# Generated by tools/kml-to-widths.ts: distance from the monza.csv centerline to each edge, one row per row of monza.csv.',
  '# row,left_m,right_m',
  ...left.map((l, i) => `${i + 1},${l.toFixed(3)},${right[i].toFixed(3)}`),
];
fs.writeFileSync(outPath, lines.join('\n') + '\n');
console.log(`wrote ${outPath} (${n} rows)`);

// ---------- check: how far are your traced edges from the road the game will build? ----------
{
  const widthsText = fs.readFileSync(outPath, 'utf8');
  const csvText = fs.readFileSync(csvPath, 'utf8');
  const info = console.info;
  console.info = () => {};
  const track = createTrackFromCsv(csvText, csvPath, 'Monza', parseTracedWidths(widthsText, outPath, n));
  console.info = info;
  const c = track.debug.centerline;
  const leftEdge: P[] = [];
  const rightEdge: P[] = [];
  for (let i = 0; i < c.count; i++) {
    leftEdge.push([c.x[i] + c.tz[i] * c.widthLeft[i], c.z[i] - c.tx[i] * c.widthLeft[i]]);
    rightEdge.push([c.x[i] - c.tz[i] * c.widthRight[i], c.z[i] + c.tx[i] * c.widthRight[i]]);
  }
  leftEdge.push(leftEdge[0]);
  rightEdge.push(rightEdge[0]);
  const xs = centre.map((p) => p[0]);
  const ys = centre.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const toWorld = (p: P): P => {
    const u: P = [(p[0] - q[1]) / q[3], (p[1] - q[2]) / q[3]];
    const co = Math.cos(q[0]);
    const si = Math.sin(q[0]);
    const csvPoint: P = [u[0] * co + u[1] * si, -u[0] * si + u[1] * co]; // undo the fit rotation
    return [csvPoint[0] - cx, -(csvPoint[1] - cy)];
  };
  const dense = (ring: P[]): P[] => {
    const out: P[] = [];
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i];
      const b = ring[i + 1];
      const count = Math.max(1, Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1])));
      for (let k = 0; k < count; k++) out.push([a[0] + ((b[0] - a[0]) * k) / count, a[1] + ((b[1] - a[1]) * k) / count]);
    }
    return out;
  };
  const report = (label: string, ring: P[], edge: P[]): void => {
    const d = dense(ring).map((p) => distToRing(toWorld(p), edge)).sort((a, b) => a - b);
    const within = (m: number): string => ((100 * d.filter((v) => v <= m).length) / d.length).toFixed(1);
    console.log(
      `${label}: distance to the game's road edge: mean ${(d.reduce((a, v) => a + v, 0) / d.length).toFixed(2)} m, ` +
        `95th percentile ${d[Math.floor(d.length * 0.95)].toFixed(2)} m, max ${d[d.length - 1].toFixed(2)} m; ` +
        `${within(0.5)}% within 0.5 m, ${within(1)}% within 1 m`,
    );
  };
  report('your outer trace', outer, leftEdge);
  report('your inner trace', inner, rightEdge);
}