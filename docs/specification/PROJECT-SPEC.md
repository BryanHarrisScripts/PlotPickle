# PlotPickle Project Specification 2.0

Status: Phase 1 architecture contract. This document defines the canonical working model for PlotPickle 2.x.

## Core principles

1. A PlotPickle project is a directory, not one indivisible document.
2. Standard, human-readable files are preferred: JSON, Fountain, Markdown, WebP, SVG, WAV and PDF.
3. `manifest.json` is the project table of contents and compatibility contract.
4. Git is optional, local-first version history; GitHub is optional collaboration infrastructure.
5. `.ppf` is PlotPickle Portable Format: a ZIP-compatible exchange package containing a complete project or selected components.
6. The Canon Binder is the approved source of truth. Imports and AI suggestions remain unapproved until reviewed.
7. Every derived element should retain provenance to its source.
8. Secrets, API keys, local caches and temporary AI output are never project content.

## Canonical project

The canonical working form is the folder layout defined in `FOLDER-STRUCTURE.md`. Applications may cache indexes, but caches must be reproducible and excluded from portable packages unless a profile explicitly permits them.

## Required files

- `manifest.json`
- at least one registered content module

A project may be minimal. For example, a dialogue package may omit storyboard and production modules.

## Identity

Each project and addressable component uses a stable UUID. Renaming a file must not change the component identity. References use UUIDs plus relative paths where useful.

## Approval states

Content supports `imported`, `suggested`, `approved`, `rejected` and `superseded` states. Only approved content is Canon unless the manifest explicitly names another policy.

## Portability

A compliant project must not require PlotPickle to inspect its core creative content. Unknown modules must be preserved during round trips.

## Security

Paths are relative and must not escape the project root. Packages must reject absolute paths, `..` traversal, executable payloads not explicitly declared, and manifest entries whose checksums fail.

## Related specifications

- `PROJECT-MANIFEST.md`
- `FOLDER-STRUCTURE.md`
- `PPF-FORMAT.md`
- `COMPONENT-SCHEMAS.md`
- `IMPORT-EXPORT.md`
- `VERSIONING.md`
- `MIGRATION.md`
- `DEVELOPER-GUIDELINES.md`
