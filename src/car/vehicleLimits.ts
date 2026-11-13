import { DRS } from '../config';
import type { VehicleParams } from '../types';

/**
 * Speed-dependent limits of the car, shared by the vehicle physics and the autopilot so they
 * always agree. Speeds are in m/s, accelerations in m/s^2.
 *
 * Shapes taken from the supplied Monza qualifying onboard (see the notes in config.ts):
 *  - an F1 car's cornering grip grows strongly with speed (downforce): about 2 g at 74 km/h but
 *    about 4.7 g at 200+ km/h;
 *  - its acceleration is large at low speed and fades smoothly towards the top speed.
 */

/** Most sideways acceleration the tyres can resist at this speed. */
export function gripLimit(p: VehicleParams, speed: number): number {
  return Math.min(p.gripAcceleration + p.aeroGrip * speed * speed, p.maxGripAcceleration);
}

/** Most sideways acceleration the car can ask for by steering at this speed (before the high-speed reduction). */
export function steerLimit(p: VehicleParams, speed: number): number {
  return Math.min(p.steerLateralAcceleration + p.aeroGrip * speed * speed, p.maxSteerLateralAcceleration);
}

/**
 * Full-throttle forward acceleration at this speed, with drag already taken off (this is the
 * number that was measured on the real lap). It is limited by traction at low speed, then falls
 * to zero at `maxSpeed` (the top speed without DRS). With DRS open the flap adds a little
 * acceleration that grows with speed, which lets the car go on to its higher DRS top speed.
 */
export function netAcceleration(p: VehicleParams, speed: number, drs = false): number {
  const ratio = Math.max(speed / p.maxSpeed, 0);
  const engine = p.acceleration * (1 - Math.pow(ratio, p.accelFalloffExponent));
  return Math.min(engine, p.maxTractionAcceleration) + (drs ? p.drsCoefficient * speed * speed : 0);
}

/** How much the steering is softened at this speed (0 = not at all, 1 = fully): calm at top speed. */
export function steerReduction(p: VehicleParams, speed: number): number {
  const t = Math.min(Math.max(speed / p.maxSpeed, 0), 1);
  return p.highSpeedSteerReduction * Math.pow(t, p.highSpeedSteerExponent);
}

/** True if this fraction (0..1) of the lap is inside a DRS zone. */
export function inDrsZone(lapFraction: number): boolean {
  return DRS.zones.some(([from, to]) => lapFraction >= from && lapFraction <= to);
}