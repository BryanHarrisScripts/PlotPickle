# Resonance Engine

## Purpose

The Resonance Engine helps a writer turn the story's central question into a coherent pattern of dramatic evidence.

It does not tell the writer what the story must mean. It helps the writer test whether characters, images, consequences, locations, motifs, dialogue, and block turns are all participating in the same living argument.

The engine is designed to strengthen cohesion without making the screenplay preachy, repetitive, or mechanically symbolic.

## Core idea

A story becomes resonant when its parts approach one difficult question from different directions.

The engine therefore treats meaning as a contested dramatic system:

1. The story asks a difficult question.
2. Different characters embody credible answers.
3. Choices and consequences test those answers.
4. Repeated images, objects, locations, and language gather changing meaning.
5. The ending provides evidence rather than a lecture.

## PlotPickle principles

### 1. Question before slogan

The strongest central idea is usually an arguable question rather than a statement with an obvious correct answer.

A useful question:

- permits intelligent disagreement;
- can be tested through action;
- creates different pressures for different characters;
- cannot be fully answered by a single speech.

### 2. Meaning through consequence

The screenplay should reveal its position by what choices cost, what actions reward, what relationships survive, and what characters become.

The engine favours dramatic evidence over explanation.

### 3. Opening and closing image bracket

The first and last major impressions form a meaning bracket.

Their relationship may show:

- transformation;
- failure to transform;
- reversal;
- repetition with new meaning;
- a question that remains deliberately unresolved.

### 4. Characters as competing arguments

Characters do not need to discuss the central question directly.

Their wants, needs, wounds, strategies, and outcomes can represent different answers. Supporting characters and subplots may confirm, complicate, reverse, or expose the limits of the protagonist's answer.

### 5. Repetition through variation

A recurring motif becomes useful when its meaning changes.

Objects, phrases, places, rituals, colours, distances, forms of movement, and visual compositions should not merely repeat. They should accumulate pressure, contradiction, memory, or consequence.

### 6. Locations carry pressure

A location is not only where an event occurs. It can make a belief easier, harder, safer, more absurd, more dangerous, or more visible.

The Resonance Engine connects world visual language and block-level choices so settings participate in the story's argument.

### 7. Dialogue carries worldview

Dialogue contributes through vocabulary, avoidance, interruption, status, bargaining, humour, and subtext.

Characters should rarely state the story's final meaning. Their language should expose what they protect, deny, misunderstand, or gradually learn.

### 8. Every block need not say everything

A block contributes when it does at least one of the following:

- places a belief under pressure;
- plants a question seed;
- provides answer evidence;
- changes the audience's interpretation;
- gives a recurring image or phrase new meaning.

The engine measures coverage, not conformity.

### 9. Restraint protects resonance

Heavy symbolism can still work, but the writer should know when meaning is being explained instead of dramatized.

The engine therefore presents alignment as an editorial signal rather than a grade.

## Canonical field mapping

The Resonance Engine deliberately reuses the existing PlotPickle project schema.

| Resonance function | Canonical PlotPickle field |
| --- | --- |
| Central question | `story.dramaticQuestion` |
| Working answer | `story.theme` |
| Credible counter-answer | `story.antiTheme` |
| Reason to tell the story | `development.pitch.audiencePromise` |
| Audience aftertaste | `development.pitch.emotionalExperience` |
| Opening image / first impression | `story.hook` |
| Closing image / final proof | `story.ending` |
| Character arguments | `character.want`, `need`, `ghost`, and `arc` |
| Belief under pressure in a block | `block.emotionalTurn` |
| Question seed | `block.setup` |
| Answer evidence | `block.payoff` |
| Audience reframe | `block.pickleTurn` |
| Visible sequence reference | `block.storyboardDirection` |
| Visual and location motifs | `world.visualLanguage` and `world.locations` |
| Behavioural meaning | `development.dialogue.subtext` |
| Recurring language and motifs | `development.dialogue.recurringLanguage` |

Because no duplicate meaning fields are introduced, a change made in Resonance remains visible in Story Planner, PageFlow, Voiceprint, the 24 Blocks view, and the Visual Board.

## Alignment signal

The workspace calculates a coverage signal from five areas:

- core compass;
- audience purpose;
- opening and closing bracket;
- visual and dialogue evidence channels;
- block-level resonance coverage.

The signal does not judge whether the theme is correct, original, subtle, or emotionally effective. It only identifies how much of the shared project currently participates in the story's central question.

Ambiguity, contradiction, silence, irony, and justified exceptions remain valid creative choices.

## Workflow

1. Write the central question.
2. Record a working answer and a credible opposing answer.
3. Clarify why the story matters and what should remain with the audience.
4. Compare the opening and closing images.
5. Review how a selected character's want, need, ghost, and arc test the question.
6. Move through the 24 blocks and record pressure, seeds, evidence, and reframes.
7. Align recurring visual language, subtext, and motifs.
8. Return to Story Planner, PageFlow, Voiceprint, or Visual Board for the relevant revision.

## Relationship to other engines

- **24 Blocks** determines how cause, choice, and consequence move the story.
- **Resonance Engine** determines how those consequences accumulate meaning.
- **Voiceprint Engine** determines how each character's history and strategy shape speech.
- **PageFlow Engine** determines how the screenplay presents visible, playable action.
- **Visual Board** preserves image progression, motifs, performance information, and continuity.

Together they form a connected development chain:

**Plan the cause → test the idea → shape the voice → write the page → preserve the image.**
