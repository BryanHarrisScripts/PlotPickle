# Versioning and Compatibility

PlotPickle uses semantic versioning independently for the application, project format and component schemas.

## Compatibility rules

- Patch versions clarify or fix compatible behavior.
- Minor versions add optional fields, modules or enum values. Readers preserve unknown data.
- Major versions may change required structure or meaning and require an explicit migration.

`formatVersion` identifies the project container contract. Each registered module has its own `schemaVersion`. `minimumReaderVersion` prevents unsafe opening by an older application.

## Reader behavior

A reader may open a project when it supports the manifest major version and every required module. Unsupported optional modules are preserved but disabled. A reader must not silently downgrade or discard unknown fields.

## Writer behavior

Saving without migration retains the opened format version. Migration creates a backup or new destination and records a migration event. A project is never upgraded solely because a newer PlotPickle version opened it.

## Deprecation

Fields remain readable for at least one major format generation after deprecation where practicable. Deprecation notices identify the replacement and earliest removal version.

## Current transition

Schema 1.7 monolithic projects remain supported as import sources. Folder-based 2.0 projects become the canonical target only after the implementation phases provide tested migration and round-trip guarantees.
