/**
 * Loads the optional reference lap from src/tracks/monza-reference-lap.csv.
 *
 * The file holds the real telemetry of Max Verstappen's 2025 Italian GP qualifying lap, digitised from
 * the f1tel.com / TracingInsights chart images (see src/tracks/README.md). Columns:
 * distance_m, speed_kmh, throttle_pct, brake (0/1), gear. Autodrive uses the speed column as its
 * target pace wherever the game's car can match it. Without the file, autodrive plans its own speed.
 */

import type { ReferenceLap } from './referenceLap';

export interface ReferenceLapResult {
  lap: ReferenceLap | null;
  message: string;
}

const files = import.meta.glob<string>('../tracks/monza-reference-lap.csv', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export function loadMonzaReferenceLap(): ReferenceLapResult {
  const text = Object.values(files)[0];
  if (text === undefined) {
    return { lap: null, message: 'not loaded - add src/tracks/monza-reference-lap.csv' };
  }

  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const rows: number[][] = [];
  let columns = ['distance_m', 'speed_kmh', 'throttle_pct', 'brake', 'gear'];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;
    if (line.startsWith('#')) {
      columns = line.replace(/^#/, '').split(',').map((name) => name.trim().toLowerCase());
      continue;
    }
    const values = line.split(',').map(Number);
    if (values.length < columns.length || !values.every((v) => Number.isFinite(v))) {
      return { lap: null, message: `ignored - line ${i + 1} is not numeric` };
    }
    rows.push(values);
  }

  const col = (name: string): number => columns.indexOf(name);
  const iDist = col('distance_m');
  const iSpeed = col('speed_kmh');
  if (iDist < 0 || iSpeed < 0 || rows.length < 50) {
    return { lap: null, message: 'ignored - needs distance_m and speed_kmh columns and at least 50 rows' };
  }
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][iDist] <= rows[i - 1][iDist]) return { lap: null, message: `ignored - distance does not increase at row ${i + 1}` };
  }

  const pick = (index: number): Float64Array => Float64Array.from(rows.map((r) => (index >= 0 ? r[index] : 0)));
  const distance = pick(iDist);
  return {
    lap: {
      distance,
      speedKmh: pick(iSpeed),
      throttle: pick(col('throttle_pct')),
      brake: pick(col('brake')),
      gear: pick(col('gear')),
      totalDistance: distance[distance.length - 1],
    },
    message: 'loaded from src/tracks/monza-reference-lap.csv',
  };
}