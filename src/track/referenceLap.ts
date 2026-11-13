/**
 * The reference lap: real telemetry of Max Verstappen's 2025 Italian GP qualifying lap, digitised from
 * chart images (see src/tracks/README.md). Pure data and lookups, with no file loading.
 */

export interface ReferenceLap {
  distance: Float64Array; // m from the start/finish line
  speedKmh: Float64Array;
  throttle: Float64Array; // percent
  brake: Float64Array; // 0 or 1
  gear: Float64Array;
  totalDistance: number;
}

/** Value of one of the reference columns at a fraction (0..1) of the lap, by linear interpolation. */
export function referenceAt(lap: ReferenceLap, values: Float64Array, fraction: number): number {
  const d = (((fraction % 1) + 1) % 1) * lap.totalDistance;
  let lo = 0;
  let hi = lap.distance.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lap.distance[mid] <= d) lo = mid;
    else hi = mid - 1;
  }
  const j = Math.min(lo + 1, lap.distance.length - 1);
  const span = lap.distance[j] - lap.distance[lo];
  const t = span > 0 ? (d - lap.distance[lo]) / span : 0;
  return values[lo] + (values[j] - values[lo]) * t;
}