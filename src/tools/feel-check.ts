import { createVehiclePhysics } from '../car/vehiclePhysics';
import { VEHICLE } from '../config';
const kmh = (v: number) => v * 3.6;
// full throttle from 74 km/h (the video's slowest corner) on a straight
let ph = createVehiclePhysics(VEHICLE); ph.reset(0, 0, 0); ph.state.vz = 74 / 3.6; ph.state.longSpeed = 74 / 3.6;
let t = 0; const marks = [100, 150, 200, 250, 300, 330, 340]; const got: Record<number, number> = {}; let vmax = 0;
while (t < 40) { ph.update(1 / 120, { throttle: 1, brake: 0, steer: 0 }, true); t += 1 / 120; const v = kmh(Math.hypot(ph.state.vx, ph.state.vz)); vmax = Math.max(vmax, v); for (const m of marks) if (v >= m && got[m] === undefined) got[m] = t; }
console.log('FULL THROTTLE from 74 km/h (video: 100 after 1.2 s, 150 after 2.2, 200 after 3.4, 250 after 4.8, 300 after 8.0):');
console.log('  game: ' + marks.map(m => got[m] ? `${m} after ${got[m].toFixed(1)} s` : `${m} not reached`).join(', ') + `; top speed ${vmax.toFixed(0)} km/h`);
// braking from 340 km/h
ph = createVehiclePhysics(VEHICLE); ph.reset(0, 0, 0); ph.state.vz = 340 / 3.6; ph.state.longSpeed = 340 / 3.6;
t = 0; let peak = 0; const at: Record<number, number> = {};
while (kmh(Math.hypot(ph.state.vx, ph.state.vz)) > 80 && t < 15) { const v0 = Math.hypot(ph.state.vx, ph.state.vz); ph.update(1 / 120, { throttle: 0, brake: 1, steer: 0 }, true); t += 1 / 120; const v1 = Math.hypot(ph.state.vx, ph.state.vz); peak = Math.max(peak, (v0 - v1) * 120); for (const m of [250, 150, 100]) if (kmh(v1) <= m && at[m] === undefined) at[m] = t; }
console.log(`BRAKING from 340 km/h: first-instant decel ${peak.toFixed(0)} m/s2 (${(peak / 9.81).toFixed(1)} g); 340 -> 100 km/h in ${at[100].toFixed(1)} s; to 80 km/h in ${t.toFixed(1)} s  (video: Rettifilo 348 -> 74 km/h in 5.2 s incl. lifting)`);
// lift-off at 340
ph = createVehiclePhysics(VEHICLE); ph.reset(0, 0, 0); ph.state.vz = 340 / 3.6; ph.state.longSpeed = 340 / 3.6; const v0 = 340 / 3.6; ph.update(1 / 120, { throttle: 0, brake: 0, steer: 0 }, true); console.log(`LIFT-OFF at 340 km/h: ${((v0 - Math.hypot(ph.state.vx, ph.state.vz)) * 120).toFixed(1)} m/s2`);