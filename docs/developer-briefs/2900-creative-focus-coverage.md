# Issue #2900 — Creative Focus source audit and integration

Pinned source revisions, reviewed 2026-10-10. The external repositories remain **research inputs only**; PlotPickle does not install their CLIs, tools, models, plug-ins, scripts or copied lessons.

| Upstream | Pinned commit | License | Review scope |
| --- | --- | --- | --- |
| [story-skills](https://github.com/danjdewhurst/story-skills) | `9a54e04b210c0adb9ac9807fcc876eda1d27e9f6` | MIT | 24 complete SKILL.md workflow packages; conventions and examples reviewed |
| [screenwriting-skills](https://github.com/jtydhr88/screenwriting-skills) | `51115f18d160aa8b2ac5813e4432b6f0b425358f` | MIT | 26 screenwriting specialist SKILL.md packages; general writing, regional and case studies separated |
| [cinema-skills](https://github.com/DenisHumen/cinema-skills) | `0ea4971cc5022c616e14b8eb572fb818433d1219` | MIT | Planning READMEs and templates for 10 disciplines; **no completed production SKILL.md bodies** in discipline directories |

## Coverage disposition

Terms: covered = a related PlotPickle procedure or lesson exists; partial = accepted bounded enrichment below; out-of-scope = not an installed PlotPickle runtime or outside the current teaching domain. "Covered" does not assert identical functionality or import of upstream source.

Story-skills 24 reviewed entries:
- Partial, handled by `story-development-craft`: premise-workshop, plot-structure, theme-craft, genre-craft, worldbuilding, research, scene-craft.
- Partial, handled by `story-revision-review`: voice-style, editorial-review, feedback-triage, reader-panel, revision-continuity.
- Covered by existing PlotPickle story/character/scene procedures or Learn: character-management, chapter-writing, discovery-drafting, line-editing, adaptation, series-continuity.
- Out of scope for this phase: story-init, story-maintenance, interactive-fiction, verse-craft, submission, publishing (their file/CLI/build/marketplace tooling is not implemented by adding agent text).

Screenwriting-skills 26 reviewed entries:
- Partial, developed into existing skills/lessons: sw-premise-theme, sw-story-structure, sw-character-conflict, sw-genre-anatomy, sw-scene-craft, sw-dialogue, sw-workflow.
- Covered by existing #1976 canonical student material: sw-format-adaptation, sw-series-structure, sw-series-engine-bible, sw-writers-room, sw-sitcom-comedy, sw-industry-business.
- Out of scope specialist frameworks/case studies: chekhov-dramaturgy, ozu-screenplay-style, succession-series-writing, sw-american-case-studies, sw-chinese-opera-banqiang-cases, sw-chinese-opera-banqiang, sw-chinese-opera-qupai-cases, sw-chinese-opera-qupai, sw-chinese-series-practice, sw-japanese-screenwriting, sw-korean-french-screenwriting, sw-series-case-studies, sw-truby-anatomy. These remain discoverable for future rights-aware optional study, not generic canon.

Cinema-skills: 00-pipeline, screenwriting, directing, cinematography, editing, color-grading, sound-and-voice, ai-generation, titles-and-vfx and series-production are **planned discipline packages only**. The source offers templates/style bible/shot-list concepts, not verified skills or ready video operations. Its useful ideas are independently authored in the existing `sequence-director` procedure.

## Integration owner and learner mapping

| Human craft request | Existing Mastra role and native procedure | Current Learn lesson receiving supplementary teaching |
| --- | --- | --- |
| Clues, setups and payoff | Elowen / story-development-craft | 24b-reflection |
| Rules, exceptions and consequences | Elowen / story-development-craft | world-building |
| Research provenance | Elowen / story-development-craft | ai-revision-representation-research |
| Simulated reader perspective | Mira / story-revision-review | essentials-audit |
| Character-specific dialogue | Mira / story-revision-review | dialogue-voiceprint |
| Style bible and reference roles | Quillan / sequence-director | early-visual-development |
| Shot continuity | Quillan / sequence-director | ai-revision-visual-pageflow |
| Connected narration | Quillan / sequence-director | essentials-screen-evidence |

All eight are authored as current presentation supplements on existing IDs by `withIssue2900CreativeFocus` in the canonical catalog; the 12 topics, 24 Craft Modules, 89 canonical archive lessons, 96 presentation lessons, source counts and completion IDs remain the same. The frozen source files and historical #1976 enrichment hash are left intact.

## Verification and limitations

Agent role registration and task-scoped materialization are testable with `scripts/agent-skills.mjs` and `tests/issue-2900-creative-focus.test.mjs`. LEARN uses the current catalog for student content and curriculum retrieval; all sections have a worked example and an Apply-to-story exercise. Human review is mandatory before any proposed creative choice becomes PPF canon. Testing actual signed-in learner progress persistence, Sage's live model response or Timeline media generation requires operational UAT and must not be inferred from static skill files. Neither the cinema templates nor the upstream story CLI proves any local media or publishing integration.
