# #1922 Verification Architecture Decisions

This decision record supplements `1922-seven-layer-verification-mesh.md` and supersedes the earlier display-name examples in that first draft. Canonical architecture IDs remain unchanged.

## Stable visible PR check names

The future required PR checks are named exactly:

1. `Layer 1 Experience Skins`
2. `Layer 2 Experience Contract`
3. `Layer 3 Production Orchestration`
4. `Layer 4 Agent & Skill Mesh`
5. `Layer 5 Story / Canon / Evidence`
6. `Layer 6 Provider Runtime`
7. `Layer 7 Validation & Operations`

The visible names are intentionally plain and map directly to the canonical layer IDs in `architecture/plotpickle.architecture.json`:

- Layer 1 -> `experience-skins`
- Layer 2 -> `experience-contract`
- Layer 3 -> `production-harness`
- Layer 4 -> `agent-runtime`
- Layer 5 -> `story-canon`
- Layer 6 -> `provider-runtime`
- Layer 7 -> `verification`

The old `PR Gate` and `Product Gate` stay authoritative during inventory, catalog/core development and shadow comparison. The seven names do not become required checks until the replacement has proven equivalent or stronger coverage.

## Measured Product Gate evidence

Exact-head Product Gate run `34691257033` on commit `daaff1d422cc89a7ad799848807f5417cbb82e31` completed in about 7m59s.

Measured high-cost steps:

- Pi 0.85.1 managed compatibility: 157s (2m37s)
- whisper.cpp native smoke: 227s (3m47s)
- combined: 384s (6m24s)

Those two steps consumed about 80% of Product Gate wall time in that run, even though the PR was a LEARN baseline change. This is direct evidence for impact-selecting heavy Agent/native runtime proof rather than running it on every unrelated PR.

Other Product Gate steps in the same run were comparatively small: Skin startup 1s, security closeout 1s, local video 1s, focused UAT contracts 12s, Windows build 20s, installer source contract 1s. Dependency/setup overhead still exists and should also be minimized by the future selected-runner model.

The corresponding PR Gate completed in about 63s. Most deterministic contracts were 0-2s at GitHub's step timestamp resolution; core auth/storage took about 12s and the production build about 18s.

## Latest live WebMCP evidence

After #1920 corrected stale Profile traversal, the next local live WebMCP run reached the real Profile surface and found a genuine Layer 1 rendering failure: five configuration controls measured 25.25px high while the canonical `--pp-skin-control-height` is 34px.

The affected controls were Configure BUZZ Identity, Configure Community BBS, Configure Local Model, Configure ComfyUI and Configure Cloud Compute. This is tracked by #1923.

This establishes an important selection rule for the future mesh:

`Profile/Skin/surface/visual token change -> Layer 1 Experience Skins -> live rendered WebMCP evidence`

The observer remains authoritative for rendered conformance. The repair must satisfy the 34px contract; CI must not weaken the observer to make the result green.
