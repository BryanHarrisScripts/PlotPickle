# Developer Brief — #2418 Storyboard batch progression and character grounding

## Goal

Make Storyboard generation useful as a true visual sequence rather than repeated variations of one Mini-Block image. The active Mini-Block must support generating one selected position, the current five-position group, or all 25 positions. Every request must use a distinct progression-aware frame brief, explicit character truth, and locked approved character visual references when available.

## Existing capability to reuse

- Storyboard already exposes 25 Shot / Frame positions.
- The Storyboard Frame Director / Sequence Director rules already define position progression and keep positions separate from authored Beats.
- The media gateway already accepts approved character references and identity-lock metadata.
- Character Visual Identity already stores locked identity prompts and approved local reference views.
- Generated WebP files already stay in PlotPickle's local persistent asset store and are not auto-committed to GitHub.

## Phase 1 — deterministic 25-frame progression planner

Add a reusable Storyboard frame planner which:
- maps selected scope to one position, a five-position band, or all 25;
- distributes the active Mini-Block's observed screenplay passages across positions in source order;
- gives every requested position a distinct visual progression role;
- preserves authored Scene / Beat / Shot evidence as higher authority;
- uses Position 01 as the Mini-Block entry boundary and Position 25 as the exit boundary;
- does not invent unsupported story events.

The planner returns a frame brief rather than immediately generating provider prose. A brief includes the position, progression role, story evidence slice, visible-change instruction, applicable character grounding, approved visual references, and continuity handoff.

## Phase 2 — character truth and visual identity grounding

For each frame brief:
- detect characters actually named in the position-specific story evidence;
- inject explicit name, pronouns, role, and bounded canonical description from the existing project character record;
- include relevant character-truth evidence claims where present;
- reuse Character Visual Identity and only attach local reference images that are approved under a locked identity;
- carry the locked approved identity prompt through the provider identity-lock field;
- if no locked approved reference exists, state that visual identity is exploratory and do not imply approval.

## Phase 3 — 1 / 5 / 25 Storyboard controls

Replace the single-image-only approval text with batch-safe approval:

"I approve this image generation request through my configured provider; cloud routes may charge my account."

Add Generation scope:
- Selected frame
- Current group of 5
- All 25 frames

Five-position groups are fixed:
01–05, 06–10, 11–15, 16–20, 21–25.

The selected frame remains editable. In a batch, that edited prompt applies only to the selected position; all other positions are rebuilt from their own frame briefs.

## Phase 4 — bounded batch generation and persistence

- Submit one provider request per position through the existing media route.
- Generate sequentially to avoid uncontrolled concurrency / GPU pressure.
- Pass only the approved references and identity locks applicable to that frame.
- Persist each successful WebP as a draft visual artifact at its own frame number.
- Keep generation non-canonical until Human review / Keep.
- Continue after an individual failure and report successful vs failed positions honestly.
- Preserve active-address protection against late responses.
- Do not push generated media to GitHub.

## Phase 5 — proof and convergence

Regression must cover:
- scope mapping for 1 / 5 / 25;
- 25 distinct progression briefs;
- ordered screenplay evidence distribution;
- character truth inclusion;
- locked approved reference inclusion;
- exploratory identity behavior;
- correct batch frame-number persistence / request payload shape;
- existing single-frame path.

Required gates:
- focused regression;
- focused UAT contracts;
- production build;
- development convergence;
- exact-head GitHub Product Gate / PR Gate / Architecture Verification as selected by repository routing.

## Completion

The change is complete when Afterglow 1.1 can plan visibly different prompts across positions 01–25, Ren-bearing frames are explicitly grounded as Ren rather than drifting to Amy, the UI provides 1 / 5 / 25 generation, and all exact-head required gates are green.
