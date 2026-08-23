# PlotPickle Portable Format (`.ppf`)

A `.ppf` file is a ZIP-compatible archive used for transfer, backup, templates and selective collaboration. It is not the preferred live working format.

## Required package contents

```text
manifest.json
META-INF/package.json
META-INF/checksums.sha256
```

`META-INF/package.json` declares the package profile, creation time, producer, root project ID and included/excluded modules.

## Profiles

- `complete-project`
- `screenplay`
- `dialogue`
- `characters`
- `storyboard`
- `production`
- `pitch`
- `structural-analysis`
- `reference-only`

A partial package must include dependencies needed to interpret its content and must identify omitted dependencies. Importers merge by stable component ID, never by filename alone.

## Merge behavior

Import offers `new-project`, `add-components`, `update-matching-components` and `preview-only`. Existing approved Canon is never overwritten without explicit review. Conflicts are presented component by component.

## Compression and paths

Use standard ZIP deflate. Paths are UTF-8, relative, case-sensitive in the specification and use `/`. Importers reject traversal, absolute paths, invalid checksums and undeclared executable content.

## MIME type

Recommended: `application/vnd.plotpickle.ppf+zip`.

## Original references

A package may retain source PDFs under `imports/` only when the user elects to include them and has the right to do so. Package rights metadata must distinguish access, private study and redistribution permissions.

## Determinism

For reproducible packages, writers should sort entries lexically, normalize JSON formatting and record timestamps in UTC. Checksums cover every archived file except the checksum index itself.
