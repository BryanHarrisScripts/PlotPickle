# CraftLoop Engine

## Purpose

The CraftLoop Engine is PlotPickle's capstone practice and integration workspace.

It helps a writer apply the complete story-development method repeatedly to one project and one selected block. Instead of introducing another isolated craft checklist, it connects audience engagement, opening design, scene movement, character pressure, dialogue observation, page economy, pitching, and revision into one deliberate-practice loop.

CraftLoop does not replace the specialist engines and does not create a second story database. It identifies which part of the writing loop needs attention and sends the writer back to the canonical PlotPickle field or workspace where the actual change belongs.

## Core idea

Craft develops through repeated cycles of observation, application, testing, and revision.

A useful CraftLoop pass asks seven questions:

1. What game is the audience being invited to play?
2. What contract does the opening establish?
3. What changes during this scene or block?
4. How does pressure become harder while remaining specific to the character?
5. Does the language sound observed, motivated, and human?
6. Can the page become clearer, more active, and more economical?
7. Can the writer explain the story confidently while remaining open to discovery?

The engine treats these as connected activities. A weak page may begin with a weak scene turn. A flat scene turn may begin with an unclear audience question. Generic dialogue may reveal that the character's motive or pressure has not been defined.

## PlotPickle principles

### 1. The audience is active

A screenplay gives the audience patterns to track, questions to answer, expectations to form, and clues to reinterpret.

CraftLoop therefore begins with The Pickle: central tension, audience question, expected destination, unpredictable route, block expectation, and block reframe.

### 2. The opening establishes a contract

An effective opening does not explain the entire story. It gives the audience enough evidence to understand the kind of world they have entered, whose experience matters, what tension is alive, and what emotional or thematic promise is being made.

The opening contract combines the hook, ordinary world, catalyst, theme pressure, image, and first meaningful conflict.

### 3. Every scene should move

A scene can reveal information, but information alone is not movement.

CraftLoop checks whether the selected block begins with a goal or condition, introduces pressure, forces action or choice, creates consequence, and ends in a meaningfully different state.

### 4. Pressure should be character-specific

Conflict is not simply difficulty. It is the force standing between this character and what they believe they need.

The strongest obstacles target the character's want, need, Ghost, flaw, relationships, strategy, status, or emotional limits. Escalation should make the situation harder without causing the character to behave arbitrarily.

### 5. Human language is observed

Distinctive dialogue grows from attention to how people actually speak: cadence, sentence length, fillers, evasions, corrections, topic changes, status shifts, silence, and the gap between the stated reason and the deeper motive.

CraftLoop connects the selected character's voice with the Voiceprint fields, project dialogue rules, subtext, and fieldwork observations.

### 6. Description improves through compression

Strong action writing uses active verbs, concrete evidence, useful white space, and precise image progression.

CraftLoop reuses the PageFlow diagnostic signal to identify invisible information, weak phrasing, unnecessary directing language, labelled emotion, and dense action paragraphs. The signal remains an editorial prompt rather than a grade.

### 7. Pitching is part of understanding

Explaining a story reveals whether its engine is clear.

The writer should be able to communicate the central experience with energy and confidence while remaining humble enough to discover a better version. Certainty about the value of the story does not require rigidity about every current solution.

### 8. Reading becomes deliberate practice

Professional scripts are not merely examples to admire. They can be studied for openings, scene turns, description, dialogue rhythm, information control, and audience engagement.

CraftLoop encourages the writer to identify a specific technique, reproduce the underlying principle in original material, compare the result, and revise.

### 9. Practice should produce evidence

Progress is not measured by consuming more advice. It appears in clearer goals, stronger turns, more specific pressure, more observed language, cleaner pages, and a pitch that accurately reflects the project.

## Seven-pass loop

### Pass 1 — Audience game

Define what the audience is tracking, what they currently expect, and what changes their interpretation.

### Pass 2 — Opening contract

Check whether the first block establishes image, world, character, pressure, question, and promise without overloading the audience with explanation.

### Pass 3 — Scene turn

Confirm that the selected block has a before state, active pressure, a meaningful choice or action, consequence, and an after state.

### Pass 4 — Character pressure

Compare the block conflict with the selected character's want, need, Ghost, flaw, strategy, and arc. Increase difficulty in a way only this character would experience.

### Pass 5 — Human voice

Review rhythm, vocabulary, motive, subtext, silence, status, and observed speech behaviour. Prefer several simultaneous motives over a single explanatory line.

### Pass 6 — Page compression

Rewrite toward visible evidence, active verbs, economical paragraphs, and image progression. Remove words that explain what the audience cannot see or hear unless the form deliberately requires them.

### Pass 7 — Pitch and reflect

State the story in one sentence and a short pitch. Record what the exercise revealed, then return to the relevant specialist workspace for the next revision.

## Canonical field mapping

CraftLoop deliberately reuses the existing PlotPickle project schema.

| CraftLoop function | Canonical PlotPickle field |
| --- | --- |
| Audience game | `development.pickle.centralTension`, `audienceQuestion`, `expectedDestination`, `unpredictableRoute`, and `signatureMove` |
| Current audience belief and reframe | `block.audienceExpectation` and `block.pickleTurn` |
| Opening contract | `story.hook`, `theme`, `catalyst`, `world.ordinaryWorld`, and Block 1 fields |
| Scene movement | `block.goal`, `conflict`, `choice`, `action`, `consequence`, and `emotionalTurn` |
| Character-specific pressure | `character.want`, `need`, `ghost`, `fatalFlaw`, and `arc` |
| Human voice | `character.voice`, Voiceprint fields, and `development.dialogue` |
| Observation practice | `development.dialogue.fieldworkNotes` |
| Page compression | `block.scriptExcerpt` and the PageFlow scanner |
| Image progression | `block.storyboardDirection` and `block.visuals` |
| One-sentence explanation | `development.pitch.oneSentence` |
| Short spoken pitch | `development.pitch.shortPitch` |
| Comparative craft study | `development.notes.research` |

No duplicate story, scene, dialogue, screenplay, pitch, or practice database is introduced.

## CraftLoop coverage signal

The workspace calculates a practice-coverage signal from:

- defined audience game;
- opening-contract evidence;
- selected-block cause and turn;
- character-specific pressure;
- voice and observation evidence;
- drafted page and PageFlow signal;
- one-sentence and short pitches.

The signal measures whether the writer has material available for a complete practice pass. It does not measure talent, originality, entertainment value, or production readiness.

## Workflow

1. Select a block and character.
2. Review the audience expectation and Pickle turn.
3. Check the opening contract when working on Block 1.
4. define the block's goal, pressure, action or choice, consequence, and emotional turn.
5. Compare the conflict with the character's internal and external engine.
6. Review voice, motive, subtext, and fieldwork observations.
7. Rewrite the page using the PageFlow signal.
8. Test the one-sentence and short pitches.
9. Follow the workspace links to Resonance, Voiceprint, PageFlow, or DraftLens for deeper work.
10. Repeat the loop on the next block or after the next draft.

## Relationship to other engines

- **24 Blocks** defines the cause-and-effect story spine.
- **Resonance Engine** tracks how choices accumulate meaning.
- **Voiceprint Engine** develops character-specific speech.
- **PageFlow Engine** strengthens visible screenplay writing.
- **DraftLens Engine** diagnoses the whole draft and organizes revision priorities.
- **CraftLoop Engine** turns the complete method into repeatable deliberate practice.
- **Visual Board** preserves image progression and continuity.

The connected production cycle becomes:

**Plan the cause → test the idea → shape the voice → write the page → review the draft → practise the craft → preserve the image → repeat.**
