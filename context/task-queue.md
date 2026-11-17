ASPHRA — TASK QUEUE
1. Purpose

This document contains the development roadmap and active task assignments.

All tasks should be based on actual project requirements.

Do not mark planned functionality as implemented without verification.

2. Priority Definitions
P0: Critical bugs or blockers.
P1: High-priority development.
P2: Medium-priority improvements.
P3: Future enhancements.
3. Current Development Priorities
P1 — Circuit System

TASK-001: Audit Monza CSV pipeline

Status: Pending

Inspect the current CSV loading and geometry pipeline.

Verify:

CSV schemas.
Coordinate transformations.
Track width interpretation.
Road mesh construction.
Boundary alignment.
Raceline integration.

Expected result: Accurate technical documentation of the existing pipeline.

P1 — Circuit System

TASK-002: Establish universal track data format

Status: Pending

Define a consistent format for future circuits.

Requirements:

Reusable CSV schemas.
Consistent coordinate conventions.
Consistent track orientation.
Track-specific metadata.
Compatible track loading.

Do not break existing Monza functionality.

P1 — Vehicle System

TASK-003: Vehicle handling refinement

Status: Pending

Improve driving feel while preserving existing vehicle architecture.

Priorities:

Steering.
Acceleration.
Braking.
Grip.
Cornering.
Stability.
P1 — Track Selection

TASK-004: Plan track selection architecture

Status: Pending

Design a system allowing players to select and load different circuits.

Do not implement until the universal track loading approach is understood.

P2 — Circuit Development

TASK-005: Expand Monza geometry

Status: Pending

Plan and implement additional circuit features:

Curbs.
Runoff areas.
Pit lane.
Barriers.
Track markings.
P2 — Environment

TASK-006: Improve circuit environments

Status: Pending

Develop recognizable low-poly surroundings.

Prioritize:

Trees.
Buildings.
Grandstands.
Circuit-specific landmarks.
Terrain.
P2 — Performance

TASK-007: Browser performance audit

Status: Pending

Identify performance bottlenecks and opportunities for optimization.

P3 — Camera

TASK-008: Expand camera options

Status: Future

Develop additional camera perspectives inspired by F1 25.

P3 — Gameplay

TASK-009: AI opponents

Status: Future / Undecided

Investigate possible racing AI.

P3 — Gameplay

TASK-010: Multiplayer

Status: Future / Undecided

Investigate multiplayer feasibility.

4. Active Tasks

TASK-013: Manual DRS and rear-wing animation

Status: Implemented — awaiting build and in-game verification

Manual DRS is requested by holding Space and is available only inside configured DRS zones while accelerating without braking. Autodrive retains automatic DRS. The rear-wing flap animates between its normal and low-drag positions; the HUD indicates zone availability and activation.

Files: src/car/controls.ts, src/car/createCar.ts, src/main.ts, src/ui/hud.ts.

Validation required: npm run build; verify Space activation/release, zone boundaries, braking/throttle cut-outs, autodrive behavior, and flap motion in browser.

TASK-011: Procedural asphalt surface

Status: Refined — awaiting build and browser verification

The procedural aggregate texture now has a wider tonal range, stronger fine/medium grain, sparse irregular aggregate flecks and subtle broad-scale variation. The existing 10 m UV repeat scale is retained. Racing-line rubber deposits were removed after visual feedback. Next validation: check the aggregate visibility at chase-camera distance and close range, then tune contrast/scale.

5. Completed Tasks

Record verified completed tasks here.

Current confirmed foundation:

Initial Monza CSV implementation.
Basic road and terrain rendering.
Formula-style vehicle.
Player driving controls.
Optional autodrive.

5. Completed Tasks

Record verified completed tasks here.

Current confirmed foundation:

Initial Monza CSV implementation.
Basic road and terrain rendering.
Formula-style vehicle.
Player driving controls.
Optional autodrive.
6. Blocked Tasks

Record tasks waiting on other systems here.

7. Assignment Rules

Every task must specify:

Task ID.
Assigned AI session.
Priority.
Description.
Files involved.
Dependencies.
Expected result.
Testing requirements.
8. Completion Rules

A task can only be marked completed after:

Implementation is finished.
Relevant testing has been performed.
Changes are documented.
Outstanding issues are recorded.

TASK-012: Racing-line rubber deposits
Status: Implemented — awaiting build and in-game visual verification
Uses the fitted Monza racing line to place two subtle tyre-width rubber ribbons. Both tracks are checked against road boundaries. Next: verify visibility and subtlety in-game; tune opacity/width if needed.
