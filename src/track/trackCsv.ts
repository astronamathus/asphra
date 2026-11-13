import { CIRCUIT } from '../config';

/** Thrown when the supplied track data is missing, malformed or unsuitable for road generation. */
export class TrackDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrackDataError';
  }
}

/** One row of the source file, in the file's own coordinate system (metres). */
export interface TrackSample {
  x: number;
  y: number;
  /** Distance from the centerline to the right road edge (m), looking in the direction of the rows. */
  widthRight: number;
  /** Distance from the centerline to the left road edge (m), looking in the direction of the rows. */
  widthLeft: number;
}

export interface ParsedTrackCsv {
  samples: TrackSample[];
  /** Human-readable remarks about what was found / adjusted while reading. */
  notes: string[];
}

/** Column names of the TUM racetrack-database format (https://github.com/TUMFTM/racetrack-database). */
const REQUIRED_COLUMNS = ['x_m', 'y_m', 'w_tr_right_m', 'w_tr_left_m'];

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function wrapAngle(a: number): number {
  let r = a;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return r;
}

/**
 * Reads a closed-circuit CSV in the TUM format: a header line (optionally starting with '#')
 * naming the columns x_m, y_m, w_tr_right_m, w_tr_left_m, followed by one row per centerline
 * sample in driving order. Every problem is reported as a TrackDataError with the file name
 * and the line number, so a bad file stops the game with a clear message.
 */
export function parseAndValidateTrackCsv(text: string, sourceName: string): ParsedTrackCsv {
  const notes: string[] = [];
  const fail = (message: string): never => {
    throw new TrackDataError(`${sourceName}: ${message}`);
  };

  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);

  // --- Header ---
  let headerLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== '') {
      headerLine = i;
      break;
    }
  }
  if (headerLine < 0) fail('the file is empty.');

  const headerNames = lines[headerLine]
    .replace(/^\s*#/, '')
    .split(',')
    .map((name) => name.trim().toLowerCase());
  const columnIndex: number[] = [];
  for (const required of REQUIRED_COLUMNS) {
    const index = headerNames.indexOf(required);
    if (index < 0) {
      fail(
        `unsupported header "${lines[headerLine].trim()}". Expected the columns ` +
          `${REQUIRED_COLUMNS.join(', ')} (TUM racetrack-database format).`,
      );
    }
    columnIndex.push(index);
  }

  // --- Rows ---
  const samples: TrackSample[] = [];
  const lineNumbers: number[] = []; // 1-based line number of every sample, for error messages
  for (let i = headerLine + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '' || line.startsWith('#')) continue;

    const parts = line.split(',');
    if (parts.length !== headerNames.length) {
      fail(`line ${i + 1}: expected ${headerNames.length} columns but found ${parts.length}.`);
    }
    const values = columnIndex.map((index) => {
      const text = parts[index].trim();
      return text === '' ? Number.NaN : Number(text);
    });
    if (!values.every((v) => Number.isFinite(v))) {
      fail(`line ${i + 1}: contains a missing or non-numeric value ("${line}").`);
    }
    samples.push({ x: values[0], y: values[1], widthRight: values[2], widthLeft: values[3] });
    lineNumbers.push(i + 1);
  }

  if (samples.length < CIRCUIT.minRows) {
    fail(`only ${samples.length} data rows found; at least ${CIRCUIT.minRows} are needed to describe a circuit.`);
  }

  // A closing row that repeats the first row would create a zero-length segment; drop it.
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (Math.hypot(last.x - first.x, last.y - first.y) < 1e-3) {
    samples.pop();
    lineNumbers.pop();
    notes.push('The last row repeated the first row (explicit closing point); it was ignored.');
  }

  // --- Widths ---
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    for (const [label, w] of [
      ['w_tr_right_m', s.widthRight],
      ['w_tr_left_m', s.widthLeft],
    ] as const) {
      if (w < CIRCUIT.minWidth || w > CIRCUIT.maxWidth) {
        fail(
          `line ${lineNumbers[i]}: ${label} = ${w} is outside the accepted range ` +
            `${CIRCUIT.minWidth}..${CIRCUIT.maxWidth} m.`,
        );
      }
    }
  }

  // --- Spacing (also catches duplicates, outliers and non-metric units) ---
  const n = samples.length;
  const spacing: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = samples[i];
    const b = samples[(i + 1) % n];
    spacing.push(Math.hypot(b.x - a.x, b.y - a.y));
  }
  const medianSpacing = median(spacing);
  for (let i = 0; i < n - 1; i++) {
    if (spacing[i] < CIRCUIT.minSampleSpacing) {
      fail(`line ${lineNumbers[i]}: duplicate or near-duplicate point (${spacing[i].toFixed(4)} m to the next row).`);
    }
    if (spacing[i] > CIRCUIT.maxSampleSpacing) {
      fail(
        `line ${lineNumbers[i]}: gap of ${spacing[i].toFixed(1)} m to the next row exceeds ` +
          `${CIRCUIT.maxSampleSpacing} m. The data is too sparse, has an outlier, or is not in metres.`,
      );
    }
  }

  // --- Closure: the loop must come back to its start ---
  const closingGap = spacing[n - 1];
  if (closingGap > CIRCUIT.closureToleranceFactor * medianSpacing) {
    fail(
      `the circuit is not closed: the last row is ${closingGap.toFixed(1)} m from the first row ` +
        `(typical spacing is ${medianSpacing.toFixed(1)} m).`,
    );
  }

  // --- Direction changes (catches sharp spikes / wrong ordering) ---
  const maxStep = (CIRCUIT.maxHeadingStepDeg * Math.PI) / 180;
  for (let i = 0; i < n; i++) {
    const p = samples[(i - 1 + n) % n];
    const c = samples[i];
    const q = samples[(i + 1) % n];
    const before = Math.atan2(c.y - p.y, c.x - p.x);
    const after = Math.atan2(q.y - c.y, q.x - c.x);
    if (Math.abs(wrapAngle(after - before)) > maxStep) {
      fail(
        `line ${lineNumbers[i]}: the direction changes by more than ${CIRCUIT.maxHeadingStepDeg} degrees ` +
          'at this point. The row order may be wrong or the data too coarse for this corner.',
      );
    }
  }

  notes.push(
    `${n} rows, median spacing ${medianSpacing.toFixed(2)} m, closing gap ${closingGap.toFixed(2)} m ` +
      '(treated as a closed loop).',
  );
  return { samples, notes };
}