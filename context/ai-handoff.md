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