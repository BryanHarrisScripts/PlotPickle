# Issue #111 — PlotPickle reuse-first interface and data audit

Parent roadmap: #110  
Audit date: 2026-07-26  
Status: implementation baseline for Issues #112–#124

## Purpose

This audit records the current PlotPickle information architecture, reusable components, duplicate patterns, hidden capabilities, context-breaking redirects and canonical-data risks before navigation or workspace implementation begins.

The governing rule is reuse first. Existing screens and data models should be kept, renamed, moved, exposed, combined, modified or extended wherever practical. Replacement is justified only where an existing implementation cannot safely support the target workflow.

## Executive findings

1. PlotPickle already contains most of the functional foundations required by roadmap #110: the 24-Block and 96-mini-block model, screenplay writing, visual storyboarding, learning, diagnostics, review records, revision snapshots, GitHub proposals, production records and reports.
2. The primary problem is information architecture, not absence of capability. Related tools are spread across the main client page, standalone routes, Settings, nested details and engine landing pages.
3. `app/page.tsx` currently owns the application shell, project state, autosave, workspace selection, story-section selection and many large editor components. It is the correct orchestration source but should be decomposed into reusable shell, navigation and context-state components rather than rewritten.
4. Standalone specialist routes load and save the same local project independently. That preserves local-first operation, but it creates multiple state owners and loses the selected workspace, Block, mini-block, scene, filters and return path.
5. The canonical schema already provides stable IDs for Blocks, scenes, mini-blocks, screenplay elements, characters, visual frames, story threads, review threads, revisions and production records. Build, Feedback and Reports should extend these records rather than introduce parallel models.
6. The existing review model is a strong starting point but is narrower than the planned Feedback system. It should be extended with additional target types, statuses, source/provenance, proposed changes and resolution records.
7. Existing connection and readiness logic is split between Dashboard, Settings and GitHub Collaboration. A shared status source is required before Dashboard and Connections reports are expanded.

## Current information architecture

### Marketing and application entry

- Marketing splash page
- PlotPickle logo returns to the marketing splash
- Enter PlotPickle opens the main client application
- The active project is stored locally under `plotpickle.project.v1`
- Settings are stored separately under `plotpickle.settings.v1`

### Current primary application navigation

1. Dashboard
2. Instructions
3. Learn
4. Plan
5. Write
6. Storyboard
7. Refine
8. Reports
9. Settings

Build and Feedback do not yet exist as first-class workspaces.

### Current project strip

- Active project title and status
- Local save state
- Imported-screenplay review state
- Overall story completion

### Dashboard

- Project health cards
- Story plan status
- Screenplay status
- Visual continuity status
- Open-review status
- New Project
- Import
- Export
- Load Afterglow
- Project Overview

Classification: modify and move. Keep the status foundations and Project Overview, but move project actions to the persistent header action zone.

### Instructions

- Reuses the Story Rail
- Provides section-specific questions, deliverables and shared-data explanations
- Includes README guidance for Project Overview
- Links into Plan and Afterglow

Classification: rename to Introduction, reorganize and extend. Retain the underlying guidance and section content, but make Introduction a complete orientation workspace rather than a mirrored Story Planner.

### Learn

- Workflow chooser
- Contextual guidance by Block and mini-block
- Complete learning library
- 24 Blocks learning collection
- AI revision lessons
- Collaboration and ownership lessons
- Working Together lessons
- Characters in Motion
- Dialogue in Motion
- Story Craft Essentials
- Screenplay terminology
- Loaded-screenplay study
- Per-project learning progress

Classification: keep and modify. Preserve the library and progress model. Replace DOM-click navigation and full-page redirects with explicit workspace-context actions.

### Plan

Current Story Rail sections:

- Simple Start
- Project Overview
- Story Setup
- Pitch & Vision
- World
- Characters
- Ghost
- Catalyst
- Foundations
- The Pickle
- Dialogue
- Core Model
- Structure Map
- 24 Blocks
- Storyboard
- Notes

Classification: keep, combine and expose. Plan remains the source for story requirements and foundational decisions. Structure arrangement and whole-film card manipulation move to Build while continuing to use the same canonical data.

### Write

- Treatment editor
- Full screenplay editor
- Block and mini-block navigator
- Scene-aware screenplay elements
- Screenplay formatting controls
- Fountain export
- Final Draft export
- Print/PDF
- Optional AI suggestion with explicit user application
- Craft diagnostics

Classification: keep and extend. This is the foundation for future Table Read and Shooting Script workflows.

### Storyboard

Internal sections:

- Visual overview
- Characters and identity locks
- Locations and world
- Props, vehicles and wardrobe
- Colour, lighting and visual language
- 24-Block storyboard
- 96 mini-block frames
- Posters, pitch and production
- Continuity and missing-assets diagnostics

Classification: keep and modify. Reuse its 24/96 board patterns, visual filters, frame thumbnails, identity locks, prompt generation and diagnostics. Avoid wrapping it in a second competing Story Rail.

### Refine

Engine and lab destinations:

- Structure Engine
- Story Craft Essentials
- Resonance Engine
- Voiceprint Engine
- PageFlow Engine
- DraftLens Engine
- CraftLoop Engine
- Pitch & Review Studio
- Production Studio
- Specialist Labs

Classification: keep and combine. Preserve specialist tools, but open them within a consistent Refine shell or contextual panel rather than replacing the whole application route without a return path.

### Reports

Current report views:

- Producer
- Actor
- Director
- Project hydration/import audit
- Screenplay summary
- Character dialogue and speaking-time analysis
- Scene intention, cast, location, runtime and coverage
- Production breakdown and schedule readiness

Classification: keep and extend. Reorganize into the roadmap’s Project, Story, Characters, Scenes, Dialogue, Production, Feedback and Connections submenu while retaining the existing report builders.

### Settings

Current sections:

- GitHub setup
- AI setup
- Music setup

Classification: keep and extend. Preserve the existing provider and credential boundary, then add the planned General, Appearance, Project defaults, Storage and backups, Plugins, Google and Connected Services, Privacy and permissions, Accessibility, and About and licensing sections.

### Standalone specialist routes

Known routes opened from the current application include:

- `/structure`
- `/story-craft-essentials`
- `/resonance`
- `/voiceprint`
- `/pageflow`
- `/draftlens`
- `/craftloop`
- `/pitch-review`
- `/production`
- `/labs`
- `/characters-in-motion`
- `/working-together`
- `/read-learn`
- lesson-defined dialogue and specialist routes

Classification: modify. Keep route components as reusable workspaces, but provide a shared shell, explicit context parameters and a reliable return path.

## Proposed information architecture

### Zone 1 — Orientation

- PlotPickle logo
- Introduction
- Visible separator after Introduction

### Zone 2 — Creative workflow

1. Dashboard
2. Learn
3. Plan
4. Build
5. Write
6. Storyboard
7. Refine
8. Feedback
9. Reports

### Zone 3 — Project actions

- New Project
- Import
- Export
- Load Afterglow

These actions remain available in every primary workspace and are removed from Dashboard content.

### Zone 4 — Configuration

- Visible separator before Settings
- Settings remains the far-right configuration area

### Persistent submenu model

Every major workspace should use the same structural pattern:

- fixed workspace title and summary;
- persistent left submenu on desktop;
- accessible collapsible navigation on smaller screens;
- one selected state;
- no more than two nesting levels;
- unresolved-count badges where useful;
- the active item and inspector retained while related content opens;
- explicit return-to-context action when a full workspace transition is necessary.

## Component reuse matrix

| Existing source | Current capability | Classification | Reuse target | Required change |
|---|---|---|---|---|
| `lib/product-direction.ts` | Shared primary navigation and product vocabulary | Modify | Application shell | Add Introduction, Build and Feedback; define four header zones and action metadata |
| `app/page.tsx` | Shell, active project, autosave, workspace state and editor orchestration | Modify and decompose | All primary workspaces | Extract shell, project actions, navigation state and context state without replacing project orchestration |
| `StoryRail` and `storySections` | Persistent story-section navigation and progress | Combine and modify | Plan and contextual inspectors | Keep Plan sections; do not reuse the same taxonomy for Introduction or Storyboard |
| `ProjectOverview` and dashboard health calculations | Project progress, warnings and next actions | Extend | Dashboard and Project reports | Move calculations into shared selectors and remove project actions from Dashboard |
| `SimpleStart` | Optional beginner entry path | Keep and move | Plan and Introduction | Keep optional; link from Introduction and Plan without making it a required startup screen |
| `LearningStudio` | 81-module library, recommendations, progress and contextual learning | Keep and modify | Learn and contextual guidance drawer | Replace DOM button simulation and route replacement with typed navigation commands |
| `StructureMapSummary` | Readable 4/12/24/scene/96 overview | Keep | Plan, Build and Story reports | Add context-preserving open actions |
| Plan Blocks editor and Storyboard planner | 24-Block editing and visual direction | Extend | Build foundation | Reuse fields and callbacks inside visual card inspectors |
| `app/structure/page.tsx` and `lib/structure.ts` | Sequences, scenes, mini-blocks, movement, duplication, timing and Story Clock | Extend and extract | Build and production planning | Extract pure operations and reusable editors; stop owning a separate project session when embedded |
| `ScriptWorkspace`, `TreatmentEditor`, `ScriptViewer` | Treatment, screenplay, scene links, exports and readable full draft | Keep and extend | Write, Table Read and Shooting Script | Add contextual feedback and production-draft modes without creating another screenplay |
| `VisualStoryboard` | 24/96 visual boards, frame editor, visual identity, prompt and continuity diagnostics | Keep and extend | Storyboard and Build | Reuse board/navigation primitives and thumbnails; unify selected Block/mini state with shell |
| `CraftDiagnosticSummary` and specialist diagnostics | Evidence-based warnings | Combine | Build, Refine, Feedback and Reports | Normalize diagnostic records and targets so findings can become feedback proposals |
| `CoreModelStudio` | Story threads, arcs, rights, provenance and revision snapshots | Keep and expose | Plan, Feedback and Reports | Reuse revision history and stable targets; provide direct contextual entry |
| `ReviewWorkspace`, `ReviewThread`, `ReviewAnchor` | Anchored local review threads | Extend | Feedback | Add full target taxonomy, source, role, category, proposed change, expanded status and resolution |
| Pitch & Review Studio | Review resolution, logline and pitch package | Combine and extend | Feedback Human Review and Reports | Reuse anchored review and exports in the unified Feedback workspace |
| `ScreenplayReports` and `lib/screenplay-reports` | Producer, actor, director and dialogue intelligence | Keep and reorganize | Reports | Split shared calculations from current presentation and map them to the persistent report submenu |
| `ProductionWorkspace` and Production Studio | Shots, cues, breakdowns, schedule and distribution | Keep and extend | Production reports and Shooting Script | Build additional planning selectors and reports from canonical records |
| `SettingsPanel` | AI connection and local settings | Extend | Settings and Connections reports | Share connection-state selectors and add planned settings categories |
| `GitHubCollaboration` | Local backups, `.ppf`, pull review, proposals, history and disconnect | Keep and expose | Settings, Feedback Human Review and Connections reports | Separate setup from project proposal/review status; preserve credential isolation |
| `project-progress` | Section completion and alerts | Extend | Dashboard, Build and Reports | Add shared workflow-readiness selectors |
| `normalizePlotPickleProject` and project package tools | Safe project normalization/import/export | Keep and extend | Every phase | Add migrations for new schema fields and round-trip tests |
| `scene-management` | Stable scene indexing and screenplay-reference synchronization | Keep and extend | Build, Write, Feedback and Shooting Script | Invoke after structural moves and validate retained target IDs |
| Local AI endpoints and provider settings | Optional text/image generation and connection testing | Keep and extend | Write, Storyboard and AI Review | Add review provenance, privacy/cost notice and proposal-only application |
| Lighthouse route discovery | Automatic static-route inventory | Keep | Release hardening | Use as the generated route source for desktop/mobile audits |

## Duplicated or competing patterns

### Navigation

- The main application tabs, Story Rail, Write block rail, Storyboard navigator, Reports role tabs, Settings menu and standalone engine pages each implement different navigation behavior.
- Storyboard is wrapped by the Story Rail even though Storyboard already has its own production-specific navigation.
- Learn sometimes finds and clicks buttons by accessible label instead of calling a shared navigation API.

Resolution: introduce one typed workspace/context navigation contract and one reusable submenu shell. Preserve specialized submenu content while standardizing behavior.

### Project state and autosave

- The main application owns project state and debounced autosave.
- Standalone specialist routes independently load, normalize, mutate and save the same localStorage project.

Resolution: create a shared project session/provider for embedded workspaces. Standalone routes may retain a compatibility wrapper but should use the same store and synchronization logic.

### Selection state

Block, mini-block, scene and character selection are separately tracked in the main page, Learning, Write, Storyboard and Structure Engine.

Resolution: define a shared context object with stable IDs and workspace-specific optional fields. Numeric positions may be derived for display but should not be the only identity.

### Connection status

Dashboard health, Settings AI connection and GitHub Collaboration each derive connection state separately.

Resolution: expose provider-neutral connection selectors for Dashboard, Settings and Connections reports.

### Report logic and presentation

Current live report calculations are valuable, but the component name and location still reflect its former placement under Settings.

Resolution: move shared report builders to report-domain modules and keep display components reusable. Do not duplicate calculations for each new submenu.

## Hidden or hard-to-find capabilities

- The full structure editor, Story Clock, scene movement and mini-block tools are behind Refine → Structure Engine rather than a first-class Build workspace.
- Existing review threads and pitch-review tools are separated from the future Feedback destination.
- GitHub proposals and project comparison are available only through Settings.
- Revision snapshots, story threads, character arcs, rights and AI provenance are nested inside Plan → Core Model.
- Production shots, cues, breakdowns and schedules are behind a specialist route and only partially surfaced in Reports.
- Visual identity diagnostics and continuity queues are inside Storyboard rather than visible as shared feedback/report signals.
- Terminology is available inside Learn but is presented through a collapsible detail rather than a persistent Learn destination.
- Project actions are discoverable on Dashboard but unavailable as persistent actions while working elsewhere.

## Cross-workspace redirects and context loss

| Source | Current behavior | Risk | Target behavior |
|---|---|---|---|
| Refine engine cards | Open standalone routes | Loses main shell and selected context | Open inside Refine shell or pass stable context and return token |
| Learn collaboration lessons | Use `window.location.assign` for specialist routes | Replaces current workspace and scroll state | Typed navigation action with contextual drawer or explicit return path |
| Learn project/setup links | Query the DOM and click named buttons | Fragile coupling to labels and markup | Direct workspace/submenu command |
| Project Overview | Changes active top-level tab | Return location is not retained | Push current context before transition and restore on return |
| Plan/Storyboard open actions | Change tab and section | Block is retained, but scroll/inspector/filter state is not | Shared context state with per-workspace restoration |
| Storyboard query parameters | Replace URL state for section, Block and mini-block | Useful deep link but disconnected from other workspace state | Keep deep links and synchronize them with the shared context store |
| GitHub proposal creation | Opens external pull request | In-app proposal context can become secondary | Keep external PR action and retain an in-app proposal record and return state |

## Build reuse candidates

Build should be assembled from existing systems rather than written as an independent story editor.

- Canonical `StoryBlock`, `StorySequence`, `StoryScene` and `MiniBlock` records
- Existing 4-act, 12-sequence, 24-Block and 96-mini-block defaults
- Stable IDs and normalization rules in `lib/structure.ts`
- Block fields and editors currently used in Plan
- Structure Engine move, duplicate, rebalance, scene and mini-block operations
- Story Clock and structure diagnostics
- VisualStoryboard whole-film/act filtering and 24/96 board patterns
- Storyboard thumbnails and visual continuity status
- Treatment mini-block content and scene links
- Character, location, storyline and arc records
- Core Model setup/payoff, story-thread and arc evidence
- Existing progress and alert selectors

Build may require new presentation components and UI-state records, but it must not create a Build-only copy of Blocks, scenes or mini-blocks.

## Feedback reuse candidates

- Existing `ReviewWorkspace`, `ReviewThread`, `ReviewAnchor` and comments
- Pitch & Review Studio review resolution and export patterns
- Core Model revision snapshots and before/after comparison
- ScriptWorkspace’s AI suggestion pattern, which requires explicit user application
- Craft and structure diagnostics as feedback sources
- Visual identity and storyboard continuity diagnostics
- GitHub proposal creation, comparison, history and owner approval model
- Stable screenplay element, scene, Block, mini-block, character and frame IDs
- Rights and AI provenance records

The Feedback implementation should extend the review model rather than create disconnected AI-review, human-review, Writers’ Room, Table Read and Shooting Script note formats.

## Reports reuse candidates

- Project Overview and project-progress selectors
- Structure Map, Story Clock and structure diagnostics
- Screenplay report builders
- Character dialogue, word, scene and speaking-time reports
- Director scene report
- Producer breakdown and schedule report
- Story threads and character arc matrices
- Review-thread status and target distribution
- Production shots, cues, breakdowns, schedule and distribution records
- Visual identity and missing-frame diagnostics
- Settings provider state and GitHub collaboration status
- Revision, rights and provenance records

New Reports views should be presentation and selector work over canonical data, not stored report snapshots.

## Canonical IDs and synchronization map

| Record | Stable identity | Move/reorder rule |
|---|---|---|
| Project | `project.id` | Never replace during normal workspace navigation |
| Sequence | `sequence.id` | Preserve ID when title, act assignment or display order changes |
| Block | `block.id` | Preserve ID when moved between acts/sequences; update canonical order fields |
| Scene | `scene.id` | Preserve ID when moved between Blocks; update Block membership and global numbering |
| Mini-block | `mini.id` | Preserve ID when moved; recalculate display number without breaking feedback or screenplay links |
| Screenplay element | `element.id` | Preserve ID; synchronize Block, mini-block and scene references after structural edits |
| Character | `character.id` | Preserve across naming and role changes |
| Location | `location.id` | Preserve across naming and visual-reference changes |
| Visual frame | `frame.id` | Preserve and relink to the moved mini-block where necessary |
| Story thread | `thread.id` | Preserve; synchronize linked scene IDs after scene operations |
| Review/feedback record | existing/future record ID | Target stable IDs, never only display numbers or labels |
| Revision snapshot | `revision.id` | Preserve immutable historical snapshot metadata |
| Production record | record ID plus stable scene/frame references | Recalculate schedule/report order without changing source identity |

## Data-model and migration risks

### Schema versioning

The root project and revision snapshots currently identify schema `1.7.0`. Build status, expanded Feedback, Writers’ Room, Google metadata, Table Read and Shooting Script fields will require a documented schema increment and migration path.

### Review model coverage

Current anchors and statuses do not cover all planned targets or workflow states. Extend the existing model with backward-compatible defaults. Do not discard or reinterpret existing review threads silently.

### Mini-block movement

Normalization currently preserves mini-block IDs while assigning canonical display numbers. Cross-Block movement must define whether a mini-block retains its ID and receives a new displayed number. Feedback, screenplay and frame links must follow the ID rather than the former number.

### Denormalized screenplay references

Screenplay elements store Block, mini-block and scene references for fast access. Structural movement must run the existing synchronization layer and add migration tests for stale references.

### Visual-frame association

Frames currently contain a mini-block number and a stable frame ID. Build movement may require an explicit mini-block ID reference in a future schema so frames cannot drift when display numbers change.

### UI state versus project data

Selected workspace, submenu, zoom, pan, filters, scroll and open inspector are application-session concerns. Store them outside `.ppf` unless a field is deliberately defined as portable project-view metadata. Unsaved creative edits remain canonical project data and must be protected.

### Credentials and tokens

AI and GitHub credentials are already managed outside the project. Google credentials must follow the same rule. Only non-sensitive provider, account, permission and meeting metadata may enter the project where required.

### Independent route state

Standalone routes can overwrite a newer main-workspace project if two independent sessions are open. A shared project-session abstraction and conflict/revision check should precede deeper embedding.

### Revision snapshots

Revision snapshots include a schema version and payload. Migrations must preserve the ability to inspect or restore older snapshots without treating them as current-schema objects prematurely.

### Local settings migration

The current `plotpickle.settings.v1` structure only covers AI and music preferences. Settings expansion needs a normalizer and versioned defaults rather than direct assumptions about stored keys.

## Implementation guardrails for later issues

### #112 — Navigation and context continuity

- Extract the shell and navigation contract from `app/page.tsx`.
- Introduce typed workspace, submenu and selected-target state.
- Remove DOM-click navigation.
- Preserve standalone routes as compatibility entries while embedding reusable content.

### #113 — Dashboard

- Reuse current health cards, Project Overview, project-progress and connection sources.
- Move project actions to the header.
- Do not add editing forms to Dashboard.

### #114 and #115 — Build

- Reuse Plan Block editors, Structure Engine operations and Storyboard board primitives.
- Preserve all stable IDs during movement.
- Add undo around canonical project mutations rather than around a copied Build state.

### #116 and #117 — Feedback

- Extend existing review records.
- Convert diagnostics and AI results into reviewable findings or proposals.
- Require explicit approval before applying canonical changes.

### #118 and #119 — Reports and Production intelligence

- Reuse shared report builders and production records.
- Keep calculations derived and current.
- Add report navigation without cloning source data.

### #120 and #121 — Connections and Writers’ Room

- Extend Settings connection patterns.
- Reuse GitHub proposal and revision history.
- Store Google tokens outside `.ppf` and meeting decisions as proposals.

### #122 — Table Read

- Reuse screenplay elements, scene navigation, character data and dialogue reports.
- Attach rehearsal notes to stable screenplay-element or scene IDs.

### #123 — Shooting Script

- Extend the existing screenplay document and draft elements.
- Reuse locked, omitted and revision-colour fields.
- Introduce explicit production-draft conversion and locked-pagination metadata.

### #124 — Hardening

- Add schema migration and round-trip fixtures.
- Run generated-route Lighthouse audits.
- Validate keyboard alternatives, context restoration, recovery and 96-card performance.

## Replacement decisions

No major existing workspace is approved for wholesale replacement by this audit.

New first-class workspace shells are justified for Build and Feedback because no current top-level destination provides their complete responsibilities. Their internal capabilities must still be assembled from the reusable components and canonical records listed above.

## Acceptance checklist

- [x] Current information architecture mapped
- [x] Proposed information architecture mapped
- [x] Existing screens and components classified
- [x] Component reuse matrix completed
- [x] Duplicated patterns identified
- [x] Hidden and hard-to-find capabilities identified
- [x] Cross-workspace redirects and context-loss risks listed
- [x] Build reuse candidates identified
- [x] Feedback reuse candidates identified
- [x] Reports reuse candidates identified
- [x] Canonical IDs mapped before Build or Feedback work
- [x] Data-model and migration risks documented
- [x] Later phases linked to explicit reuse requirements

## Decision

Issue #111 establishes a reuse-first baseline. Implementation may proceed to #112 without replacing working screens or introducing parallel story, screenplay, visual, review, production or report models.
