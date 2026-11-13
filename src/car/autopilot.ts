import { AUTODRIVE } from '../config';
import { buildCenterline, createTrackQueries } from '../track/trackGeometry';
import type { Centerline, TrackQueries } from '../track/trackGeometry';
import { referenceAt } from '../track/referenceLap';
import type { ReferenceLap } from '../track/referenceLap';
import type { VehicleInput, VehicleParams, VehicleState } from '../types';
import { clamp, wrapAngle } from '../utils/math';
import { gripLimit, inDrsZone, netAcceleration, steerLimit, steerReduction } from './vehicleLimits';

/**
 * Autodrive. No Three.js here, only numbers, like the vehicle physics.
 *
 * It does two things:
 *  1. Steering: follows the racing line (positions from the raceline file).
 *  2. Speed: follows a speed plan. If the reference lap (real telemetry) is available, the plan is
 *     that lap's speed at every point of the track, held down wherever the game's car cannot match
 *     it (corner grip, how fast it accelerates, how late it can brake). Without the reference lap
 *     the plan is simply the fastest the game's car can do. The raceline file has positions only.
 */

export interface AutoInfo {
  /** Speed the plan asks for at the car's position (m/s). */
  targetSpeed: number;
  /** Sideways distance from the racing line (m, positive = car is left of the line). */
  lineOffset: number;
  /** Distance along the racing line (m). */
  lineS: number;
}

export interface Autopilot {
  /** Checks the car is close enough to the racing line, and pointing along it, to take over. */
  engage(state: VehicleState): { ok: boolean; reason: string };
  compute(state: VehicleState, dt: number): VehicleInput;
  info(): AutoInfo;
  /** Summary of the speed plan, for messages. */
  plan: { lapLength: number; lapTime: number; minSpeed: number; maxSpeed: number; usesReference: boolean };
  /** Planned speed (m/s) at a fraction (0..1) of the lap. */
  planSpeedAt(lapFraction: number): number;
  /** True if the point at this distance along the lap (0..1) is inside a DRS zone. */
  isDrsAt(lapFraction: number): boolean;
}

export class RacelineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RacelineError';
  }
}

export function createAutopilot(
  points: { x: number; z: number }[],
  params: VehicleParams,
  reference: ReferenceLap | null = null,
): Autopilot {
  const A = AUTODRIVE;

  // ---------- Racing line geometry ----------
  if (points.length < 20) throw new RacelineError('the racing line has too few points.');
  const gaps = points.map((p, i) => {
    const q = points[(i + 1) % points.length];
    return Math.hypot(q.x - p.x, q.z - p.z);
  });
  const sortedGaps = [...gaps.slice(0, -1)].sort((a, b) => a - b);
  const medianGap = sortedGaps[Math.floor(sortedGaps.length / 2)];
  if (gaps[gaps.length - 1] > 2.5 * medianGap) {
    throw new RacelineError(
      `the racing line is not a closed loop (last point is ${gaps[gaps.length - 1].toFixed(1)} m from the first).`,
    );
  }
  if (Math.max(...gaps.slice(0, -1)) > 20) {
    throw new RacelineError('the racing line has a gap larger than 20 m between points.');
  }

  const line: Centerline = buildCenterline(
    points.map((p) => ({ x: p.x, z: p.z, widthLeft: 0, widthRight: 0 })),
    A.resampleSpacing,
  );
  const queries: TrackQueries = createTrackQueries(line, 50);
  const n = line.count;
  const lap = line.lapLength;

  const heading = new Float64Array(n);
  for (let i = 0; i < n; i++) heading[i] = Math.atan2(line.tx[i], line.tz[i]);

  // Signed curvature (positive = turning left), measured over about +-8 m to remove noise.
  const curvature = new Float64Array(n);
  const k = Math.max(1, Math.round(8 / A.resampleSpacing));
  for (let i = 0; i < n; i++) {
    const a = (i - k + n) % n;
    const b = (i + k) % n;
    const ds = (line.s[b] - line.s[a] + lap) % lap;
    curvature[i] = wrapAngle(heading[b] - heading[a]) / Math.max(ds, 1e-6);
  }

  // ---------- Speed plan ----------
  const inDrs = inDrsZone;
  // Sideways acceleration the car can really produce at speed v: limited by tyre grip and by how
  // far it can steer (steering is softened at speed in the physics model).
  const lateralLimit = (v: number): number =>
    Math.min(gripLimit(params, v), steerLimit(params, v) * (1 - steerReduction(params, v))) * A.lateralFactor;
  // netAcceleration already has drag taken off, so only the plan's safety factor is applied.
  const accelCap = (v: number, drs: boolean): number => netAcceleration(params, v, drs) * A.accelFactor;
  const brakeCap = (v: number): number =>
    params.brakeDeceleration * A.brakeFactor + params.rollingResistance + params.dragCoefficient * v * v;

  const speed = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const kappa = Math.abs(curvature[i]);
    // largest v with v^2 * kappa <= lateralLimit(v)  (bisection)
    let lo = 0;
    let hi = A.maxSpeed;
    if (hi * hi * kappa <= lateralLimit(hi)) {
      lo = hi;
    } else {
      for (let it = 0; it < 30; it++) {
        const mid = (lo + hi) / 2;
        if (mid * mid * kappa <= lateralLimit(mid)) lo = mid;
        else hi = mid;
      }
    }
    let v = clamp(lo, A.minSpeed, A.maxSpeed);
    // The real lap's speed at this point of the track is the target, if we have it.
    if (reference) v = Math.min(v, (referenceAt(reference, reference.speedKmh, line.s[i] / lap) / 3.6) * A.referenceScale);
    speed[i] = v;
  }
  // Braking: work backwards so every corner can be reached from the straight before it.
  // Acceleration: work forwards so the car is never asked to gain speed faster than it can.
  // Three laps around the loop make the result independent of where the loop starts.
  for (let pass = 0; pass < 3; pass++) {
    for (let step = 2 * n; step >= 0; step--) {
      const i = step % n;
      const j = (i + 1) % n;
      const ds = (line.s[j] - line.s[i] + lap) % lap;
      speed[i] = Math.min(speed[i], Math.sqrt(speed[j] * speed[j] + 2 * brakeCap(speed[j]) * ds));
    }
    for (let step = 0; step <= 2 * n; step++) {
      const i = step % n;
      const j = (i + 1) % n;
      const ds = (line.s[j] - line.s[i] + lap) % lap;
      speed[j] = Math.min(speed[j], Math.sqrt(speed[i] * speed[i] + 2 * accelCap(speed[i], inDrs(line.s[i] / lap)) * ds));
    }
  }
  let lapTime = 0;
  let minSpeed = Infinity;
  let maxSpeed = 0;
  for (let i = 0; i < n; i++) {
    speed[i] = Math.max(A.minSpeed * 0.5, speed[i] * A.speedScale);
    const j = (i + 1) % n;
    const ds = (line.s[j] - line.s[i] + lap) % lap;
    lapTime += ds / ((speed[i] + speed[j]) / 2);
    minSpeed = Math.min(minSpeed, speed[i]);
    maxSpeed = Math.max(maxSpeed, speed[i]);
  }

  // ---------- Lookups along the line ----------
  function indexAt(s: number): number {
    const d = ((s % lap) + lap) % lap;
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (line.s[mid] <= d) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }
  function valueAt(values: Float64Array, s: number): number {
    const i = indexAt(s);
    const j = (i + 1) % n;
    const d = ((s % lap) + lap) % lap;
    const end = i + 1 < n ? line.s[i + 1] : lap;
    const t = (d - line.s[i]) / Math.max(end - line.s[i], 1e-9);
    return values[i] + (values[j] - values[i]) * t;
  }

  // ---------- Controller ----------
  let lastInfo: AutoInfo = { targetSpeed: 0, lineOffset: 0, lineS: 0 };
  // Smoothed pedal positions, so the inputs ramp like a driver's feet instead of switching.
  let throttleOut = 0;
  let brakeOut = 0;

  function engage(state: VehicleState): { ok: boolean; reason: string } {
    const hit = queries.nearest(state.x, state.z);
    if (Math.abs(hit.lateralOffset) > A.engageMaxOffset) {
      return { ok: false, reason: `the car is ${Math.abs(hit.lateralOffset).toFixed(0)} m from the racing line (press R to reset)` };
    }
    const speedNow = Math.hypot(state.vx, state.vz);
    const course = speedNow > 2 ? Math.atan2(state.vx, state.vz) : state.heading;
    const error = Math.abs(wrapAngle(hit.heading - course));
    if (error > (A.engageMaxHeadingDeg * Math.PI) / 180) {
      return { ok: false, reason: 'the car is not pointing along the racing line (press R to reset)' };
    }
    return { ok: true, reason: '' };
  }

  function compute(state: VehicleState, dt: number): VehicleInput {
    const hit = queries.nearest(state.x, state.z);
    const v = Math.hypot(state.vx, state.vz);

    // --- Steering ---
    // Aim for the line's direction, nudged back toward the line if the car is beside it
    // (a "Stanley" controller), plus the turn rate the line's curvature needs.
    const course = v > 2 ? Math.atan2(state.vx, state.vz) : state.heading;
    const crossTerm = clamp(-Math.atan2(A.crossTrackGain * hit.lateralOffset, v + 3), -A.maxCrossTrackAngle, A.maxCrossTrackAngle);
    const courseError = wrapAngle(hit.heading + crossTerm - course);
    // The car takes about 0.25 s to respond, so look a little ahead for the curvature.
    const feedForward = v * valueAt(curvature, hit.s + v * A.curvatureLookAheadTime + 2);
    const yawWanted = feedForward + A.headingGain * courseError;

    // Convert the wanted turn rate into a steering input, using the same rules as the physics.
    const yawLow = (v * Math.tan(params.maxSteerAngle)) / params.wheelbase;
    const yawHigh = steerLimit(params, v) / Math.max(v, 1);
    const authority = Math.min(yawLow, yawHigh) * (1 - steerReduction(params, v));
    const steer = authority > 1e-3 ? clamp(yawWanted / authority, -1, 1) : 0;

    // --- Speed ---
    // The further the car is from the line, or the more it points away from it, the slower the plan
    // is made, so it can rejoin the line safely and then speed up again.
    const lookAhead = Math.max(4, v * 0.2);
    const recovery = clamp(
      1 -
        Math.max(0, Math.abs(hit.lateralOffset) - A.recoveryDeadband) / A.recoveryOffset -
        Math.max(0, Math.abs(wrapAngle(hit.heading - course)) - 0.1) / A.recoveryAngle,
      A.recoveryMinFactor,
      1,
    );
    const target = Math.max(A.minSpeed * 0.5, valueAt(speed, hit.s + lookAhead) * recovery);
    const error = target - v;
    const throttleWanted = clamp(error * 0.9, 0, 1);
    const brakeWanted = clamp((-error - 0.4) * 0.5, 0, 1);
    // Ease the pedals in and out (throttle comes in over about half a second, brakes bite fast).
    const move = (current: number, wanted: number, rise: number, fall: number): number =>
      current + clamp(wanted - current, -fall * dt, rise * dt);
    brakeOut = move(brakeOut, brakeWanted, A.brakeRise, A.brakeFall);
    throttleOut = brakeOut > 0.05 ? 0 : move(throttleOut, throttleWanted, A.throttleRise, A.throttleFall);

    lastInfo = { targetSpeed: target, lineOffset: hit.lateralOffset, lineS: hit.s };
    return { throttle: throttleOut, brake: brakeOut, steer };
  }

  return {
    engage,
    compute,
    info: () => lastInfo,
    plan: { lapLength: lap, lapTime, minSpeed, maxSpeed, usesReference: reference !== null },
    isDrsAt: inDrs,
    planSpeedAt: (fraction: number): number => valueAt(speed, fraction * lap),
  };
}