import fs from 'node:fs';
import { createTrackFromCsv } from '../track/trackLoader';
import { createVehiclePhysics } from '../car/vehiclePhysics';
import { createAutopilot } from '../car/autopilot';
import { fitRacelineToRoad } from '../track/racelineFit';
import { referenceAt } from '../track/referenceLap';
import type { ReferenceLap } from '../track/referenceLap';
import { AUTODRIVE, CAR_SIZE, VEHICLE, WORLD } from '../config';

console.info = () => {};
const track = createTrackFromCsv(fs.readFileSync('src/tracks/monza.csv', 'utf8'), 'src/tracks/monza.csv', 'Monza');
const c = track.debug.centre;
const pts = fs.readFileSync('src/tracks/monza-raceline.csv', 'utf8').split('\n').filter(l => l && !l.startsWith('#')).map(l => { const [x, y] = l.split(',').map(Number); return { x: x - c.x, z: -(y - c.y) }; });
const rows = fs.readFileSync('src/tracks/monza-reference-lap.csv', 'utf8').split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split(',').map(Number));
const col = (i: number) => Float64Array.from(rows.map(r => r[i]));
const ref: ReferenceLap = { distance: col(0), speedKmh: col(1), throttle: col(2), brake: col(3), gear: col(4), totalDistance: rows[rows.length - 1][0] };
const useRef = process.argv[2] !== 'noref';
const fit = fitRacelineToRoad(pts, track, CAR_SIZE.width / 2 + AUTODRIVE.lineEdgeClearance);
const ap = createAutopilot(fit.points, VEHICLE, useRef ? ref : null);
console.log(`plan (${useRef ? 'real lap as target' : 'game limits only'}): lap ${ap.plan.lapTime.toFixed(1)} s, speed ${(ap.plan.minSpeed * 3.6).toFixed(0)}..${(ap.plan.maxSpeed * 3.6).toFixed(0)} km/h`);
const ph = createVehiclePhysics(VEHICLE); ph.reset(track.start.x, track.start.z, track.start.heading); const st = ph.state;
const dt = 1 / 60; let t = 0, progress = 0, prevS = -1; const L = track.lapLength;
const evts: string[] = []; let inEvt = false; let sqPlan = 0, nPlan = 0; const under: Record<number, number> = {}; const dev: Record<number, number> = {};
let off = 0, maxDev = 0, sumDev = 0, n = 0, bodyOver = 0, maxLat = 0, topKmh = 0; let lapT = -1; let laps = 0;
const rec: { s: number; v: number; refv: number; thr: number; brk: number }[] = []; let sumSq = 0, nSq = 0; let dThr = 0, dBrk = 0, lastThr = 0, lastBrk = 0;
while (t < 400 && laps < 2) {
  const input = ap.compute(st, dt);
  const info0 = ap.info();
  input.drs = ap.isDrsAt(info0.lineS / ap.plan.lapLength) && input.throttle > 0.9 && input.brake < 0.1;
  const onRoad = track.isOnRoad(st.x, st.z, WORLD.roadEdgeTolerance);
  ph.update(dt, input, onRoad); t += dt;
  const n2 = track.nearest(st.x, st.z); const w = n2.lateralOffset >= 0 ? n2.widthLeft : n2.widthRight;
  const v = Math.hypot(st.vx, st.vz) * 3.6; topKmh = Math.max(topKmh, v);
  if (!onRoad) { off++; if (!inEvt) evts.push(`s=${n2.s.toFixed(0)} v=${v.toFixed(0)} km/h`); inEvt = true; } else inEvt = false;
  if (t > 15) { const pv = ap.planSpeedAt(n2.s / L) * 3.6; sqPlan += (v - pv) ** 2; nPlan++; const b = Math.round(n2.s / 100) * 100; under[b] = Math.min(under[b] ?? 0, v - pv); dev[b] = Math.max(dev[b] ?? 0, Math.abs(ap.info().lineOffset)); }
  if (t > 15) { maxDev = Math.max(maxDev, Math.abs(ap.info().lineOffset)); sumDev += Math.abs(ap.info().lineOffset); n++; if (w - Math.abs(n2.lateralOffset) < CAR_SIZE.width / 2) bodyOver++; dThr += Math.abs(input.throttle - lastThr); dBrk += Math.abs(input.brake - lastBrk); }
  lastThr = input.throttle; lastBrk = input.brake;
  maxLat = Math.max(maxLat, Math.abs(st.yawRate * st.longSpeed));
  let ds = n2.s - (prevS < 0 ? n2.s : prevS); if (ds < -L / 2) ds += L; if (ds > L / 2) ds -= L; progress += ds; prevS = n2.s;
  if (progress >= L * (laps + 1)) { laps++; if (laps === 1) lapT = t; }
  if (laps >= 1) { const rv = referenceAt(ref, ref.speedKmh, n2.s / L); sumSq += (v - rv) ** 2; nSq++; rec.push({ s: n2.s, v, refv: rv, thr: input.throttle, brk: input.brake }); }
}
console.log(`FIRST LAP (from standing start at the line, so slower than a flying lap): ${lapT.toFixed(1)} s`);
console.log(`2 laps: off-road frames ${off}; line deviation after 15 s: mean ${(sumDev / n).toFixed(2)} m, max ${maxDev.toFixed(2)} m; body over the road edge in ${(100 * bodyOver / n).toFixed(1)}% of frames; max lateral ${maxLat.toFixed(1)} m/s2 (${(maxLat / 9.81).toFixed(1)} g); top speed ${topKmh.toFixed(0)} km/h`);
console.log(`lap 2 vs the real lap: speed RMS difference ${Math.sqrt(sumSq / nSq).toFixed(1)} km/h (all points after lap 1)`);
console.log(`pedal activity (sum of |changes| per second): throttle ${(dThr / (n / 60)).toFixed(2)}, brake ${(dBrk / (n / 60)).toFixed(2)}`);
// per-corner comparison: minimum speed in lap-2 windows around the real corner minima
const corners: [string, number][] = [['Rettifilo', 950], ['Roggia', 2120], ['Lesmos 1', 2500], ['Lesmos 2', 2830], ['Ascari', 3910], ['Parabolica', 5150]];
for (const [name, d] of corners) {
  const f = d / ref.totalDistance; const win = rec.filter(r => Math.abs(r.s / L - f) < 0.012);
  if (win.length) console.log(`  ${name.padEnd(11)} real min ${Math.min(...win.map(r => r.refv)).toFixed(0)} km/h | game min ${Math.min(...win.map(r => r.v)).toFixed(0)} km/h`);
}

console.log('speed vs the car\'s own plan: RMS', Math.sqrt(sqPlan / nPlan).toFixed(1), 'km/h');
console.log('off-road events:', evts.join('; ') || 'none');
console.log('worst under-speed vs plan per 100 m (< -12 km/h):', Object.entries(under).filter(([, d]) => d < -12).map(([b, d]) => `s=${b}:${d.toFixed(0)}`).join(' '));
console.log('line deviation > 1.2 m by 100 m bucket:', Object.entries(dev).filter(([, d]) => d > 1.2).map(([b, d]) => `s=${b}:${d.toFixed(1)}`).join(' '));