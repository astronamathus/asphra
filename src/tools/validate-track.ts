import fs from 'node:fs';
import * as THREE from 'three';
import { createTrackFromCsv } from '../track/trackLoader';
import { parseAndValidateTrackCsv, TrackDataError } from '../track/trackCsv';
import { buildCenterline, createTrackQueries } from '../track/trackGeometry';
import type { WorldSample } from '../track/trackGeometry';

const csv = fs.readFileSync('src/tracks/monza.csv', 'utf8');
const results: string[] = [];
const ok = (cond: boolean, label: string, detail = '') => { results.push(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? '  -> ' + detail : ''}`); };

// ---------- 1. Real file loads ----------
const t0 = performance.now();
const track = createTrackFromCsv(csv, 'src/tracks/monza.csv', 'Monza');
const buildMs = performance.now() - t0;
ok(true, 'monza.csv parsed + track built', `${buildMs.toFixed(0)} ms (incl. 57k-vertex terrain)`);
ok(Math.abs(track.lapLength - 5790.2) < 5, 'lap length ~ source polyline length', `${track.lapLength.toFixed(1)} m`);

// ---------- 2. Negative tests: bad data must throw a clear error, never fall back ----------
function expectError(label: string, text: string, mustContain: string) {
  try { createTrackFromCsv(text, 'test.csv', 'X'); ok(false, `error: ${label}`, 'no error thrown!'); }
  catch (e) {
    const isOk = e instanceof TrackDataError && e.message.includes(mustContain);
    ok(isOk, `error: ${label}`, (e as Error).message.slice(0, 150));
  }
}
const lines = csv.split('\n');
expectError('empty file', '', 'empty');
expectError('wrong header', 'a,b,c,d\n1,2,3,4\n', 'unsupported header');
expectError('too few rows', lines.slice(0, 20).join('\n'), 'data rows');
expectError('missing value', [...lines.slice(0, 30), '1.0,,5,5', ...lines.slice(31)].join('\n'), 'missing or non-numeric');
expectError('non-numeric', [...lines.slice(0, 30), 'a,b,c,d', ...lines.slice(31)].join('\n'), 'non-numeric');
expectError('wrong column count', [...lines.slice(0, 30), '1,2,3', ...lines.slice(31)].join('\n'), 'expected 4 columns');
expectError('open (not closed) loop', lines.slice(0, 900).join('\n'), 'not closed');
expectError('too sparse (every 5th row)', lines.filter((_, i) => i === 0 || i % 5 === 0).join('\n'), 'too sparse');
expectError('width out of range', [...lines.slice(0, 30), '10,10,99,5', ...lines.slice(31)].join('\n'), 'outside the accepted range');
expectError('lat/lon-like units', ['# x_m,y_m,w_tr_right_m,w_tr_left_m', ...Array.from({ length: 100 }, (_, i) => `${9.28 + i * 1e-5},${45.62},5,5`)].join('\n'), 'duplicate');
const dup = [...lines.slice(0, 30), lines[29], ...lines.slice(30)].join('\n');
expectError('duplicate point', dup, 'duplicate');

// ---------- 3. Closed loop / seam ----------
const parsed = parseAndValidateTrackCsv(csv, 'src/tracks/monza.csv');
const cx = (Math.min(...parsed.samples.map(s => s.x)) + Math.max(...parsed.samples.map(s => s.x))) / 2;
const cy = (Math.min(...parsed.samples.map(s => s.y)) + Math.max(...parsed.samples.map(s => s.y))) / 2;
const world: WorldSample[] = parsed.samples.map(s => ({ x: s.x - cx, z: -(s.y - cy), widthLeft: s.widthLeft, widthRight: s.widthRight }));
const c = buildCenterline(track.debug.source, 2.5); // widths as used by the game (CSV + width zones)
const n = c.count;
let maxSeg = 0, minSeg = 1e9;
for (let i = 0; i < n; i++) { const j = (i + 1) % n; const d = Math.hypot(c.x[j] - c.x[i], c.z[j] - c.z[i]); maxSeg = Math.max(maxSeg, d); minSeg = Math.min(minSeg, d); }
ok(maxSeg < 3.2 && minSeg > 1.0, 'resampled spacing uniform incl. seam', `${minSeg.toFixed(2)}..${maxSeg.toFixed(2)} m, ${n} points`);
const seamCross = c.tx[n - 1] * c.tz[0] - c.tz[n - 1] * c.tx[0];
const seamDot = c.tx[n - 1] * c.tx[0] + c.tz[n - 1] * c.tz[0];
ok(Math.abs(Math.atan2(seamCross, seamDot)) < 0.01, 'no heading kink at the seam', `${(Math.atan2(seamCross, seamDot) * 180 / Math.PI).toFixed(4)} deg`);

// every source sample is reproduced exactly
let maxNodeErr = 0;
for (let k = 0; k < world.length; k++) { const i = c.sourceIndex[k]; maxNodeErr = Math.max(maxNodeErr, Math.hypot(c.x[i] - world[k].x, c.z[i] - world[k].z)); }
ok(maxNodeErr < 1e-9, 'road passes exactly through all 1159 source samples', `max error ${maxNodeErr.toExponential(1)} m`);

// spline vs source polyline: how far do interpolated points deviate from the straight chords (sagitta)?
let maxDev = 0, maxDevAt = 0;
for (let i = 0; i < n; i++) {
  let k = 0; { let lo = 0, hi = world.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (c.sourceIndex[mid] <= i) lo = mid; else hi = mid - 1; } k = lo; }
  const k2 = (k + 1) % world.length;
  const ax = world[k].x, az = world[k].z, bx = world[k2].x, bz = world[k2].z;
  const dx = bx - ax, dz = bz - az; let t = ((c.x[i] - ax) * dx + (c.z[i] - az) * dz) / (dx * dx + dz * dz); t = Math.max(0, Math.min(1, t));
  const best = Math.hypot(c.x[i] - (ax + dx * t), c.z[i] - (az + dz * t));
  if (best > maxDev) { maxDev = best; maxDevAt = i; }
}
ok(maxDev < 0.5, 'spline stays within 0.5 m of the source polyline (no corner cutting / overshoot)', `max ${maxDev.toFixed(3)} m at s=${c.s[maxDevAt].toFixed(0)} m`);

// radius preservation at the tightest corner
const sourceMinR = (() => { let m = 1e9; for (let i = 0; i < world.length; i++) { const p = world[(i - 1 + world.length) % world.length], q = world[i], r = world[(i + 1) % world.length]; const a = Math.hypot(q.x - p.x, q.z - p.z), b = Math.hypot(r.x - q.x, r.z - q.z), cc = Math.hypot(r.x - p.x, r.z - p.z); const area2 = Math.abs((q.x - p.x) * (r.z - p.z) - (r.x - p.x) * (q.z - p.z)); if (area2 > 1e-9) m = Math.min(m, a * b * cc / (2 * area2)); } return m; })();
let resMinR = 1e9; for (let i = 0; i < n; i++) { const j = (i + 1) % n; const st = Math.abs(Math.atan2(c.tx[i] * c.tz[j] - c.tz[i] * c.tx[j], c.tx[i] * c.tx[j] + c.tz[i] * c.tz[j])); resMinR = Math.min(resMinR, Math.hypot(c.x[j] - c.x[i], c.z[j] - c.z[i]) / st); }
ok(Math.abs(resMinR - sourceMinR) / sourceMinR < 0.25, 'tightest corner radius preserved', `source ${sourceMinR.toFixed(1)} m vs road ${resMinR.toFixed(1)} m`);

// ---------- 4. Mesh integrity ----------
const road = (track.object.children[1] as THREE.Group).children[0] as THREE.Mesh;
const pos = road.geometry.getAttribute('position') as THREE.BufferAttribute;
const nor = road.geometry.getAttribute('normal') as THREE.BufferAttribute;
const idx = road.geometry.index!;
let flipped = 0, degenerate = 0, badNormals = 0;
for (let k = 0; k < idx.count; k += 3) {
  const a = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(k)), b = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(k + 1)), d = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(k + 2));
  const nrm = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a));
  if (nrm.length() < 1e-6) degenerate++; else if (nrm.y <= 0) flipped++;
}
for (let i = 0; i < nor.count; i++) if (Math.abs(nor.getY(i) - 1) > 1e-6) badNormals++;
ok(flipped === 0 && degenerate === 0, 'road triangles: all face up, none degenerate/flipped', `${idx.count / 3} triangles, flipped ${flipped}, degenerate ${degenerate}`);
ok(badNormals === 0, 'road vertex normals all (0,1,0)');
const last = pos.count - 2;
const seamGap = Math.max(Math.hypot(pos.getX(0) - pos.getX(last), pos.getZ(0) - pos.getZ(last)), Math.hypot(pos.getX(1) - pos.getX(last + 1), pos.getZ(1) - pos.getZ(last + 1)));
ok(seamGap < 1e-4, 'road mesh closes exactly at the seam (no gap)', `${seamGap.toExponential(1)} m`);
// quads share vertices -> no cracks; check edge continuity: distance between consecutive left vertices ~ spacing
let maxJump = 0; for (let k = 0; k < pos.count / 2 - 1; k++) maxJump = Math.max(maxJump, Math.hypot(pos.getX(2 * k + 2) - pos.getX(2 * k), pos.getZ(2 * k + 2) - pos.getZ(2 * k)));
ok(maxJump < 8, 'no jumps along the left road edge', `max step ${maxJump.toFixed(2)} m`);
// road width at source nodes equals source widths
let maxWErr = 0; for (let k = 0; k < world.length; k++) { const i = c.sourceIndex[k]; const w = Math.hypot(pos.getX(2 * i) - pos.getX(2 * i + 1), pos.getZ(2 * i) - pos.getZ(2 * i + 1)); const used = track.debug.source[k]; maxWErr = Math.max(maxWErr, Math.abs(w - (used.widthLeft + used.widthRight))); }
let zoneChanged = 0, outsideZone = 0, plateau = 0;
for (let k = 0; k < world.length; k++) { const a = world[k].widthLeft + world[k].widthRight, b = track.debug.source[k].widthLeft + track.debug.source[k].widthRight; if (Math.abs(a - b) > 1e-9) { zoneChanged++; if (!(k >= 1109 || k <= 179)) outsideZone++; } if ((k >= 1109 || k <= 179) && Math.abs(b - 12) < 1e-6) plateau++; }
ok(outsideZone === 0 && zoneChanged > 0, 'width zone changes only rows 1110-180 (main straight)', `${zoneChanged} rows changed, ${outsideZone} outside the zone`);
ok(plateau > 150, 'main straight reaches exactly 12.00 m', `${plateau} rows at 12.00 m`);
ok(track.debug.originalWidths.every((w, k) => Math.abs(w.widthLeft - world[k].widthLeft) < 1e-9 && Math.abs(w.widthRight - world[k].widthRight) < 1e-9), 'original CSV widths kept for comparison');
ok(maxWErr < 5e-4, 'mesh width equals the width used (CSV or zone) at every source sample (float32 rounding only)', `max error ${maxWErr.toExponential(1)} m`);

// self-intersection of the two road edges (brute force segment tests)
function edge(side: 0 | 1) { const pts: [number, number][] = []; for (let k = 0; k < n; k++) pts.push([pos.getX(2 * k + side), pos.getZ(2 * k + side)]); return pts; }
function segInt(p1: [number, number], p2: [number, number], p3: [number, number], p4: [number, number]) {
  const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]); if (Math.abs(d) < 1e-12) return false;
  const t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d; const u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
  return t > 0 && t < 1 && u > 0 && u < 1;
}
const L = edge(0), R = edge(1); let crossings = 0;
for (const E of [L, R]) for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (segInt(E[i], E[(i + 1) % n], E[j], E[(j + 1) % n])) crossings++; }
for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (segInt(L[i], L[(i + 1) % n], R[j], R[(j + 1) % n])) crossings++;
ok(crossings === 0, 'road edges never cross themselves or each other', `${crossings} crossings`);

// ---------- 5. Queries vs brute force ----------
const rng = (() => { let a = 12345; return () => { a = (a * 1664525 + 1013904223) % 4294967296; return a / 4294967296; }; })();
const q = createTrackQueries(c, 50); let qErr = 0;
for (let k = 0; k < 3000; k++) {
  const x = (rng() - 0.5) * 3500, z = (rng() - 0.5) * 3500;
  let best = 1e18; for (let i = 0; i < n; i++) { const j = (i + 1) % n; const dx = c.x[j] - c.x[i], dz = c.z[j] - c.z[i]; let t = ((x - c.x[i]) * dx + (z - c.z[i]) * dz) / (dx * dx + dz * dz); t = Math.max(0, Math.min(1, t)); best = Math.min(best, (x - c.x[i] - dx * t) ** 2 + (z - c.z[i] - dz * t) ** 2); }
  qErr = Math.max(qErr, Math.abs(Math.sqrt(best) - q.distanceTo(x, z)));
}
ok(qErr < 1e-9, 'nearest-point search matches brute force on 3000 random points (incl. far away)', `max diff ${qErr.toExponential(1)} m`);
let onRoadWrong = 0, offRoadWrong = 0;
for (let i = 0; i < n; i += 7) {
  const lx = c.tz[i], lz = -c.tx[i];
  if (!track.isOnRoad(c.x[i], c.z[i])) onRoadWrong++;
  if (!track.isOnRoad(c.x[i] + lx * (c.widthLeft[i] - 0.3), c.z[i] + lz * (c.widthLeft[i] - 0.3))) onRoadWrong++;
  if (!track.isOnRoad(c.x[i] - lx * (c.widthRight[i] - 0.3), c.z[i] - lz * (c.widthRight[i] - 0.3))) onRoadWrong++;
  if (track.isOnRoad(c.x[i] + lx * (c.widthLeft[i] + 0.6), c.z[i] + lz * (c.widthLeft[i] + 0.6))) offRoadWrong++;
  if (track.isOnRoad(c.x[i] - lx * (c.widthRight[i] + 0.6), c.z[i] - lz * (c.widthRight[i] + 0.6))) offRoadWrong++;
}
ok(onRoadWrong === 0 && offRoadWrong === 0, 'isOnRoad: inside edges -> true, 0.6 m outside -> false (both sides, whole lap)', `wrong on ${onRoadWrong}, wrong off ${offRoadWrong}`);
const tq0 = performance.now(); for (let k = 0; k < 20000; k++) track.nearest(c.x[k % n] + 3, c.z[k % n] + 2); const perQuery = (performance.now() - tq0) / 20000 * 1000;
ok(perQuery < 50, 'nearest() speed', `${perQuery.toFixed(1)} microseconds per call`);

// ---------- 6. Start / spawn ----------
const s = track.start; const fwd = { x: Math.sin(s.heading), z: Math.cos(s.heading) };
const srcDir = { x: parsed.samples[1].x - parsed.samples[0].x, z: -(parsed.samples[1].y - parsed.samples[0].y) };
const dotv = (fwd.x * srcDir.x + fwd.z * srcDir.z) / Math.hypot(srcDir.x, srcDir.z);
ok(dotv > 0.999, 'spawn heading follows the CSV row order', `heading ${(s.heading * 180 / Math.PI).toFixed(1)} deg, alignment ${dotv.toFixed(5)}`);
const near = track.nearest(s.x, s.z);
ok(near.distance < 1e-6 && track.isOnRoad(s.x, s.z), 'spawn is on the road centerline', `s=${near.s.toFixed(1)} m, y=${track.heightAt(s.x, s.z)}`);

// ---------- 7. Ground ----------
let maxRoadH = 0; for (let i = 0; i < n; i += 5) { maxRoadH = Math.max(maxRoadH, Math.abs(track.heightAt(c.x[i], c.z[i]))); for (const off of [-30, 30, 60]) { const lx = c.tz[i], lz = -c.tx[i]; maxRoadH = Math.max(maxRoadH, Math.abs(track.heightAt(c.x[i] + lx * off, c.z[i] + lz * off))); } }
ok(maxRoadH === 0, 'ground is exactly flat within 60 m of the road (no terrain poking through)', `max |h| = ${maxRoadH}`);
const terrain = track.object.children[0] as THREE.Mesh; const tp = terrain.geometry.getAttribute('position') as THREE.BufferAttribute;
let maxTer = 0; for (let i = 0; i < tp.count; i++) maxTer = Math.max(maxTer, tp.getY(i));
ok(true, 'terrain stats', `${tp.count} vertices, max height ${maxTer.toFixed(1)} m`);
const bbox = new THREE.Box3().setFromObject(track.object);
results.push(`INFO  world bounding box: x ${bbox.min.x.toFixed(0)}..${bbox.max.x.toFixed(0)}, z ${bbox.min.z.toFixed(0)}..${bbox.max.z.toFixed(0)}`);
let tri = 0; track.object.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) tri += (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count) / 3; });
results.push(`INFO  total triangles in track group: ${tri} (road+lines: ${(road.geometry.index!.count / 3) * 3})`);

console.log(results.join('\n'));
fs.writeFileSync('tools/edges.json', JSON.stringify({ L, R, start: [s.x, s.z] }));
process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);