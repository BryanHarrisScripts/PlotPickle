# Issue #528 — Learn-first Creative Writer wireframe

Approved direction: Learn is a full PlotPickle Studio creative module, not a settings/help page. It uses the same matte-black, muted antique-gold, typewriter/editorial system already approved for Dashboard, Plan, Storyboard and the rest of the visual-writing journey.

## Desktop wireframe

```text
┌ PLOTPICKLE STUDIO ────────────────────────────────────────────────────────────────┐
│ current story: [project title]        ACT 1 · BLOCK 1 · MINI 1        Saved local │
├───────────────┬───────────────────────────────────────────────────────────────────┤
│ LEARN         │ READ & LEARN                                                     │
│               │ The complete PlotPickle screenwriting course.                    │
│ Library       │ Learn only what helps the story you are writing now.              │
│ Core          │                                                                   │
│ Workflow      │ ┌ CURRENT STORY POSITION ──────────────────────────────────────┐  │
│ 24 Blocks     │ │ Block 1.1 · current mini-block · current function             │  │
│ Characters    │ │ [Block selector] [Mini-block selector]                        │  │
│ Dialogue      │ └───────────────────────────────────────────────────────────────┘  │
│ Story Craft   │                                                                   │
│ AI Revision   │ ┌ COURSE PROGRESS ─────────────┐ ┌ NEXT USEFUL LESSON ─────────┐ │
│ Collaboration │ │ 0 of 81 complete             │ │ Recommended for Block 1.1   │ │
│ Working Tog.  │ │ ──────────────── 0%          │ │ title / reason / read       │ │
│ Guidance      │ └───────────────────────────────┘ └──────────────────────────────┘ │
│               │                                                                   │
│               │ CHOOSE HOW YOU WANT TO LEARN                                     │
│               │ [Complete Library] [Core Curriculum] [Guidance for this Block]    │
│               │                                                                   │
│               │ RECOMMENDED / SEARCHABLE MODULES                                 │
│               │ ┌ lesson ┐ ┌ lesson ┐ ┌ lesson ┐                                 │
│               │ │ read   │ │ read   │ │ read   │                                 │
│               │ │complete│ │complete│ │complete│                                 │
│               │ └────────┘ └────────┘ └────────┘                                 │
└───────────────┴───────────────────────────────────────────────────────────────────┘
```

## Module reader state

Opening a lesson keeps the same story position visible and expands the lesson below the learning overview. The reader presents teaching material, a worked example, an active-project exercise and a single Apply action. Completing a lesson records learning progress only; it does not modify story canon.

## Core Curriculum state

Core Curriculum uses the same PlotPickle Studio visual grammar: matte-black canvas, muted antique-gold dividers and actions, typewriter typography, square editorial panels and restrained hierarchy. It may record private exercise/application evidence into the active project review record, but it never locks the writer into a route.

## Visual contract

- canvas: matte black / near-black (`#070706`, `#0b0b0a`, `#10100f`)
- accent: muted antique gold between brass and yellow-gold (`#cda758`, lighter highlight `#e1ba64`, deeper trim `#8c6f35`)
- typography: typewriter/monospaced throughout; no teal, bright blue, white-card or rounded SaaS styling
- thin gold/neutral borders, square or nearly square panels, generous negative space
- current story position and learning progress remain visible and secondary to the lesson itself
- left Learn rail is persistent on desktop and collapses naturally on narrower screens

## Workflow contract

Learn is optional. It receives the same active PPF project, Block and mini-block context as Plan and Storyboard. A writer can choose a local learning route, read a recommended/searchable module, mark it complete, reload without losing project-specific progress, apply the lesson back to the same Block/writing workspace, open Core Curriculum, save exercise/application evidence and return to Learn with project continuity intact.

The preserved learning engine remains 81 modules. No cloud AI, provider/model choice, credentials, paid request or external write is required for this journey.

## UAT acceptance path

`Dashboard → New Project → Plan story material → Learn → choose route → open/read module → mark complete → reload → apply to same Block/workspace → Core Curriculum → save exercise/application evidence → return to Learn → Storyboard → Write → Edit → Graphic Novel → Build → Feedback → Refine`

The acceptance report must separate Learning findings from runner/infrastructure findings and capture screenshots for the Learn and Core Curriculum states.
