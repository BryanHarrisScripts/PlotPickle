# Storyboard editorial adaptation — Issue #1424

This bounded Phase 8 slice continues the reuse-first Storyboard re-adoption after the canonical readiness gate merged in PR #1521.

Current authority path:

`profile-owned PPF -> #1423 visual readiness -> canonical Block target -> observed Storyboard references -> explicit Human Keep -> existing PPF visual review commands`

What is reused:
- bundled Afterglow Storyboard frame identity and imagery;
- the previous Storyboard Keep / Change / Compare editorial semantics;
- the existing PPF visual-artifact review states, accepted-ID authority, provenance keys and parent-artifact lineage;
- the existing profile-owned PPF persistence boundary.

What is deliberately not reused:
- `PlotPickleProject` as Storyboard authority;
- `storyboardExploration` or other legacy extension stores;
- direct frame-local copies of story canon;
- automatic approval merely because a bundled reference exists;
- media generation in this slice.

The first editorial proof remains intentionally bounded to the previously proven Afterglow Block 17 readiness target. Its four bundled mini-block frames remain Observed/reference until the Human chooses Keep. Change cycles the working reference without changing the kept PPF state. Compare is read-only. Keep records one approved visual projection and preserves the prior kept artifact as lineage when the Human later chooses a replacement.

Bundled reference bytes remain under `/afterglow/storyboard/`. A read-only `/api/local-ai/assets/storyboard-reference` route validates Block 1-24 and mini-block 1-4, then redirects to that local bundled asset. This gives persisted PPF visual artifacts an asset URL inside the already accepted `/api/local-ai/assets/` namespace without broadening the project normalizer's asset trust rules.

Next #1424 work after this slice is green should adapt reusable frame-intent fields and stale/affected-frame behavior onto canonical targets while preserving this same PPF authority boundary.
