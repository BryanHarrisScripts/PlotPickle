# Dashboard: use Community artwork rendering pattern

Scope: Skin V1 Dashboard only.

Goal: render the Dashboard dragon using the same robust presentation pattern already used by Community room artwork, without touching Community or other surfaces.

Implementation:
- use Next.js Image instead of a raw img element
- keep the existing packaged Dashboard dragon asset
- priority-load the Dashboard hero
- use a fixed artwork frame with object-fit: cover
- use pixelated image rendering for the Skin V1 terminal aesthetic
- keep the existing Dashboard canonical marker and accessibility behavior
- preserve the API fallback only if the packaged image cannot load

Acceptance:
- Dashboard only
- no Community/Profile/Local AI/Node changes
- existing keyboard/navigation behavior unchanged
- visual-contract regression test updated
- PR Gate and Product Gate green before merge
