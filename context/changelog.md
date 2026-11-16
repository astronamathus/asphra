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
