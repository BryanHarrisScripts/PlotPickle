---
name: storyboard-frame-director
description: Provider-neutral Storyboard skill for turning one selected Mini-Block's available 25 Shot / Frame positions into distinct, continuity-aware single-frame prompts that visibly progress the approved story without inventing Beats or canon.
license: MIT
metadata:
  author: PlotPickle
  version: "1.0.0"
  compatibility: PlotPickle host runtime
  uri: skill://plotpickle/storyboard-frame-director
  progressiveDisclosure: true
---

# Storyboard Frame Director

Use this skill when the Human selects one of PlotPickle's 25 available Storyboard Shot / Frame positions inside a canonical Mini-Block.

This skill strengthens visual coverage and image-generation prompts. It does not create story canon, assign Beat N to Position N, require all 25 positions to be used, or replace the Sequence Director.

## Authority and relationship to Sequence Director

- Sequence Director owns PLAN → STORYBOARD → PREVIS semantics, ordered creative Beats, continuity and later render-grid compilation.
- Storyboard Frame Director operates inside the approved Storyboard context and proposes one clean representative still for a selected available position.
- The 25 positions are visual Shot / Frame capacity. They are not 25 canonical Beats and not a fixed creative Shot quota.
- Existing authored Scene, Beat and Shot evidence always outranks the generic progression function for a position.
- The Human remains canon authority. Generated prompts and images are candidates only.

## Core procedure

For the selected position:

1. Read only host-supplied story evidence for the current Mini-Block:
   - Scene evidence;
   - authored Beat evidence;
   - authored Shot evidence;
   - screenplay/source passages;
   - approved character, location, wardrobe, prop and visual references;
   - accepted prior Storyboard frame state when available.
2. Identify the position's visual progression function from the 25-position coverage map below.
3. Use that function only as a directing/coverage objective. Never invent an unsupported event just to satisfy the map.
4. Describe one decisive visible moment that advances from the established prior state.
5. Preserve character identity, wardrobe, props, geography, screen direction, lighting logic and story state.
6. Prefer physical camera decisions over vague adjectives:
   - where the camera is;
   - approximate height and distance;
   - viewing direction;
   - shot size / lens character when useful;
   - foreground/background spatial relationships.
7. Make the frame readable as a storyboard image: clear action, silhouette, staging, eyelines and dramatic emphasis.
8. End with an explicit continuity handoff: what must remain true for the next selected position.
9. Return one standalone landscape image prompt. Never request a collage, contact sheet, split screen, storyboard grid, poster or multi-panel image.
10. Keep generation provider-neutral. Model/runtime selection belongs to the PlotPickle host.

## 25-position visual progression map

These are visual coverage functions, not story events and not Beat assignments.

01. Entry boundary — establish the Mini-Block's approved starting state.
02. Geography — clarify where subjects and important objects exist in relation to one another.
03. Subject relationship — clarify the central character/object relationship already present in evidence.
04. Story detail — isolate a supported prop, expression, environmental clue or physical detail.
05. Directional shift — make the next supported change in attention, intention or movement visually legible.
06. Response — show the supported reaction or physical response that follows.
07. Forward movement — clarify supported movement through the space or toward the objective.
08. Resistance — emphasize the supported obstacle, friction or counterforce.
09. Compression — tighten framing or spatial pressure around the active dramatic problem.
10. Setup pressure — visually emphasize a supported setup, risk or unresolved condition.
11. Reorientation — re-establish geography or power relationships after movement/change.
12. Pressure — increase visual emphasis on the supported source of tension.
13. Reaction under pressure — capture the supported human/physical response without melodrama.
14. Discovery emphasis — make an existing reveal, recognition or important information visually clear.
15. Turn coverage — emphasize the supported change of direction, meaning or control.
16. Consequence — show the visible result of the preceding supported action/turn.
17. Stakes detail — isolate what is now visibly at risk or newly important.
18. Intent / strategy — clarify the next supported intention, preparation or directional choice.
19. Convergence — bring the supported opposing forces, goals or movements into a clearer relationship.
20. Crisis pressure — frame the strongest supported unresolved pressure before payoff.
21. Confrontation coverage — make the supported central conflict or decisive interaction readable.
22. Peak emphasis — capture the strongest supported action, realization or emotional peak available in evidence.
23. Immediate aftermath — show the first supported visible state after the peak.
24. Resolution movement — show the supported settling, departure, recovery or new state.
25. Exit boundary — establish the Mini-Block's approved ending state and a clean handoff to what follows.

If the evidence does not support the nominal function, keep the frame exploratory and grounded in what is known. Do not manufacture plot.

## Prompt grammar

A strong frame prompt should include, when evidence exists:

- production address: Block / Mini-Block / Position;
- progression function;
- Scene evidence;
- Beat evidence;
- authored Shot evidence;
- screenplay/source evidence;
- visible action;
- camera position and composition;
- continuity-in;
- what visibly changes in this frame;
- continuity-out / next-frame handoff;
- identity, wardrobe, prop, environment and screen-direction locks;
- lighting / atmosphere grounded in the project;
- output constraints.

Prefer concrete direction over labels such as "cinematic", "epic" or "realistic" by themselves.

## Asset separation

The Storyboard board and its 25 positions are a planning surface, not one image reference.

- Generate one clean standalone image per position.
- Keep character, location, wardrobe, prop and style assets separate and role-scoped.
- Do not send a 25-frame grid/contact sheet as the single visual reference for downstream motion generation.
- For Storyboard → Previs/video handoff, use the approved single frame for the relevant shot plus clean role-scoped references and explicit motion/camera instructions.
- A prior approved single frame may be used as continuity evidence when the host supports it; it must not silently become a style authority that overrides identity/location roles.

## Negative / protection rules

Always protect against:
- identity drift;
- unintended wardrobe or prop changes;
- geography/screen-direction reversal;
- invented characters or story events;
- decorative text, captions, logos or watermarks;
- collage/contact-sheet/split-screen/multi-panel output;
- arbitrary camera changes unsupported by the selected Shot;
- exaggerated expressions that contradict the story evidence.

## Output contract

Return a single editable image-generation prompt for the selected position.

The prompt must make the position distinct from its neighbours through composition, visual emphasis or supported state progression while preserving continuity.

Do not approve, persist or generate media yourself. The PlotPickle host owns consent, provider routing, generation, provenance, review and acceptance.
