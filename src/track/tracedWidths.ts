import { CIRCUIT } from '../config';
import { TrackDataError } from './trackCsv';

/** Road half-widths per CSV row, measured from a traced road-edge polygon pair (see tools/kml-to-widths.ts). */
export interface TracedWidths {
  /** Distance from the CSV centerline to the left road edge, per row (m). */
  left: Float64Array;
  /** Distance from the CSV centerline to the right road edge, per row (m). */
  right: Float64Array;
}

/**
 * Reads monza-widths.csv: comment lines starting with '#', then `row,left_m,right_m` for every row
 * of the track CSV in order. Anything unexpected is a TrackDataError (no silent fallback).
 */
export function parseTracedWidths(text: string, sourceName: string, expectedRows: number): TracedWidths {
  const left: number[] = [];
  const right: number[] = [];
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '' || line.startsWith('#')) continue;
    const parts = line.split(',').map(Number);
    if (parts.length !== 3 || !parts.every((v) => Number.isFinite(v))) {
      throw new TrackDataError(`${sourceName}: line ${i + 1} is not "row,left_m,right_m" with numbers.`);
    }
    if (parts[0] !== left.length + 1) {
      throw new TrackDataError(`${sourceName}: line ${i + 1} has row ${parts[0]} but row ${left.length + 1} was expected.`);
    }
    for (const w of [parts[1], parts[2]]) {
      if (w < CIRCUIT.minWidth || w > CIRCUIT.maxWidth) {
        throw new TrackDataError(`${sourceName}: line ${i + 1} has a width of ${w} m, outside ${CIRCUIT.minWidth}..${CIRCUIT.maxWidth} m.`);
      }
    }
    left.push(parts[1]);
    right.push(parts[2]);
  }
  if (left.length !== expectedRows) {
    throw new TrackDataError(
      `${sourceName}: has ${left.length} rows but the track file has ${expectedRows}. ` +
        'Run `npx tsx tools/kml-to-widths.ts` again after changing monza.csv.',
    );
  }
  return { left: Float64Array.from(left), right: Float64Array.from(right) };
}