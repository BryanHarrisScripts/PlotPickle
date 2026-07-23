# Phase 7 — Canon Binder

The Canon Binder is PlotPickle's authoritative story knowledge layer. Screenplay, storyboard, reports, production tools, imports, exports and AI context builders reference the binder instead of maintaining competing copies of story facts.

## Sections

The binder provides first-class sections for story, characters, world, timeline, locations, research, references, continuity, legal, voiceprints, visual style, AI decisions, meeting notes, producer notes, director notes and actor notes.

## Approval policy

Canon uses an approved-only policy. Entries move through draft, suggested, imported, AI-generated, reviewed, approved, locked and archived states. Imported or AI-derived material is never silently promoted to approved canon. Locked legal and rights records remain authoritative until explicitly revised.

## Provenance and relationships

Every entry stores source type, timestamps, optional page and confidence information, tags and links. The relationship graph connects characters and locations to scenes and connects characters to their voiceprints. Future modules can add relationships without changing the project storage model.

## Query and AI context

`queryCanon` filters by section, status, tags and text. `canonContextPacket` returns approved and locked entries plus their relevant relationships, allowing AI assistants and reports to receive compact, consistent context rather than the entire project.

## Project folder format

Phase 7 advances the folder format to 2.3.0 while retaining read compatibility with 2.0.0, 2.1.0 and 2.2.0. The canonical binder is stored at `canon/binder.json`, with graph, health, conflict and section indexes alongside it.
