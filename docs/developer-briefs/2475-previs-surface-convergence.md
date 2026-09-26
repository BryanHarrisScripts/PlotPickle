# Developer Brief — #2475 Previs surface convergence

## Goal

Make Previs follow the same progressive workspace grammar as Outline and Storyboard.

## Human-visible changes

- Previs identity remains PREVIS in the shared header and Previs in the Progressive Story Map.
- The four-Act rail uses the same centered four-column Skin V1 treatment as Outline and Storyboard.
- The shared Progressive Story Map remains the single source of Defined / Observed / Emerging / Available / Blocked state presentation.
- The duplicate Visual Coverage / Mini 1–4 navigation rail is removed.
- The selected story-address context and real Previs workspace remain.

## Non-goals

No story/canon changes, no Keep/Lock changes, no Previs frame-authority changes, and no new Previs-specific status palette.

## Verification

Layer 1 owns the rendered surface regression. Layer 5 remains a required non-regression gate. Existing #2456, Outline and Storyboard navigation contracts remain green.
