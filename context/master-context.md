ASPHRA — MASTER PROJECT CONTEXT
1. Project Identity

Name: Asphra

Genre: Formula racing / driving

Platform: Web browser

Technology: Three.js, TypeScript, Vite

Visual Style: Low-poly, semi-realistic

2. Core Vision

Asphra is a lightweight browser-based Formula racing game inspired by PolyTrack, Slowroads.io and Roblox's Apex Formula Racing.

The ultimate goal is to recreate the experience of driving Formula-style racing cars around real-world Formula 1 circuits, while keeping the game accessible and lightweight enough to run in a web browser.

The game prioritizes driving experience, handling, circuit accuracy and recognizable environments over photorealistic graphics.

Core Design Philosophy
Authentic Formula-style driving experience.
Faithful recreations of real-world F1 circuits.
Accurate visual proportions and track layouts.
Low-poly environments with recognizable real-world landmarks.
Lightweight browser performance.
Modular development and reusable track systems.
3. Design Inspirations
PolyTrack: Low-poly racing presentation and accessible driving.
Slowroads.io: Driving experience, environment and atmosphere.
Apex Formula Racing (Roblox): Formula-style driving and racing experience.
F1 25: Inspiration for future camera options and presentation.

These are inspirations, not instructions to copy their implementations.

4. Current Development State
Implemented
Three.js rendering environment.
TypeScript and Vite development setup.
Formula-style player car.
Player-controlled driving.
Vehicle physics and gearbox systems.
Optional autodrive functionality.
Chase camera.
Monza track implementation.
CSV-based track data loading.
Monza track outline and width data.
Road surface.
Basic surrounding terrain.
Basic trees.
Blue sky.
Raceline data sourced from the TUMFTM racetrack database.
Partially Implemented / Under Development
Track geometry and width processing.
Raceline fitting.
Reference-lap functionality.
Track validation.
Vehicle handling refinement.
Camera refinement.
Terrain and scenery systems.
Planned
Multiple selectable F1 circuits.
Track selection menu.
Detailed circuit-specific surroundings.
Curbs, barriers, pit lanes and runoff areas.
More realistic circuit elevation.
Improved environmental detail.
Additional camera options inspired by F1 25.
Potential AI opponents.
Potential multiplayer.

Do not represent planned features as completed.

5. Current Circuit

Monza, Italy

Monza is the first circuit being developed.

Its outline has been manually traced using Google Maps as a visual reference.

The project uses CSV data to represent circuit geometry and track widths.

The TUMFTM racetrack database provides raceline information.

Additional circuit features are being mapped manually.

6. Technology Stack
Three.js
TypeScript
Vite
HTML
CSS

See package.json for the actual installed dependencies.

7. Project Structure
src/car/: Vehicle systems.
src/track/: Circuit loading, geometry and road systems.
src/tracks/: Circuit CSV data.
src/scene/: Scene and environment systems.
src/ui/: Interface.
src/tools/: Development and validation tools.
src/utils/: Shared utilities.
src/types.ts: Shared types.
src/main.ts: Application entry point.
8. Development Priorities
Establish a reliable universal circuit loading system.
Refine Monza's track geometry.
Improve vehicle handling.
Improve circuit elevation and road accuracy.
Establish reusable circuit data formats.
Develop the track selection system.
Expand environmental detail.
Optimize browser performance.
9. Non-Negotiable Principles
Preserve existing working functionality.
Never invent implementation details.
Do not replace working systems without justification.
Maintain consistent circuit data formats.
Prioritize driving feel and track accuracy.
Optimize without unnecessarily sacrificing the intended experience.
Keep systems modular and reusable.
10. Documentation

All shared project documentation lives in /context/.

Every AI developer must read this file before starting work.

See the other context files for detailed specifications.

11. Unknowns

The following details must be verified through source inspection:

Exact coordinate conversion implementation.
Exact CSV loading pipeline.
Exact vehicle physics model.
Exact autodrive implementation.
Current road mesh construction method.
Current terrain generation method.
Exact performance targets.

Never assume these details without inspecting the source code.