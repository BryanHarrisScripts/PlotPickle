# PageFlow Engine

## Purpose

The PageFlow Engine turns planned story movement into screenplay description that is visible, active, economical, actor-playable, and easy to read.

It is a diagnostic and revision layer rather than a second screenplay database. It works directly with PlotPickle's existing character and 24 Blocks data so the written page, causal story plan, and Visual Board remain synchronized.

## Core contract

Every action line should answer four questions:

1. What can the audience actually see or hear?
2. Who is doing what, and in what order?
3. What behaviour gives an actor something playable?
4. How quickly and clearly can the reader experience the moment?

Meaning may be internal, but its screenplay evidence must be external. Thought, history, attraction, fear, status, and intention become useful when expressed through behaviour, dialogue, objects, spatial choices, reactions, or consequences.

## PageFlow principles

### Screen evidence

Description records observable evidence. Explanations such as what a character knows, remembers, wants, or feels must be converted into a visible or audible choice unless the story deliberately uses narration.

### Active precision

Prefer exact nouns and active verbs. Simple language is not generic language: the goal is the clearest specific image with the fewest necessary words.

### Playable behaviour

Emotion labels are prompts, not finished description. Replace "nervous," "angry," or "attracted" with behaviour an actor can perform and an audience can interpret.

### Character entrance in motion

A first appearance should create an immediate impression through action, condition, clothing, environment, contradiction, or relationship to the space. Casting facts remain concise; personality arrives through what the character does.

### Page-turn rhythm

Paragraph breaks represent visual beats. Dense blocks slow the reader and bury changes. Separate actions when attention, subject, location, power, or emotional meaning turns.

### Direction restraint

The writer controls attention through selection and sequence, not constant camera terminology. A shot instruction belongs only when the storytelling effect cannot be communicated clearly through action and composition.

### Description voice

The prose may carry tone and personality, but it should not become a competing narrator. Word choice can be funny, tense, elegant, harsh, or tender while remaining transparent enough for the movie to stay in the reader's mind.

## Canonical data mapping

The PageFlow Engine deliberately reuses the existing PlotPickle project object:

- `block.scriptExcerpt` stores the page-ready action or scene draft.
- `block.storyboardDirection` stores the visible sequence and image progression.
- `block.goal`, `conflict`, `choice`, `action`, `consequence`, and `emotionalTurn` provide causal context.
- `character.description` stores the character's entrance impression and concise physical introduction.
- `block.notes` stores PageFlow revision decisions and unresolved questions.
- `block.visuals` carry the same selected actions into the Visual Board.

This avoids duplicate screenplay text and requires no separate project schema branch.

## Diagnostic signals

PageFlow provides editorial signals rather than a mechanical grade. It can flag:

- invisible-state words such as "thinks," "knows," "realizes," or "feels";
- explanatory connectors such as "because" when they substitute for visible causality;
- camera and editing terminology that may be unnecessary;
- weak constructions such as "starts to," "begins to," or "seems to";
- long paragraphs that may contain several visual beats;
- emotion labels that may need actor-playable behaviour.

A flagged phrase is an invitation to inspect the line, not an automatic error. Genre, voiceover, formal experimentation, and necessary shot design can justify exceptions.

## Workflow

1. Select one of the 24 Blocks.
2. Review its goal, conflict, action, consequence, and emotional turn.
3. Draft or paste the scene description in the Page Draft field.
4. Use the diagnostic signals to find invisible, weak, dense, or over-directed passages.
5. Rewrite internal meaning as screen evidence and emotional labels as behaviour.
6. Break the page into visual beats and record the image progression.
7. Refine the selected character's entrance description when the block introduces them.
8. Return to Story Planner or Visual Board; all changes are already attached to the same project data.

## Relationship to other PlotPickle engines

The 24 Blocks system determines why the scene must happen and what it changes.

The Voiceprint Engine determines how each character speaks under pressure.

The PageFlow Engine determines what the reader sees, how an actor can play it, and how the page moves.

The Visual Board determines which images best communicate those turns and how continuity carries forward.
