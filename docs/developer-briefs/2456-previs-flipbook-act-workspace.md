# Developer Brief — #2456 Previs Act workspace and locked-frame Flip Book foundation

## Human intent

Previs should feel like the next visual storytelling surface after Storyboard, not a technical five-stage navigation page.

When the writer enters Previs from Dashboard:
- the primary horizontal navigation is Act 1 / Act 2 / Act 3 / Act 4, matching Outline and Storyboard;
- the selected Act exposes six Blocks with the same readiness semantics already used across the story map;
- the selected Block exposes its four Mini-Blocks;
- the selected Mini-Block opens the Previs Flip Book.

The Flip Book is built from the 25 ordered Storyboard positions. Locked Storyboard frames are the authoritative visual inputs. Draft, reference, or missing positions can remain visible, but they must never masquerade as locked Previs material.

## Writer-facing hierarchy

Previs

Act 1 / Act 2 / Act 3 / Act 4
→ Block
→ Mini-Block
→ Flip Book
→ Scene
→ Beat Detail
→ Shot
→ Frame
→ camera / motion / blocking / performance / timing / transition intent

The 25 positions are visual moments. They are not automatically 25 canonical screenplay Beats.

## Phase 1 — Act navigation parity

Replace the old stage-first Previs experience with the established Act navigation pattern:
- four equal Act tabs;
- six Blocks for the selected Act;
- preserve Block/Mini-Block address in the URL and existing callbacks;
- preserve Dashboard return behavior.

Use the writer-facing state vocabulary already established by the progressive story map:
- defined → DEFINED
- observed → OBSERVED
- emerging → EMERGING
- missing → AVAILABLE
- locked → BLOCKED

Do not change the underlying readiness enum or authority model.

## Phase 2 — locked-frame Flip Book projection

For the selected Mini-Block:
- project all 25 Storyboard positions in order;
- resolve generated Storyboard artifacts by frameNumber;
- identify the Human-kept artifact from acceptedVisualArtifactIds;
- expose the locked asset as the authoritative Previs frame;
- expose an unlocked/reference candidate only as non-authoritative visual context;
- leave genuinely empty positions empty.

Previs must not generate, accept, reject, replace, or otherwise mutate Storyboard still-image authority.

## Phase 3 — Scene / Beat Detail / Shot / Frame inspector

Selecting one Flip Book position shows a bounded detail panel.

Scene:
- existing mapped screenplay Scene(s) only.

Beat Detail:
- a derived working description from existing Scene purpose, authored Beat evidence, Storyboard narrative intention/prompt, and existing Shot evidence;
- clearly labelled as derived Previs detail;
- does not write a new canonical Beat.

Shot:
- existing editorial/Storyboard Shot when one maps to the position;
- otherwise state that Shot intent is still open.

Frame:
- locked Storyboard asset and position identity;
- draft/reference/missing state remains explicit.

Existing ProductionShotIntent remains the owner for camera, blocking, performance, pacing, duration and transition intent.

## Phase 4 — visual hierarchy

The first useful thing below Block/Mini-Block selection is the Flip Book:
- large selected-frame viewer;
- previous / next controls;
- position counter;
- 25-position filmstrip;
- locked/unlocked/missing state visible at each position;
- no Render Plan numbers dominating the page.

Technical Render Plan projection may remain downstream on the surface, but it is secondary to the visual story flow.

## Non-goals

- Do not remove ProductionShotIntent.
- Do not infer timing from the 25-frame sequence.
- Do not turn 25 positions into 25 canonical Beats.
- Do not regenerate Storyboard images from Previs.
- Do not change provider routing.
- Do not create a second timeline or story authority.

## Acceptance

1. Previs primary navigation is Act 1–4.
2. The selected Act shows six Blocks and uses DEFINED / OBSERVED / EMERGING / AVAILABLE / BLOCKED writer-facing state labels.
3. The selected Block still exposes four Mini-Blocks.
4. The selected Mini-Block projects positions 01–25 as a Flip Book.
5. A kept/locked Storyboard frame is visually and programmatically distinguished from draft/reference/missing material.
6. Selecting a position exposes Scene / Beat Detail / Shot / Frame.
7. Beat Detail remains derived/non-canonical.
8. Existing camera/motion/timing ProductionShotIntent editing remains available downstream.
9. Focused #2456 regression passes.
10. Branch build/type validation is clean before PR creation.

## Delivery gate

Implement and validate on `issue-2456-previs-flipbook-act-workspace`.
Do not open a pull request until the branch is ready for comparison/testing against `main`.
