# Developer Brief: PlotPickle Bounded Storage and Retention System

**Decision date:** October 24, 2026  
**Issue:** [#3241](https://github.com/BryanHarrisScripts/PlotPickle/issues/3241)  
**Status: DESIGN APPROVED FOR RECORDING — FULL IMPLEMENTATION ON HOLD.** No deployment, file cleanup, background disk maintenance, arbitrary-path scan, or new authority is authorized by this brief. Restart implementation only on a later explicit development decision, after source-bound acceptance planning.

## Executive product rule

**A user who installs and uses PlotPickle must not discover that the application consumes unlimited disk space day after day without warning, limits, and a safe recovery path.**

This is a product-wide lifecycle invariant, not a Factory-only incident fix. Every automatic producer of persistent or temporary data must be identifiable, accounted for, preflighted, bounded, inspectable, and governed by safe retention rules. Normal creative work must not implicitly turn on developer engineering/PR staging. A safety limit never grants authority to destroy user-created work.

Existing project backup rules remain authoritative: at most 10 *automatic* packages and approximately 2 GiB in the automatic pool; manual backups remain protected until the owner explicitly deletes them. Follow [local-first storage architecture](../architecture/local-first-trust-storage.md), [initial incident brief](plotpickle-storage-lifecycle-2026-10-23.md) and [bounded inventory/dry-run contract](3241-storage-inventory-dry-run.md).

## Incident evidence and limits

On October 23 free disk space recovered to about 27.44 GB after an earlier near-full disk incident. On October 24 it measured about 15 GB free, though the complete delta has **not been attributed** to specific allocations.

In the owner Windows survey:
- There were **65** private `engineering-team/autonomous-queue/chat-candidate-stages` directories, all created in the five-day window.
- A bounded scan measured **13.44 GiB apparent/logical bytes in only 24 of those 65**; eight individual stages contained roughly 1.225–1.322 GiB / 45,000 files each. This is confirmed accumulation, **not** independently verified reclaimable physical space or an exact free-space delta.
- Six Factory issue worktree folders and 16 Story UAT folders were also created in the window.
- Only two of 39 runtime folders were created in the five-day window. It would be incorrect to conclude that 31 previously retired runtime folders were recreated.
- The broad C: survey was **PARTIAL** (730,612 entries; 15,228 inaccessible/changed directories; 43 skipped reparse points). Access errors do not prove corruption.

Existing PRs [#3281](https://github.com/BryanHarrisScripts/PlotPickle/pull/3281) and [#3282](https://github.com/BryanHarrisScripts/PlotPickle/pull/3282) provide bounded fixed-root and owner-initiated metadata observations. [#3283](https://github.com/BryanHarrisScripts/PlotPickle/pull/3283) is the first proposed **prevention slice** for opt-in PR staging: three retained stages maximum, eight GiB free-space threshold, and serialization/fail-closed behavior. It does **not** reclaim existing stage copies or constitute the complete system.

## Storage-class policy (proposed defaults, not implemented)

The product must own a reviewed, versioned policy manifest with default and effective limits and specific exception semantics. These initial numbers require real Windows measurements and user review before adoption.

| Class | Protection | Proposed budget/admission and retention | Safe release |
| --- | --- | --- | --- |
| PPF, Library, screenplay, locked/approved creative work and project state | Permanent user authority | No automatic deletion. Verify free space before imports and write transactions | Existing owner/project workflows only |
| Approved images, videos, audio, posters, characters, collectibles and project assets | Project/user protected | Per-project usage and warnings; proposed 10 GiB soft warning, user-settable media budgets and alternate destination | Owner/project-aware explicit action only |
| Unapproved previews, proxies, renders, frames and temporary generation files | Task/project scoped | Proposed 4 GiB temporary-preview warning, age and per-job limits; active/version-linked assets protected | Reference-verified review; automatic expiry only with separate opt-in |
| Automatic project backup | Existing backup manager | Preserve existing 10-package / ~2 GiB bounded automatic pool; manual packages never silently expire | Existing transactional backup service |
| Runtime dependency fingerprints | Host runtime manager | Keep active + independently verified fallback + user-selected 10 historical eligible Windows versions; named special-purpose runtimes exempt | Reference, process and task attestation plus owner review |
| Model weights and provider downloads | User-selected | Estimate size, destination and peak space; reuse verified downloads; never silently duplicate each update | Explicit owner decision |
| npm/package cache and derived build outputs | Host installer/Factory | Proposed 2 GiB soft limit per cache pool; distinguish safe rebuild cost from recoverable space | Typed and verified cache-owner cleanup only |
| Factory PR candidate stages | Opt-in developer capability, **off for ordinary installs** | Proposed maximum **three retained full stages** and preflight **8 GiB free**; byte cap needed in later slice | Git-registration and immutable-receipt proof; owner-confirmed staged retirement |
| Factory issue worktrees | Developer engineering owner | One active by default; at most three retained unreviewed; block uncertainty | Git-managed cleanup only when verified inactive/unreferenced |
| Story UAT, browser diagnostic outputs and temporary test frames | Verification producer | Proposed 2 GiB per active UAT space and at most three full traces; preserve minimal immutable evidence separately | Closed-run reference attestation and owner review |
| Logs and interrupted-install scratch | Responsible subsystem | Rotating size/age caps, e.g. 250 MiB log class; limit pre/post crash temporary state | Verified disposable data only |
| Manual exports, archives and explicitly named backups | Human owner | Always disclose size; never background-evict | Explicit Human action only |
| Unidentified, inaccessible, redirected, symlinked or ambiguous | Unknown, therefore protected | **BLOCKED/UNKNOWN**; no reclaimable-byte claim | No removal until independently classified |

Actual creative output can exceed proposed soft budgets with informed user consent. A low-disk safety floor may still pause new large writes; never delete completed media to satisfy a cap.

## Target architecture and typed contracts

Implement one host-owned **Storage Registry**, separate from creative canon:
- Each allocation has `allocationId`, storage class, trusted owner, project/job/PR/source references, approved canonical root, purpose, policy version, timestamps and lifecycle state (`PLANNED`, `RESERVED`, `WRITING`, `ACTIVE`, `RETAINED`, `REVIEWABLE`, `BLOCKED`, `RETIRED`, `FAILED_UNCERTAIN`).
- Record expected peak bytes, measured *apparent/logical* bytes, *physical allocated* bytes only where demonstrable, hardlink/inode accounting domain, volume identity, reservation, process/task/worktree references, and evidence manifests.
- Preserve source-bound receipts for allocation, release, crash recovery, errors and human review; use explicit `COMPLETE`, `PARTIAL`, `UNKNOWN` measurement states.
- Incrementally inspect only fixed, reviewed roots with bounded time/entries and durable checkpointing; prevent junction traversal, root redirect, time-of-check/time-of-use and overlapping/double-counted trees.
- Missing or stale registry entries never mean that a folder is safe to remove. Remote MCP returns sanitized category totals only; local trusted UI may display exact reviewed paths.

### Admission algorithm

Before installation/update, runtime download, project/media generation, staging, UAT, export, or cache expansion:
1. Resolve trusted storage class, allocation purpose, destination volume, job references and estimated peak + scratch + rollback cost.
2. Read effective class and per-project limits, measured free bytes and outstanding allocations/reservations **on that volume**.
3. Reject unknown root, incomplete ownership or capacity evidence with typed `STORAGE_CAPACITY_UNVERIFIED`. Compute `requiredFree=max(effectiveSafetyFloor,peakWrite+scratch+rollback+outstandingReservations)`.
4. Use a durable atomic reservation/admission ledger to prevent concurrent jobs from double-spending available bytes. A one-time disk free check is **not a reservation**.
5. Sample actual growth at checkpoints and alert at proposed 75% and 90% policy consumption. On limit, stop *new* writes safely, preserve completed user work and return typed `STORAGE_LIMIT_REACHED` / `DISK_SPACE_INSUFFICIENT` / `STORAGE_RESERVATION_CONFLICT`.
6. On success, reconcile actual usage and retire only verified scratch. On interruption, preserve an uncertain-state record and reconcile after restart; never automatically delete solely because a lease expired.

Choose safety floors by workload. The engineering-staging proposal of 8 GiB must not be misrepresented as a universal quota for simple text edits.

### Candidate worktree retirement

Every PR stage is a Git-registered checkout, not an ordinary cache. The retirement planner must correlate:
- canonical stage/worktree root and Git `worktree list --porcelain`;
- PR number/state, exact candidate SHA, task/request ID, receipt and verification artifacts;
- process handles, supervisor/scheduled task leases, active UAT, dirty/untracked changes and author-created edits;
- separate compact, immutable, source-bound verification evidence kept **outside** the full checkout.

Classify `KEEP`, `REVIEWABLE`, `BLOCKED`; never decide based on age alone. An unregistered, dirty, missing-receipt or redirected folder is **blocked**, not automatically orphaned/disposable.

A local dry-run must explain exact owner-visible path, dependencies and exclusions, file count, measured complete/partial size and cautious reclaim estimate. Before each owner-confirmed batch, revalidate root/Git ownership/receipt/process state. Use fixed-argument Git-managed worktree removal only for clean verified unreferenced checkouts. No generic recursive delete, blind `git worktree prune`, forced lock removal, or implicit repeat of uncertain failures. Verify actual disk free bytes before/after; append receipts, stop batch on error.

## Product and installer UX

Place a **Storage** surface in `Settings → Operations`, consistent with PlotPickle's defined/observed/emerging/blocked truth labels:
- Free/used bytes per volume; PlotPickle observed usage by class, growth over comparable 24h/7d complete measurements, last scan time and clear PARTIAL/UNKNOWN labels.
- Protected vs reviewable vs blocked bytes, active runtimes and fallback, user-selected historical versions, projects/media, generated temporary files, cache, manual/automatic backups and Factory/Story UAT.
- Budget defaults/overrides, forecast peak temporary space, optional destination choice for large model/media downloads, and warning before high-cost operations.
- `Review potential cleanup` shows owner-local paths, references, reclaim uncertainty, verification status, protected exclusions and explicit batch confirmation; **no "Clean everything"** action.
- Explain each STOP or low-space condition with non-destructive next steps, never requiring manual JSON edits.

On first installation, normal consumer mode must neither start developer staging nor create duplicate giant dependency snapshots after code-only upgrades. An unchanged verified runtime fingerprint should be reused, not reinstalled. Engineering mode is explicit opt-in. A full disk is a recoverable, transparent condition rather than a silent install failure.

## Security, privacy, and integrity boundaries

- No broad `C:\` scan over MCP. Whole-drive surveys require separate owner invocation; read only metadata within bounded I/O and time.
- Do not read private file contents, credentials, screenplays, images, prompts or project media for quota computation. No arbitrary path capability, even if a caller has valid authentication.
- Refuse reparse/junction ancestor traversal, path escapes, uncertain hardlinks/allocated bytes, permission ambiguities and changed nodes. Fail closed.
- **File access errors and modified timestamps are not proof of disk corruption**; OS filesystem validation is a distinct, read-only owner-controlled workflow, never conflated with cleanup.
- Any actual deletion remains a new, separately approved capability with independent tests and owner action; this document grants none.

## Delivery sequence — implementation deferred

1. **P0 prevention:** finish the independently green opt-in Factory staging brake and disk floor if appropriate. Do not confuse it with global quota governance.
2. **P1 measurement/ownership:** source-bound durable snapshots, per-root/class inventory, hardlink/physical allocation semantics, Git worktree registry and reference reconciliation, retained creative media inventory, stable continuation under large trees.
3. **P2 capacity admission:** durable per-volume reservation ledger and quotas for runtimes, caches, UAT, renders/media, installers; test concurrent jobs and interrupted jobs.
4. **P3 user visibility:** Settings → Operations storage reporting, warnings, policy controls, complete vs partial/protected distinction and reviewable dry-run.
5. **P4 retirement:** independent ownership proof, evidence-preserving staged retire, human-reviewed transaction, measured reclaimed bytes, fail-safe interruption and recovery.
6. **P5 full installer/Windows acceptance:** cold install, update/reinstall, long-run repeated creative workloads and Factory attempts, low-space handling, closed/open PR transitions and Windows recovery.

**Acceptance tests:** repeated 100+ source-only updates must not grow runtime fingerprints when dependency lock is unchanged; 100+ bounded stage attempts never create a fourth retained PR stage without explicit lifecycle disposition; no unsupported automatic deletion under low-space, crash or partial scans; protected media/PPF never mutated; measured before/after free bytes distinguish apparent from reclaimed; mixed-volume reservations cannot oversubscribe; safe local Windows paths/junctions; user-visible warning and stop; source-bound verified receipts, architecture CI, actual Windows fixture/product UAT and STOP/sentinel proof.

## Implementation hold and go/no-go

**HOLD:** Full quota engine, UI, registry, reservation system and retirement/delete routes. The brief is the handoff artifact. Do not open broad implementation PRs or delete the existing 65 stages under cover of this approval.

**RESUME ONLY when requested:** Reconfirm policy thresholds with real Windows/user benchmarks, stage the smallest independently testable slice, run Build → Test → Fix → Independent verification → PR → Merge when green. Ensure #3241 stays open until all required product acceptance tests pass. Security [#3279](https://github.com/BryanHarrisScripts/PlotPickle/issues/3279) and collaborative workspace [#3263](https://github.com/BryanHarrisScripts/PlotPickle/issues/3263) remain distinct queued work.
