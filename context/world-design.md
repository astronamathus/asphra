ASPHRA — WORLD DESIGN
1. World Concept

Asphra recreates real-world Formula 1 circuits using manually prepared track data and CSV-based geometry.

Each circuit should resemble its real-world counterpart in layout, proportions and recognizable surroundings.

The objective is not to generate generic procedural roads.

The objective is to recreate real racing circuits.

2. Circuit Accuracy

Circuit outlines are manually plotted using Google Maps as a visual reference.

The goal is accurate visual proportions and faithful track layouts.

The game should preserve:

Circuit shape.
Corner sequences.
Straights.
Track width variations.
Recognizable circuit features.
Elevation changes where data is available.

Exact real-world scaling should be approached carefully and verified against available data.

3. Track Data

Each circuit should have its own data files.

The project uses:

CSV-based geometry.
Raceline data.
Manually plotted track features.
Additional track-width information.

The TUMFTM racetrack database is used as a raceline data source:

https://github.com/TUMFTM/racetrack-database

Track geometry and raceline information are separate concepts and must not be confused.

4. Current Monza Implementation

Monza is the first implemented circuit.

Current confirmed features:

Inner and outer track outline traced using Google Maps.
CSV-based track data.
Road surface.
Surrounding terrain.
Basic trees.
Blue sky.

Additional details remain to be developed.

5. Track Features

Future circuit data may include:

Road Geometry
Track centerline.
Inner boundary.
Outer boundary.
Track width.
Road surface.
Road Details
Kerbs.
Pit lanes.
Runoff areas.
Track markings.
DRS-related markings where appropriate.
Circuit Infrastructure
Barriers.
Fences.
Pit buildings.
Grandstands.
Marshal posts.
Trackside structures.
Environment
Trees.
Grass.
Hills.
Buildings.
Mountains.
Water.
Other recognizable landmarks.
6. Terrain

Terrain should complement the actual circuit.

It should not interfere with track geometry or driving.

The environment should reflect the real-world location of each circuit as closely as practical.

Terrain systems should be reusable across circuits.

7. Scenery

The initial environment is intentionally simple.

It currently includes basic trees and terrain.

Future scenery should be recognizable and circuit-specific while maintaining the project's low-poly art direction.

8. Coordinate System

The project contains track data with the following documented sample schema:

x_m,y_m,w_tr_right_m,w_tr_left_m

Interpretation:

x_m: X coordinate in meters.
y_m: Y coordinate in meters.
w_tr_right_m: Track width to the right.
w_tr_left_m: Track width to the left.

These fields describe a reference path and associated widths.

The exact coordinate origin, orientation and conversion pipeline must be verified in the source code.

Do not assume that these coordinates are geographic latitude and longitude.

9. Circuit Expansion

Each additional circuit should use a consistent data structure.

A universal circuit-loading system should make adding new circuits straightforward.

Circuit-specific geometry must not require a completely separate rendering architecture.

10. Visual Priorities
Accurate road geometry.
Recognizable circuit surroundings.
Consistent terrain.
Low-poly scenery.
Performance-efficient environmental detail.