import type { ChaseCameraParams, VehicleParams } from './types';

/**
 * Units: metres, seconds, radians. 1 m/s = 3.6 km/h.
 *
 * Tuned from the supplied telemetry charts of Max Verstappen's 2025 Italian GP qualifying lap
 * (f1tel.com / TracingInsights, 1:18.792), which were digitised from the chart images into
 * src/tracks/monza-reference-lap.csv (integrated lap time of the digitised speed: 78.63 s).
 * What the data showed, and how it maps to the numbers below:
 *  - Full-throttle acceleration (no DRS): 13 m/s2 at 160 km/h, 8 at 215, 5 at 260, 3 at 295,
 *    1 at 320, 0 at about 333 km/h. This gives acceleration 43.4, maxSpeed 92.5 m/s, exponent 0.5
 *    (the formula is acceleration * (1 - (v / maxSpeed) ^ exponent)), capped by
 *    maxTractionAcceleration 15 at low speed. Within about 0.5 m/s2 of the measurements.
 *  - DRS (open on the main straight and the Serraglio straight) adds about 1 m/s2 at 300+ km/h
 *    and raises the top speed from about 333 to 348 km/h (drsCoefficient).
 *  - Braking zones average 2.7-3.1 g (345 -> 82 km/h in 140 m), with peaks of about 4.6 g.
 *    Here braking = brakeDeceleration plus air drag.
 *  - Sideways acceleration (speed squared times racing-line curvature) peaks at about 2.3 g at
 *    60-120 km/h, 3.5 g at 120-180 and 4.7 g at 180-260 km/h (downforce): grip = gripAcceleration
 *    + aeroGrip * speed^2, up to maxGripAcceleration.
 *  - Throttle is 100% for 82% of the lap; brakes are on for 10% of it.
 * These are driving-feel references, not a simulation of the real car.
 */
export const VEHICLE: VehicleParams = {
  wheelbase: 2.8,
  acceleration: 43.4, // m/s^2 before the traction cap; see the fit above
  accelFalloffExponent: 0.5, // shape of the fall-off of acceleration with speed
  maxTractionAcceleration: 15, // m/s^2, most the tyres can put down at low speed
  maxSpeed: 92.5, // m/s = 333 km/h, top speed without DRS
  drsCoefficient: 0.00012, // DRS adds drsCoefficient * speed^2 of acceleration (about 1 m/s2 at 300 km/h)
  maxReverseSpeed: 10, // m/s
  reverseAcceleration: 7, // m/s^2
  brakeDeceleration: 24, // m/s^2, before air drag is added
  coastDeceleration: 2, // m/s^2 when no pedal is pressed (engine braking)
  rollingResistance: 0.3, // m/s^2 constant
  dragCoefficient: 0.0018, // air drag: decel = coefficient * speed^2 (about 1.6 g at 340 km/h)

  maxSteerAngle: 0.5, // radians, front wheel angle at low speed
  steerResponse: 7, // higher = steering reacts faster (less inertia)
  yawResponse: 8, // higher = car rotates into a turn faster
  highSpeedSteerReduction: 0.55, // 0..1, how much steering is softened at top speed
  highSpeedSteerExponent: 2, // 2 = barely softened in corners, calm on the straights
  steerLateralAcceleration: 24, // m/s^2 the car can ask for by steering at low speed
  maxSteerLateralAcceleration: 58, // m/s^2 upper limit of that, at high speed

  gripAcceleration: 17, // m/s^2 of tyre grip at low speed. Lower = more sliding
  aeroGrip: 0.0098, // extra grip from downforce: + aeroGrip * speed^2
  maxGripAcceleration: 50, // m/s^2 upper limit of grip (about 5 g)
  gripStiffness: 9, // how quickly sideways motion is corrected
  slipDrag: 1.0, // speed lost to tyre scrub when sliding (1 = physical: sideways acceleration x slip angle)
  offRoadGripMultiplier: 0.7, // grass grip relative to asphalt
  offRoadDrag: 4, // extra deceleration on grass, m/s^2
};

/**
 * DRS zones as fractions of the lap: open on the main straight (25-760 m of the real lap) and the
 * Serraglio straight (3045-3770 m), read from the telemetry's DRS chart. In the game the flap opens
 * automatically in these zones while the throttle is nearly fully down and the brake is off.
 */
export const DRS = {
  zones: [
    [0.0044, 0.1321],
    [0.5293, 0.6553],
  ] as [number, number][],
};

/**
 * Gear indicator (display only; it does not change the physics). Upshift speeds 2->3 to 7->8 were
 * read from the telemetry's gear chart (agreeing with the earlier onboard video); the downshift
 * speeds come from the video, and the 1->2 shift is an estimate.
 */
export const GEARBOX = {
  upshiftKmh: [80, 134, 172, 214, 234, 269, 297], // speed to go from gear 1->2, 2->3, ... 7->8
  downshiftKmh: [60, 115, 152, 195, 215, 235, 258], // speed to go from gear 2->1, 3->2, ... 8->7
};

/**
 * Car size in metres. The overall width (wheels and wings included) is 2.0 m, the width of an F1 car,
 * so on a 12 m wide straight the car is one sixth of the road, as in real life. Used by the car model
 * and by the debug overlay's footprint. wheelX / wheelZ / wheelWidth / wheelRadius are averages of the
 * front and rear values, used for the footprint and for sampling the ground under the car.
 */
export const CAR_SIZE = {
  width: 2.0, // overall, outer face of one wheel to the outer face of the other
  length: 5.6, // front wing to rear wing
  wheelX: 0.815,
  wheelZ: 1.775,
  wheelWidth: 0.35,
  wheelRadius: 0.34,
  // front axle: 0.30 m wide tyres, 0.66 m diameter; rear axle: 0.40 m wide, 0.71 m diameter (as in F1)
  front: { x: 0.84, z: 1.8, width: 0.3, radius: 0.33 },
  rear: { x: 0.79, z: 1.75, width: 0.4, radius: 0.355 },
};

export const CAMERA: ChaseCameraParams = {
  distance: 7.2, // metres behind the car's centre (the rear wing is 2.7 m behind it)
  speedDistance: 2.5, // extra distance at full speed
  height: 1.6, // metres above the ground, a little above the car's roof (1.06 m)
  lookAhead: 14, // look this far in front of the car
  pitchDeg: -10, // tilt from level (negative = looks down): horizon about 37% down the screen, car near the middle
  headingSmoothing: 4, // higher = camera swings behind the car faster
  heightSmoothing: 6,
  baseFov: 70,
  speedFov: 10, // extra field of view at full speed
  fovSmoothing: 3,
  speedReference: 95, // m/s considered "full speed" for camera effects
  groundClearance: 0.8,
};

/** T-Cam view (press C): mounted above the roll hoop, just behind the driver. */
export const COCKPIT_CAMERA = { x: 0, y: 1.02, z: -0.38, fov: 78 };

/**
 * Terrain settings (shared by the Stage 1 test track and the Stage 2 circuit terrain)
 * plus the Stage 1 test road, which is kept for reference but is no longer used by main.ts.
 */
export const TRACK = {
  roadWidth: 14,
  sampleSpacing: 5, // metres between centerline samples
  startDistance: 30, // metres along the road where the car starts
  /** Test road centerline control points as [x, z]. Only used by createTestTrack.ts. */
  controlPoints: [
    [0, -100],
    [0, 100],
    [72, 350],
    [234, 600],
    [288, 850],
    [180, 1100],
    [-36, 1350],
    [-180, 1600],
    [-162, 1850],
    [-36, 2100],
    [108, 2350],
    [126, 2600],
  ] as [number, number][],

  edgeLineInset: 0.8,
  lineWidth: 0.25,
  centerLineWidth: 0.3,
  dashLength: 4,
  dashGap: 8,

  flatRadius: 70, // terrain is perfectly flat this close to the road
  hillFadeDistance: 260, // hills reach full height this far from the road
  hillHeight: 30, // was 45; Monza is a flat park circuit, so the hills are gentler
  terrainSize: 7200, // was 6400; the Monza circuit is larger than the test road
  terrainSegments: 240, // keep cells <= ~35 m so the flat zone around the road stays flat
  terrainSink: 0.08, // terrain sits slightly below the road to avoid flickering
};

/** Stage 2: settings for circuits built from CSV data (see src/track/trackLoader.ts). */
export const CIRCUIT = {
  /** Spacing (m) of the resampled centerline used for the road mesh and queries. Source data is ~5 m. */
  resampleSpacing: 2.5,
  roadY: 0, // road surface height; the source data has no elevation, so the road is flat
  startDistance: 0, // metres along the lap, from the first CSV row, where the car is placed
  edgeLineInset: 0.4, // white edge line sits this far inside the road edge
  edgeLineWidth: 0.2,
  uvMetersPerRepeat: 10, // the road texture coordinate v repeats every N metres
  queryCellSize: 50, // grid cell size (m) of the nearest-point search structure
  /**
   * Stretches of road whose total width is forced to a known value (rows are CSV data rows, the "#n"
   * numbers in the debug overlay). Empty now: the road widths come from the traced road edges in
   * src/tracks/monza-widths.csv, which show about 12.2 m at the start line tapering to about 9.6 m
   * before the first chicane. Use zones only for stretches the trace does not cover.
   */
  widthZones: [] as {
    name: string;
    fromRow: number;
    toRow: number;
    totalWidth: number;
    rampMeters: number;
  }[],
  asphaltColor: 0x44474c,
  lineColor: 0xf2f2f2,

  // Data validation limits. Data outside these limits is rejected with an error.
  minRows: 50,
  minSampleSpacing: 0.05, // m; closer points are treated as duplicates
  maxSampleSpacing: 20, // m; sparser data cannot describe chicanes reliably
  maxHeadingStepDeg: 50, // max direction change between consecutive samples
  minWidth: 0.5, // m, per side
  maxWidth: 40, // m, per side
  closureToleranceFactor: 2.5, // last->first gap may be at most this many median spacings
};

export const WORLD = {
  skyTopColor: 0x3f86d6,
  horizonColor: 0xc9e0f0, // also the fog colour
  fogNear: 80,
  fogFar: 2200, // was 1600; scaled up because the Monza circuit is much larger
  sunColor: 0xfff2d6,
  sunIntensity: 2.4,
  hemiSkyColor: 0xcfe6ff,
  hemiGroundColor: 0x5b7a3a,
  hemiIntensity: 1.2,
  sunOffset: [60, 90, 40] as [number, number, number],
  shadowSize: 40,
  maxPixelRatio: 2,
  maxFrameTime: 0.1, // seconds; longer frames are clamped
  roadEdgeTolerance: 0.8, // metres beyond the road edge still counted as road
  autoResetDistance: 200, // was 350; recovery now returns the car to the nearest road point
  mountainCount: 36,
  mountainRingMin: 1700, // was 1400
  mountainRingMax: 2100, // was 1750
  treeCount: 1600, // was 900; the circuit is longer
};

/**
 * Autodrive: follows the racing line (src/tracks/monza-raceline.csv) at a speed worked out from
 * the game's own vehicle limits. The raceline file has positions only (no speeds), so the speed
 * is NOT real F1 data: it is the fastest speed the game's car can hold on that line.
 */
export const AUTODRIVE = {
  toggleKey: 'KeyE',
  resampleSpacing: 2, // m between racing-line points
  lateralFactor: 0.86, // share of the car's sideways grip / steering limit that the speed plan uses
  accelFactor: 0.95, // share of the car's acceleration the speed plan assumes
  brakeFactor: 0.9, // share of the car's braking the speed plan assumes
  speedScale: 1.0, // 1 = full plan, 0.9 = 10% slower everywhere
  referenceScale: 1.0, // share of the real lap's speed used as the target (1 = match the real lap where possible)
  throttleRise: 2.5, // per second: how fast the throttle pedal can come in
  throttleFall: 10, // per second: how fast it can be lifted
  brakeRise: 10, // per second: how fast the brake can come on
  brakeFall: 6, // per second: how fast it can be released
  lineEdgeClearance: 0, // m kept between the car's side and the road edge: the line is moved inwards (only where needed) so the 2 m car stays on the asphalt
  maxSpeed: 100, // m/s cap on the plan
  minSpeed: 8, // m/s floor on the plan
  lookAheadMin: 4, // m
  lookAheadTime: 0.25, // s, extra look-ahead in seconds
  curvatureLookAheadTime: 0.2, // s: the turn rate asked for is that of the line this far ahead (the car responds with a lag)
  headingGain: 3.0, // 1/s, how strongly heading errors are corrected
  crossTrackGain: 0.8, // how strongly sideways errors are corrected
  maxCrossTrackAngle: 0.45, // rad: the most the car aims away from the line direction to rejoin it
  recoveryDeadband: 1.0, // m: normal tracking wobble up to this far from the line does not slow the plan
  recoveryOffset: 8, // m beyond the deadband at which the speed plan is cut to the minimum factor
  recoveryAngle: 1.2, // rad: same, for pointing away from the line
  recoveryMinFactor: 0.2, // the plan is never cut below this share
  engageMaxOffset: 8, // m: autodrive will not start if the car is further from the line
  engageMaxHeadingDeg: 25, // deg: ...or pointing further away from the line direction
};