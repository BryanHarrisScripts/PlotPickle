# PlotPickle LEARN: local curriculum completion process

## Purpose

LEARN is part of PlotPickle, not a directory of links to other repositories. A writer must be able to install PlotPickle on one computer and read, search, navigate, practise and complete the curriculum without GitHub, Git, an internet connection or an external account.

The earlier repositories remain valuable upstream teaching libraries. Their relevant material is imported into PlotPickle during development, preserved exactly as a local source archive, and then curated into the lesson where a first-time student can understand it best. Moving a concept to a better lesson is encouraged; losing it is not.

This process was established with the eleven Foundations lessons and is the required path for every later LEARN subsection.

## The learner and provenance layers

The two layers have different jobs.

### Learner layer

- Current, beginner-readable PlotPickle lessons.
- Substantial explanations, definitions, worked examples, misconceptions, practice and a saved output.
- Local previous/next navigation within the active topic.
- A reliable start at the top whenever a lesson opens.
- A visible top-of-lesson chevron for long lessons.
- Local links to other bundled lessons when a source concept was moved.
- Sage answers generated from the writer's live question and retrieved local curriculum.

### Provenance layer

- Exact imported source text.
- Original project name, path, URL, content hash and rights notes where applicable.
- A coverage record showing where each useful concept is now taught.
- An explicit `historicalOnly` classification for navigation residue, obsolete rules, prompts, contradictory advice and claims that are preserved but no longer taught.

Provenance metadata is audit information. It is never a required outbound navigation path, never a general learner search signal and never a reason to make the writer leave PlotPickle.

## Topic lifecycle

The canonical status is recorded in `learn/completion-manifest.json`.

1. `source-discovered` — inventory every relevant upstream document, asset and internal link.
2. `source-imported` — store complete text and required media locally; record provenance and hashes.
3. `concepts-mapped` — assign every useful concept to a teaching destination and classify historical-only material.
4. `lessons-curated` — write the student-facing sequence and verify beginner flow.
5. `rag-indexed` — give every curriculum and source block a stable local retrieval ID.
6. `offline-verified` — traverse the topic without outbound network access.
7. `complete` — all gates below pass in automation and in the live application.

Only Foundations is currently marked complete. The other eleven topics contain imported local source material but must progress through the same curation, coverage, RAG and live-verification gates before their status changes.

## Step 1: inventory the upstream library

For the topic being completed:

1. Read the existing `learn/<topic>.json` source records.
2. Extract Markdown links, HTML links, bare URLs and referenced assets from every source body.
3. Follow linked teaching documents during development and import the relevant contents into PlotPickle.
4. Record documents that are navigation-only, duplicates, generated prompts, current external rules or unrelated project material.
5. Confirm that PlotPickle has the right to retain and distribute the imported material.

An upstream URL may be retained in provenance, but it cannot be the only copy of learner-required content.

## Step 2: capture immutable local sources

Each imported source record must have a stable ID, title, kind, scope note, original location and complete non-empty `content`. Do not summarize the only copy. If the document contains tables, ordered steps, quotations, code or links, preserve that exact text in the archive.

Required images, diagrams, worksheets or templates must also be copied into a local PlotPickle asset directory. Remote image URLs are not runtime assets.

Never edit the exact archive merely to make it agree with current teaching. Corrections belong in the curated lesson and coverage map.

## Step 3: map concepts before writing lessons

Create a topic coverage module modelled on `adapters/curriculum/foundation-content-coverage.ts`.

For every source, record:

- the lesson that owns the readable archive;
- every current lesson that teaches its useful concepts;
- concepts intentionally moved to another lesson;
- historical-only text and why it is not current guidance;
- any concept still waiting for a teaching destination.

A topic cannot be complete while useful content is unmapped. Exact preservation and pedagogical placement are both required.

## Step 4: curate the beginner sequence

Each lesson should answer one distinct learner question and explain why it follows the previous lesson. A normal lesson contains:

- a plain-language overview;
- clear outcomes;
- three or more substantial teaching sections when the subject requires them;
- definitions for new terms;
- a worked example or an example carried through several steps;
- a misconception and correction;
- a practical exercise;
- a named PlotPickle output or next lesson handoff.

Use continuous chapter typography. Lists are ordinary lists, not collections of decorative pills. Reserve restrained visual callouts for objectives, examples, checklists, mistakes and practice.

The course-level flow must be checked by someone reading as a first-time student, not merely by sorting lesson numbers.

## Step 5: integrate imported teaching into the lesson

Imported material is curriculum, not a source card. Parse its headings, paragraphs, ordered and unordered lists, quotations, tables and code into the same continuous typography as the authored lesson. It must be visible in the normal lesson flow; never hide expected teaching behind READ+, an archive disclosure or a raw-text viewer.

Keep each exact imported document once in the local topic JSON for integrity, provenance and retrieval tests. The raw document is a data-layer record, not a second student-facing reading mode. If useful material belongs in another lesson, record the audited destination and teach it there. Preserve obsolete or contradictory wording in the immutable record, but pair it with current PlotPickle guidance and do not rank it above the current curriculum.

If an imported historical link points to bundled material, render a local PlotPickle lesson control. Otherwise show its title as non-clickable historical text. No rendered lesson may contain an `http:` or `https:` navigation target. Current facts such as law, rates or eligibility may tell an online writer to verify an official authority, but the durable lesson must remain complete offline and the external check cannot block course completion.

## Step 6: index the whole topic for Sage

`modules/creative-room/curriculum-retrieval.ts` builds stable local chunks for:

- overview;
- each objective;
- each teaching paragraph or point;
- each definition;
- example;
- each checklist item and mistake;
- exercise and saved output;
- every passage of every bundled imported curriculum document.

Every chunk carries a visible curriculum status and authority. Current authored teaching is governing; imported material adapted into the lesson is supporting; superseded wording is historical and must travel with its current correction; legacy tables of contents and repository navigation are non-teaching artifacts. Retrieval ranks those authorities in that order and includes the imported material's local type and scope, never its remote URL or path.

Retrieval runs across the full bundled curriculum for every live student question. It may select several lessons when the question crosses lesson boundaries. Historical URLs are removed from the readable retrieval form.

Sage then sends the retrieved local blocks, recent conversation, bounded local project context and the student's actual question to the `curriculum-guide` Mastra agent using the configured local Ollama model. The response shown to the writer must be the model result. There is no question-to-answer table, canned teaching bank or fixed fallback lesson response. Welcome and error copy are UI state, not answers.

LEARN remains fully readable if Mastra or Ollama is unavailable. Sage is assistance, not a course prerequisite.

## Step 7: run the completion validator

Run:

```powershell
npm run validate:learn
```

The validator checks:

- all twelve declared local topic files;
- all 81 archived lessons and 95 unique complete source records;
- static catalog imports rather than remote curriculum fetching;
- topic completion status and required implementation artifacts;
- local closure of teaching-document links for completed topics;
- absence of student-facing repository/source anchors;
- local Mastra/Ollama generation and the no-canned-answer boundary;
- lesson-top reset and control requirements.

Pending topics may report unresolved upstream links as information. A topic marked `complete` fails validation if any required teaching-document target is missing locally.

## Step 8: automated and live verification

Before changing a topic to `complete`, all of these must pass:

### Content and coverage

- Declared counts and hashes agree with stored content.
- Every lesson has substantive teaching and all required learning fields.
- Every useful source concept has a destination.
- Historical-only material is explicit.
- Search finds terms that exist only in lesson bodies and local sources.

### Reading and navigation

- Previous/next stays inside the topic and traverses the intended order.
- Every newly opened lesson starts at the true top.
- The top chevron scrolls to the lesson heading and restores keyboard focus.
- Every imported curriculum document appears in the lesson's normal headings, numbered steps, lists, quotes and tables.
- No student-facing control leaves PlotPickle for source material.

### RAG and agent behavior

- Every local curriculum field and source passage has a stable chunk ID.
- Every chunk fits the retrieval boundary.
- Representative questions retrieve the intended lesson/source blocks.
- Misconception probes confirm current teaching outranks older wording, including optional three-act structure, theme as a tested question rather than merely a message, and pace as meaningful change rather than an action-fast/drama-slow rule.
- Cross-lesson questions can retrieve more than two lessons when useful.
- The complete closing `</student_question>` tag reaches the gateway.
- The request contains no remote source address.
- A real local Ollama smoke produces coherent, lesson-grounded answers through Mastra.
- Unsupported questions cause the agent to state that the current curriculum does not contain the answer.
- No submitted question is answered from stored response copy.

### Offline browser run

- Start the packaged/local application with outbound network unavailable.
- Visit every lesson in the topic.
- Read every integrated imported curriculum section.
- Follow every local cross-reference.
- Search and mark lessons complete.
- Confirm all lesson and brand assets are served by PlotPickle.
- Confirm zero non-loopback requests and zero browser console errors.
- Repeat the reading traversal with Ollama stopped; only Sage should be unavailable.

## Step 9: create the matching PLAN application path

Every completed LEARN topic must have a PLAN path derived from the same lesson sequence and application outputs. Do not maintain a second hard-coded curriculum. PLAN begins by showing only the completed topic being applied; Foundations therefore opens as the same eleven ordered lessons.

For each lesson, PLAN provides:

- plain editable fields derived from the lesson's “Apply this to your story” outputs;
- automatic local saving into the one canonical PlotPickle project;
- a direct return to the matching LEARN lesson;
- an optional Mastra + local Ollama draft action;
- a visibly separate proposal that changes no writer field until explicit acceptance;
- continued editing after acceptance, because the writer owns the final wording;
- a manual/no-AI path that remains completely functional;
- an assembled, editable Foundations Brief saved only when the writer chooses.

The saved brief and accepted fields become the planning evidence carried into later PlotPickle stages. An unaccepted AI proposal is never canon and never silently replaces the writer's intention. Apply this same LEARN-to-PLAN contract as later curriculum topics become complete.

## Foundations reference implementation

Foundations demonstrates the complete process:

- eleven curated beginner lessons;
- seven exact bundled sources;
- an explicit concept-placement map;
- topic-local navigation;
- continuous reading typography;
- local source cross-links and no repository buttons;
- stable block-level Sage retrieval through local Mastra/Ollama;
- a top reset and top-of-lesson chevron;
- automated depth, placement, source preservation, offline and RAG checks.

Use its architecture, not its exact lesson counts or prose targets, as the template for each remaining subsection.
