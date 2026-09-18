# Issue #2226 Phase 3 — Canonical shell and measure proposal

Status: HUMAN APPROVED 2026-09-18. Dashboard candidate implementation may proceed; locked baseline replacement still requires separate Human acceptance of the resulting candidate.

## Evidence compared

The proposal uses the current Phase 2 exact-head candidate corpus from Architecture Verification run 516 plus the current Skin V1 source contracts.

Preferred current evidence compared:
- Dashboard: canonical locked reference; 1180px outer shell and 1060px directory/menu body.
- Settings: same 1180px outer shell and 1060px directory/menu body; canonical dark selected row.
- Local Story Mode and Cloud Story Mode: clean current subordinate shell, upper-right return, matte dark/green treatment.
- Agents: strong matte panel treatment with restrained green hierarchy.
- Issue Log: restrained green left-edge/eyebrow sub-header treatment.
- Profile: strongest current layered outer/inset frame evidence.
- Community: clean 1180px subordinate workspace treatment.

The Phase 2 Visual Director report had zero blockers. Community, Local Story Mode, Cloud Story Mode and Agents had zero advisories. Profile had only a heading-density advisory, Issue Log only a 9px spacing-rhythm advisory, and Settings only a dead-space advisory. Those findings do not undermine their shell/frame evidence.

## Proposed canonical measure

Use the existing token geometry, not a new width system:

- outer shell maximum: 1180px via --pp-skin-shell-max;
- desktop viewport inset: 40px total, 20px per side;
- directory/menu body maximum: 1060px via --pp-skin-menu-max;
- directory/menu internal fallback: calc(100% - 72px);
- workspaces/editors/canvases may consume the full 1180px shell when their declared layout profile needs it;
- do not force workspace content into the narrower 1060px directory measure.

This keeps Dashboard and Settings directory geometry related while allowing Agents, Storyboard, Write, PageFlow and similar workspaces to use the full governed shell.

## Proposed premium matte/frame treatment

Use existing PlotPickle patterns only:

- outer structural frame: 2px solid --pp-skin-line-strong;
- inset/panel frame: 1px solid using existing line/accent tokens;
- square geometry: --pp-skin-radius remains 0;
- outer/panel fills: existing stepped --pp-skin-fill-panel / --pp-skin-surface-0 / --pp-skin-surface-1 family;
- subtle existing --pp-skin-inset-highlight may be used for depth;
- no glass, blur, rounded-card language or new shadow system;
- Profile supplies the layered outer/inset-frame precedent;
- Agents supplies the premium matte panel precedent;
- Issue Log supplies the restrained subordinate accent precedent rather than a new global header style.

## Proposed selected state

Use the already codified Phase 2 canonical state:
- background: --pp-skin-accent-deep;
- 1px solid frame: --pp-skin-accent-bright;
- text: --pp-skin-ink;
- no stark-white selected fill for surfaces declaring this profile.

## Proposed Dashboard change boundary

If approved, Phase 3 implementation should deliberately re-express Dashboard using the same canonical shell contract while preserving its composition and navigation:
- retain the 1180px outer shell;
- retain the 1060px directory body;
- retain the 20px desktop outer gutter;
- retain its hero/brand/menu composition;
- converge the outer frame and matte/inset treatment on the approved 2px + 1px layered vocabulary;
- do not change navigation order, product behavior, story authority or keyboard behavior.

Only after the resulting Dashboard candidate is reviewed and explicitly accepted should the locked Dashboard baseline be replaced.

## Human decision

Approved on 2026-09-18 as the Phase 3 canonical shell:
1180px outer shell + 20px-per-side desktop gutter + 1060px directory body, with full-shell workspaces where declared; 2px solid outer frame + 1px solid inset/panel framing; square matte Skin V1 fills; dark/green selected state; restrained subordinate accent treatment.

Implementation is authorized. No locked baseline replacement occurs until the resulting Dashboard candidate is separately accepted.
