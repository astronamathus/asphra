ASPHRA — FILE OWNERSHIP
1. Purpose

This document prevents multiple AI sessions from modifying conflicting files.

Every development task should have a defined owner.

2. Ownership Groups
Vehicle Developer

Primary files:

src/car/autopilot.ts
src/car/chaseCamera.ts
src/car/controls.ts
src/car/createCar.ts
src/car/gearbox.ts
src/car/vehicleLimits.ts
src/car/vehiclePhysics.ts

Responsibilities:

Vehicle handling.
Driving controls.
Gearbox.
Camera.
Autodrive.
Track Data Developer

Primary files:

src/track/trackCsv.ts
src/track/trackLoader.ts
src/track/loadRaceline.ts
src/track/loadReferenceLap.ts
src/track/racelineFit.ts
src/track/tracedWidths.ts
src/track/widthZones.ts
src/tracks/*

Responsibilities:

CSV formats.
Circuit data.
Raceline integration.
Track data validation.
Track Geometry Developer

Primary files:

src/track/trackGeometry.ts
src/track/roadMesh.ts
src/track/createMonzaTrack.ts
src/track/createTestTrack.ts

Responsibilities:

Road geometry.
Track boundaries.
Track surface.
Circuit geometry.
Environment Developer

Primary files:

src/scene/createScene.ts
src/scene/createScenery.ts
src/track/createTerrain.ts

Responsibilities:

Terrain.
Trees.
Vegetation.
Environmental details.
Lighting and atmosphere.
UI Developer

Primary files:

src/ui/*
src/style.css
index.html

Responsibilities:

HUD.
Menus.
Track selection.
Interface styling.
Integration Developer

Primary files:

src/main.ts
src/config.ts
src/types.ts
Shared interfaces and integration points.

Responsibilities:

System integration.
Application initialization.
Shared configuration.
Cross-system compatibility.
3. Shared File Restrictions

The following files require coordination before modification:

src/main.ts
src/types.ts
src/config.ts
src/track/trackLoader.ts
Shared CSV schemas.
Shared vehicle interfaces.
4. Ownership Rules
Check this file before starting work.
Check the active task assignments.
Do not modify another task's owned files without coordination.
Coordinate shared interface changes.
Record ownership in active assignments.
Release ownership when a task is completed.
5. Active Assignments
Task	Session	Branch	Files	Status
None recorded				

Update this table when tasks are assigned.

6. Important

Ownership is a coordination mechanism, not a permanent restriction.

The project integrator can authorize changes when required.

Always check the actual Git state before editing.