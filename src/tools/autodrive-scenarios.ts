import fs from 'node:fs';
import { createTrackFromCsv } from '../track/trackLoader';
import { createVehiclePhysics } from '../car/vehiclePhysics';
import { createAutopilot } from '../car/autopilot';
import type { ReferenceLap } from '../track/referenceLap';
import { fitRacelineToRoad } from '../track/racelineFit';
import { pointAtDistance } from '../track/trackGeometry';
import { AUTODRIVE, CAR_SIZE, VEHICLE, WORLD } from '../config';

console.info = () => {};
const track = createTrackFromCsv(fs.readFileSync('src/tracks/monza.csv', 'utf8'), 'src/tracks/monza.csv', 'Monza');
const centre = track.debug.centre;
const pts = fs.readFileSync('src/tracks/monza-raceline.csv', 'utf8').split('\n').filter(l => l && !l.startsWith('#')).map(l => { const [x, y] = l.split(',').map(Number); return { x: x - centre.x, z: -(y - centre.y) }; });
const rrows = fs.readFileSync('src/tracks/monza-reference-lap.csv', 'utf8').split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split(',').map(Number));
const rcol = (i: number) => Float64Array.from(rrows.map(r => r[i]));
const refLap: ReferenceLap = { distance: rcol(0), speedKmh: rcol(1), throttle: rcol(2), brake: rcol(3), gear: rcol(4), totalDistance: rrows[rrows.length - 1][0] };
const ap = createAutopilot(fitRacelineToRoad(pts, track, CAR_SIZE.width / 2 + AUTODRIVE.lineEdgeClearance).points, VEHICLE, refLap);
const c = track.debug.centerline;
let runs = 0, refused = 0, bad = 0, never = 0, fastTotal = 0, fastOut = 0; const lines: string[] = [];
for (const s0 of [300, 950, 1500, 2150, 2900, 3500, 4100, 4800, 5400, 5700]) {
  for (const off of [-4, 4]) for (const v0 of [0, 25, 55]) for (const hErr of [0, 0.2, -0.2]) {
    const p = pointAtDistance(c, s0);
    const lx = Math.cos(p.heading), lz = -Math.sin(p.heading);
    const physics = createVehiclePhysics(VEHICLE);
    const h = p.heading + hErr;
    physics.reset(p.x + lx * off, p.z + lz * off, h);
    physics.state.vx = Math.sin(h) * v0; physics.state.vz = Math.cos(h) * v0; physics.state.longSpeed = v0;
    const eng = ap.engage(physics.state);
    if (!eng.ok) { refused++; continue; }
    runs++;
    let offFrames = 0, maxOut = 0, t = 0, lastDev = 0;
    while (t < 40) {
      const input = ap.compute(physics.state, 1 / 60); input.drs = ap.isDrsAt(ap.info().lineS / ap.plan.lapLength) && input.throttle > 0.9 && input.brake < 0.1;
      const onRoad = track.isOnRoad(physics.state.x, physics.state.z, WORLD.roadEdgeTolerance);
      physics.update(1 / 60, input, onRoad); t += 1 / 60;
      const n2 = track.nearest(physics.state.x, physics.state.z); const w = n2.lateralOffset >= 0 ? n2.widthLeft : n2.widthRight;
      if (!onRoad) offFrames++;
      maxOut = Math.max(maxOut, Math.abs(n2.lateralOffset) - w);
      if (t > 30) lastDev = Math.abs(ap.info().lineOffset);
    }
    // success: settled onto the line by 30-40 s, and never ran far off the road
    if (v0 === 55) { fastTotal++; if (maxOut > 4) fastOut++; }
    if (lastDev > 1.5) never++;
    if (v0 <= 25 && maxOut > 2) { bad++; lines.push(`  s=${s0} off=${off} v0=${v0} hErr=${hErr.toFixed(1)}: offFrames ${offFrames}, max beyond edge ${maxOut.toFixed(1)} m, settled dev ${lastDev.toFixed(2)} m`); }
  }
}
console.log(`scenarios run ${runs}, refused by engage() ${refused}`);
console.log(`did not settle onto the line within 40 s: ${never}`);
console.log(`moderate starts (0-90 km/h) that ran more than 2 m beyond the road edge: ${bad}`);
console.log(`engaged at 200 km/h (informational; often inside a corner, where no controller could save it): ${fastOut} of ${fastTotal} ran more than 4 m beyond the edge`);
console.log(lines.join('\n'));