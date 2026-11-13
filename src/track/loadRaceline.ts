/**
 * Loads the racing line from src/tracks/monza-raceline.csv, if that file exists.
 *
 * monza.csv does not contain a racing line, so nothing is drawn or driven unless you add the file
 * yourself: the TUM database provides it as racelines/Monza.csv (columns x_m,y_m, same coordinate
 * frame as tracks/Monza.csv). Rename it to monza-raceline.csv and put it next to monza.csv.
 * Used by the autodrive mode and by the debug overlay.
 *
 * Nothing here is invented or substituted: if the file is missing or unreadable, there is simply
 * no racing line, and the game says why.
 */

export interface Raceline {
  /** Points in world coordinates (same conversion as the road). */
  points: { x: number; z: number }[];
  rows: number;
}

export interface RacelineResult {
  raceline: Raceline | null;
  /** Short explanation shown in the overlay. */
  message: string;
}

// import.meta.glob returns an empty object when the file does not exist (no build error).
const files = import.meta.glob<string>('../tracks/monza-raceline.csv', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export function loadMonzaRaceline(centre: { x: number; y: number }): RacelineResult {
  const text = Object.values(files)[0];
  if (text === undefined) {
    return {
      raceline: null,
      message: 'not loaded - add the TUM racelines/Monza.csv as src/tracks/monza-raceline.csv',
    };
  }

  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  let xColumn = 0;
  let yColumn = 1;
  const points: { x: number; z: number }[] = [];
  let firstLine = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;
    const delimiter = line.includes(';') ? ';' : ',';
    const parts = line.split(delimiter).map((part) => part.trim());

    const mayBeHeader = firstLine;
    firstLine = false;
    if (line.startsWith('#') || (mayBeHeader && /[a-z]/i.test(line))) {
      // Header line: find the x_m / y_m columns by name.
      const names = line.replace(/^#/, '').split(delimiter).map((part) => part.trim().toLowerCase());
      const xi = names.indexOf('x_m');
      const yi = names.indexOf('y_m');
      if (xi >= 0 && yi >= 0) {
        xColumn = xi;
        yColumn = yi;
      }
      continue;
    }

    const x = Number(parts[xColumn]);
    const y = Number(parts[yColumn]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return { raceline: null, message: `ignored - line ${i + 1} has a missing or non-numeric x_m / y_m value` };
    }
    // Same conversion as the road: world.x = x_m - centreX, world.z = -(y_m - centreY)
    points.push({ x: x - centre.x, z: -(y - centre.y) });
  }

  if (points.length < 20) {
    return { raceline: null, message: `ignored - only ${points.length} usable rows found` };
  }
  return { raceline: { points, rows: points.length }, message: 'loaded from src/tracks/monza-raceline.csv' };
}