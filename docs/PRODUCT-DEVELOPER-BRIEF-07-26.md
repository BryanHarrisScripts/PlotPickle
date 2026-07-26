# PlotPickle Product Developer Brief — 07-26

## Purpose

This brief defines the expanded PlotPickle product direction and the implementation rules that govern Issues #110–#124.

PlotPickle should become a clear, local-first screenwriting and production-planning environment that helps a writer move from learning and planning through story construction, screenplay writing, visual development, refinement, feedback, reporting, rehearsal and production preparation.

The product must remain understandable to a new writer, useful to an experienced writer, and safe for existing projects.

---

## 1. Product principles

### 1.1 Reuse first

Before creating a new screen or data model, audit what already exists.

Every existing panel, component, route, schema and workflow should be classified as one of:

- Keep as-is
- Rename
- Move
- Expose in navigation
- Combine
- Modify
- Extend
- Replace only when necessary
- New feature

No major screen should be rewritten without documented justification.

### 1.2 Preserve the writer’s context

PlotPickle must reduce internal links that unexpectedly move the user away from the Block, mini-block, scene, character, frame or report they are working on.

Related guidance, feedback, diagnostics, visuals and reports should open in a right-side inspector, drawer, modal, anchored panel or split view whenever practical.

The application should restore:

- selected workspace and submenu;
- selected Block, mini-block, scene or character;
- filters;
- zoom and board position;
- scroll position;
- open inspector;
- feedback target;
- unsaved work.

### 1.3 Canonical project data

Plan, Build, Write, Storyboard, Refine, Feedback and Reports must use the same canonical project structure and stable IDs.

Build must not create a second story model. Feedback must remain linked after structural reordering. Reports must derive from canonical project data.

### 1.4 Local-first and optional integrations

Core PlotPickle features must work locally and offline.

AI, GitHub, plugins and Google services are optional. A disconnected provider must never block local project work.

Credentials and tokens must never be stored inside `.ppf` project files or exported reports.

---

## 2. Application shell

The header should have four clearly separated zones.

### Zone A — Orientation

- PlotPickle logo returns to the marketing splash page.
- Rename **Instructions** to **Introduction**.
- Add a visible gutter after Introduction.

### Zone B — Creative workflow

Centered primary navigation:

**Dashboard · Learn · Plan · Build · Write · Storyboard · Refine · Feedback · Reports**

### Zone C — Project actions

Place on the far-right side before Settings:

- New Project
- Import
- Export
- Load Afterglow

These actions remain available from every primary workspace and must not be treated as Dashboard content.

### Zone D — Configuration

- Add a visible gutter before Settings.
- Settings remains the far-right application and provider configuration area.

---

## 3. Introduction

Introduction is the entrance to the PlotPickle method, not a generic instruction manual.

It should reuse and reorganize existing guidance and include:

- what PlotPickle does;
- the complete idea-to-production journey;
- 24 Blocks overview;
- 96 mini-blocks overview;
- how Learn, Plan, Build, Write, Storyboard and Refine connect;
- local-first ownership;
- optional AI;
- `.ppf` project files;
- collaboration roles;
- suggested first steps;
- glossary links;
- Afterglow as a worked example.

Introduction should not contain active project status, file-management controls or project reports.

---

## 4. Navigation and submenus

Each major workspace should use a persistent, predictable left submenu.

Submenus should:

- remain in the same location;
- clearly indicate the selected section;
- show unresolved badges where useful;
- support keyboard navigation;
- collapse cleanly on smaller screens;
- avoid more than two nested levels;
- avoid hiding essential items only in overflow menus;
- restore the last selected subsection.

A submenu item should normally open content inside the current workspace shell rather than redirecting to another top-level workspace.

---

## 5. Dashboard

Dashboard is a quick-look command centre, not an editing workspace.

It should answer:

1. Is PlotPickle ready?
2. Where is the project?
3. What needs attention?
4. What should the writer do next?

### 5.1 Connection status

Reuse existing status sources for:

- GitHub;
- AI provider;
- plugins;
- current project and save state;
- local storage and backups;
- collaboration or synchronization.

Each card should show a text label, icon, accessible green/yellow/red state, short explanation, repair/setup action and last successful check when appropriate.

### 5.2 Workflow progress

Show:

- Learn
- Plan
- Build
- Write
- Storyboard
- Refine

Each item should include completion, unresolved work, last activity, recommended next action and a direct Continue action.

### 5.3 Attention required

Examples:

- empty Blocks or mini-blocks;
- incomplete character profiles;
- missing storyboard frames;
- unresolved continuity warnings;
- unresolved feedback;
- unsaved work;
- unmerged proposals;
- provider or plugin errors.

### 5.4 Project snapshot

Include title, draft, format, runtime estimate, screenplay pages, scenes, characters, locations, project path, last save and canonical/branch state.

New Project, Import, Export and Load Afterglow do not belong here.

---

## 6. Build workspace

Build is the visual story-construction bridge between Plan and Write.

- **Plan:** define what the story requires.
- **Build:** arrange the story visually.
- **Write:** turn the structure into screenplay pages.

### 6.1 Reuse-first foundation

Reuse or extend existing 24-Block views, 96-mini-block data, Story Planner cards, treatment cards, storyboard interactions, sequence layouts, visual references and drag-and-drop behaviour wherever practical.

### 6.2 Views

- Whole Film
- Acts
- Sequences
- 24 Blocks
- 96 Mini-blocks
- Storylines
- Character Arcs
- Setup and Payoff
- Unresolved Cards

### 6.3 Build cards

Cards may include:

- Block and mini-block number;
- working title;
- story purpose;
- scene summary;
- conflict;
- character focus;
- emotional movement;
- setup and payoff;
- location;
- timeline position;
- linked scenes;
- visual reference;
- notes;
- status;
- labels;
- colour category.

Suggested states:

- Empty
- Planned
- Drafted
- Written
- Reviewed
- Approved
- Needs revision
- Locked

### 6.4 Interactions

- drag and drop;
- keyboard move alternatives;
- reorder within a Block;
- move between Blocks or sequences;
- duplicate;
- split;
- merge;
- archive;
- pin;
- lock;
- add notes and images;
- connect related cards;
- filter and search;
- undo and redo;
- debounced autosave.

### 6.5 Whole-film wall

The 24 Blocks should expand into all 96 mini-blocks.

Support:

- expand one Block, sequence, act or all 96;
- pan and zoom;
- focused views;
- colour modes by character, storyline, location, act, status or setup/payoff;
- scene links;
- storyboard thumbnails;
- persistent zoom, pan, filters and selection.

### 6.6 Diagnostics

Identify:

- empty mini-blocks;
- overloaded Blocks;
- missing escalation;
- repeated beats;
- setup without payoff;
- payoff without setup;
- absent character arcs;
- long storyline gaps;
- unlinked scenes;
- story cards without storyboard frames;
- storyboard frames without story cards.

---

## 7. Feedback workspace

Feedback becomes PlotPickle’s central review, discussion, rehearsal and collaboration area.

Suggested submenu:

- Overview
- AI Review
- Human Review
- Writers’ Room
- Shooting Script
- Table Read

### 7.1 Feedback targets

Feedback may attach to:

- project;
- act;
- sequence;
- Block;
- mini-block;
- character;
- relationship;
- world;
- treatment;
- screenplay;
- scene;
- dialogue or action passage;
- storyboard frame;
- visual identity;
- production item.

### 7.2 Feedback records

Each record should support:

- stable target reference;
- author and role;
- source;
- title and body;
- dates;
- status;
- priority;
- category;
- proposed change;
- response thread;
- resolution;
- linked revision;
- AI provenance where applicable.

Statuses:

- Open
- Under review
- Accepted
- Partially accepted
- Rejected
- Resolved
- Deferred

Feedback never changes canonical project content automatically.

---

## 8. AI Review and Human Review

### 8.1 AI Review

Allow the user to select:

- review scope;
- provider and model;
- review lens;
- custom questions;
- project context included.

Scopes may include all 24 Blocks, all 96 mini-blocks, selected Blocks, an act, sequence, character arc, treatment, screenplay, scenes or storyboard continuity.

Suggested lenses:

- story editor;
- screenwriting instructor;
- director;
- producer;
- actor;
- dialogue specialist;
- continuity reviewer;
- visual continuity reviewer;
- audience reader;
- structure analyst;
- pacing analyst.

Flow:

**Request → Review generated → User evaluates → Accept, reject, defer or convert into proposal**

Every result should retain provider, model, date, scope and prompt provenance.

### 8.2 Human Review

Support:

- reviewer identity and role;
- review requests;
- threaded responses;
- proposed changes;
- approval and resolution;
- GitHub proposal linkage where available;
- exportable review summaries.

AI and human feedback must be visually distinguishable.

---

## 9. Writers’ Room and Google

Writers’ Room lives inside Feedback.

Google Meet supplies video communication. PlotPickle supplies story context, notes, decisions, action items and proposals.

### 9.1 Writers’ Room sessions

Include:

- title, date and time;
- participants;
- optional Meet link and Calendar event;
- agenda;
- selected Blocks, mini-blocks, scenes or feedback items;
- active item;
- notes;
- decisions;
- unresolved questions;
- action items;
- proposed revisions;
- session summary and history.

Meeting decisions remain proposals until approved.

### 9.2 Google and Connected Services

Settings should include:

- Google sign-in;
- connection status;
- Meet permissions;
- Calendar permissions;
- disconnect and revoke;
- privacy and scope explanations.

Google remains optional. Only non-sensitive meeting metadata may be stored in the project.

---

## 10. Table Read

Table Read supports rehearsal, listening, actor preparation and feedback capture.

Reuse the screenplay viewer, character data, dialogue reports, scene navigation and feedback records.

Capabilities:

- character voice assignment;
- narrator voice;
- browser speech synthesis foundation;
- optional voice-provider plugins later;
- scene, sequence and full-script playback;
- pause, resume and navigation;
- estimated timing;
- actor sides;
- pronunciation controls;
- rehearsal notes;
- feedback attached to the current line or scene;
- session summary and reports.

---

## 11. Shooting Script

Shooting Script should extend the existing screenplay rather than create a duplicate screenplay.

Capabilities:

- explicit conversion from writer draft to production draft;
- locked pagination;
- scene numbering;
- A/B scenes and pages;
- revision sets, colours, dates and marks;
- omitted scenes;
- changed-page output;
- production annotations;
- revision and approval history;
- print and PDF rules.

Existing writer drafts remain unchanged until explicitly converted.

---

## 12. Reports

Reports should use a persistent left submenu:

- Project
- Story
- Characters
- Scenes
- Dialogue
- Production
- Feedback
- Connections

Selecting a report should keep the user inside Reports. Editing actions should open the exact target in context with a clear return path.

### 12.1 Project

Draft, format, runtime, pages, scenes, characters, locations, Block/mini-block completion, storyboard status, unresolved feedback, save/sync and canonical state.

### 12.2 Story

Act and sequence balance, 24/96 completion, missing or overloaded sections, setup/payoff, character arcs, storylines, pacing and escalation.

### 12.3 Characters

Scenes, dialogue lines, words, first/last appearance, shared scenes, arc progress, visual continuity, actor requirements and estimated shooting days.

### 12.4 Scenes

Scene heading, interior/exterior, day/night, location, characters, page length, estimated runtime, linked Blocks, storyboard status, feedback, readiness, props, wardrobe and effects.

### 12.5 Dialogue

Lines and words by character, longest speeches, dialogue-heavy or silent scenes, repeated phrases, voice consistency, sides and spoken duration.

### 12.6 Feedback

Open, resolved and deferred items; sources; reviewers; distribution by Block, mini-block and scene; recurring issues; Writers’ Room decisions; table-read notes.

### 12.7 Connections

GitHub, AI, plugins, Google, storage, backups, repository, last synchronization and authentication problems.

Detailed setup remains in Settings.

---

## 13. Production reports

Production becomes a practical shoot-planning intelligence area.

Suggested submenu:

- Overview
- Locations
- Shot Types
- Shoot Groups
- Actor Schedule
- Shooting Timeline
- Production Requirements
- AI Systems

### 13.1 Locations

Report:

- story and possible real-world location;
- scenes;
- interior/exterior;
- day/night;
- characters;
- props and set dressing;
- wardrobe;
- sound and lighting concerns;
- weather dependency;
- permits;
- travel and accessibility;
- availability;
- setup time;
- estimated shoot time.

### 13.2 Shot Types

Track establishing, wide, full, medium, close-up, extreme close-up, over-the-shoulder, two-shot, group, POV, insert, cutaway, tracking, handheld, crane/jib, drone, static, vehicle, green-screen/virtual-production and VFX plate requirements.

### 13.3 Shoot Groups

Propose shots and scenes that can be completed in one shoot based on shared:

- location or set;
- cast;
- wardrobe;
- story time;
- lighting;
- camera setup;
- vehicle;
- props;
- stunt or VFX team;
- weather requirement.

Every grouping must explain its reasoning and allow manual acceptance, rejection or adjustment.

### 13.4 Actor Schedule

Provide views by actor/character, shooting day, location, scene and conflict.

Include required scenes, locations, wardrobe, makeup, rehearsals, call/wrap estimates, days required, grouped scenes, availability and daily sides.

### 13.5 Shooting Timeline

Estimate:

- optimistic days;
- realistic days;
- contingency days;
- pages and scenes per day;
- night shoots;
- company moves;
- preparation days;
- pickup days;
- contingency allowance.

Use pages, complexity, setups, shot count, locations, cast, children/animals, stunts, effects, weather, makeup and rehearsal as planning inputs.

All estimates must be labelled as planning guidance, not guarantees.

### 13.6 Production Requirements

Consolidate cast, extras, locations, props, wardrobe, makeup, vehicles, animals, stunts, practical effects, VFX, equipment, sound, playback, permits, safety and accessibility.

### 13.7 AI Systems

Maintain reviewed top-three options for:

- video generation;
- image generation;
- multi-model aggregators.

Do not permanently hard-code rankings.

Store:

- date reviewed;
- source links;
- supported tasks;
- licensing and privacy notes;
- cost model;
- API and plugin status;
- local or cloud operation;
- recommended PlotPickle use.

Clearly identify Connected, Plugin available, Recommended but not connected, Local option, Cloud service, Requires account and Commercial terms need review.

---

## 14. Settings structure

Recommended Settings navigation:

- General
- Appearance
- Project defaults
- Storage and backups
- AI providers
- GitHub
- Plugins
- Google and Connected Services
- Privacy and permissions
- Accessibility
- About and licensing

Every integration should expose status, identity, setup, test connection, last success, errors, repair guidance, disconnect/revoke and a clear data-sharing explanation.

---

## 15. Schema direction

Potential versioned additions include:

```text
project.buildBoard
project.buildCards
project.feedback
project.reviewRequests
project.reviewThreads
project.reviewResolutions
project.writersRoomSessions
project.connectedServicesMetadata
project.shootingScript
project.tableRead
```

Build cards should reference existing structure IDs. Feedback should use generic stable targets, for example:

```json
{
  "targetType": "miniBlock",
  "targetId": "mini-block-042"
}
```

All schema changes require migration and round-trip tests.

---

## 16. Non-functional requirements

### Accessibility

- full keyboard navigation;
- non-drag card movement;
- screen-reader labels;
- colour-independent states;
- visible focus indicators;
- scalable text;
- reduced-motion support;
- accessible boards, drawers, dialogs and report tables.

### Performance

- responsive 96-card wall;
- localized rerenders;
- virtualization where appropriate;
- lazy-loaded images;
- debounced autosave;
- bounded undo history.

### Safety and recovery

- confirm destructive actions;
- retain recovery snapshots;
- log approved structural changes;
- support undo and redo;
- prevent integrations from silently changing canon.

---

## 17. Ordered delivery plan

The GitHub implementation roadmap is tracked in Issue #110 and child Issues #111–#124.

### Milestone 1 — Workflow shell and reuse map

- #111 Existing-system inventory and reuse map
- #112 Navigation, persistent submenus and context continuity
- #113 Dashboard redesign

### Milestone 2 — Visual story construction

- #114 24-Block Build foundation
- #115 96 mini-block whole-film wall

### Milestone 3 — Review and reporting

- #116 Feedback foundation
- #117 AI Review and Human Review
- #118 Reports consolidation
- #119 Production reports and AI systems

### Milestone 4 — Connections and collaboration

- #120 Settings connections and Google foundation
- #121 Writers’ Room and Google Meet

### Milestone 5 — Rehearsal and production draft

- #122 Table Read
- #123 Shooting Script

### Milestone 6 — Release hardening

- #124 Schema migration, accessibility, performance, documentation and release hardening

---

## 18. PR requirements

Every implementation PR should state:

1. which existing components were reused;
2. which panels were moved or renamed;
3. why any new screen was necessary;
4. how user context is preserved;
5. how canonical project data remains synchronized;
6. what migration, accessibility and regression tests were added.

---

## Definition of success

A writer can understand where they are, remain focused on the current problem, move through the complete film workflow, visually arrange the 24/96 structure, receive structured feedback, assess system readiness, prepare collaboration sessions, rehearse the screenplay and generate meaningful story and production reports without losing context or surrendering control of the canonical project.
