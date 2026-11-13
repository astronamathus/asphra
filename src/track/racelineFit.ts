import type { RoadTrack } from '../types';
import { pointAtDistance } from './trackGeometry';

export interface RacelineFit {
  points: { x: number; z: number }[];
  /** How many points had to be moved, and the largest move (m). */
  moved: number;
  maxShift: number;
}

/**
 * The raceline file treats the car as a point, so it can touch the road edge. This keeps the
 * line at least `margin` metres from both road edges (measured from the line, i.e. the car's
 * centre).
 *
 * It works in "distance along the road" and "sideways offset from the centerline". Where the
 * line is already clear of the edges it is NOT changed at all (smoothing the whole line would
 * flatten the chicanes' sideways swing, which is what makes the real line fast). Only the
 * inward correction is spread over a short stretch, so it eases in and out instead of leaving a
 * kink, which the speed planner would read as a very tight corner.
 */
export function fitRacelineToRoad(points: { x: number; z: number }[], track: RoadTrack, margin: number): RacelineFit {
  const n = points.length;
  const lap = track.lapLength;
  const centerline = track.debug.centerline;

  const hits = points.map((p) => track.nearest(p.x, p.z));
  const maxLeft = new Float64Array(n);
  const maxRight = new Float64Array(n);
  const original = new Float64Array(n);
  const correction = new Float64Array(n); // how far the line must move (left positive) at each point
  for (let i = 0; i < n; i++) {
    let left = hits[i].widthLeft - margin;
    let right = -(hits[i].widthRight - margin);
    if (left < right) {
      left = (hits[i].widthLeft - hits[i].widthRight) / 2; // road too narrow for the margin: use the middle
      right = left;
    }
    maxLeft[i] = left;
    maxRight[i] = right;
    original[i] = hits[i].lateralOffset;
    correction[i] = Math.min(Math.max(original[i], right), left) - original[i];
  }

  // Spread each correction over about +-20 m: take the largest correction in the window (so the
  // eased-in value never falls short at the point that needed it), then blur it a little.
  const half = 4;
  const spread = (sign: 1 | -1): Float64Array => {
    let out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let best = 0;
      for (let k = -half; k <= half; k++) {
        const value = correction[(i + k + n) % n] * sign;
        if (value > best) best = value;
      }
      out[i] = best * sign;
    }
    for (let pass = 0; pass < 2; pass++) {
      const next = new Float64Array(n);
      for (let i = 0; i < n; i++) next[i] = 0.25 * out[(i - 1 + n) % n] + 0.5 * out[i] + 0.25 * out[(i + 1) % n];
      out = next;
    }
    return out;
  };
  const toRight = spread(-1); // corrections that move the line to the right (negative)
  const toLeft = spread(1); // corrections that move the line to the left (positive)

  let moved = 0;
  let maxShift = 0;
  const fitted = points.map((p, i) => {
    const wanted = Math.min(Math.max(original[i] + toRight[i] + toLeft[i], maxRight[i]), maxLeft[i]);
    const shift = wanted - original[i];
    if (Math.abs(shift) < 0.02) return p;
    moved++;
    maxShift = Math.max(maxShift, Math.abs(shift));
    const base = pointAtDistance(centerline, hits[i].s % lap);
    // left of the direction of travel is (cos h, -sin h), matching the car's left vector
    return { x: base.x + wanted * Math.cos(base.heading), z: base.z - wanted * Math.sin(base.heading) };
  });
  return { points: fitted, moved, maxShift };
}