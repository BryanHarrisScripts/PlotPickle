# PP-AFTERGLOW-CONSOLIDATE-001 — Human Account Consolidation Truth

**Status:** Human-directed, implementation in phases under issue #2863. Phase 1 planner is review-only; no profile mutation or example publication.

## Governing Human Truth

The signed-in Human's PlotPickle account must be able to merge **any and all supported project field changes** across its saved Afterglow working copies into one complete current Afterglow. No valid older change may be lost just because another working copy has a newer date. The Human decides when that consolidated project is ready to be promoted to the **provided example**. Promotion is a separate explicit release event.

## Rules and proof obligations

- **TRUTH 1 — All durable fields:** Enumerate the canonical project schema, not selected screen labels. Preserve Foundations, World, Mind Map accepted storyDevelopment fields and Mind Map notes, Build artifacts/locks, Production, Structure, Writing, Discovery, World Map, mutable screenplay evidence, and every other supported durable project field. New schema fields require an explicit adoption review; quietly omitting them from promotion is failure.
- **TRUTH 2 — Authority:** Merge only snapshots from the currently authenticated profile. Profile history and private account credentials never become public GitHub source files. No automatic startup import or foreign-account reconciliation.
- **TRUTH 3 — Baseline comparison:** Compare each complete saved project with the trusted packaged Afterglow baseline while preserving immutable `afterglow-v9-complete-baseline` reference provenance. Three dated saved projects are three distinct versions, *not* three incremental patches or proof that newest contains every older decision.
- **TRUTH 4 — Deterministic conflict resolution:** Non-overlapping edits combine; identical accepted edits converge. Distinct values for one field, deletion or clearing of approved facts, ambiguous list ordering, competing visual approvals or different media identities become visible conflicts or needs-review. Timestamp is not creative authority. Missing fallback prose is not an approved Human decision.
- **TRUTH 5 — Stable entity identity:** Merge character visuals and Shot/artifact records using proven immutable IDs. Never zip positional anonymous arrays, fabricate entity IDs, concatenate incompatible approvals, or change media lock/source identity silently.
- **TRUTH 6 — Verify before commit:** Preview source IDs/revisions, proposed field changes, conflicts, unresolved erasures, and referenced media. Before creating a *new* account-owned consolidated working copy, independently verify every referenced asset and a round-trip readback of the full project. Keep originals/recovery points until the Human confirms success.
- **TRUTH 7 — Clear normal UI, preserve history:** After a successful account consolidation, open the current consolidated Afterglow by default while keeping `Load the provided example` available. Older copies may be hidden from ordinary opening and archived reversibly, but cannot be silently deleted or falsely called merged.
- **TRUTH 8 — Publishing authority:** Never update `data/afterglow-packaged-current` or its Git-backed media on Save, Restore, or Consolidate. Only explicit Human `Promote current Afterglow` approval triggers the existing reviewed package-export/media-mapping process and green GitHub gates.

## Formal contracts

Let `B` be the trusted official packaged reference, `S = {S1 ... Sn}` the authenticated account's durable working snapshots, and `D(B,Si)` the set of supported field/entity differences, identified with canonical paths and stable IDs. Let `C` be the candidate.

- `Candidates = Union(D(B,Si))`, **not** `latest(S)` and not entire-state overwrite.
- `NonConflicting(change-set) => deterministic proposal in C`.
- `Conflict OR unknown deletion/ordering => HumanReviewNeeded`; no timestamp chooses winners.
- `ConsolidationPreview => NoMutation(B,S,AccountState,GitHubPackage)`.
- `CommitAllowed => HumanConfirmation AND NoUnresolvedConflicts AND MediaVerified AND SchemaRoundTripVerified`.
- `PublishAllowed => SeparateHumanPromotionApproval AND ValidatedExport AND AllMediaGitBacked AND TestsGreen`.

**Phase 1 implementation boundary:** pure `planAfterglowConsolidation` exposes a proposed candidate, applied paths, explicit conflicts, Human-review items and local asset URLs requiring verification. It intentionally reports `readyForHumanCommit: false`, because an offline planner alone cannot authenticate an account, verify bytes or persist a safe project. Phase 2 must deliver authenticated UI merge review, Human conflict decisions, durable new working copy and an ordinary clean opening. Phase 3 promotes only upon later explicit Human request.

## Independent verification

Test field-complete packaging, non-overlapping changes spanning Mind Map/World Map/Storyboard, identical decisions, direct contradictions, attempted deletion, changed source identity, reordering, duplicate project IDs and ambiguous dialogue-approval collections. After Phase 2, use the Human's real local Afterglow account for a 3-copy merge, Save/Lock, unload and Windows restart readback. No test can claim to access that account's encrypted private data from GitHub CI.
