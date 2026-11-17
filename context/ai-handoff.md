ASPHRA — AI HANDOFF PROTOCOL
1. Purpose

This document ensures that work can be transferred between different AI sessions without losing important development context.

The repository and context documentation are the shared source of truth.

Conversation history is not the source of truth.

2. Before Starting Work

Every AI session must:

Read master-context.md.
Read coding-rules.md.
Read technical-architecture.md.
Read its relevant design documentation.
Read task-queue.md.
Read file-ownership.md.
Read the latest handoff.
Inspect the current source code.
Check the current Git branch and working tree.

Do not assume previous AI descriptions are accurate without checking the repository.

3. During Development

The assigned AI must:

Work on its assigned task.
Preserve unrelated functionality.
Record important discoveries.
Document architectural changes.
Identify bugs.
Avoid conflicting modifications.
4. Handoff Requirements

Before ending a session, update this document.

Handoff Template

Task ID:

Previous AI:

Date:

Git branch:

Task status:

Work Completed

Describe what was implemented.

Files Modified

List every created, modified or deleted file.

Current Implementation State

Describe what currently works.

Technical Discoveries

Record important information about existing systems.

Outstanding Work

Describe unfinished implementation.

Bugs

Record discovered or introduced bugs.

Testing

Describe tests performed and their results.

Integration Requirements

Identify systems that need to integrate with the work.

Next Steps

Provide an ordered list of actions for the next developer.

Documentation Updated

List all updated context files.

5. Next AI Instructions

The next AI must:

Read this handoff.
Inspect the latest repository state.
Check the relevant Git branch.
Verify the reported implementation.
Continue existing work rather than rebuilding it.
Ask for clarification when requirements are ambiguous.
6. Handoff History

Keep older handoffs in a dated history section or Git history.

The current handoff should always describe the latest relevant development state.

7. Important Rule

Never assume that a previous session successfully completed a task just because it reported completion.

Verify the code and tests.
Handoff — 2026-11-15

Task ID: TASK-011
Previous AI: ChatGPT
Git branch: main
Task status: Implemented; awaiting build and in-game verification

Work Completed
Added a seamless procedural asphalt aggregate texture and connected it to the existing Monza road material. The existing road geometry, UV convention and 10 m repeat scale are unchanged.

Files Modified
- src/track/asphaltTexture.ts (created)
- src/track/roadMesh.ts
- src/utils/dispose.ts
- context/changelog.md
- context/task-queue.md
- context/ai-handoff.md

Technical Discoveries
- Road UV V coordinates are generated from centerline distance divided by CIRCUIT.uvMetersPerRepeat.
- The current default texture repeat length is 10 m.
- Material disposal did not previously dispose texture maps; road texture map disposal was added.

Outstanding Work
1. Run npm run build.
2. Inspect the asphalt in browser at driving and close-up distances.
3. Tune aggregate contrast and apparent scale if needed.
4. Consider adding racing-line rubbering only after the base material is visually approved.

Testing
No local build or browser test executed in this session.


Handoff — 2026-11-15
Task: TASK-012 — Racing-line rubber deposits
Status: Implemented on main; awaiting build and visual check.

Added src/track/rubberDeposits.ts and integrated it in src/main.ts after raceline fitting. Two subtle tyre-width ribbons follow the fitted racing line and are checked against actual road boundaries. Build and browser validation have not been run.

Handoff — 2026-11-15
Task: TASK-011 — Asphalt material refinement
Status: Implemented on main; awaiting build and in-game visual verification.

Removed experimental rubber deposits and their main.ts integration. Increased asphalt texture contrast using stronger periodic fine/medium grain, sparse irregular darker particles, occasional lighter flecks and subtle broad-scale tonal variation. Retained 512 × 512 DataTexture, seamless wrapping, current road UV repeat scale and matte material.

Files
- src/track/asphaltTexture.ts (updated)
- src/main.ts (rubber integration removed)
- src/track/rubberDeposits.ts (deleted)
- context/changelog.md, context/task-queue.md, context/ai-handoff.md (updated)

Testing
Source-level checks only. No build or browser session available in this workflow.
Next
Run npm run build and inspect in-game. If aggregate reads too noisy close-up or still too flat at driving distance, tune contrast and scale before starting runoff geometry.


Handoff — 2026-11-16

Task ID: TASK-013 — Manual DRS and rear-wing animation
Previous AI: ChatGPT
Git branch: main
Task status: Implemented; awaiting build and in-game verification

Work Completed
- Added held Space input for manual DRS requests.
- Manual DRS only opens within configured Monza zones, with throttle above 90% and brake below 10%.
- Autodrive continues to request DRS automatically in those zones.
- Added a pivoting rear-wing flap that smoothly moves to a low-drag position while DRS is open.
- HUD now shows DRS readiness in a zone and DRS OPEN while active; controls list explains Space.
- Space does not cancel autodrive.

Files Modified
- src/car/controls.ts
- src/car/createCar.ts
- src/main.ts
- src/ui/hud.ts
- context/task-queue.md
- context/ai-handoff.md
- context/changelog.md

Testing
No local build or browser visual test was run in this workflow. Run npm run build and verify manual activation/release, zone entry/exit, throttle/brake cut-outs, autodrive, and flap animation.
