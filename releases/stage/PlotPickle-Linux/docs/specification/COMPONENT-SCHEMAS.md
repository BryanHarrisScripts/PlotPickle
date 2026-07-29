# Component Schemas and Ownership

Phase 1 defines boundaries; executable JSON Schemas follow in the implementation phases.

| Component | Canonical owner | Typical granularity |
|---|---|---|
| Project manifest | Project core | one project |
| Story foundation | Story module | premise/theme/pitch file |
| Character | Character module | one file per character |
| Scene | Screenplay module | one file per scene |
| Dialogue element | Screenplay module | embedded in scene with stable ID |
| Location/world rule | World module | one file per entity/rule |
| Block/Mini-Block | Structure module | one file per block |
| Storyboard frame | Storyboard module | one file per frame |
| Production shot | Production module | one file per shot |
| Canon entry | Canon Binder | one file per decision/source |
| Report | Report engine | reproducible output, not primary truth |

## Common envelope

Addressable JSON components should include:

```json
{
  "id": "uuid",
  "type": "plotpickle.character",
  "schemaVersion": "2.0.0",
  "status": "approved",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "provenance": [],
  "extensions": {}
}
```

## Cross-references

References use stable IDs and may include a relative-path hint. Broken references produce validation findings; they do not cause unrelated content to be deleted.

## Provenance

Provenance entries can identify manual creation, import, migration, approved AI suggestion or Git proposal. PDF imports may record source hash, page, text range, extraction method and confidence.

## Canon rule

Modules may propose facts, but the Canon Binder owns approval of shared facts such as identity, world rules, chronology, rights and continuity. Reports read Canon and source modules; reports do not overwrite them.
