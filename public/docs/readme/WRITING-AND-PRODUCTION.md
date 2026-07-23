PlotPickle Playhouse
====================

This is one selectable tab from the complete PlotPickle README. The canonical root README links all three tabs.

## PlotPickle 0.17 — Page to Production

Open `/production` to connect the 24 Blocks, flexible scenes, screenplay, storyboard frames, shot coverage, keyframes, Sonic Bible, cue sheet, animatic playback, production breakdowns, shoot schedule and distribution plan. Afterglow now includes twelve new replacement concept keyframes for Blocks 22–24.

## PlotPickle 0.16 — Pitch and Review Workflows

Open `/pitch-review` to move from guided logline development through local anchored comments, review-thread resolution, revision snapshot comparison and a complete pitch package. The same active project produces a browser PDF layout, self-contained HTML package and presentation-ready Markdown deck. Review anchors use stable project IDs and all decisions remain local to the canonical PlotPickle project.

## PlotPickle 0.15 — Specialist Labs

PlotPickle now includes `/labs`, a review-first workspace containing the AI Prompt Lab, Dialogue Lab, Structured Research & Canon Binder, Visual Bible and mood boards, prompt and generated-asset provenance, and saved specialist passes with before/after comparison.

Every lab reads the same canonical schema 1.7 project. Suggestions remain temporary until the writer explicitly approves them. Approved work is applied to existing story, screenplay, research, visual-language or provenance fields and saved inside normal revision history; no parallel lab database is created.

The PlotPickle 0.14 Diagnostic Craft Layer remains available at `/diagnostics`, with focused findings inside Structure, Writer and DraftLens.

PlotPickle is a local-first story-development application built around Bryan Harris’s 24 Blocks method. One canonical project powers the complete hierarchy from story foundation to sequence, block, flexible scene plan, mini-block, screenplay page, review, visual board, diagnostics and specialist labs.

Current application version: `1.0.0-rc.2`

Current released project schema: `1.7.0`

## Five connected workspaces

- **Instructions** explains the 24 Blocks method and every story column.
- **Story Planner** develops the story foundation, world, characters, Ghost, Catalyst, The Pickle, dialogue system, structure summary, block spine, and notes.
- **Writer** connects three modes to the same 24 Blocks and 96 mini-blocks: a Markdown Treatment editor, a screenplay editor and Read & Learn.
- **Visual Storyboard** moves from the 24-block overview into all 96 mini-block images using canonical story, scene, character, location, screenplay, shot and continuity context.
- **Engines** explains and opens six focused craft engines plus the Specialist Labs.

Every workspace reads and writes the same locally saved project.

The Writer starts with a Markdown treatment section for every mini-block. It includes formatting tools, live preview, section and complete-treatment export, word counts, optional AI cleanup that requires approval, and a deliberate handoff from prose into screenplay action. Treatment text is saved in the canonical local project and can contribute context to later visual-storyboard prompts.

Screenplay mode starts blank for a new movie and uses the existing Story Setup, World, Characters, Ghost, Catalyst, 24 Blocks, flexible scene plan and 96 mini-blocks as its writing foundation. Every screenplay element retains its Block and mini-block assignment. The editor estimates page and scene counts, uses screenplay-standard spacing, and exports Fountain and Final Draft FDX; Print / PDF uses the screenplay page layout.

Read & Learn adds a searchable Learning Studio drawn from PlotPickle's screenwriting documentation. Short learning paths cover concept-to-draft, character and inner journey, structure and dramatic questions, scene construction, visual writing, dialogue, subtext, silence, theme, pacing, revision and Markdown. Recommended lessons follow the active Block and mini-block, provide an immediate exercise, and open the correct workspace for application. The educational guidance remains CC BY-SA 4.0; each writer's creative work remains their own.

PlotPickle accepts plain-text (`.txt`), Fountain (`.fountain` or `.spmd`), and Final Draft (`.fdx`) files. **Load a screenplay** in Read & Learn and **Import** in the top bar use the same ingestion pipeline. A screenplay creates a complete schema 1.7 project and populates reviewable metadata, story, world, characters, voiceprints, arc matrices, 24 Blocks, scenes, 96 mini-blocks, Story Threads, rights, review, pitch, production and collaboration fields. Script-derived interpretations are visibly marked as suggestions until the writer reviews and confirms them.

Parsing and the initial structural extraction happen on the local device without AI. The source screenplay is stored in the canonical `.plotpickle.json` project so it travels with the project, while the writer retains ownership of the script. Importing an existing `.plotpickle.json` file restores that complete saved project.

## Optional AI foundation

PlotPickle's AI layer is provider-independent and local-server mediated. The primary development and live-test target is **ChatGPT / OpenAI API**, using the writer's own API key, while OpenAI-compatible servers, Ollama, manual prompt export, and no-AI operation remain supported choices.

Settings also contains live **Reports** and a redesigned **Terminology Index**. Reports recalculate from the active canonical screenplay after every load, import, normalization, replacement or edit, including speaking coverage and a current-schema population audit. Terms are grouped, searchable, available in concise or expanded views, and linked to their relevant PlotPickle workspace. Both work locally without AI.

Optional connections remain in **AI Setup**, **Music**, and **Plugins**. Music can store Suno or Udio artist links. Plugins are reserved for future connectivity and cannot be enabled yet.

The AI foundation includes:

- capability-based provider selection instead of hardcoded model assumptions;
- portable knowledge-source contracts and bounded project context packs;
- character identity locks, approved looks, continuity locks, and generation provenance;
- OpenAI Responses and GPT Image adapters;
- compatible-server and Ollama text adapters; and
- a replaceable asynchronous video-job contract.

In the downloaded local edition, a verified API key may be saved in PlotPickle's private local-server data under the current computer account. AI Setup confirms the live connection, records the last successful check, and can test or remove the saved key. API keys are connection secrets, not project data, and are never written into browser settings, exported `.plotpickle.json` files, prompts, logs, provenance records or GitHub.

The Screenplay assistant can suggest material using the current Block, mini-block and character context, but inserts nothing until the writer approves it. Characters can generate a portrait through the connected image model; the local server saves the resulting asset under the current computer account and attaches it as the character reference.

See `docs/ai-architecture.md` for the complete architecture and delivery sequence.

## Specialist Labs

Open `/labs` from the Engines workspace.

- **AI Prompt Lab** creates bounded reusable prompts from canonical project context but does not execute or apply them automatically.
- **Dialogue Lab** compares a selected screenplay element with a voice- and pressure-aware alternative before replacement.
- **Structured Research & Canon Binder** records source, creator, URL, licence and the exact verified finding or canon decision.
- **Visual Bible & Mood Boards** reads existing character, location and storyboard assets, then proposes unified visual and continuity rules.
- **Prompt & Generated-Asset Provenance** records provider, model, prompt, retained output or asset, human contribution and approval decision without storing credentials.
- **Saved Specialist Passes** displays the before and after values preserved in canonical revision snapshots.

Every lab uses the sequence: prepare → compare → approve or discard → record. The pending suggestion is not saved to the project before approval.

See `docs/phase-c-specialist-labs.md` for the complete approval and provenance contract.

## Guided left-hand story rail

The story rail is grouped into four readable areas.

### Project

- **OV — Project Overview** shows project identity, overall coverage, the next suggested task, structural totals, open questions, and ownership information.

### Foundation

- Story Setup
- Pitch & Vision
- World
- Characters
- Ghost
- Catalyst
- Foundations
- The Pickle
- Dialogue

### Structure

- **ST — Structure Map** summarizes 4 acts, 12 sequences, 24 blocks, the live scene count, 96 mini-blocks, and the Story Clock before the writer enters the full Structure Engine. A 48-scene feature plan remains the starting template rather than a fixed requirement.
- 24 Blocks

### Production

- Storyboard
- Notes

Each rail item displays a live state:

- `○` not started;
- `◐` in progress;
- `✓` substantially complete; or
- `!` an open question or continuity item needs attention.

## Engines workspace

The guided engine order is:

**Structure → Resonance → Voiceprint → PageFlow → DraftLens → CraftLoop → Specialist Labs**

- **Structure Engine** expands the spine into 12 sequences, a flexible scene plan, 96 mini-blocks, beat and shot targets, and a complete Story Clock.
- **Resonance Engine** aligns the central question with character choices, motifs, opening and closing images, and consequences.
- **Voiceprint Engine** develops character-specific speech from history, status, worldview, rhythm, vocabulary, emotion, and pressure.
- **PageFlow Engine** turns planning into visible, active, actor-playable screenplay description.
- **DraftLens Engine** converts reader experience into evidence, root diagnosis, and revision questions, supported by computed Scene Pulse, thread, ledger, arc, and timeline findings.
- **CraftLoop Engine** connects the method into a repeatable deliberate-practice cycle.
- **Specialist Labs** provides controlled prompt, dialogue, research, visual and provenance passes with writer approval.

The suggested order is not mandatory. Writers may enter whichever engine or lab addresses the current story problem. The complete Diagnostic Craft workspace is available at `/diagnostics`.

## Complete structural hierarchy

**4 Acts → 12 Sequences → 24 Blocks → Flexible Scenes → 96 Mini-Blocks → Beats → Shots**

At the original 120-minute preset, the default reference model provides:

- 30 minutes per act;
- 10 minutes per sequence;
- 5 minutes per block;
- an initial two-scene distribution per block, producing a 48-scene starting template;
- 75 seconds per mini-block;
- 4 beats and 16 shots per mini-block;
- 384 beat targets and 1,536 shot targets overall; and
- approximately 4.69 seconds average shot length.

These are editable planning references, not mandatory filmmaking rules.
