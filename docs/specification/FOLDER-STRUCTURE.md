# Canonical Folder Structure

```text
ProjectName/
├── manifest.json
├── screenplay/
├── story/
├── characters/
├── world/
├── blocks/
├── storyboard/
├── production/
├── canon/
├── reports/
├── assets/
├── imports/
├── exports/
└── plugins/
```

Only `manifest.json` and one registered module are required. Empty folders need not exist.

## Responsibilities

- `screenplay/`: Fountain source, scene records, dialogue and transitions.
- `story/`: premise, theme, dialectic, outline, beats and pitch.
- `characters/`: one stable file per character plus relationships, appearances and voiceprints.
- `world/`: locations, rules, timeline and setting references.
- `blocks/`: 24 Blocks and 96 Mini-Blocks with stable IDs and cross-references.
- `storyboard/`: frames, boards, prompts and visual continuity metadata.
- `production/`: breakdowns, shots, schedules, cast/crew-facing plans and budgets.
- `canon/`: approved facts, rights, research, continuity and decisions.
- `reports/`: reproducible report snapshots or exports; canonical source data stays elsewhere.
- `assets/`: images, audio and other project-owned media.
- `imports/`: optionally retained original sources and page/line maps.
- `exports/`: user-created deliverables; normally excluded from Git unless intentionally tracked.
- `plugins/`: project-portable plugin configuration, excluding secrets and installed binaries.

## File rules

Use lowercase kebab-case paths and stable UUIDs inside files. References are project-relative. Components should be small enough for useful Git diffs: normally one character, scene, block, frame or production unit per file.

## Recommended screenplay layout

```text
screenplay/
├── module.json
├── main.fountain
├── scenes/
│   ├── scene-0001.json
│   └── scene-0002.json
└── dialogue/
    └── index.json
```

Fountain is the human-readable screenplay interchange view. Scene JSON retains stable identities, provenance, block links and review state.
