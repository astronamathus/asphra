import type * as THREE from 'three';
import type { Centerline } from './track/trackGeometry';

/** Driver input, already converted to numbers. steer: +1 = left, -1 = right. */
export interface VehicleInput {
  throttle: number; // 0..1
  brake: number; // 0..1 (also reverse when stopped)
  steer: number; // -1..1
  /** DRS (drag-reduction flap) open. Only has an effect at high speed. */
  drs?: boolean;
}

/** Everything the physics simulation remembers about the car. */
export interface VehicleState {
  x: number;
  z: number;
  /** Radians. Forward direction is (sin(heading), cos(heading)). Increasing = turning left. */
  heading: number;
  vx: number; // world-space velocity, m/s
  vz: number;
  yawRate: number; // rad/s
  steer: number; // smoothed steering, -1..1
  longSpeed: number; // speed along the car's nose, m/s (negative = reversing)
  latSpeed: number; // sideways speed, m/s (non-zero = sliding)
}

export interface VehicleParams {
  wheelbase: number;
  acceleration: number;
  maxSpeed: number;
  maxReverseSpeed: number;
  reverseAcceleration: number;
  brakeDeceleration: number;
  coastDeceleration: number;
  rollingResistance: number;
  dragCoefficient: number;
  accelFalloffExponent: number;
  maxTractionAcceleration: number;
  drsCoefficient: number;
  maxSteerAngle: number;
  steerResponse: number;
  yawResponse: number;
  highSpeedSteerReduction: number;
  highSpeedSteerExponent: number;
  steerLateralAcceleration: number;
  gripAcceleration: number;
  aeroGrip: number;
  maxGripAcceleration: number;
  maxSteerLateralAcceleration: number;
  gripStiffness: number;
  slipDrag: number;
  offRoadGripMultiplier: number;
  offRoadDrag: number;
}

export interface ChaseCameraParams {
  distance: number;
  speedDistance: number;
  height: number;
  lookAhead: number;
  /** Degrees the camera is tilted from level (negative = looks down at the road, positive = up). */
  pitchDeg: number;
  headingSmoothing: number;
  heightSmoothing: number;
  baseFov: number;
  speedFov: number;
  fovSmoothing: number;
  speedReference: number;
  groundClearance: number;
}

/**
 * Everything the game needs to know about a track.
 * (Unchanged from Stage 1, so createTestTrack.ts and createScenery.ts still compile.)
 */
export interface TrackData {
  object: THREE.Group;
  roadWidth: number;
  start: { x: number; z: number; heading: number };
  center: { x: number; z: number };
  samples: THREE.Vector3[];
  heightAt(x: number, z: number): number;
  distanceToCenterline(x: number, z: number): number;
}

/** Result of asking "where on the track is this world position?" */
export interface TrackNearest {
  /** Straight-line distance from the query point to the centerline (m). */
  distance: number;
  /** Signed sideways offset from the centerline (m). Positive = left of the direction of travel. */
  lateralOffset: number;
  /** Distance along the lap from the first row of the source data (m). */
  s: number;
  /** Nearest centerline point, world coordinates. */
  x: number;
  z: number;
  /** Direction of travel at that point, same convention as VehicleState.heading. */
  heading: number;
  /** Distance from the centerline to the left / right road edge at that point (m). */
  widthLeft: number;
  widthRight: number;
}

/** Raw and generated geometry, kept so the debug overlay can compare them. */
export interface TrackDebugData {
  /** Every CSV data row converted to world coordinates (index 0 = first data row), with widths after width zones. */
  source: { x: number; z: number; widthLeft: number; widthRight: number }[];
  /** The CSV's own widths per row, before any width zone was applied (for comparison). */
  originalWidths: { widthLeft: number; widthRight: number }[];
  /** The generated (interpolated) centerline that the road mesh is built from. */
  centerline: Centerline;
  /** Middle of the circuit's bounding box in CSV coordinates (m). world = csv - centre (x), z = -(y - centre). */
  centre: { x: number; y: number };
}

/** A closed-circuit track built from data, with queries for boundaries and recovery. */
export interface RoadTrack extends TrackData {
  name: string;
  /** Total lap length along the centerline (m). */
  lapLength: number;
  /** True if the position is between the left and right road edges (plus optional tolerance in m). */
  isOnRoad(x: number, z: number, tolerance?: number): boolean;
  nearest(x: number, z: number): TrackNearest;
  debug: TrackDebugData;
}