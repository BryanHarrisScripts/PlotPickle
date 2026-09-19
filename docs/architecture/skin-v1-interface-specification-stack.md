# Skin V1 four-layer interface specification stack

Issue: #2226  
Status: implementation reference

## Purpose

Skin V1 now separates visual style from surface meaning so a Human or LLM does not infer navigation, content, titles or hierarchy from geometry alone.

### Layer 1 — Tokens

Authority: `app/skin-v1-definition.css`

Defines palette, typography, spacing, 1px/2px borders, square geometry, control sizing and motion.

### Layer 2 — Components and composition

Authority: `config/skin-v1-surface-composition-reference.json`

Defines reusable visible objects and recipes: global header, action row, outer/inset frame, menus, submenus, selected state, panels, pills and one/two/three-column composition.

### Layer 3 — Surface anatomy

Authority: `config/skin-v1-surface-anatomy-contract.json`

Defines what regions mean and where they belong. Navigation is semantic, not geometric. Lists, columns, tabs, fields and panels do not become navigation unless explicitly declared.

Key placement rules:

- global header: product identity left, surface identity center, Skin identity right;
- Return: upper-right in the surface action row beneath the global header;
- workspace title stack: left aligned, eyebrow → title → optional subtitle → context metadata;
- destination navigation: normally left, outside workspace-column count;
- primary work: central/dominant;
- inspector/evidence/reference: right-side supporting work;
- timeline: nested below the work it controls;
- status/footer: bottom, full shell.

### Layer 4 — Surface declarations

Authority: `config/skin-v1-surface-declarations/*.json`

Each declaration names the actual regions, role, placement, content type, navigation semantics, dominance and literal/illustrative content policy for one registered surface.

The first hardened declaration is `scene-workspace.json`, mapped to canonical registry id `scene-timeline`.

## Scene Workspace proving case

The Human-supplied Scene Workspace design establishes Script Preview, Primary Playback Preview, Inspector and a cue timeline. The declaration therefore defines:

- Script Preview = supporting content, not navigation;
- Playback = the one primary work region;
- Inspector = supporting context, not navigation;
- Cue Timeline = nested time projection, not another column and not story authority;
- Dialogue / Action / Shot / Audio = initial literal lane vocabulary;
- Review/Edit and Inspector/References/History = local view controls, not product destinations.

This preserves the design boundary that one primary work area should remain visually dominant and nested decorative frames should be avoided.

## Spec-sheet reproducibility

`config/skin-v1-spec-sheet-contract.json` defines how another LLM or Human communicates a declaration. It requires region role labels, navigation semantics, title placement, column count, frame measurements, selected state and engineering summary.

A generated board may invent neutral example copy only inside regions explicitly marked `illustrative`. It may not invent navigation, extra panels, title placement, dimensions, palettes or structural controls.

## Acceptance test

A fresh interpreter receiving only the four authorities plus one surface declaration should be able to produce a spec sheet with the same region map and hierarchy even when its illustrative text differs.
