# Migration Strategy

## Source generation

PlotPickle schema 1.7 projects are monolithic JSON documents. They remain valid import sources and must not be modified in place during migration.

## Migration sequence

1. Validate and normalize the source project using the existing schema 1.7 pipeline.
2. Create a new project directory and 2.0 manifest.
3. Split data into owned modules while retaining stable legacy identifiers where possible.
4. Write screenplay Fountain plus stable scene records.
5. Move approved shared facts into Canon Binder records and preserve review status.
6. copy assets with content hashes and update references.
7. record the migration event, original schema, source hash and migrator version.
8. validate references, counts and representative screenplay output.
9. keep the original source as a user-controlled backup.

## No-loss requirements

Migration testing compares characters, scenes, screenplay elements, blocks, mini-blocks, assets, notes, rights, pitch, production and collaboration metadata. Unknown fields are stored in an extension envelope until assigned to a formal 2.x schema.

## Rollback

Migration writes to a new destination. Failure deletes only the incomplete destination. The original project remains readable by the previous PlotPickle version.

## Package migration

Existing monolithic `.ppf` files are detected by their internal manifest/schema. Importers normalize them before producing a folder project or 2.0 portable package.

## Release gate

Folder projects do not become the default save format until round-trip fixtures demonstrate no material data loss and clean-machine tests pass on Windows, macOS and Linux.
