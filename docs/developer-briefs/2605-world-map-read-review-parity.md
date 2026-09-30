# #2605 — World Map read/review parity + Learn deep-links

Parent: #2601  
Depends on: #2602, #2604

## Product rule

World Map answers: **What is the story/project now?**

It is no longer a second authoring, proposal-acceptance, image-generation, save, lock, or approval surface.

Mind Map owns creation/editing. World Map reads the same project truth.

## Shared twelve-topic model

World Map uses the same:
- `LEARN_TOPIC_SPINE`;
- `buildStoryDevelopmentFields(plotPickleCurriculum)`;
- canonical field IDs `<topic>:<lessonId>:<fieldId>`;
- `storyDevelopmentFieldView(project, field)`;

that Mind Map uses.

There is no World Map field database and no synchronization copy.

Foundations and World continue to read their established answer stores through the shared adapter. Other Learn-backed fields read the project-level `storyDevelopment` store introduced in #2604.

## Review cards

Every canonical field card shows:
- Learn lesson title;
- current accepted project value or **Not established yet**;
- the Learn application prompt;
- **Open in Learn** for the exact lesson;
- **Edit in Mind Map** for the exact canonical field.

The edit route switches surfaces inside the Dashboard host and passes the topic + canonical field ID to Mind Map. Mind Map selects the topic, scrolls to the field, and focuses it.

## Removed World Map authoring

The World Map surface no longer contains:
- Ask World Agent;
- Save / Redo / Discard proposal flow;
- poster generation/save/lock;
- character generation/save/lock;
- local image-generation API calls;
- direct project persistence.

Existing durable visual and story authorities are preserved. World Map simply reviews their current approved state.

## Rich read-only supplements

The canonical field grid is primary for every topic. Existing project authorities may add review context without becoming competing field stores:
- Character: approved Character Truth + approved image;
- Structure: Act-filtered 24-Block projection;
- Previs: current saved/locked Marketing Reference;
- Drafting: Act-filtered written entries;
- Responsible AI: provenance/source summary.

## Deterministic one-to-one behavior

Mind Map writes the shared project stores. `saveActiveLibraryProject` emits `PROJECT_LIBRARY_CHANGED_EVENT`; when World Map is open, the Dashboard host reloads the active Library project. World Map therefore reflects saved Mind Map changes directly from the same data source.

## Blank and Afterglow

Blank renders all twelve topic structures with empty values and no Afterglow content.

Explicitly loaded Afterglow uses the same World Map renderer and displays the approved values/resources already carried by the packaged example. Missing approved fields remain empty rather than being invented.
