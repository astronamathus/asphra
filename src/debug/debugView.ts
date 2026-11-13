/**
 * TEMPORARY debug overlay: a top-down, true-scale map of the track for checking how accurately
 * the CSV data is turned into a road. To remove it: delete this folder (src/debug) and the
 * three lines marked "TEMPORARY" in main.ts.
 *
 * Keys (only while the overlay is visible; the game keeps running underneath):
 *   V  cycle  off -> full screen -> small corner map -> off
 *   F  follow the car      G  fit the whole circuit      +/- or mouse wheel  zoom
 *   drag with the mouse to pan      click the width chart to jump to that point of the lap
 *   P  save a PNG of the overlay
 *   1 CSV centerline + rows   2 generated road edges   3 raceline   4 car footprint
 *   5 road fill   6 width ticks (coloured by total width)   7 row labels   8 grid
 *   9 interpolated points
 *
 * The map is north-up and uses the same scale on both axes, so distances can be measured
 * directly. Grid labels are in CSV coordinates (x_m, y_m), so they can be compared with the
 * rows of monza.csv.
 */
import { CAR_SIZE } from '../config';
import { pointAtDistance } from '../track/trackGeometry';
import type { RoadTrack, VehicleState } from '../types';
import type { RacelineResult } from '../track/loadRaceline';

export interface DebugView {
  /** autoText: one-line autodrive status shown in the readout (empty = none). */
  update(state: VehicleState, autoText?: string): void;
  dispose(): void;
}

type Mode = 'off' | 'full' | 'inset';
type ViewMode = 'follow' | 'fit' | 'free';

/** Car size in metres, from the shared CAR_SIZE setting (x = sideways, z = along the car). */
const CAR = {
  length: CAR_SIZE.length,
  width: CAR_SIZE.width,
  wheelX: CAR_SIZE.wheelX,
  wheelZ: CAR_SIZE.wheelZ,
  wheelW: CAR_SIZE.wheelWidth,
  wheelD: CAR_SIZE.wheelRadius * 2,
};
const CHART_HEIGHT = 170;
const INSET_SIZE = 440;
const CHART_RANGE = 8; // chart shows +/- this many metres from the centerline

const COLORS = {
  background: '#0f1318',
  grid: 'rgba(255,255,255,0.09)',
  gridText: 'rgba(255,255,255,0.45)',
  fill: 'rgba(130,140,150,0.30)',
  csv: '#ffd23f',
  left: '#4aa3ff',
  right: '#ff5d5d',
  raceline: '#3cff9a',
  car: '#ffffff',
  resampled: 'rgba(255,255,255,0.35)',
};

const LAYERS = [
  { key: 'csv', code: 'Digit1', label: 'CSV centerline + rows', color: COLORS.csv },
  { key: 'edges', code: 'Digit2', label: 'generated road edges (L blue / R red)', color: COLORS.left },
  { key: 'raceline', code: 'Digit3', label: 'raceline', color: COLORS.raceline },
  { key: 'car', code: 'Digit4', label: 'car footprint', color: COLORS.car },
  { key: 'fill', code: 'Digit5', label: 'road fill', color: '#8c96a0' },
  { key: 'ticks', code: 'Digit6', label: 'width ticks (colour = total width)', color: '#ff9b3d' },
  { key: 'labels', code: 'Digit7', label: 'row labels', color: '#cfd8e3' },
  { key: 'grid', code: 'Digit8', label: 'grid (CSV coordinates)', color: '#6d7a88' },
  { key: 'resampled', code: 'Digit9', label: 'interpolated points', color: '#b9c3cf' },
] as const;
type LayerKey = (typeof LAYERS)[number]['key'];

export function createDebugView(container: HTMLElement, track: RoadTrack, raceInfo: RacelineResult): DebugView {
  const { centerline: c, source, centre } = track.debug;
  const n = c.count;
  const lap = c.lapLength;

  // ---------- Precomputed geometry ----------
  const leftX = new Float64Array(n);
  const leftZ = new Float64Array(n);
  const rightX = new Float64Array(n);
  const rightZ = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    leftX[i] = c.x[i] + c.tz[i] * c.widthLeft[i];
    leftZ[i] = c.z[i] - c.tx[i] * c.widthLeft[i];
    rightX[i] = c.x[i] - c.tz[i] * c.widthRight[i];
    rightZ[i] = c.z[i] + c.tx[i] * c.widthRight[i];
  }
  const srcX = Float64Array.from(source.map((s) => s.x));
  const srcZ = Float64Array.from(source.map((s) => s.z));
  const srcCount = source.length;

  // Whole-lap width statistics
  let minW = Infinity;
  let maxW = 0;
  let minAt = 0;
  let maxAt = 0;
  let sumW = 0;
  let maxAsym = 0;
  for (let i = 0; i < n; i++) {
    const w = c.widthLeft[i] + c.widthRight[i];
    sumW += w;
    if (w < minW) {
      minW = w;
      minAt = c.s[i];
    }
    if (w > maxW) {
      maxW = w;
      maxAt = c.s[i];
    }
    maxAsym = Math.max(maxAsym, Math.abs(c.widthLeft[i] - c.widthRight[i]));
  }
  const meanW = sumW / n;

  // Raceline (optional): position along the lap and sideways offset of each point
  const racePts = raceInfo.raceline?.points ?? [];
  const raceX = new Float64Array(racePts.length);
  const raceZ = new Float64Array(racePts.length);
  const raceS = new Float64Array(racePts.length);
  const raceLat = new Float64Array(racePts.length);
  let raceOutside = 0;
  let raceMinLat = Infinity;
  let raceMaxLat = -Infinity;
  racePts.forEach((p, i) => {
    const hit = track.nearest(p.x, p.z);
    raceX[i] = p.x;
    raceZ[i] = p.z;
    raceS[i] = hit.s;
    raceLat[i] = hit.lateralOffset;
    const margin = hit.lateralOffset >= 0 ? hit.widthLeft - hit.lateralOffset : hit.widthRight + hit.lateralOffset;
    if (margin < -0.05) raceOutside++;
    raceMinLat = Math.min(raceMinLat, hit.lateralOffset);
    raceMaxLat = Math.max(raceMaxLat, hit.lateralOffset);
  });

  // Driving-direction arrows every 250 m
  const arrows: { x: number; z: number; heading: number }[] = [];
  for (let d = 0; d < lap; d += 250) arrows.push(pointAtDistance(c, d));

  // Bounding box of the road edges (for "fit")
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    for (const [x, z] of [
      [leftX[i], leftZ[i]],
      [rightX[i], rightZ[i]],
    ]) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
  }

  // ---------- Canvas and state ----------
  const canvas = document.createElement('canvas');
  canvas.style.display = 'none';
  canvas.style.touchAction = 'none';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Debug overlay: 2D canvas is not available in this browser.');

  let mode: Mode = 'off';
  let viewMode: ViewMode = 'follow';
  const view = { cx: 0, cz: 0, scale: 1.2 }; // world point at the centre of the map, pixels per metre
  const layers: Record<LayerKey, boolean> = {
    csv: true,
    edges: true,
    raceline: true,
    car: true,
    fill: true,
    ticks: true,
    labels: true,
    grid: true,
    resampled: false,
  };
  let width = 0; // canvas size in CSS pixels
  let height = 0;
  let lastState: VehicleState | null = null;
  let lastAutoText = '';
  const mouse = { x: -1, y: -1, inside: false };
  let dragging = false;
  let dragMoved = false;

  const hasChart = (): boolean => mode === 'full';
  const mapHeight = (): number => height - (hasChart() ? CHART_HEIGHT : 0);

  function layout(): void {
    const full = mode === 'full';
    width = full ? container.clientWidth : INSET_SIZE;
    height = full ? container.clientHeight : INSET_SIZE;
    canvas.style.cssText = full
      ? 'position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:crosshair'
      : `position:absolute;right:16px;top:16px;width:${INSET_SIZE}px;height:${INSET_SIZE}px;` +
        'border:2px solid #fff;border-radius:8px;touch-action:none;cursor:crosshair';
    canvas.style.display = mode === 'off' ? 'none' : 'block';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function fitView(): void {
    const availableHeight = mapHeight();
    const scale = Math.min((width - 60) / (maxX - minX), (availableHeight - 60) / (maxZ - minZ));
    view.scale = scale;
    view.cx = (minX + maxX) / 2;
    view.cz = (minZ + maxZ) / 2;
  }

  function followCar(): void {
    if (!lastState) return;
    view.cx = lastState.x;
    view.cz = lastState.z;
  }

  function setViewMode(next: ViewMode): void {
    viewMode = next;
    if (next === 'fit') fitView();
    if (next === 'follow') followCar();
  }

  // ---------- Helpers ----------
  const sx = (x: number): number => (x - view.cx) * view.scale + width / 2;
  const sy = (z: number): number => (z - view.cz) * view.scale + mapHeight() / 2;
  const worldX = (px: number): number => view.cx + (px - width / 2) / view.scale;
  const worldZ = (py: number): number => view.cz + (py - mapHeight() / 2) / view.scale;
  const fmt = (v: number, digits = 1): string => (v >= 0 ? '+' : '') + v.toFixed(digits);

  function polyline(xs: ArrayLike<number>, zs: ArrayLike<number>, count: number, close: boolean): void {
    if (!ctx || count === 0) return;
    ctx.moveTo(sx(xs[0]), sy(zs[0]));
    for (let i = 1; i < count; i++) ctx.lineTo(sx(xs[i]), sy(zs[i]));
    if (close) ctx.closePath();
  }

  function text(str: string, x: number, y: number, color: string, size = 12, align: CanvasTextAlign = 'left'): void {
    if (!ctx) return;
    ctx.font = `${size}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(str, x, y);
  }

  function carCorners(state: VehicleState, halfWidth: number, halfLength: number): [number, number][] {
    const sinH = Math.sin(state.heading);
    const cosH = Math.cos(state.heading);
    // local x = left (cosH, -sinH), local z = forward (sinH, cosH)
    const at = (lx: number, lz: number): [number, number] => [
      state.x + lx * cosH + lz * sinH,
      state.z - lx * sinH + lz * cosH,
    ];
    return [at(halfWidth, halfLength), at(-halfWidth, halfLength), at(-halfWidth, -halfLength), at(halfWidth, -halfLength)];
  }

  function nearestSourceRow(x: number, z: number): number {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < srcCount; i++) {
      const d = (srcX[i] - x) ** 2 + (srcZ[i] - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  const niceSteps = [5, 10, 20, 50, 100, 200, 500, 1000];

  // ---------- Drawing ----------
  function drawGrid(): void {
    if (!ctx) return;
    const step = niceSteps.find((s) => s * view.scale >= 45) ?? 1000;
    const mh = mapHeight();
    // world <-> CSV: csvX = x + centre.x ; csvY = centre.y - z
    const csvLeft = worldX(0) + centre.x;
    const csvRight = worldX(width) + centre.x;
    const csvTop = centre.y - worldZ(0);
    const csvBottom = centre.y - worldZ(mh);

    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.grid;
    ctx.beginPath();
    for (let X = Math.ceil(csvLeft / step) * step; X <= csvRight; X += step) {
      const px = sx(X - centre.x);
      ctx.moveTo(px, 0);
      ctx.lineTo(px, mh);
    }
    for (let Y = Math.ceil(csvBottom / step) * step; Y <= csvTop; Y += step) {
      const py = sy(centre.y - Y);
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
    }
    ctx.stroke();

    for (let X = Math.ceil(csvLeft / step) * step; X <= csvRight; X += step) {
      text(`x ${X}`, sx(X - centre.x) + 3, 12, COLORS.gridText, 10);
    }
    for (let Y = Math.ceil(csvBottom / step) * step; Y <= csvTop; Y += step) {
      text(`y ${Y}`, 3, sy(centre.y - Y) - 3, COLORS.gridText, 10);
    }
  }

  function drawScaleBar(): void {
    if (!ctx) return;
    const length = niceSteps.find((s) => s * view.scale >= 90) ?? 1000;
    const px = length * view.scale;
    const x0 = 16;
    const y0 = mapHeight() - 18;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0 - 5);
    ctx.lineTo(x0, y0);
    ctx.lineTo(x0 + px, y0);
    ctx.lineTo(x0 + px, y0 - 5);
    ctx.stroke();
    text(`${length} m`, x0 + px / 2, y0 - 8, '#fff', 12, 'center');
  }

  function drawMap(state: VehicleState): void {
    if (!ctx) return;
    const mh = mapHeight();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, mh);
    ctx.clip();
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, mh);

    if (layers.grid) drawGrid();

    if (layers.fill) {
      ctx.beginPath();
      polyline(leftX, leftZ, n, true);
      polyline(rightX, rightZ, n, true);
      ctx.fillStyle = COLORS.fill;
      ctx.fill('evenodd');
    }

    if (layers.ticks) {
      let lo = Infinity;
      let hi = 0;
      for (let k = 0; k < srcCount; k++) {
        const w = source[k].widthLeft + source[k].widthRight;
        lo = Math.min(lo, w);
        hi = Math.max(hi, w);
      }
      ctx.lineWidth = 1.5;
      for (let k = 0; k < srcCount; k++) {
        const i = c.sourceIndex[k];
        const t = (source[k].widthLeft + source[k].widthRight - lo) / Math.max(hi - lo, 1e-6);
        ctx.strokeStyle = `hsl(${220 - 200 * t} 90% 60%)`;
        ctx.beginPath();
        ctx.moveTo(sx(leftX[i]), sy(leftZ[i]));
        ctx.lineTo(sx(rightX[i]), sy(rightZ[i]));
        ctx.stroke();
      }
    }

    if (layers.edges) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = COLORS.left;
      ctx.beginPath();
      polyline(leftX, leftZ, n, true);
      ctx.stroke();
      ctx.strokeStyle = COLORS.right;
      ctx.beginPath();
      polyline(rightX, rightZ, n, true);
      ctx.stroke();
    }

    if (layers.resampled && view.scale >= 1.2) {
      ctx.fillStyle = COLORS.resampled;
      for (let i = 0; i < n; i++) ctx.fillRect(sx(c.x[i]) - 1, sy(c.z[i]) - 1, 2, 2);
    }

    if (layers.csv) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = COLORS.csv;
      ctx.beginPath();
      polyline(srcX, srcZ, srcCount, true);
      ctx.stroke();
      if (view.scale >= 0.9) {
        ctx.fillStyle = COLORS.csv;
        for (let k = 0; k < srcCount; k++) {
          ctx.beginPath();
          ctx.arc(sx(srcX[k]), sy(srcZ[k]), 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // direction arrows
      ctx.fillStyle = COLORS.csv;
      for (const a of arrows) {
        const px = sx(a.x);
        const py = sy(a.z);
        const fx = Math.sin(a.heading);
        const fz = Math.cos(a.heading);
        ctx.beginPath();
        ctx.moveTo(px + fx * 9, py + fz * 9);
        ctx.lineTo(px - fx * 6 + fz * 6, py - fz * 6 - fx * 6);
        ctx.lineTo(px - fx * 6 - fz * 6, py - fz * 6 + fx * 6);
        ctx.closePath();
        ctx.fill();
      }
      // first CSV row (spawn)
      ctx.strokeStyle = '#3cff9a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx(srcX[0]), sy(srcZ[0]), 7, 0, Math.PI * 2);
      ctx.stroke();
      text('CSV row 1 = spawn', sx(srcX[0]) + 11, sy(srcZ[0]) + 4, '#3cff9a', 11);
    }

    if (layers.labels && view.scale >= 0.12) {
      const every = view.scale >= 0.5 ? 10 : view.scale >= 0.25 ? 25 : 50;
      for (let k = 0; k < srcCount; k += every) {
        const i = c.sourceIndex[k];
        text(`#${k + 1}`, sx(source[k].x) + 4, sy(source[k].z) - 4, 'rgba(255,255,255,0.8)', 10);
        if (view.scale >= 0.5) text(`${c.s[i].toFixed(0)}m`, sx(source[k].x) + 4, sy(source[k].z) + 8, 'rgba(255,255,255,0.45)', 9);
      }
    }

    if (layers.raceline && racePts.length > 0) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = COLORS.raceline;
      ctx.beginPath();
      polyline(raceX, raceZ, racePts.length, true);
      ctx.stroke();
    }

    if (layers.car) {
      const body = carCorners(state, CAR.width / 2, CAR.length / 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = COLORS.car;
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.moveTo(sx(body[0][0]), sy(body[0][1]));
      for (let i = 1; i < 4; i++) ctx.lineTo(sx(body[i][0]), sy(body[i][1]));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // wheels
      ctx.fillStyle = '#111';
      for (const [wx, wz] of [
        [CAR.wheelX, CAR.wheelZ],
        [-CAR.wheelX, CAR.wheelZ],
        [CAR.wheelX, -CAR.wheelZ],
        [-CAR.wheelX, -CAR.wheelZ],
      ]) {
        const corners = carCorners(
          { ...state, x: state.x + wx * Math.cos(state.heading) + wz * Math.sin(state.heading), z: state.z - wx * Math.sin(state.heading) + wz * Math.cos(state.heading) },
          CAR.wheelW / 2,
          CAR.wheelD / 2,
        );
        ctx.beginPath();
        ctx.moveTo(sx(corners[0][0]), sy(corners[0][1]));
        for (let i = 1; i < 4; i++) ctx.lineTo(sx(corners[i][0]), sy(corners[i][1]));
        ctx.closePath();
        ctx.fill();
      }
      // nose marker (front of the car)
      const nose = carCorners(state, 0, CAR.length / 2 + 1.2)[0];
      ctx.strokeStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(sx(state.x), sy(state.z));
      ctx.lineTo(sx(nose[0]), sy(nose[1]));
      ctx.stroke();
      // keep the car visible when zoomed far out
      if (view.scale < 1.2) {
        ctx.fillStyle = COLORS.car;
        ctx.beginPath();
        ctx.arc(sx(state.x), sy(state.z), 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawScaleBar();
    ctx.restore();
  }

  function drawChart(state: VehicleState): void {
    if (!ctx || !hasChart()) return;
    const top = height - CHART_HEIGHT;
    const left = 52;
    const right = 14;
    const plotTop = top + 22;
    const plotBottom = height - 20;
    const plotW = width - left - right;
    const base = (plotTop + plotBottom) / 2;
    const kY = (plotBottom - plotTop) / 2 / CHART_RANGE; // px per metre
    const xs = (s: number): number => left + (s / lap) * plotW;

    ctx.fillStyle = 'rgba(10,14,18,0.94)';
    ctx.fillRect(0, top, width, CHART_HEIGHT);
    text('ROAD WIDTH vs DISTANCE  (blue/red = left/right half-width used, dashed = original CSV widths, green = raceline, white = car)', left, top + 14, '#cfd8e3', 11);

    // horizontal grid
    ctx.lineWidth = 1;
    for (let m = -CHART_RANGE; m <= CHART_RANGE; m += 2) {
      const y = base - m * kY;
      ctx.strokeStyle = m === 0 ? 'rgba(255,255,255,0.5)' : COLORS.grid;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + plotW, y);
      ctx.stroke();
      text(`${m > 0 ? '+' : ''}${m} m`, left - 6, y + 4, COLORS.gridText, 10, 'right');
    }
    for (let s = 0; s <= lap; s += 500) {
      const x = xs(s);
      ctx.strokeStyle = COLORS.grid;
      ctx.beginPath();
      ctx.moveTo(x, plotTop);
      ctx.lineTo(x, plotBottom);
      ctx.stroke();
      text(`${s}`, x, height - 6, COLORS.gridText, 10, 'center');
    }
    text('s (m)', left + plotW, height - 6, COLORS.gridText, 10, 'right');

    // left / right half-width areas
    for (const side of ['left', 'right'] as const) {
      const sign = side === 'left' ? 1 : -1;
      const widths = side === 'left' ? c.widthLeft : c.widthRight;
      ctx.beginPath();
      ctx.moveTo(xs(0), base);
      for (let i = 0; i < n; i++) ctx.lineTo(xs(c.s[i]), base - sign * Math.min(widths[i], CHART_RANGE) * kY);
      ctx.lineTo(xs(lap), base);
      ctx.closePath();
      ctx.fillStyle = side === 'left' ? 'rgba(74,163,255,0.30)' : 'rgba(255,93,93,0.30)';
      ctx.fill();
      ctx.strokeStyle = side === 'left' ? COLORS.left : COLORS.right;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // the CSV's own widths (before width zones), dashed, so changes are easy to see
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    for (const sign of [1, -1]) {
      ctx.beginPath();
      for (let k = 0; k < srcCount; k++) {
        const w = sign === 1 ? track.debug.originalWidths[k].widthLeft : track.debug.originalWidths[k].widthRight;
        const x = xs(c.s[c.sourceIndex[k]]);
        const y = base - sign * Math.min(w, CHART_RANGE) * kY;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // raceline offset
    if (layers.raceline && racePts.length > 0) {
      ctx.strokeStyle = COLORS.raceline;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < racePts.length; i++) {
        const x = xs(raceS[i]);
        const y = base - Math.max(-CHART_RANGE, Math.min(CHART_RANGE, raceLat[i])) * kY;
        if (i === 0 || Math.abs(raceS[i] - raceS[i - 1]) > lap / 2) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // car marker: its position across the road, and its width as a vertical bar
    const hit = track.nearest(state.x, state.z);
    const cx = xs(hit.s);
    const cy = base - hit.lateralOffset * kY;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(cx, plotTop);
    ctx.lineTo(cx, plotBottom);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - 2, cy - (CAR.width / 2) * kY, 4, CAR.width * kY);

    // hover
    if (mouse.inside && mouse.y >= top && mouse.x >= left && mouse.x <= left + plotW) {
      const s = ((mouse.x - left) / plotW) * lap;
      const p = pointAtDistance(c, s);
      const h = track.nearest(p.x, p.z);
      ctx.strokeStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(mouse.x, plotTop);
      ctx.lineTo(mouse.x, plotBottom);
      ctx.stroke();
      const label = `s=${s.toFixed(0)} m  L ${h.widthLeft.toFixed(2)} + R ${h.widthRight.toFixed(2)} = ${(h.widthLeft + h.widthRight).toFixed(2)} m  (click to go there)`;
      text(label, Math.min(mouse.x + 8, width - 520), plotTop + 12, '#ffd23f', 11);
    }
  }

  function drawBox(lines: { t: string; c: string }[], x: number, y: number, boxWidth: number, size: number): void {
    if (!ctx) return;
    const lineHeight = size + 3;
    ctx.fillStyle = 'rgba(8,10,14,0.72)';
    ctx.fillRect(x, y, boxWidth, lines.length * lineHeight + 8);
    lines.forEach((line, i) => text(line.t, x + 6, y + 6 + size + i * lineHeight, line.c, size));
  }

  function drawPanel(state: VehicleState): void {
    if (!ctx) return;
    const compact = mode === 'inset';
    const hit = track.nearest(state.x, state.z);
    const total = hit.widthLeft + hit.widthRight;

    // clearance of the car's four body corners to each road edge
    let clearLeft = Infinity;
    let clearRight = Infinity;
    for (const [x, z] of carCorners(state, CAR.width / 2, CAR.length / 2)) {
      const h = track.nearest(x, z);
      clearLeft = Math.min(clearLeft, h.widthLeft - h.lateralOffset);
      clearRight = Math.min(clearRight, h.widthRight + h.lateralOffset);
    }
    const row = nearestSourceRow(state.x, state.z);
    const off = clearLeft < 0 || clearRight < 0;

    const readout: { t: string; c: string }[] = [
      { t: `CAR  s=${hit.s.toFixed(0)} m (${((hit.s / lap) * 100).toFixed(0)}%)  offset ${fmt(hit.lateralOffset)} m  CSV row #${row + 1}`, c: '#fff' },
      { t: `road L ${hit.widthLeft.toFixed(2)} + R ${hit.widthRight.toFixed(2)} = ${total.toFixed(2)} m`, c: '#fff' },
      { t: `car ${CAR.width} m wide = ${((CAR.width / total) * 100).toFixed(0)}% of the road`, c: '#fff' },
      { t: `clearance to edge: L ${clearLeft.toFixed(2)} m  R ${clearRight.toFixed(2)} m${off ? '  OFF ROAD' : ''}`, c: off ? '#ff7b7b' : '#fff' },
    ];

    if (lastAutoText) readout.push({ t: `AUTODRIVE ${lastAutoText}`, c: '#7dffb0' });

    if (compact) {
      drawBox(
        [{ t: `scale 1 px = ${(1 / view.scale).toFixed(2)} m, north up  [V] next view`, c: '#9fb0c0' }, ...readout],
        8,
        8,
        width - 16,
        10,
      );
      return;
    }

    // left box: controls and layers
    const legend: { t: string; c: string }[] = [
      { t: `TOP-DOWN DEBUG   1 px = ${(1 / view.scale).toFixed(2)} m (north up)`, c: '#fff' },
      { t: `view: ${viewMode}   [V] view [F] follow [G] fit`, c: '#9fb0c0' },
      { t: '[+/-/wheel] zoom  [drag] pan  [P] save PNG', c: '#9fb0c0' },
      ...LAYERS.map((layer) => ({
        t: `[${layer.code.slice(5)}] ${layers[layer.key] ? '[x]' : '[ ]'} ${layer.label}`,
        c: layers[layer.key] ? layer.color : '#5b6671',
      })),
    ];
    drawBox(legend, 8, 8, 350, 12);

    // right box: measurements
    const right: { t: string; c: string }[] = [
      ...readout,
      { t: `LAP width: min ${minW.toFixed(1)} m @ s=${minAt.toFixed(0)}  max ${maxW.toFixed(1)} m @ s=${maxAt.toFixed(0)}`, c: '#cfd8e3' },
      { t: `          mean ${meanW.toFixed(1)} m   max |L-R| ${maxAsym.toFixed(2)} m`, c: '#cfd8e3' },
      racePts.length > 0
        ? { t: `RACELINE ${racePts.length} pts, offset ${fmt(raceMinLat)}..${fmt(raceMaxLat)} m, outside edges: ${raceOutside}`, c: COLORS.raceline }
        : { t: `RACELINE ${raceInfo.message}`, c: '#ffb86b' },
    ];
    if (mouse.inside && mouse.y < mapHeight()) {
      const wx = worldX(mouse.x);
      const wz = worldZ(mouse.y);
      const h = track.nearest(wx, wz);
      const r = nearestSourceRow(wx, wz);
      right.push({ t: `HOVER csv (x_m,y_m)=(${(wx + centre.x).toFixed(1)}, ${(centre.y - wz).toFixed(1)})  row #${r + 1}`, c: '#ffd23f' });
      right.push({ t: `      s=${h.s.toFixed(0)} m  offset ${fmt(h.lateralOffset)} m  L ${h.widthLeft.toFixed(2)}  R ${h.widthRight.toFixed(2)}`, c: '#ffd23f' });
    }
    const boxWidth = 600;
    const boxHeight = right.length * 15 + 8;
    drawBox(right, width - boxWidth - 8, mapHeight() - boxHeight - 8, boxWidth, 12);
  }

  function draw(): void {
    if (mode === 'off' || !ctx || !lastState) return;
    if (viewMode === 'follow') followCar();
    drawMap(lastState);
    drawChart(lastState);
    drawPanel(lastState);
  }

  // ---------- Input ----------
  function setMode(next: Mode): void {
    mode = next;
    layout();
    if (mode !== 'off') {
      if (viewMode === 'fit') fitView();
      draw();
    }
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'KeyV') {
      setMode(mode === 'off' ? 'full' : mode === 'full' ? 'inset' : 'off');
      return;
    }
    if (mode === 'off') return;

    const layer = LAYERS.find((l) => l.code === event.code);
    if (layer) {
      layers[layer.key] = !layers[layer.key];
    } else if (event.code === 'KeyF') {
      setViewMode('follow');
    } else if (event.code === 'KeyG') {
      setViewMode('fit');
    } else if (event.code === 'Equal' || event.code === 'NumpadAdd') {
      view.scale = Math.min(40, view.scale * 1.25);
    } else if (event.code === 'Minus' || event.code === 'NumpadSubtract') {
      view.scale = Math.max(0.04, view.scale / 1.25);
    } else if (event.code === 'KeyP') {
      draw();
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `monza-debug-s${Math.round(track.nearest(lastState?.x ?? 0, lastState?.z ?? 0).s)}.png`;
        link.click();
        URL.revokeObjectURL(url);
      });
    } else {
      return;
    }
    draw();
  };

  const pointer = (event: { clientX: number; clientY: number }): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event: PointerEvent): void => {
    const p = pointer(event);
    dragging = true;
    dragMoved = false;
    mouse.x = p.x;
    mouse.y = p.y;
    canvas.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent): void => {
    const p = pointer(event);
    if (dragging && p.y < mapHeight()) {
      const dx = p.x - mouse.x;
      const dy = p.y - mouse.y;
      if (Math.abs(dx) + Math.abs(dy) > 0) dragMoved = true;
      if (dragMoved) {
        viewMode = 'free';
        view.cx -= dx / view.scale;
        view.cz -= dy / view.scale;
      }
    }
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.inside = true;
    draw();
  };

  const onPointerUp = (event: PointerEvent): void => {
    const p = pointer(event);
    // a click (not a drag) on the width chart moves the map to that point of the lap
    if (dragging && !dragMoved && hasChart() && p.y >= height - CHART_HEIGHT) {
      const left = 52;
      const plotW = width - left - 14;
      const s = Math.max(0, Math.min(lap, ((p.x - left) / plotW) * lap));
      const target = pointAtDistance(c, s);
      viewMode = 'free';
      view.cx = target.x;
      view.cz = target.z;
    }
    dragging = false;
    canvas.releasePointerCapture(event.pointerId);
    draw();
  };

  const onPointerLeave = (): void => {
    mouse.inside = false;
    draw();
  };

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const p = pointer(event);
    const factor = Math.exp(-event.deltaY * 0.0015);
    const newScale = Math.min(40, Math.max(0.04, view.scale * factor));
    if (viewMode !== 'follow') {
      // keep the point under the cursor fixed while zooming
      const wx = worldX(p.x);
      const wz = worldZ(p.y);
      view.scale = newScale;
      view.cx = wx - (p.x - width / 2) / newScale;
      view.cz = wz - (p.y - mapHeight() / 2) / newScale;
      viewMode = 'free';
    } else {
      view.scale = newScale;
    }
    draw();
  };

  const onResize = (): void => {
    if (mode === 'off') return;
    layout();
    if (viewMode === 'fit') fitView();
    draw();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onResize);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  return {
    update(state: VehicleState, autoText = ''): void {
      lastState = state;
      lastAutoText = autoText;
      if (mode !== 'off') draw();
    },
    dispose(): void {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.remove();
    },
  };
}