# Visual Writer Curriculum Dependency Audit

Issue #1030 turns PlotPickle's guided curriculum into a progressive Visual Writer journey. This document records the dependency decision behind the canonical order in `modules/dashboard/guided-progression.ts`.

## Boundary

This PR is the audit/contracts phase only. It does not generate new images, implement World workspaces, or change canonical project data. The bundled curriculum remains the source of teaching truth and retains all 81 archived lessons. The current Foundations presentation adapter remains intact.

The core rule is:

`LEARN → PLAN → BUILD → next curriculum group`

BUILD may use only the accepted project frontier named by the current group's output contract. Future incomplete groups are never implicit context.

The early visual artifact is called the **Visual Narrative Wireframe**. It is rough, low-resolution, disposable, regenerable and pre-final. It is not Storyboard/Previs canon.

## Canonical Visual Writer order

1. Foundations
2. World
3. Character
4. Theme
5. Structure
6. Visual Storytelling
7. Drafting
8. Dialogue
9. Revision
10. Responsible AI
11. Industry
12. Collaboration

### Why this order

The old sequence placed Structure and Drafting before Character and Theme. That works as a reading curriculum, but it is a weak dependency chain for progressive visual authoring: a wireframe should know who the people are and what dramatic idea/tone their choices are testing before it hardens sequence, staging and page execution.

The revised order therefore establishes:

- **Foundations** — the minimal story proposition and direction.
- **World** — the environmental/rule context the story can actually inhabit.
- **Character** — stable people, goals, relationships and continuity anchors.
- **Theme** — dramatic intent, tone and motif grounded in character choices/consequences.
- **Structure** — causality and sequence after the story's people and dramatic intent exist.
- **Visual Storytelling** — composition/staging after world, character, theme and sequence are known.
- **Drafting → Dialogue → Revision** — execution and rewrite after the visual/story dependency spine exists.
- **Responsible AI → Industry → Collaboration** — provenance, outward-facing packaging and handoff after the creative frontier is reviewable. These groups do not silently become story-canon generators.

Responsible AI precedes outward-facing Industry/Collaboration so disclosure, provenance and approval boundaries exist before production handoff.

## Group output-contract audit

| Group | Prerequisites | Decisions created/refined | Visual effect | BUILD capability | Classification |
|---|---|---|---|---|---|
| Foundations | none | premise, protagonist direction, conflict, stakes, genre/tone | yes | first Foundations-only Visual Narrative Wireframe | mixture |
| World | Foundations | locations, culture, geography, rules, environmental mood | yes | extend/branch wireframe from Foundations + World | mixture |
| Character | Foundations + World | identity, goals/needs, relationships, behaviour, continuity | yes | character continuity pass over wireframe | mixture |
| Theme | Foundations + Character | theme, dramatic question, tone, motif, consequences | yes | dramatic-intent/motif pass | mixture |
| Structure | Foundations + Character + Theme | blocks, turns, causality, escalation, setup/payoff | yes | sequence/causality pass | mixture |
| Visual Storytelling | World + Character + Theme + Structure | composition, staging, visual grammar, shot intention | yes | visual-language pass over rough wireframe | mixture |
| Drafting | Character + Structure + Visual Storytelling | scene purpose/action and accepted page-level story facts | yes | screenplay draft; refine visuals only from accepted draft facts | mixture |
| Dialogue | Character + Drafting | voice, subtext, spoken intention/conflict | no direct image generation | dialogue/performance revision layer | decision-producing |
| Revision | Drafting + Dialogue | accepted rewrite, continuity repair, retain/reject decisions | yes when accepted changes affect visuals | provenance-preserving draft/wireframe branch/update | mixture |
| Responsible AI | Revision | disclosure, provenance, approval and rights constraints | no | responsibility/provenance readiness record | mixture |
| Industry | Revision + Responsible AI | deliverables, submission target, positioning, production readiness | no | industry-readiness package | mixture |
| Collaboration | Responsible AI + Industry | roles, handoff scope, feedback boundaries, attribution | no | collaboration handoff/review package | mixture |

The exact strings, permitted BUILD context, artifact kinds and approval boundary are coded once in `GUIDED_CURRICULUM_GROUPS` via `VISUAL_WRITER_GROUP_ORDER` and the group definitions.

## Detailed lesson-order audit

PR A does **not** rewrite or delete lesson copy. Within each group, the existing lesson-number order is retained because the current bundled material already presents its concepts progressively. Reordering at the group level fixes the material dependency problem without inventing a second lesson library.

`deriveGuidedLessonOutputContracts(curriculum)` makes the lesson audit explicit at runtime for every supplied curriculum lesson:

- `prerequisiteGroupIds` comes from the canonical group contract;
- `prerequisiteLessonIds` points to the prior lesson in that group's existing numbered order;
- `learned` comes from the lesson's own objectives (or overview fallback);
- `projectDecisionContribution` comes from the lesson's own `apply` text (or exercise fallback), so the audit does not duplicate lesson bodies;
- `affectsVisualGeneration`, BUILD capability, artifact kinds and classification come from the canonical group contract;
- `mustPrecedeLessonIds` points to the next lesson;
- the last lesson identifies dependent groups that require the completed group.

This produces one audit/output record per actual curriculum lesson while keeping teaching content in the curriculum files where it belongs.

## Frontier and provenance rules for later PRs

PR B and later implementation work must preserve these rules:

1. A BUILD stage receives only `buildContextGroupIds` that are complete/accepted at that point.
2. Generated output is draft evidence, not canon.
3. Writer acceptance is explicit and group-specific.
4. Later groups may refine or branch earlier visuals, but accepted older versions remain reviewable.
5. Every wireframe frame/version must record the curriculum frontier and accepted project decisions available when it was produced.
6. Image generation stays behind PlotPickle's existing provider/media-routing boundary; no direct ComfyUI dependency is added to the progression engine.
7. Dashboard, Avery and Writer-in-Residence must consume this same progression/output contract rather than inventing their own order or frontier rules.
