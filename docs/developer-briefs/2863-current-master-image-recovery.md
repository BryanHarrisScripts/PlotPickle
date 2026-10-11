# Issue 2863: selected image recovery into the current master

The Human's consolidated Afterglow master loads, but original character images are missing. Reopening the full consolidation review starts from the packaged baseline and revisits already resolved creative alternatives. Add a separate missing-image review against the encrypted, ledger-verified current master.

Scope: inventory exact missing WebP references from saved working/history/recovery snapshots and the provided example; let the Human select only the desired frames; independently recompute on the server against exact source fingerprints. Preserve all current master fields, existing references, locks and approval dates. Restore selected frames in a separate draft version, without approving an incomplete historical character version. Reject conflicting metadata or existing reference identities, stale sources, narrative decisions in this mode, additional active copies and a master without an encrypted receipt. Reuse the existing encrypted archive, media verification/escrow and master readback transaction.

Validation: targeted Afterglow regressions, real normalization preserving the existing lock and recovered draft, encrypted storage close/reopen and explicit current-master readback, stale/forged choice rejection; focused UAT contracts and production build. Exact-head Windows CI must pass before merging. Synthetic storage restart does not prove the Human's missing originals are present on their Windows disk or that their provider keys survive their app restart. No private story data, real keys or paid generation are used.

Ordered work: 2911 merged first; this change precedes 2855 narration and 2830 Shot 1 motion. Actual configured provider readback and attended Windows image/media acceptance remain unproven until that environment is available. Keep issue 2863 open for those acceptance checks.

## Historical reference identity reuse follow-up

The reported Save Selected Missing Images failure occurs when an archived frame reuses a current reference ID but points to a different image. Recover the explicitly selected historical frame with a deterministic separate reference identity and draft version. Preserve the current frame, lock, approval, story decisions, and immutable historical source evidence. Source digests and physical media verification remain authoritative; the copy identity is not a media hash. Reject forged option keys and any generated identity collision without modifying the current master.

Regression coverage includes real world-map normalization, deterministic repeated selection, missing inventory after reopen, and independent encrypted storage close/reopen with server candidate recomputation for both ordinary recovery and reused historical identity. Synthetic storage restart does not prove the user's Windows image bytes are present; actual profile acceptance remains open.

CI scope follow-up: helper-only image recovery edits and the owning regression now select the existing Windows build/product lane. That lane executes the encrypted identity-reuse regression, alongside existing rendered consolidation and Save/Lock readback proof. No unrelated Windows media compilation is selected.
