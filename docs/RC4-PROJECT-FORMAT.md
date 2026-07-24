# RC4 — PlotPickle Project Format Freeze

RC4 establishes project format major version `1` as the first long-term-supported PlotPickle project format.

## Canonical portable layout

```text
Project.ppf/
  manifest.json
  project.json
  story/
    treatment.json
    screenplay.fountain
    storyboard.json
  canon/
    characters.json
    locations.json
    timeline.json
    world.json
    glossary.json
  assets/
    images/
    audio/
    references/
  extensions/
  history/
    revisions/
  ai/
    prompts/
    conversations/
  reports/
```

Only `manifest.json` and `project.json` are required. Optional directories and files may be omitted when empty. Paths use forward slashes and UTF-8 names. Portable files must never depend on absolute machine paths.

## Frozen manifest contract

`manifest.json` contains:

- `formatVersion`: semantic format version, frozen at `1.0.0` for RC4;
- `projectId`: UUID;
- `title` and `author`;
- ISO-8601 `createdAt` and `modifiedAt` timestamps;
- `minimumPlotPickleVersion`;
- `sdkApiVersion`;
- `schemas`: version map for project, canon, timeline, character, world, screenplay and storyboard data;
- `extensions`: optional extension descriptors.

Unknown manifest properties and unknown optional extensions must be preserved during open/save/export/import. Unsupported extensions may be isolated from execution, but their data must not be silently discarded.

## Versioning and governance

Backward-compatible additions use a minor format version. Clarifications and compatible fixes use a patch version. Removing or changing frozen fields, paths, meanings, identifiers or extension preservation guarantees requires a new major format version and a documented migration.

All schema-bearing JSON documents include `schemaVersion`. Post-RC4 migrations are ordered, idempotent and covered by fixtures. Published project versions are never overwritten.

## Portability and security

Portable project files must not contain provider credentials, cookies, OAuth tokens, passwords, private keys or machine-specific absolute paths. Local provider settings remain outside the project package. Asset references are project-relative paths or content identifiers.

## Round-trip guarantee

For supported RC4 projects, open → save → export → import must retain semantic project content. Formatting-only changes such as JSON whitespace or object-key order are not semantic changes.

## Compatibility statement

PlotPickle will continue opening format-major `1` projects for the supported lifetime of RC4. Future features should normally use versioned optional extensions and public SDK/plugin interfaces rather than modifying the frozen core format.