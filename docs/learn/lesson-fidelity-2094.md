# #2094 final fidelity and formatting audit

This is the final safeguard before learner-visible bundled-source viewers are retired.

## Governing test

A source is not absorbed merely because a broad concept appears in the learner lesson. If the original source disappeared, PlotPickle's canonical curriculum should still preserve essentially all useful, durable teaching: terminology, distinctions, explanations, examples and workflows.

Formatting may improve readability through headings, shorter paragraphs, bullets, definitions, examples and checklists, but must not reduce meaning or nuance.

Disposition vocabulary:

- `PRESERVED` — durable teaching remains explicit at useful depth.
- `MODERNIZED_WITH_ALIAS` — terminology is modernized while a useful established/source term remains discoverable.
- `MOVED_ELSEWHERE` — durable teaching is explicitly owned by another current lesson.
- `DUPLICATE` — the source repeats teaching already preserved at equal or greater depth.
- `OUTDATED` — a dated/live/product-specific claim should not become frozen teaching.
- `REJECTED` — an unsupported, misleading or overly prescriptive claim should not become current authority.

Raw source records remain provenance/retrieval/history and are not deleted.

## Before baseline

Baseline commit: `7be7562a4969689a55fe975993940d23858561dd`

- Presentation lessons: 96
- Unique bundled sources: 95
- Learner-facing teaching: **52,124 words**
- Raw bundled-source corpus: **79,597 words**

The learner count includes lesson title, overview, objectives, section headings/paragraphs/points, definitions, example, checklist, mistakes, exercise and Apply text. It excludes bundled-source Markdown, source metadata, duration, tags and static UI labels. The same counter must be used after this pass.

Word count is evidence, not a target. Raw sources contain duplication, obsolete/live claims, navigation and material deliberately owned elsewhere.

## Lessons 1–10 fidelity review

### 1 — The Anatomy of a Screenplay

- `PRESERVED`: the original seven craft areas — structure, dialogue, character, theme, world-building, storytelling dynamics and symbolic techniques — are all taught explicitly and at greater practical depth.
- `PRESERVED`: source-level explanations of dialogue function, character connection, pacing/tone, subtext, foreshadowing, motifs, symbolism and visual storytelling survive in current teaching.
- `MODERNIZED_WITH_ALIAS`: the source's typical three-act framing remains recognizable as a structure tradition elsewhere in the curriculum, while this opening lesson correctly avoids presenting it as the mandatory architecture.
- Formatting: already uses clear headings, explanatory paragraphs, scan-friendly craft bullets, definitions and a worked example. No formatting expansion required.

### 2 — The Screenwriting Essentials Roadmap

- `PRESERVED`: the linked original source is a table-of-contents/navigation page rather than substantive craft teaching; the current lesson substantially expands it into a usable diagnostic learning roadmap.
- `DUPLICATE`: source navigation links are not learner teaching and do not need to be reproduced in the lesson body.
- Formatting: current promise/engine/expression/proof bullets and diagnostic sections are already readable and appropriately structured.

### 3 — Story Essentials: Theme, Plot, Character and Stakes

- `PRESERVED`: theme, anti-theme/competing answer, thematic agreement, motifs/symbolism, tone/mood, conflict/escalation/resolution, subplots, twists, foreshadowing, turning points, external/internal/relationship movement, action/reaction, quest, Ghost/backstory, dramatic need, character arc, antagonist/opposition, super-objective, object of desire, perspective and transforming stakes are retained or explicitly re-homed.
- `MODERNIZED_WITH_ALIAS`: familiar terms such as `super-objective`, `object of desire` and `fatal flaw` remain explicitly searchable while their current meaning is clarified rather than treated as mandatory doctrine.
- `MOVED_ELSEWHERE`: detailed conflict taxonomy belongs in Lesson 22, **Join Inner and Outer Conflict**.
- Fidelity correction required at Lesson 22: preserve the traditional/search terms `Man vs Machine`, `Man vs Himself` and `Man vs Other` as historical/common aliases beside the current neutral `Person versus …` taxonomy. The modern terminology should remain primary; the old wording should not silently disappear.
- `REJECTED`: an anti-theme as one simple villain opposite, a fatal flaw as an obligatory moral defect, unsupported unconscious motives and fixed A/B/C or act placements remain rejected as universal rules.
- Formatting: already uses headings, bullets, examples and definitions. No additional formatting needed in this lesson before the Lesson 22 alias repair.

### 4 — The Pitch

- `PRESERVED`: core story-pitch teaching remains explicit in the current Foundations sequence.
- `MOVED_ELSEWHERE`: the original comprehensive project/market pitch checklist is deliberately owned by Lesson 10, **Pitch Components and Project Positioning**, rather than duplicated here.
- Formatting: current story-first pitch progression is already structured for scanning and practice.

### 5 — Loglines That Carry the Movie

- `PRESERVED`: protagonist, disruption, objective, opposition, stakes, distinctive world pressure, tone and deconstruction remain explicit.
- `MOVED_ELSEWHERE`: the original 20-item logline craft checklist and variant testing belong in Lesson 6.
- `PRESERVED`: the current lesson adds the useful distinction between a development logline, one-sentence pitch and tagline rather than collapsing them.
- Formatting: already uses a stepwise evidence/deconstruction structure; no additional formatting required.

### 6 — Crafting and Testing Loglines

- `PRESERVED`: the original source's 20 suggestions survive as practical tests rather than commandments: protagonist, conflict, stakes, setting, brevity, plain language, imagery, intrigue, spoiler choice, genre, active phrasing, irony, specificity, names, distinctiveness, revision, feedback, audience and tone are all represented by the current testing framework.
- `PRESERVED`: hook, irony, tone and world pressure are taught explicitly, including when to omit them rather than forcing every item into every sentence.
- `REJECTED`: fixed word counts, never-use-names, always-hide-the-ending and similar source phrasing are not promoted as universal laws.
- `MOVED_ELSEWHERE`: source examples based on existing commercial films are not required for concept fidelity because PlotPickle now uses its own worked examples and deconstruction method.
- Formatting: already uses headings, rule/test distinctions, bullets, worked examples and a repeatable testing sequence.

### 7 — Why PlotPickle Works in Layers

- `PRESERVED`: the current lesson explicitly retains the 24 Blocks × 4 Mini-Blocks = 96 Mini-Block scaffold and distinguishes Mini-Blocks from scenes, beats and shots.
- `PRESERVED`: the lesson keeps the scaffold as a planning/application system rather than turning one historical structure into mandatory story truth.
- Formatting: layer distinctions are already scan-friendly; no additional formatting needed.

### 8 — Screenplay Essentials: Structure, Dialogue and Visuals

- `PRESERVED`: structure, scene function, length/pacing, climax, resolution, dialogue, visual description, cinematic elements, spectacle, theme, conflict, twists, foreshadowing, formatting, transitions, characterization, genre, audience and revision remain represented at useful depth.
- `PRESERVED`: climax and resolution are explicitly separated, and surprises are framed as prepared/reframing turns rather than arbitrary twists.
- `MOVED_ELSEWHERE`: screenplay title craft and detailed formatting rules are owned by pitch/project and drafting/formatting lessons rather than duplicated here.
- `REJECTED`: camera-angle prescription and genre formula are not treated as mandatory craft rules.
- Formatting: already organized by functional sections with explanatory paragraphs and bullets.

### 9 — Pacing and Tone: Storytelling Dynamics

- `PRESERVED`: source teaching on fast/slow/medium contrast, suspense, processing time, tonal coherence, controlled tonal shifts, character contribution to tone and pacing/tone interaction remains explicit.
- `PRESERVED`: source techniques such as rapid dialogue, slower reflective passages, genre experiments, scene rewrites and character/voice exploration are retained but corrected for screenplay observability and treated as conditional tools.
- `MODERNIZED_WITH_ALIAS`: `tone` and `mood` remain separately defined so familiar source wording stays discoverable without treating them as identical concepts.
- `REJECTED`: comedy=fast, drama=slow and other genre-speed defaults are rejected as universal rules.
- Formatting: exercises and contrasts are already broken into readable sections; no additional formatting required.

### 10 — Pitch Components and Project Positioning

- `PRESERVED`: title/logline, format, audience, synopsis, distinctiveness, comparables/market context, character/world, episodic or season engine, production scope, creator background, marketing/distribution thinking and call to action all remain available as selectable pitch components.
- `PRESERVED`: rehearsal, listener-specific selection and readiness for questions/feedback preserve the source's preparation guidance.
- `MODERNIZED_WITH_ALIAS`: source terms such as `unique selling points`, `market analysis` and `target audience` remain conceptually recognizable while current teaching replaces unsupported sales claims with evidence and decision-specific context.
- `OUTDATED`: live market size, sales/viewership figures, distribution assumptions or other changing market claims must be verified at use time rather than frozen into curriculum.
- `REJECTED`: one universal comprehensive pitch checklist and unsupported claims of commercial viability remain rejected.
- Formatting: current lesson already groups components by purpose and uses headings/bullets to avoid a single dense checklist.

## Batch result — Lessons 1–10

All ten lessons preserve the durable teaching at useful depth under the stricter standard. No learner-text expansion is required in Lessons 1–10 themselves. One cross-lesson fidelity repair is carried forward: Lesson 22 must preserve the traditional `Man vs …` conflict labels as discoverable aliases beside the modern neutral taxonomy.
