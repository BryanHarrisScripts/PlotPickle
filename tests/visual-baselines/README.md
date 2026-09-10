# PlotPickle visual baselines

`app/skin-v1-definition.css` is the shared presentation contract. Dashboard is the canonical Skin V1 design reference, while each approved surface may also become an individual visual regression baseline.

WebMCP always writes fresh candidate screenshots to `.artifacts/visual-readiness/`. Candidate evidence is disposable and must not be committed automatically.

A surface becomes locked only through an explicit developer action:

```bash
node scripts/lock-skin-visual-baseline.mjs <surface>
```

Supported Skin V1 surfaces are `dashboard`, `community`, `profile`, `local-ai`, and `node`.

The lock command copies the current candidate PNG into `tests/visual-baselines/skin-v1/` and changes only that surface from `candidate` to `locked` in `manifest.json`. The PNG and manifest change must then be reviewed and committed in a normal pull request.

Verification never updates a locked baseline. If a locked baseline is missing, or if the rendered result exceeds the manifest tolerance, Visual Readiness fails. To replace an approved baseline, first make a deliberate repository change that returns that surface to `candidate`, review the new candidate, and lock it again.

The fixed baseline viewport and comparison tolerance live in `tests/visual-baselines/skin-v1/manifest.json`, so Skin V2, Skin V3, and later skins can own independent baseline folders without changing Surface behavior.
