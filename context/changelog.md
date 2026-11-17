ASPHRA — CHANGELOG

All significant development changes must be recorded here.

The changelog provides a historical record of the project's evolution.

Development History
Initial Development
Added
Initial Three.js and TypeScript project.
Vite development environment.
Basic application structure.
Initial Formula-style vehicle.
Vehicle control and physics modules.
Gearbox system.
Chase camera.
Autodrive functionality.
Track Development
Initial Monza circuit implementation.
CSV-based track data loading.
Monza track geometry.
Track boundary and width processing.
Raceline data integration.
Reference-lap functionality.
Track validation tools.
Environment
Basic Three.js scene.
Road surface.
Surrounding terrain.
Basic trees.
Blue sky.
Development Tools
Autodrive checks.
Autodrive scenarios.
Camera checks.
Controls checks.
Vehicle feel checks.
KML-to-widths conversion tool.
Track validation tool.

Note: These entries reflect the known project foundation. Exact implementation dates and commit references have not yet been verified.

Change Entry Template
[YYYY-MM-DD] — [Task ID] — [Feature Name]

Developer:

Branch:

Added
Changed
Fixed
Technical Details
Files Modified
Testing
Known Limitations
Related Documentation
Changelog Rules
Record meaningful changes.
Include task IDs whenever available.
Identify modified files.
Describe technical decisions.
Record relevant testing.
Do not claim untested functionality works.
Keep entries chronological.
Never delete important development history.
[2026-11-15] — TASK-011 — Procedural asphalt surface

Developer: ChatGPT
Branch: main

Added
- Seamless 512 × 512 procedural asphalt aggregate DataTexture.
- Fine, medium and broad periodic noise with sparse aggregate flecks.

Changed
- Road material now samples the procedural texture while retaining the existing asphalt base colour and UV scale.
- Road material texture maps are explicitly disposed with their meshes.

Technical Details
- The existing road UVs repeat every CIRCUIT.uvMetersPerRepeat metres (10 m by default).
- Texture noise is periodic in both axes to avoid visible tile seams.
- No external image assets or dependencies added.

Files Modified
- src/track/asphaltTexture.ts (created)
- src/track/roadMesh.ts
- src/utils/dispose.ts

Testing
- Source-level integration checked.
- TypeScript build and browser appearance not yet verified.

Known Limitations
- This pass adds aggregate grain and subtle tonal variation only; rubbered-in racing lines, patch repairs and painted surface details remain future work.

[2026-11-15] — TASK-012 — Racing-line rubber deposits

Developer: ChatGPT
Branch: main

Added
- Two subtle tyre-width rubber deposit ribbons following the fitted Monza racing line.
- Road-boundary checks prevent deposits from extending onto grass.
- Semi-transparent dark material preserves the underlying asphalt aggregate.

Files
- src/track/rubberDeposits.ts (created)
- src/main.ts (integrated after racing-line fitting)

Testing
- Source integration checked; build and visual validation remain outstanding.

[2026-11-15] — TASK-011 refinement — Asphalt aggregate contrast

Removed the experimental racing-line rubber deposits after visual feedback found them artificial.
Increased the procedural asphalt texture's tonal range and aggregate contrast:
- Stronger fine and medium periodic noise.
- Irregular darker aggregate particles and occasional lighter grains.
- Subtle broad-scale variation to break up the flat grey appearance.
- Retained seamless periodic generation, existing 10 m UV scale and matte road material.

Files
- src/track/asphaltTexture.ts
- src/main.ts
- src/track/rubberDeposits.ts (deleted)

Testing
Source integration verified from GitHub. Build and in-browser visual inspection not performed.


2026-11-16 — Manual DRS and animated rear-wing flap
- Added held Space request for manual DRS, gated by the existing Monza DRS zones and throttle/brake conditions.
- Preserved automatic DRS while autodrive is active; Space does not hand control back from autodrive.
- Added smooth rear-wing flap movement and HUD readiness/active states.
- Build and in-browser visual verification remain outstanding.


[2026-11-16] — TASK-014 — Formula car visual redesign and T-Cam refinement

Developer: ChatGPT
Branch: main

Added / Changed
- Refined the car's layered front wing and endplates, sidepod inlet lips and floor-edge details.
- Added visible floor and diffuser channel detailing, plus a more layered rear-wing assembly.
- Improved cockpit presentation with a recessed rim, driver visor, steering wheel detail and a small T-Cam housing.
- Reduced the default DRS flap angle from 0.2 rad to 0.075 rad so it sits much closer to the rear-wing mainplane at rest; the open target remains 0.015 rad.
- Repositioned the C-key cockpit view to a higher, rearward T-Cam-like mount, narrowed its base FOV from 88 to 80 degrees and added a subtle downward pitch. Speed-related FOV expansion is reduced.

Technical Details
- Existing car dimensions, wheel setup, steering animation, physics interface and camera toggle contract are preserved.
- The camera remains fixed relative to the car and follows its orientation; it is not a separately implemented broadcast camera.

Files Modified
- src/car/createCar.ts
- src/car/chaseCamera.ts
- src/config.ts
- context/task-queue.md
- context/changelog.md
- context/ai-handoff.md

Testing
- Source-level inspection and targeted replacement checks completed.
- npm run build and in-browser visual checks were not available in this workflow.

Known Limitations
- Geometry is procedural Three.js geometry, not a high-detail imported model.
- T-Cam composition, camera clipping and exact visible proportions still require in-game inspection and tuning.
- The DRS flap rest gap and open animation require visual verification from both camera modes.


[2026-11-16] — TASK-015 — Low-poly Formula body and articulated DRS airfoil

Developer: ChatGPT
Branch: main

Added / Changed
- Replaced the cylindrical nose placeholder with an original faceted tapered nose loft, widening progressively into the monocoque.
- Rebuilt the rear-wing upper flap as a shaped airfoil profile on a leading-edge hinge.
- Kept the rear-wing mainplane and endplates fixed while the flap moves independently.
- Increased the flap travel between closed and DRS-open states and added visible hinge caps.
- Used the supplied Sketchfab screenshots as general visual references; no third-party model geometry or textures were imported.

Files Modified
- src/car/createCar.ts

Testing
- Source updated through GitHub.
- Build and in-game visual verification have not been run.

Known Limitations
- The full body still uses procedural Three.js geometry and retains existing wheel, sidepod and cockpit construction; this is an incremental silhouette improvement, not a complete imported-model replacement.
- Nose proportions, flap pivot direction, endplate clearance and camera presentation require in-game visual inspection.


[2026-11-17] — TASK-016 — User-supplied low-poly GLB integration preparation

Developer: ChatGPT
Branch: main

Source Asset
- User uploaded F1 low poly.glb (ImageToStl.com glTF 2.0 export).
- Inspected the GLB structure: 17 nodes, 16 mesh references, 33 materials, no animation clips.
- The steering wheel is included as geometry. The rear wing is static; there is no separate animated DRS node or animation clip.

Asset Preparation
- Recoloured the original body and livery materials to racing red; darkened grey trim to charcoal.
- Removed the oversized studio background mesh.
- Applied a scale/orientation transform to fit the existing game car coordinate system and dimensions.
- Generated /mnt/data/F1-low-poly-red.glb for the user.

Code Changes
- Added GLTFLoader integration and a procedural fallback in src/car/createCar.ts.
- Kept a separate animated DRS flap overlay because the uploaded GLB's rear wing is static.
- Aligned the DRS overlay approximately to the imported rear wing.
- Adjusted COCKPIT_CAMERA framing to bring the supplied steering wheel into view.

Files Modified
- src/car/createCar.ts
- src/config.ts

Important Deployment Step
- The generated binary asset has not yet been added to the Git repository. Place it at public/models/F1-low-poly-red.glb for the loader path to resolve. Until then, the existing procedural car remains visible as fallback.

Controls
- Left Shift remains a toggle for manual DRS. Existing zone, throttle and brake gates remain intact.

Testing
- GLB parsed and reloaded successfully with transformed bounds approximately 2.0 m wide, 5.6 m long and 1.17 m high.
- No npm build or in-browser visual test run.
