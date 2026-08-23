# AI-native visual writing and creative direction

Programme: [#382](https://github.com/BryanHarrisScripts/PlotPickle/issues/382)
Foundation: [#383](https://github.com/BryanHarrisScripts/PlotPickle/issues/383)

## Product thesis

PlotPickle is a visual writing studio where the writer directs words, images and cinematic possibilities as one connected body of creative material.

The writer does not need to arrive with a finished screenplay or a carefully engineered provider prompt. A session can begin with a concept, fragment, photograph, sketch, palette, emotional purpose, visual reference or simple instruction. PlotPickle helps the writer explore possibilities, compare them, direct revisions, approve what belongs and carry those decisions into later work.

AI supplies responsive creative material. It does not supply authorship, automatic approval or silent changes to canon. The writer remains the author, editor, visual director and final authority.

## Canonical creative loop

1. **Concept** - Capture the idea, references, emotional purpose, constraints and open creative space.
2. **Explore** - Generate or import multiple possibilities connected to the selected story target.
3. **Compare** - Judge candidates side by side and identify qualities worth carrying forward.
4. **Direct** - State what to keep, what to change and what new direction to try.
5. **Refine** - Develop a selected direction while preserving lineage and continuity.
6. **Approve** - Make a deliberate human decision about what belongs to the storyworld.
7. **Reuse** - Carry approved visual and narrative choices into later connected work.

The normal creative vocabulary is **Keep, Change, Try, Compare, Combine and Approve**. Raw prompts and provider details remain inspectable advanced information, not the primary interface.

## Visual writing

Visual development is not decoration added after the screenplay. It is part of writing because it gives the writer another way to test and discover the story:

- a character study can clarify identity, contradiction, wardrobe and movement;
- a location study can reveal culture, history, pressure and practical story rules;
- a scene image can expose weak staging or a missing emotional turn;
- a panel sequence can test whether action reads without explanation;
- a shot progression can reveal pacing, continuity and production implications;
- a visual discovery can return as a proposed change to character, world, scene, action or dialogue.

Visual discoveries may create proposals. They never rewrite canonical story material automatically.

## Connected creative material

Every concept, reference, candidate, annotation, direction, approval and proposal belongs to a specific project target. Supported targets grow from the existing PPF graph and include the project, character, location, sequence, Block, scene, mini-block, storyboard frame, Graphic Novel panel and production item.

Generated and imported possibilities remain versioned candidates. Approval can promote selected qualities into visual canon categories:

- character identity;
- location;
- prop;
- wardrobe;
- palette;
- style;
- composition.

Continuity locks can apply at project, sequence, Block or scene scope. A narrower scope may deliberately override a broader lock, but the conflict and its consequences must be visible before new material is created.

## Human authority and trust

- No generated result becomes canon automatically.
- No visual analysis changes story text automatically.
- Paid work requires action-specific confirmation.
- A failed local route never activates a paid cloud fallback.
- Manual import and no-AI workflows remain complete product paths.
- Provider credentials stay in the private local credential boundary.
- Creative memory stores decisions and provenance, not credentials or unrelated private content.
- Approved contributions retain enough lineage to understand the writer's direction and decision.

## Implementation programme

The machine-readable delivery order lives in [`config/ai-native-visual-writing-programme.json`](../config/ai-native-visual-writing-programme.json). Its twenty focused briefs are GitHub issues #383 through #402 under parent programme #382.

The sequence intentionally builds the durable creative model before specialized screens:

1. contract, concepts, references, context and versioned candidates;
2. directing, comparison and combination;
3. visual canon and continuity;
4. character, world, scene, Storyboard and Graphic Novel workflows;
5. image-to-story feedback and creative memory;
6. consent, contribution history and the end-to-end human journey gate.

Each implementation PR must preserve local-first ownership, PPF compatibility, manual operation, existing project data and explicit human approval. Focused behavioral tests and rendered visual evidence are required before merge.
