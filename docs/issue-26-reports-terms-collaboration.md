# Issue #26 — Reports, terminology, complete import hydration and collaboration proposals

## Completed behaviour

### Screenplay loading

TXT, Fountain, SPMD and Final Draft FDX imports now create one complete schema 1.7 project. The local parser populates reviewable values for project metadata, story, world, locations, character profiles, full voiceprints, arc matrices, planner forms, 12 sequences, 24 Blocks, flexible scenes, 96 mini-blocks, normalized screenplay elements, Story Threads, rights/source records, review threads, pitch package, production breakdowns, initial shoot schedule, distribution planning, collaboration path and a baseline revision snapshot.

Values inferred from a screenplay remain visibly marked as suggestions. Ownership, genre, tone, theme, Ghost, Catalyst, rights, production and audience decisions are never represented as verified facts merely because a parser generated a useful starting value. Image fields remain empty unless a real asset is supplied.

### Reports

Settings → Reports recalculates directly from the active canonical project on every project change. It displays screenplay pages, scenes, speaking roles, dialogue entries and source lines, spoken words, action paragraphs, speaking time, runtime and per-character speaking-scene coverage. A schema-aware population audit includes every current section, including the recently added arc, voiceprint, mini-block, Story Thread, rights, review, production and collaboration areas.

No report totals are stored as duplicate project data, so loading, replacing, normalizing or editing a screenplay cannot leave stale counts behind.

### Terminology

Settings → Terminology Index is grouped into Writing, Formatting, Structure, Character, Production, Revision, PlotPickle and Collaboration. It supports search, category filters, concise and expanded reading modes, examples, related terms and links to the relevant workspace.

### Many-server collaboration

One GitHub repository and canonical `.ppf` path can be connected to many independently running local PlotPickle servers.

1. Each server receives a durable local identity stored outside the project.
2. A server pulls only the owner-approved canonical branch.
3. Work remains local until the collaborator chooses **Submit changes for owner approval**.
4. PlotPickle saves a local backup, creates a unique `plotpickle/...` branch, commits the `.ppf`, and opens a pull request.
5. The repository owner or maintainer reviews, discusses, merges, or closes the pull request in GitHub.
6. If the canonical `.ppf` changed since the server's last pull, submission is rejected until the approved version is pulled and reviewed again.

The proposal workflow never writes directly to the canonical branch. GitHub permissions, branch protection and pull-request review remain authoritative. Tokens stay in the private localhost server and are never written into `.ppf` files.

## Repository decision model

A submitted proposal is durable evidence of one local server's work at a known canonical base. The repository owner can inspect the `.ppf` change and discussion in GitHub, merge accepted work, or close the pull request without changing the canonical story.

## Compatibility guarantees

The expanded importer preserves existing development subobjects while populating Ghost, Catalyst, Foundations and Pickle suggestions. Reports continue to point writers to named revision snapshots in the Core Model, so the new live report interface does not remove established revision workflows.
