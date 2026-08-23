# Developer Guidelines for Project Format 2.x

## Naming and structure

Use lowercase kebab-case repository paths, stable UUIDs for entities and project-relative references. Keep components small enough to produce meaningful Git diffs.

## JSON conventions

UTF-8, two-space indentation, ISO-8601 UTC timestamps and deterministic key ordering for generated files. Do not encode binary media in JSON. Put optional vendor data under a namespaced `extensions` object.

## Schema evolution

Additive optional changes use minor schema versions. Required or meaning-changing changes require a major version and migration. Never repurpose an existing field with a new meaning.

## Module boundaries

Write creative truth only through its owning module. Derived reports and indexes are replaceable. Shared approved facts belong in Canon. Plugins may add namespaced modules but may not silently mutate another module.

## Git behavior

Avoid generated churn, unstable ordering and timestamps that change on every open. A commit should show the smallest meaningful creative change. Merge components by stable ID; filenames are hints, not identity.

## Secrets and privacy

API keys, OAuth tokens, local model credentials, caches and machine paths remain outside projects and packages. Redact private source material from diagnostics by default.

## Import and AI behavior

Imports and AI output create provenance-bearing suggestions. No inferred fact becomes approved Canon without user action. Preserve original text and location references when licensing and user choices permit.

## Validation

Every writer must validate manifest compatibility, path safety, schema shape, reference integrity and checksums before replacing an existing project. Unknown optional content is preserved.

## Contributions

Architectural changes require an ADR. Format changes update the relevant specification, migration notes and fixtures in the same pull request.
