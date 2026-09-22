# Developer Brief — #2354 DSDD Interpret → Pi Draft → Publish Brief

## Decision

Conversational UAT is a specification handoff surface, not a voice-triggered autonomous coding surface.

The Human workflow is:

```text
Narrate
→ Interpret
→ Human reviews the DSDD meaning
→ Pi Draft
→ Human reviews repository-aware technical guidance
→ Publish Brief
→ GitHub Issue
→ normal developer implementation / test / PR / merge workflow
```

## Action contract

### Clear Draft

Clears only the current narration textarea. It does not clear conversation, locked intent, Pi draft, publication metadata or the authenticated DSDD session.

### Interpret

Persists Human narration and asks the local Quality model to reflect the intended product outcome. The response is instructed to stay under 3,500 characters and is hard-bounded to 6,000 characters before session persistence. The existing 128 KiB DSDD request limit remains unchanged.

Interpret performs no repository or GitHub mutation.

### Pi Draft

Locks the latest reviewed interpretation as Intent vN and invokes PlotPickle-managed Pi with the existing read-only runner.

Allowed Pi tools are exactly:

- read
- grep
- find
- ls

Pi Draft produces an implementation-grade technical brief from repository evidence. It may identify architecture ownership, existing contracts/primitives, likely files/symbols, the smallest implementation path, deterministic verification, risks, do-not-change boundaries and unknowns.

Pi Draft cannot edit files, run shell commands, create a worktree, commit, push, create an Issue/PR or merge.

### Publish Brief

Explicit Human action after Pi Draft.

Publish Brief creates one GitHub Issue in `BryanHarrisScripts/PlotPickle` containing Human intent, DSDD interpretation, locked requirements/digest/context and the Pi technical draft. Publication metadata is written back to the DSDD session before optional Pi-session provenance is appended, so the same locked intent is not published twice from repeated clicks.

Publish Brief does not create a branch or pull request.

## Removed behavior

The Conversational UAT gateway no longer exposes the old `build` action and no longer launches `scripts/run-uat-repair-agent.mjs`.

The repair agent still exists for its explicit UAT/developer workflows. It is simply no longer invoked by DSDD approval.

## Architecture

Layer 2 Experience Contract owns the visible action semantics and Human review sequence.

Layer 4 Agent & Skill Mesh owns locked intent, persistent Pi provenance, read-only Pi Draft and explicit GitHub Issue handoff.

Layer 6 Provider Runtime continues to own local generation plumbing; #2354 does not add a new provider.

## Acceptance

1. Buttons are Clear Draft, Interpret, Pi Draft and Publish Brief.
2. Clear Draft only clears the textarea.
3. Interpretation output is bounded before persistence.
4. The 128 KiB DSDD request safety cap remains intact.
5. Pi Draft is read-only with read/grep/find/ls.
6. No DSDD path starts the UAT repair/coding worker.
7. Pi Draft is stored in the authenticated DSDD session and persistent Pi provenance.
8. Publish Brief creates exactly one GitHub Issue per locked intent.
9. Published Issue contains Human + DSDD + Pi technical context.
10. No DSDD action creates a worktree, branch, commit, PR or merge.
11. Exact-head GitHub CI remains the downstream implementation merge authority.
