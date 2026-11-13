import { smoothstep } from '../utils/math';
import type { WorldSample } from './trackGeometry';
import { TrackDataError } from './trackCsv';

/**
 * A stretch of road whose total width is set to a known value instead of the CSV's width.
 * Rows are CSV data-row numbers (1 = first row after the header), the same numbers the debug
 * overlay shows as "#n". If fromRow > toRow the zone runs across the start/end of the file.
 * The width eases in and out over `rampMeters` at each end (inside the zone), so the road
 * edge never jumps.
 */
export interface WidthZone {
  name: string;
  fromRow: number;
  toRow: number;
  totalWidth: number;
  rampMeters: number;
}

export interface WidthZoneResult {
  samples: WorldSample[];
  /** The widths before any zone was applied, per row. */
  originalWidths: { widthLeft: number; widthRight: number }[];
  notes: string[];
}

/**
 * Applies the zones to a copy of the samples. Left and right widths are scaled by the same
 * factor, so the CSV's left/right proportion (how far the centerline sits from the middle of
 * the road) is kept.
 */
export function applyWidthZones(
  samples: WorldSample[],
  zones: readonly WidthZone[],
  sourceName: string,
): WidthZoneResult {
  const n = samples.length;
  const originalWidths = samples.map((s) => ({ widthLeft: s.widthLeft, widthRight: s.widthRight }));
  const result = samples.map((s) => ({ ...s }));
  const notes: string[] = [];

  // distance along the loop at each row
  const dist = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    dist[i] = dist[i - 1] + Math.hypot(samples[i].x - samples[i - 1].x, samples[i].z - samples[i - 1].z);
  }
  const loopLength = dist[n - 1] + Math.hypot(samples[0].x - samples[n - 1].x, samples[0].z - samples[n - 1].z);

  for (const zone of zones) {
    if (zone.fromRow < 1 || zone.fromRow > n || zone.toRow < 1 || zone.toRow > n) {
      throw new TrackDataError(
        `${sourceName}: width zone "${zone.name}" uses rows ${zone.fromRow}-${zone.toRow}, but the file has rows 1-${n}.`,
      );
    }
    if (zone.totalWidth < 1) {
      throw new TrackDataError(`${sourceName}: width zone "${zone.name}" has an invalid width ${zone.totalWidth} m.`);
    }
    const a = zone.fromRow - 1;
    const b = zone.toRow - 1;
    const zoneLength = (dist[b] - dist[a] + loopLength) % loopLength;
    if (zone.rampMeters * 2 > zoneLength) {
      throw new TrackDataError(
        `${sourceName}: width zone "${zone.name}" is ${zoneLength.toFixed(0)} m long, too short for two ${zone.rampMeters} m ramps.`,
      );
    }

    let before = Infinity;
    const count = ((b - a + n) % n) + 1;
    for (let k = 0; k < count; k++) {
      const i = (a + k) % n;
      const along = (dist[i] - dist[a] + loopLength) % loopLength;
      const weight = smoothstep(0, zone.rampMeters, along) * smoothstep(0, zone.rampMeters, zoneLength - along);
      const current = result[i].widthLeft + result[i].widthRight;
      before = Math.min(before, current);
      const target = current + (zone.totalWidth - current) * weight;
      const scale = target / current;
      result[i].widthLeft *= scale;
      result[i].widthRight *= scale;
    }
    notes.push(
      `Width zone "${zone.name}": rows ${zone.fromRow}-${zone.toRow} (${zoneLength.toFixed(0)} m) set to ` +
        `${zone.totalWidth} m (was down to ${before.toFixed(1)} m).`,
    );
  }

  return { samples: result, originalWidths, notes };
}