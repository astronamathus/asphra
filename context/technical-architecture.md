ASPHRA — TECHNICAL ARCHITECTURE
1. Technology Stack

Confirmed technologies:

Three.js
TypeScript
Vite
HTML
CSS

See package.json for the complete dependency list.

2. Project Structure
Application
src/main.ts: Application entry point.
src/config.ts: Configuration.
src/types.ts: Shared types.
src/style.css: Main styling.
Vehicle Systems — src/car/
autopilot.ts: Autodrive functionality.
chaseCamera.ts: Chase camera.
controls.ts: Vehicle controls.
createCar.ts: Vehicle creation.
gearbox.ts: Gearbox.
vehicleLimits.ts: Vehicle limits.
vehiclePhysics.ts: Vehicle physics.
Track Systems — src/track/
createMonzaTrack.ts: Monza circuit creation.
createTerrain.ts: Terrain creation.
createTestTrack.ts: Test track creation.
loadRaceline.ts: Raceline loading.
loadReferenceLap.ts: Reference-lap loading.
racelineFit.ts: Raceline fitting.
referenceLap.ts: Reference-lap functionality.
roadMesh.ts: Road mesh generation.
tracedWidths.ts: Traced track-width functionality.
trackCsv.ts: CSV handling.
trackGeometry.ts: Track geometry.
trackLoader.ts: Track loading.
widthZones.ts: Track-width zones.
Circuit Data — src/tracks/
Monza.csv
monza-raceline.csv
Scene Systems — src/scene/
createScene.ts: Scene creation.
createScenery.ts: Scenery creation.
Tools — src/tools/
autodrive-check.ts
autodrive-scenarios.ts
camera-check.ts
controls-check.ts
feel-check.ts
kml-to-widths.ts
validate-track.ts

These are development and diagnostic tools.

UI — src/ui/
fatalError.ts
hud.ts
Utilities — src/utils/
dispose.ts
math.ts
3. Track Data Architecture

The game uses CSV data for circuit geometry and raceline information.

Current data files:

Monza.csv
monza-raceline.csv

A sample track-data schema:

x_m,y_m,w_tr_right_m,w_tr_left_m

Fields:

x_m: Local X coordinate in meters.
y_m: Local Y coordinate in meters.
w_tr_right_m: Width to the right of the reference path.
w_tr_left_m: Width to the left of the reference path.

The precise coordinate conventions must be verified in trackCsv.ts and related geometry files.

4. Raceline Data

The project uses raceline data from:

https://github.com/TUMFTM/racetrack-database

Raceline information is used by the existing track and autodrive-related systems.

Do not assume the raceline CSV and manually traced track-width data are interchangeable.

Inspect their respective loaders before modifying either format.

5. Track Loading

Relevant modules:

trackCsv.ts
trackLoader.ts
trackGeometry.ts
roadMesh.ts
tracedWidths.ts
widthZones.ts
createMonzaTrack.ts

These modules collectively support the circuit data and geometry pipeline.

The exact order of processing and dependencies must be verified from source code.

6. Vehicle Architecture

Relevant modules:

createCar.ts
vehiclePhysics.ts
vehicleLimits.ts
controls.ts
gearbox.ts
autopilot.ts
chaseCamera.ts

Preserve existing system boundaries and interfaces.

Do not replace the physics or control implementation without first understanding how these modules interact.

7. Environment Architecture

Relevant modules:

createScene.ts
createScenery.ts
createTerrain.ts

The current environment includes basic terrain, trees and a blue sky.

Future scenery should be reusable and compatible with multiple circuits.

8. UI Architecture

Relevant modules:

hud.ts
fatalError.ts

A full track-selection menu is planned.

9. Performance Architecture

Performance is a core project requirement.

Asphra should remain lightweight and browser-accessible.

Future optimization should consider:

Geometry reuse.
Instanced meshes.
Draw-call reduction.
Efficient track meshes.
Resource disposal.
Terrain optimization.
Visibility management.
Efficient animation loops.

Do not introduce complex rendering systems without demonstrating their value.

10. Architecture Rules
Inspect existing code before modifying it.
Preserve public interfaces unless changes are coordinated.
Avoid duplicated systems.
Keep track loading reusable.
Keep circuit-specific data separate from rendering logic.
Avoid unnecessary dependencies.
Test changes in the browser.
11. Unverified Details

The following require source inspection:

Exact initialization sequence.
Exact track coordinate transformation.
Track mesh triangulation implementation.
Physics equations and update frequency.
Autodrive steering and braking algorithm.
Camera update behavior.
Terrain generation algorithm.
Actual browser performance characteristics.

Never invent these details.