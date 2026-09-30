# #2604 — Mind Map as canonical create/edit workspace

Parent: #2601  
Depends on: #2602, #2603

## Purpose

Mind Map now owns creation and editing for the full twelve-section Learn taxonomy while preserving one project truth.

The twelve sections are:

1. Foundations
2. World
3. Character
4. Theme
5. Structure
6. Previs
7. Drafting
8. Dialogue
9. Revision
10. Responsible AI
11. Industry
12. Collaboration

## Canonical field identity

Each Learn application field receives the stable Phase 1 identity:

`<topic>:<lessonId>:<fieldId>`

Fields are derived from the live curriculum, using the lesson's final **Apply this to your story** points and falling back to the lesson exercise when an application list does not exist.

The field model therefore follows Learn rather than duplicating a second hard-coded Mind Map curriculum.

## Storage

A project-level `storyDevelopment` store now persists:
- accepted generic project/craft/application values for topics that do not already have a dedicated truth store;
- agent proposals and proposal provenance for every canonical field;
- accepted-source metadata.

This store is not named or scoped as Mind Map state. Phase 4 World Map can read the same model.

Foundations and World remain special because they already own canonical answer stores. Their accepted field values continue to live at:
- `foundations.lessons[lessonId].answers[fieldId]`
- `world.lessons[lessonId].answers[fieldId]`

The shared adapter reads/writes those existing authorities while keeping proposal metadata in `storyDevelopment`.

## Mind Map behavior

For the selected Learn topic, Mind Map renders every applicable canonical field.

Each field provides:
- the Learn lesson title;
- the exact application prompt;
- the stable canonical field ID;
- a directly editable project-value textarea;
- a field-specific agent action such as **Create Character Bible Proposal** or **Create Genres Proposal**;
- an editable Agent Proposal area;
- **Use Proposal**, which only then accepts the proposal into project truth.

The previous generic **Develop Agent Proposals** / **Build Topic** workflow is removed.

Existing free-form Act ideas remain available as an ideation layer, but they are no longer the only way to author the story. Canonical Learn-backed fields are now the primary structured create/edit layer.

## Human authority

Agent generation never automatically replaces the Human's current value.

For an already saved project, a generated proposal may be persisted as proposal metadata. In a detached Blank, the proposal remains runtime-local until the Human explicitly saves/uses it.

Using an Agent Proposal records that source, accepts the value into the same canonical field, and leaves the resulting text directly editable.

## Blank / Afterglow behavior

Blank continues to normalize with an empty `storyDevelopment` store and empty Foundations/World answers.

Afterglow continues to populate the same Mind Map controls from its canonical packaged project data. Existing Foundations values are read directly from the packaged Foundations answer store; later topic-specific development values use the shared project-level store as they are authored/promoted.

No example content is copied into Blank.

## Phase 4 handoff

#2605 can render these exact same canonical IDs and values in World Map. It does not need to create a second World Map field database.
