import type { TrackNearest } from '../types';
import { TrackDataError } from './trackCsv';

/** A centerline sample in world coordinates (x = east, z = south), with road widths. */
export interface WorldSample {
  x: number;
  z: number;
  widthLeft: number;
  widthRight: number;
}

/**
 * A closed centerline as flat arrays. Point i is joined to point i + 1, and the last point
 * is joined back to point 0 (the first point is NOT repeated at the end).
 * "Left" is the left-hand side when looking in the direction of travel.
 */
export interface Centerline {
  count: number;
  x: Float64Array;
  z: Float64Array;
  /** Unit direction of travel. */
  tx: Float64Array;
  tz: Float64Array;
  widthLeft: Float64Array;
  widthRight: Float64Array;
  /** Distance along the lap at each point (m); s[0] = 0. */
  s: Float64Array;
  lapLength: number;
  /** For every source sample, the index of the resampled point that coincides with it. */
  sourceIndex: Int32Array;
}

export interface CenterlineStats {
  points: number;
  lapLength: number;
  minSpacing: number;
  maxSpacing: number;
  /** Largest direction change between neighbouring points (degrees). */
  maxHeadingStepDeg: number;
  /** Smallest radius of curvature of the centerline (m). */
  minRadius: number;
  minRoadWidth: number;
  maxRoadWidth: number;
}

/**
 * Centripetal Catmull-Rom interpolation (Barry-Goldman form). The curve passes exactly through
 * p1 (t = 0) and p2 (t = 1); the centripetal parametrisation avoids loops and overshoot in
 * tight corners. Result is written into `out`.
 */
function catmullRom(
  p0x: number,
  p0z: number,
  p1x: number,
  p1z: number,
  p2x: number,
  p2z: number,
  p3x: number,
  p3z: number,
  t: number,
  out: [number, number],
): void {
  const knot = (ax: number, az: number, bx: number, bz: number): number =>
    Math.max(Math.pow(Math.hypot(bx - ax, bz - az), 0.5), 1e-6);

  const t0 = 0;
  const t1 = t0 + knot(p0x, p0z, p1x, p1z);
  const t2 = t1 + knot(p1x, p1z, p2x, p2z);
  const t3 = t2 + knot(p2x, p2z, p3x, p3z);
  const u = t1 + (t2 - t1) * t;

  const mix = (ax: number, bx: number, ta: number, tb: number): number =>
    ((tb - u) / (tb - ta)) * ax + ((u - ta) / (tb - ta)) * bx;

  for (let axis = 0; axis < 2; axis++) {
    const a = axis === 0 ? [p0x, p1x, p2x, p3x] : [p0z, p1z, p2z, p3z];
    const a1 = mix(a[0], a[1], t0, t1);
    const a2 = mix(a[1], a[2], t1, t2);
    const a3 = mix(a[2], a[3], t2, t3);
    const b1 = mix(a1, a2, t0, t2);
    const b2 = mix(a2, a3, t1, t3);
    out[axis] = mix(b1, b2, t1, t2);
  }
}

/**
 * Turns the (about 5 m spaced) source samples into a denser closed centerline.
 * Every source sample is kept exactly as a node, so the road passes through all the real data
 * points; extra points are inserted between them with a spline so tight corners stay round.
 * Widths are interpolated linearly between source samples.
 */
export function buildCenterline(samples: WorldSample[], spacing: number): Centerline {
  const n = samples.length;
  const xs: number[] = [];
  const zs: number[] = [];
  const wls: number[] = [];
  const wrs: number[] = [];
  const sourceIndex = new Int32Array(n);
  const point: [number, number] = [0, 0];

  for (let i = 0; i < n; i++) {
    const p0 = samples[(i - 1 + n) % n];
    const p1 = samples[i];
    const p2 = samples[(i + 1) % n];
    const p3 = samples[(i + 2) % n];
    const steps = Math.max(1, Math.ceil(Math.hypot(p2.x - p1.x, p2.z - p1.z) / spacing));

    sourceIndex[i] = xs.length;
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      if (k === 0) {
        point[0] = p1.x;
        point[1] = p1.z;
      } else {
        catmullRom(p0.x, p0.z, p1.x, p1.z, p2.x, p2.z, p3.x, p3.z, t, point);
      }
      xs.push(point[0]);
      zs.push(point[1]);
      wls.push(p1.widthLeft + (p2.widthLeft - p1.widthLeft) * t);
      wrs.push(p1.widthRight + (p2.widthRight - p1.widthRight) * t);
    }
  }

  const count = xs.length;
  const x = Float64Array.from(xs);
  const z = Float64Array.from(zs);
  const tx = new Float64Array(count);
  const tz = new Float64Array(count);
  const s = new Float64Array(count);

  let length = 0;
  for (let i = 0; i < count; i++) {
    s[i] = length;
    const j = (i + 1) % count;
    length += Math.hypot(x[j] - x[i], z[j] - z[i]);

    const prev = (i - 1 + count) % count;
    const dx = x[j] - x[prev];
    const dz = z[j] - z[prev];
    const len = Math.hypot(dx, dz) || 1;
    tx[i] = dx / len;
    tz[i] = dz / len;
  }

  return {
    count,
    x,
    z,
    tx,
    tz,
    widthLeft: Float64Array.from(wls),
    widthRight: Float64Array.from(wrs),
    s,
    lapLength: length,
    sourceIndex,
  };
}

/**
 * Measures the centerline and rejects geometry that would make a broken road: if a road edge
 * would fold over itself in a corner (corner radius smaller than the road half-width) the
 * mesh would have flipped triangles, so loading stops with an error instead.
 */
export function checkCenterline(c: Centerline, sourceName: string): CenterlineStats {
  let minSpacing = Infinity;
  let maxSpacing = 0;
  let maxStep = 0;
  let minRadius = Infinity;
  let minWidth = Infinity;
  let maxWidth = 0;

  for (let i = 0; i < c.count; i++) {
    const j = (i + 1) % c.count;
    const spacing = Math.hypot(c.x[j] - c.x[i], c.z[j] - c.z[i]);
    minSpacing = Math.min(minSpacing, spacing);
    maxSpacing = Math.max(maxSpacing, spacing);

    const cross = c.tx[i] * c.tz[j] - c.tz[i] * c.tx[j];
    const dot = c.tx[i] * c.tx[j] + c.tz[i] * c.tz[j];
    const step = Math.abs(Math.atan2(cross, dot));
    maxStep = Math.max(maxStep, step);

    const radius = step > 1e-9 ? spacing / step : Infinity;
    minRadius = Math.min(minRadius, radius);

    const halfSide = Math.max(c.widthLeft[i], c.widthRight[i]);
    if (radius <= halfSide * 1.05) {
      throw new TrackDataError(
        `${sourceName}: the road would fold over itself near distance ${c.s[i].toFixed(0)} m ` +
          `(corner radius ${radius.toFixed(1)} m is smaller than the road half-width ${halfSide.toFixed(1)} m).`,
      );
    }

    const total = c.widthLeft[i] + c.widthRight[i];
    minWidth = Math.min(minWidth, total);
    maxWidth = Math.max(maxWidth, total);
  }

  return {
    points: c.count,
    lapLength: c.lapLength,
    minSpacing,
    maxSpacing,
    maxHeadingStepDeg: (maxStep * 180) / Math.PI,
    minRadius,
    minRoadWidth: minWidth,
    maxRoadWidth: maxWidth,
  };
}

/** Position and direction of travel at a given distance along the lap (wraps around). */
export function pointAtDistance(c: Centerline, distance: number): { x: number; z: number; heading: number } {
  const d = ((distance % c.lapLength) + c.lapLength) % c.lapLength;

  // Binary search for the last point with s <= d.
  let lo = 0;
  let hi = c.count - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (c.s[mid] <= d) lo = mid;
    else hi = mid - 1;
  }
  const j = (lo + 1) % c.count;
  const segmentEnd = lo + 1 < c.count ? c.s[lo + 1] : c.lapLength;
  const t = (d - c.s[lo]) / (segmentEnd - c.s[lo]);

  const tx = c.tx[lo] + (c.tx[j] - c.tx[lo]) * t;
  const tz = c.tz[lo] + (c.tz[j] - c.tz[lo]) * t;
  return {
    x: c.x[lo] + (c.x[j] - c.x[lo]) * t,
    z: c.z[lo] + (c.z[j] - c.z[lo]) * t,
    heading: Math.atan2(tx, tz),
  };
}

export interface TrackQueries {
  /** Distance to the centerline in metres. If maxDistance is given, returns Infinity beyond it. */
  distanceTo(x: number, z: number, maxDistance?: number): number;
  nearest(x: number, z: number): TrackNearest;
  isOnRoad(x: number, z: number, tolerance?: number): boolean;
}

/**
 * Builds nearest-point queries over the centerline. The segments are bucketed into a grid so a
 * query only looks at nearby segments, and it searches outward ring by ring until nothing closer
 * can exist, so the result is exact.
 */
export function createTrackQueries(c: Centerline, cellSize: number): TrackQueries {
  const n = c.count;

  // --- Grid over the bounding box of the centerline ---
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, c.x[i]);
    maxX = Math.max(maxX, c.x[i]);
    minZ = Math.min(minZ, c.z[i]);
    maxZ = Math.max(maxZ, c.z[i]);
  }
  const gridW = Math.floor((maxX - minX) / cellSize) + 1;
  const gridH = Math.floor((maxZ - minZ) / cellSize) + 1;

  // Segment i runs from point i to point i + 1 (wrapping).
  const segDx = new Float64Array(n);
  const segDz = new Float64Array(n);
  const segInvLen2 = new Float64Array(n);
  const counts = new Int32Array(gridW * gridH + 1);

  const cellRange = (i: number): [number, number, number, number] => {
    const j = (i + 1) % n;
    return [
      Math.floor((Math.min(c.x[i], c.x[j]) - minX) / cellSize),
      Math.floor((Math.max(c.x[i], c.x[j]) - minX) / cellSize),
      Math.floor((Math.min(c.z[i], c.z[j]) - minZ) / cellSize),
      Math.floor((Math.max(c.z[i], c.z[j]) - minZ) / cellSize),
    ];
  };

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    segDx[i] = c.x[j] - c.x[i];
    segDz[i] = c.z[j] - c.z[i];
    segInvLen2[i] = 1 / (segDx[i] * segDx[i] + segDz[i] * segDz[i]);
    const [x0, x1, z0, z1] = cellRange(i);
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) counts[iz * gridW + ix + 1]++;
    }
  }
  for (let k = 1; k < counts.length; k++) counts[k] += counts[k - 1];
  const cellStart = counts; // cellStart[cell]..cellStart[cell + 1] indexes into cellItems
  const cellItems = new Int32Array(cellStart[cellStart.length - 1]);
  const fill = new Int32Array(gridW * gridH);
  for (let i = 0; i < n; i++) {
    const [x0, x1, z0, z1] = cellRange(i);
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) {
        const cell = iz * gridW + ix;
        cellItems[cellStart[cell] + fill[cell]++] = i;
      }
    }
  }

  // --- Search state (reused between calls to avoid allocations) ---
  let bestD2 = Infinity;
  let bestSeg = -1;
  let bestT = 0;

  function testSegment(i: number, x: number, z: number): void {
    const ax = c.x[i];
    const az = c.z[i];
    let t = ((x - ax) * segDx[i] + (z - az) * segDz[i]) * segInvLen2[i];
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = x - (ax + segDx[i] * t);
    const dz = z - (az + segDz[i] * t);
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestSeg = i;
      bestT = t;
    }
  }

  function scanCell(ix: number, iz: number, x: number, z: number): void {
    if (ix < 0 || iz < 0 || ix >= gridW || iz >= gridH) return;
    const cell = iz * gridW + ix;
    for (let k = cellStart[cell]; k < cellStart[cell + 1]; k++) testSegment(cellItems[k], x, z);
  }

  /** Finds the nearest segment. Returns false if nothing lies within maxDistance. */
  function search(x: number, z: number, maxDistance: number): boolean {
    bestD2 = Infinity;
    bestSeg = -1;
    bestT = 0;

    const cx = Math.floor((x - minX) / cellSize);
    const cz = Math.floor((z - minZ) / cellSize);
    let ringLimit = Math.max(Math.abs(cx), Math.abs(cx - (gridW - 1)), Math.abs(cz), Math.abs(cz - (gridH - 1)));
    if (Number.isFinite(maxDistance)) ringLimit = Math.min(ringLimit, Math.ceil(maxDistance / cellSize) + 1);

    for (let r = 0; r <= ringLimit; r++) {
      if (r === 0) {
        scanCell(cx, cz, x, z);
      } else {
        const x0 = cx - r;
        const x1 = cx + r;
        const z0 = cz - r;
        const z1 = cz + r;
        const ixa = Math.max(x0, 0);
        const ixb = Math.min(x1, gridW - 1);
        if (z0 >= 0 && z0 < gridH) for (let ix = ixa; ix <= ixb; ix++) scanCell(ix, z0, x, z);
        if (z1 >= 0 && z1 < gridH) for (let ix = ixa; ix <= ixb; ix++) scanCell(ix, z1, x, z);
        const iza = Math.max(z0 + 1, 0);
        const izb = Math.min(z1 - 1, gridH - 1);
        if (x0 >= 0 && x0 < gridW) for (let iz = iza; iz <= izb; iz++) scanCell(x0, iz, x, z);
        if (x1 >= 0 && x1 < gridW) for (let iz = iza; iz <= izb; iz++) scanCell(x1, iz, x, z);
      }
      // Anything not scanned yet is at least r * cellSize away, so we can stop once we beat that.
      const reach = r * cellSize;
      if (bestSeg >= 0 && bestD2 <= reach * reach) break;
    }

    if (bestSeg < 0) return false;
    return bestD2 <= maxDistance * maxDistance;
  }

  function distanceTo(x: number, z: number, maxDistance = Infinity): number {
    return search(x, z, maxDistance) ? Math.sqrt(bestD2) : Infinity;
  }

  function nearest(x: number, z: number): TrackNearest {
    search(x, z, Infinity);
    const i = bestSeg;
    const j = (i + 1) % n;
    const t = bestT;

    const px = c.x[i] + segDx[i] * t;
    const pz = c.z[i] + segDz[i] * t;
    let tx = c.tx[i] + (c.tx[j] - c.tx[i]) * t;
    let tz = c.tz[i] + (c.tz[j] - c.tz[i]) * t;
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;

    const segmentEnd = i + 1 < n ? c.s[i + 1] : c.lapLength;
    return {
      distance: Math.sqrt(bestD2),
      // Left of the direction of travel is (tz, -tx), matching the car's left vector.
      lateralOffset: (x - px) * tz + (z - pz) * -tx,
      s: c.s[i] + (segmentEnd - c.s[i]) * t,
      x: px,
      z: pz,
      heading: Math.atan2(tx, tz),
      widthLeft: c.widthLeft[i] + (c.widthLeft[j] - c.widthLeft[i]) * t,
      widthRight: c.widthRight[i] + (c.widthRight[j] - c.widthRight[i]) * t,
    };
  }

  function isOnRoad(x: number, z: number, tolerance = 0): boolean {
    const hit = nearest(x, z);
    return hit.lateralOffset >= 0
      ? hit.lateralOffset <= hit.widthLeft + tolerance
      : -hit.lateralOffset <= hit.widthRight + tolerance;
  }

  return { distanceTo, nearest, isOnRoad };
}