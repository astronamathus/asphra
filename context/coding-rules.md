ASPHRA — CODING RULES
1. General Principles

Every developer, human or AI, must follow these rules.

Inspect existing code before making changes.
Understand the system before modifying it.
Preserve working functionality.
Avoid unnecessary rewrites.
Avoid duplicated functionality.
Use existing utilities and interfaces.
Keep code modular.
Use TypeScript appropriately.
Avoid unnecessary dependencies.
2. Scope Control

Only work on the assigned task.

Do not:

Rewrite unrelated systems.
Change unrelated files.
Refactor entire modules without approval.
Replace existing working implementations without justification.
Introduce speculative functionality.

If an additional change is necessary, explain why before proceeding.

3. Vehicle Systems

When modifying vehicle systems:

Preserve existing controls.
Maintain consistent physics updates.
Test acceleration and braking.
Test steering behavior.
Test stability.
Avoid introducing conflicting input systems.
Preserve autodrive compatibility where applicable.

Driving feel is a major part of Asphra's identity.

4. Track Systems

When modifying track systems:

Preserve existing CSV compatibility.
Verify coordinate conventions.
Maintain consistent track orientation.
Preserve left/right width conventions.
Avoid introducing unexpected geometry discontinuities.
Check road mesh alignment.
Validate track boundaries.
Test corner transitions.
Preserve raceline compatibility.

Never silently change CSV schemas.

5. Circuit Accuracy

Real-world circuit geometry is a core feature.

Do not approximate or redesign manually mapped circuit sections without approval.

Performance optimizations must preserve the intended circuit layout.

6. Three.js Performance

Prefer:

Geometry reuse.
Material reuse.
Instancing for repeated objects.
Efficient rendering.
Appropriate resource disposal.
Avoiding unnecessary object allocation inside animation loops.

Dispose of resources when they are no longer needed.

Avoid unnecessary draw calls and expensive visual effects.

7. Environment Development

New scenery should:

Follow the art direction.
Match the circuit's surroundings.
Avoid interfering with driving.
Be performance-conscious.
Reuse geometry where appropriate.
8. Shared Files

Coordinate modifications to:

main.ts
config.ts
types.ts
Shared track interfaces.
Shared vehicle interfaces.
Global rendering configuration.

Never overwrite another developer's work.

9. Testing

Run relevant project checks before reporting completion.

Inspect package.json for available scripts.

Test:

Compilation.
TypeScript errors.
Runtime behavior.
Relevant gameplay systems.
Existing functionality affected by changes.

Never claim a test passed if it was not executed.

10. Documentation

Update relevant context documentation after meaningful changes.

At minimum:

Update changelog.md.
Update task-queue.md.
Update ai-handoff.md when handing work over.
Update known-bugs.md when bugs are discovered or resolved.
11. Completion Report

Every task must finish with:

Task completed.
Summary of implementation.
Files created.
Files modified.
Tests performed.
Known limitations.
Outstanding bugs.
Integration requirements.
Documentation updated.
12. Golden Rule

Continue the existing Asphra project.

Do not treat it as a blank project or rebuild systems simply because another implementation seems easier.