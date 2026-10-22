# #3118 — Bounded owner-Windows Story Factory worktree diagnostics

## Evidence leading to this slice

On clean owner-Windows main `58676439784299cb580c4a20b67b6a47a3d7dadc`, unique immutable `factory-story-uat` request `7a2e91bc4d8f4a669ce70a5b31f2d804` returned **BLOCKED / PRODUCT_UAT_STAGE_UNVERIFIED** before launching a browser. Earlier 55-checkpoint owner-Windows PASS and independent evidence attestation were on an older commit and cannot be promoted to current acceptance. In the existing staging helper, private `git worktree add --detach`, exact SHA, and tracked-clean failures all collapsed to `null`; the caller could not tell whether the failure involved disk, lock, prior worktree, permissions, path length, Git, wrong SHA or dirty staged source.

## First corrective slice — diagnose; do not auto-repair

`stageFactoryStorySource()` keeps its original contract: return a verified absolute staged path **only on success**, otherwise `null`. It accepts a trusted local `onFailure` callback. That callback and `runFactoryStoryUat()` classify a failure from local error code/stderr into an explicit *fixed enum*:

`WORKTREE_DISK_FULL`, `WORKTREE_LOCKED`, `WORKTREE_EXISTS`, `WORKTREE_FILE_ACCESS`, `WORKTREE_PATH_UNSUPPORTED`, `WORKTREE_GIT_UNAVAILABLE`, `WORKTREE_HEAD_MISMATCH`, `WORKTREE_DIRTY`, or `WORKTREE_GIT_FAILED`.

These classifications are **observations, not proven root causes**. They are never success, never a source-write grant and never permission to delete old private worktrees. Raw Git stdout/stderr, filesystem paths, stack traces, credentials, story content and exception strings are **not** included in the public output. The immutable MCP control receipt now attaches `stageReason` only when the outcome is BLOCKED with `PRODUCT_UAT_STAGE_UNVERIFIED` **and** the value is one of the reviewed enumerations; otherwise null. Browser execution remains impossible when private source stage is unverified. The same immutable request ID is never replayed, and owner source `main` is not reset or cleaned.

## Proof boundaries

Runtime unit tests inject Git errors including private and adversarial diagnostic text, verify each bounded class, ensure no browser execution, verify source HEAD/dirty stage cases still fail, and exercise the **actual authenticated MCP one-attempt control and durable receipt**. No secrets or arbitrary paths escape. W8/W9 source digests remain pinned.

CI fixtures **cannot attest** the actual Windows private worktree state, free disk, orphaned Git metadata, owner-process STOP, Story Factory journey or independent browser evidence. After green-only merge and guarded owner-host sync, the next real owner-Windows `factory-story-uat` invocation with a **new** request ID can report the precise safe `stageReason`. A later bounded repair can target the demonstrated cause without blindly pruning worktrees. Do **not** close #3118 on this diagnostic slice.
