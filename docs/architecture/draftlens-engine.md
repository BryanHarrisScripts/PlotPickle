# DraftLens Engine

## Purpose

The DraftLens Engine is PlotPickle's whole-draft review and feedback workspace.

It helps writers and readers treat a completed draft as a flexible blueprint rather than a finished object. Its purpose is to identify the reader experience, trace visible symptoms to deeper story causes, and turn feedback into useful revision questions without taking authorship away from the writer.

DraftLens does not automatically rewrite scenes and does not declare a screenplay good or bad.

## Core idea

A useful screenplay note has four parts:

1. what the reader experienced;
2. where the evidence appears;
3. what deeper story function may be causing it;
4. what question could help the writer discover a stronger solution.

The engine separates diagnosis from prescription. A reader can identify what is not working and why without assuming there is only one correct repair.

## PlotPickle principles

### 1. The draft is malleable

A screenplay is a working design for a future film. Performance, direction, editing, production design, timing, and later writing passes can all change how the material functions.

DraftLens therefore reads the current pages closely while remaining open to multiple future versions.

### 2. First response before repair

The first review pass records attention, emotion, confusion, anticipation, resistance, and memory before the reader begins proposing changes.

This protects valuable reader evidence from being overwritten by premature problem-solving.

### 3. Serve this story

Notes should respond to the actual characters, goals, world, tone, audience promise, and structure of the current project.

Generic craft advice is less useful than a precise observation tied to specific evidence.

### 4. Central question check

A draft should establish a meaningful dramatic question and continue creating reasons for the audience to care about its answer.

DraftLens examines whether the question is introduced, pressured, refreshed, and answered through choices and consequences.

### 5. Character engine check

Plot events become character development when they challenge the character's current belief, avoidance pattern, false solution, wound, want, or strategy.

The engine compares the selected character's want, need, Ghost, fatal flaw, and arc with the selected block's pressure.

### 6. Structure as cause and pattern

Plot points are not useful merely because they occur at familiar page positions.

DraftLens asks whether goals, conflict, choices, actions, consequences, repetition, escalation, and surprise create a living pattern of forward movement.

### 7. Page experience matters

A screenplay can contain a sound story idea and still be difficult to read.

The engine therefore distinguishes whole-story problems from page-level problems such as unclear action, low momentum, repetitive exchanges, delayed information, or scenes that explain without changing anything.

### 8. Dialogue must carry viewpoint

Dialogue is reviewed for character-specific worldview, objective, status, emotional access, rhythm, and subtext.

Exposition should enter through immediate pressure, desire, humour, disagreement, bargaining, avoidance, or action rather than neutral information exchange.

### 9. Surprise must remain earned

Originality does not require random events. The strongest turns are unexpected while still feeling inevitable in retrospect.

DraftLens uses the audience expectation, Pickle turn, and unpredictable route to inspect whether the draft renews curiosity or travels overly familiar territory without a distinctive execution.

### 10. Trace symptoms to roots

A weak line may be caused by an unclear scene objective. A confusing scene may be caused by missing setup several blocks earlier. A passive climax may be caused by a protagonist who never received a meaningful choice.

The engine encourages the reviewer to follow the problem backward until the deepest useful cause is found.

### 11. Diagnose before prescribing

A reader may offer possibilities, but the core note should not depend on one replacement scene or one preferred solution.

The writer retains responsibility for choosing the repair that best serves the entire screenplay.

### 12. Questions are revision tools

Precise questions can reveal missing intention more effectively than broad criticism.

Useful examples include:

- What does the character want in this moment?
- What changes because this scene happened?
- Why must this happen now?
- What does the audience believe before and after the block?
- Which earlier setup earns this turn?
- Is the apparent problem a symptom of something earlier?

### 13. Receiving notes requires distance

Feedback is about the work, but creative work can feel personal.

DraftLens encourages writers to record the note, allow the immediate reaction to settle, and then search for the potentially useful observation underneath the wording or proposed solution.

## Six diagnostic lenses

### Story question

Checks the central dramatic question, stakes, theme pressure, and ending evidence.

### Character engine

Checks want, need, Ghost, fatal flaw, strategy, resistance, and arc.

### Structure and pattern

Checks cause, choice, consequence, escalation, pacing, repetition, and turning points.

### Page experience

Checks action clarity, readability, momentum, scene change, and visual evidence.

### Dialogue and exposition

Checks voice distinction, viewpoint, subtext, status, objective, and information delivery.

### Surprise and specificity

Checks audience expectation, reversals, Pickle turns, distinctive execution, and earned unpredictability.

## Canonical field mapping

DraftLens deliberately reuses the existing PlotPickle project schema.

| DraftLens function | Canonical PlotPickle field |
| --- | --- |
| First-read observations | `development.notes.general` |
| Root diagnosis and revision priorities | `development.notes.revisions` |
| Questions for the next draft | `development.notes.openQuestions` |
| Continuity and supporting evidence | `development.notes.continuity` |
| Comparisons and research | `development.notes.research` |
| Feedback readers, dates, drafts, and sources | `development.notes.sources` |
| Selected block review | `block.notes` |
| Central question | `story.dramaticQuestion` |
| Character journey | `character.want`, `need`, `ghost`, `fatalFlaw`, and `arc` |
| Causal block evidence | `block.goal`, `conflict`, `choice`, `action`, and `consequence` |
| Page evidence | `block.scriptExcerpt` and `block.storyboardDirection` |
| Audience expectation and surprise | `block.audienceExpectation`, `block.pickleTurn`, and `development.pickle.unpredictableRoute` |
| Dialogue evidence | `character.voice` and `development.dialogue` |

No duplicate screenplay, character, structure, or notes database is introduced.

## Review coverage signal

The workspace calculates a coverage signal from:

- the story spine;
- defined character arcs;
- causal 24 Blocks;
- drafted block pages;
- recorded review evidence.

The signal measures review preparation and coverage only. It does not measure talent, originality, emotional impact, commercial value, or whether the draft is ready to produce.

## Workflow

1. Read the draft without deciding how to fix it.
2. Record the first-read experience.
3. Review the story through the six diagnostic lenses.
4. Select a block and identify the visible symptom.
5. Record evidence from the page, structure, character, and audience turn.
6. Trace the symptom backward to the deepest useful cause.
7. Write questions that preserve multiple possible solutions.
8. Record revision priorities, continuity evidence, and feedback sources.
9. Return to the relevant PlotPickle workspace for the actual change.

## Relationship to other engines

- **24 Blocks** defines the cause-and-effect story spine.
- **Resonance Engine** tracks how choices and consequences accumulate meaning.
- **Voiceprint Engine** shapes character-specific speech.
- **PageFlow Engine** strengthens visible, playable screenplay writing.
- **DraftLens Engine** evaluates the whole draft and converts reader experience into revision priorities.
- **Visual Board** preserves image progression and continuity.

The connected production chain becomes:

**Plan the cause → test the idea → shape the voice → write the page → review the draft → preserve the image.**
