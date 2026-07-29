# Issue 53 — Dialogue in Motion

## Purpose

Issue #53 combines eleven legacy Dialogue resources into one screenplay-specific learning and practice system. Dialogue is treated as playable speech, silence and physical action used to pursue objectives under pressure.

## Legacy source-to-learning map

| Legacy source | Dialogue in Motion lesson |
| --- | --- |
| Different Genres | Handle Exposition, World and Genre |
| Conflict | Create Conflict Without Constant Arguments; Shape the Exchange and Scene Turn |
| Balancing Action | Balance Speech, Silence and Physical Action |
| Distinctive Voices | Build a Playable Voiceprint |
| Realistic Dialogue | Dialogue Is Action; Shape the Exchange and Scene Turn |
| Dialogue Pitfalls | Revise for Voice, Purpose and Performance |
| Tags and Beats | Balance Speech, Silence and Physical Action |
| Subtext | Write Subtext and Withheld Information |
| Reveal Character | Build a Playable Voiceprint |
| Refining Dialogue | Revise for Voice, Purpose and Performance |
| Art of Silence | Balance Speech, Silence and Physical Action |

## Canonical data strategy

The PlotPickle 1.7 schema remains unchanged.

- Dialogue Blueprints are encoded as anchored review threads linked to the selected scene and mini-block.
- Optional line-purpose labels are encoded as screenplay-element review threads.
- Table-read observations are encoded as scene review threads.
- Voice comparison reads the existing Character Voiceprint fields.
- Relationship context reads both characters' existing relationship records.
- Dialogue proof compares planned character, scene, Block and mini-block claims with current screenplay elements.
- Guided Dialogue Lab passes retain the existing specialist suggestion, before/after comparison, revision snapshot and provenance systems.

Dialogue-specific records use the marker `PLOTPICKLE_DIALOGUE_RECORD` in the first review-thread comment so existing projects and ordinary review threads remain compatible.

## Screenplay formatting distinctions

The learning collection explicitly distinguishes:

- character cues, which identify speakers;
- dialogue and dual-dialogue elements, which hold spoken text;
- action lines, which carry visible behaviour;
- brief necessary parentheticals;
- extensions for off-screen or voice-over delivery;
- dual dialogue for simultaneous speech;
- prose tags such as “he said,” which are generally not screenplay formatting.

## Evidence and diagnostics

The Dialogue in Motion workspace surfaces evidence rather than rigid scores:

- dialogue concentration by speaker and scene;
- long speeches for optional read-aloud review;
- exact repeated speeches of three or more words;
- dialogue-to-action context;
- Voiceprint planning coverage versus actual dialogue elements;
- relationship, objective, opposition and turn evidence;
- recorded Blueprint and line-purpose evidence;
- contextual questions based on the active character, relationship, scene, Block, mini-block, genre and world rules.

Long speeches, repetition, shared language and dialogue-heavy scenes are not automatically failures. Each diagnostic is a question for the writer.

## Voice, genre and cultural language

Voice is a flexible pattern of perception, rhythm, vocabulary, metaphor, emotional access, status behaviour and persuasion. Motivated change under relationship, stress, intimacy, deception or character growth is not automatically inconsistency.

Genre affects pressure, timing, information control and audience expectation; it does not dictate one dialogue style. Accent, dialect and cultural language require research, restraint and informed human review. Synthetic voices must not imitate real performers without permission.

## Guided Dialogue Lab passes

Dialogue Lab now offers bounded options for critique, voice separation, objective and tactic, subtext, status and leverage, conflict escalation, exposition reduction, action and silence, rhythm and concision, genre expectation, continuity and arc consistency, and comparison of two approaches.

Free-form writer direction remains available. Manual and no-AI workflows remain fully supported. Original and proposed text remain separate until explicit writer approval.

## Product surfaces

- Read & Learn → Dialogue in Motion
- Dialogue in Motion Blueprint, proof and table-read workspace
- Specialist Labs → Dialogue Lab guided passes
- Existing screenplay editor, Character Voiceprints, relationships, scene planning, review threads, revisions, provenance and reports

## Validation coverage

Regression tests cover the eleven-source map, searchable aliases, eight lessons, Dialogue Blueprint, contextual guidance, screenplay formatting, voice variation, dialect and genre care, proof diagnostics, read-aloud review, guided passes, explicit approval boundaries and Read & Learn routing.
