import type { VehicleInput, VehicleParams, VehicleState } from '../types';
import { wrapAngle } from '../utils/math';
import { gripLimit, netAcceleration, steerLimit, steerReduction } from './vehicleLimits';

/** The simulation always advances in steps no longer than this (seconds). */
const MAX_SUBSTEP = 1 / 120;

export interface VehiclePhysics {
  readonly state: VehicleState;
  update(dt: number, input: VehicleInput, onRoad: boolean): void;
  reset(x: number, z: number, heading: number): void;
}

/**
 * Simple arcade vehicle model. No Three.js here: just numbers.
 *
 * Convention: forward = (sin(heading), cos(heading)), left = (cos(heading), -sin(heading)).
 * Increasing the heading turns the car to the left. The speed-dependent limits (grip, steering,
 * acceleration) live in vehicleLimits.ts so the autopilot uses exactly the same ones.
 */
export function createVehiclePhysics(params: VehicleParams): VehiclePhysics {
  const state: VehicleState = {
    x: 0,
    z: 0,
    heading: 0,
    vx: 0,
    vz: 0,
    yawRate: 0,
    steer: 0,
    longSpeed: 0,
    latSpeed: 0,
  };

  function step(dt: number, input: VehicleInput, onRoad: boolean): void {
    const p = params;
    const sinH = Math.sin(state.heading);
    const cosH = Math.cos(state.heading);

    // Split the world velocity into "along the car" and "sideways" parts.
    let vLong = state.vx * sinH + state.vz * cosH;
    let vLat = state.vx * cosH - state.vz * sinH;
    const grip = onRoad ? 1 : p.offRoadGripMultiplier;

    // --- Throttle, brake, reverse ---
    let accel = 0;
    if (input.throttle > 0) {
      if (vLong < -0.5) {
        accel += p.brakeDeceleration * input.throttle; // moving backwards: brake first
      } else {
        // The engine produces the measured full-throttle acceleration PLUS enough to overcome
        // drag and rolling resistance, which are applied separately below.
        const engine = Math.max(
          0,
          netAcceleration(p, Math.max(vLong, 0), input.drs === true) + p.dragCoefficient * vLong * vLong + p.rollingResistance,
        );
        accel += engine * input.throttle;
      }
    }
    if (input.brake > 0) {
      accel -=
        vLong > 0.5
          ? p.brakeDeceleration * input.brake // moving forwards: brake
          : p.reverseAcceleration * input.brake * Math.max(0, 1 + vLong / p.maxReverseSpeed); // reverse
    }
    vLong += accel * dt;

    // --- Passive slowing: rolling resistance, air drag, engine braking, grass ---
    const coasting = input.throttle <= 0 && input.brake <= 0;
    let passive = p.rollingResistance + p.dragCoefficient * vLong * vLong;
    if (coasting) passive += p.coastDeceleration;
    if (!onRoad) passive += p.offRoadDrag;
    const dv = passive * dt;
    if (Math.abs(vLong) <= dv) {
      vLong = 0;
    } else {
      vLong -= Math.sign(vLong) * dv;
    }

    // --- Lateral grip: tyres pull the car toward where it is pointing, but only up to a maximum
    //     force that grows with speed (downforce). Beyond that the car slides. ---
    const slipBefore = Math.abs(vLat);
    const wanted = slipBefore * Math.min(1, p.gripStiffness * grip * dt);
    const maxCorrection = gripLimit(p, Math.abs(vLong)) * grip * dt;
    const correction = Math.min(wanted, maxCorrection);
    vLat -= Math.sign(vLat) * correction;

    // Tyre scrub: the sideways force the tyres produce, working against the sliding direction,
    // slows the car by (sideways acceleration) x (slip angle). Tiny in gentle corners, noticeable
    // in a real slide. slipDrag scales it (1 = physical).
    const scrub = (correction / dt) * (slipBefore / Math.max(Math.abs(vLong), 5)) * p.slipDrag * dt;
    vLong -= Math.sign(vLong) * Math.min(scrub, Math.abs(vLong));

    // --- Steering ---
    const speedAbs = Math.abs(vLong);
    const steerTarget = input.steer * (1 - steerReduction(p, speedAbs));
    state.steer += (steerTarget - state.steer) * (1 - Math.exp(-p.steerResponse * dt));

    // Turn rate is limited at low speed by the steering angle and at high speed
    // by how much sideways acceleration we allow. Whichever is smaller wins.
    const yawLow = (speedAbs * Math.tan(p.maxSteerAngle)) / p.wheelbase;
    const yawHigh = steerLimit(p, speedAbs) / Math.max(speedAbs, 1);
    const yawMax = Math.min(yawLow, yawHigh);
    const direction = vLong >= 0 ? 1 : -1; // steering flips when reversing
    const yawTarget = state.steer * yawMax * direction;
    state.yawRate += (yawTarget - state.yawRate) * (1 - Math.exp(-p.yawResponse * dt));

    // --- Integrate. Velocity is rebuilt with the OLD heading, then the heading turns.
    //     That is what makes the car keep its momentum and slide. ---
    state.vx = vLong * sinH + vLat * cosH;
    state.vz = vLong * cosH - vLat * sinH;
    state.heading = wrapAngle(state.heading + state.yawRate * dt);
    state.x += state.vx * dt;
    state.z += state.vz * dt;
    state.longSpeed = vLong;
    state.latSpeed = vLat;
  }

  return {
    state,
    update(dt: number, input: VehicleInput, onRoad: boolean): void {
      let remaining = dt;
      while (remaining > 1e-6) {
        const h = Math.min(remaining, MAX_SUBSTEP);
        step(h, input, onRoad);
        remaining -= h;
      }
    },
    reset(x: number, z: number, heading: number): void {
      state.x = x;
      state.z = z;
      state.heading = heading;
      state.vx = 0;
      state.vz = 0;
      state.yawRate = 0;
      state.steer = 0;
      state.longSpeed = 0;
      state.latSpeed = 0;
    },
  };
}