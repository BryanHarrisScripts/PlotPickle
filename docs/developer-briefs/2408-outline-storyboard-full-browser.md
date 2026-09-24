# Developer Brief — #2408 Full-Browser Outline and Storyboard

## Decision

Outline and Storyboard are primary visual workspaces. They use the available browser viewport rather than the legacy restrained subordinate-surface shell.

The shared Skin V1 orchestrator remains the chrome owner. This change is an orchestrator policy, not a collection of screen-specific negative margins.

## Full-browser contract

When the active surface is Outline (`story-map`) or Storyboard (`storyboard`):

- global orchestrator header uses `calc(100vw - 40px)`;
- orchestrator actions use the same width;
- orchestrator workspace header uses the same width;
- the active orchestrated root uses the same width with `max-width: none`;
- the status footer uses the same width;
- direct children remain bounded to 100% of that root;
- the host review surface itself has no max-width constraint and owns the full available viewport height.

The 40px subtraction retains the existing 20px left/right breathing room.

## Preserve

- Dashboard remains separately governed.
- Other subordinate surfaces retain `--pp-skin-shell-max`.
- Outline and Storyboard keep the existing Skin V1 chrome and return behavior.
- Storyboard keeps its inline Scene/Beat/Shot/Frame flow.
- WebMCP surface ownership remains unchanged.
- No negative-margin escape rules.

## Acceptance

- Outline and Storyboard both have explicit full-browser selectors in the orchestrator.
- Header/actions/workspace header/root/footer share one boundary.
- Host surfaces are width 100%, max-width none, min-height 100dvh.
- Existing restrained-shell rule remains present for other non-Dashboard surfaces.
- Focused regression test and normal CI are green.
