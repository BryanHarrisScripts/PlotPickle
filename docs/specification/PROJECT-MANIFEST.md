# Project Manifest

Every project root contains `manifest.json`. The manifest locates modules; it does not duplicate their creative content.

## Required shape

```json
{
  "$schema": "https://plotpickle.org/schemas/2.0/manifest.schema.json",
  "format": "plotpickle-project",
  "formatVersion": "2.0.0",
  "projectId": "uuid",
  "title": "Afterglow: Reflections of Sentience",
  "createdAt": "2026-07-23T13:00:00Z",
  "updatedAt": "2026-07-23T13:00:00Z",
  "createdWith": "PlotPickle 2.0",
  "minimumReaderVersion": "2.0.0",
  "modules": {},
  "canon": { "root": "canon/", "policy": "approved-only" },
  "rights": { "path": "canon/rights.json" },
  "imports": [],
  "extensions": {}
}
```

## Module registry

Each module entry contains `id`, `type`, `path`, `schemaVersion`, `required`, and optional `dependencies`.

```json
"modules": {
  "screenplay": {
    "id": "uuid",
    "type": "plotpickle.screenplay",
    "path": "screenplay/module.json",
    "schemaVersion": "2.0.0",
    "required": true
  }
}
```

Unknown module types must be preserved. Readers may disable unavailable features but must not delete unknown content.

## Optional capabilities

The manifest may declare:

- `git`: repository presence and preferred branch names, never credentials;
- `plugins`: plugin IDs, versions and project-relative configuration, never secrets;
- `ai`: provenance policy and approved-provider capability requirements, never keys;
- `packageProfile`: complete, screenplay, dialogue, characters, storyboard, production, pitch, structural-analysis or reference-only;
- `checksums`: relative path to a checksum index.

## Import history

Each import records a stable ID, type, source filename, content hash, timestamp, importer version, review status and optional retained source path. PDF-derived records may include page mappings and extraction confidence.

## Rights

Rights metadata records ownership assertions, source licence, permitted project use and redistribution restrictions. It is informational and does not replace legal advice or grant rights.
