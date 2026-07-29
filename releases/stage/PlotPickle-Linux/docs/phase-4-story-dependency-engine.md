# Phase 4 — Story Dependency Engine

Phase 4 advances the live folder format to `2.2.0` and generates a deterministic story knowledge graph every time a project is saved.

## Graph coverage

The engine creates stable nodes for projects, story records, characters, locations, relationships, story threads, sequences, 24 Blocks, scenes, mini-blocks, screenplay elements, storyboard frames, production shots and sonic cues.

Edges describe explicit or derived relationships such as:

- contains;
- appears-in;
- used-in;
- developed-in;
- participates-in;
- speaks;
- written-as;
- visualized-by;
- covered-by;
- realized-as;
- scored-by.

## Generated files

```text
dependencies/
    graph.json
    references.json
    reverse-index.json
    conflicts.json
    health.json

reports/
    story-health.json
```

These files are derived from canonical project modules. They can be regenerated and are not a second source of creative truth.

## Impact analysis

`impactForNode()` returns incoming and outgoing direct dependencies for a stable node ID. This is the foundation for future rename previews, AI change previews, semantic Git review and module-aware editing.

Phase 4 does not silently update affected story material. It identifies impact so the writer can approve later changes.

## Conflict detection

The first deterministic checks identify:

- blocks referencing missing characters;
- blocks referencing missing locations;
- active story threads without a resolution block;
- empty catalyst and ghost foundations;
- empty blocks;
- unused characters;
- orphaned storyboard frames.

Critical and warning findings are written into the dependency conflict report and mirrored into the generated Canon continuity view.

## Story health

The health report contains individual pass, warning and critical checks plus a deterministic score. It is intended as a diagnostic summary, not a judgment of artistic quality.

## Compatibility

PlotPickle continues to read folder formats `2.0.0` and `2.1.0`. Their next save writes the `2.2.0` dependency artifacts. Portable `.ppf` backups and the browser-facing schema 1.7 project remain compatible.

## Deferred work

The visual dependency explorer, writer-approved refactors, AI impact confirmation, expanded timeline/prop continuity and semantic Git merges remain later phases. Phase 4 supplies their stable graph and reverse-index foundation.
