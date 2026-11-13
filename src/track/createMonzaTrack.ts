import type { RoadTrack } from '../types';
// Vite's "?raw" suffix bundles the file's text into the app, so there is no runtime fetch and a
// missing file stops the build/dev server with a clear "failed to resolve import" error.
import monzaCsv from '../tracks/monza.csv?raw';
import { parseAndValidateTrackCsv } from './trackCsv';
import { parseTracedWidths } from './tracedWidths';
import { createTrackFromCsv } from './trackLoader';

// Optional: widths measured from road edges traced on satellite imagery (made by tools/kml-to-widths.ts).
// import.meta.glob gives an empty object when the file does not exist, and the CSV's own widths are used.
const tracedWidthFiles = import.meta.glob<string>('../tracks/monza-widths.csv', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Monza, built from src/tracks/monza.csv (see src/tracks/README.md for provenance and licence). */
export function createMonzaTrack(): RoadTrack {
  const widthsText = Object.values(tracedWidthFiles)[0];
  const traced =
    widthsText === undefined
      ? null
      : parseTracedWidths(widthsText, 'src/tracks/monza-widths.csv', parseAndValidateTrackCsv(monzaCsv, 'src/tracks/monza.csv').samples.length);
  return createTrackFromCsv(monzaCsv, 'src/tracks/monza.csv', 'Monza', traced);
}