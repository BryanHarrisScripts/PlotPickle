# PlotPickle Product Contract

Status: LOCKED
Contract version: 1.0
Established: 2026-08-11

This document is the durable product contract for PlotPickle. Product work may extend these requirements, but MUST NOT silently contradict, remove, rename, relocate, or weaken a LOCKED requirement.

A deliberate change requires a documented LOCK CHANGE containing the requirement ID, old rule, new rule, reason, evidence, and contract version.

## Development Rule

PlotPickle follows this cycle:

DISCOVER -> DEFINE -> BUILD -> TEST -> VISUALLY VERIFY -> LOCK -> MOVE FORWARD

Requirements use three states:

- DRAFT: still being explored.
- CANDIDATE: designed/built and being validated.
- LOCKED: part of the PlotPickle product contract.

## PP-BRAND — Product Identity

PP-BRAND-001 — LOCKED — Brand: PLOTPICKLE.

PP-BRAND-002 — LOCKED — Promise: “Words to Worlds.”

PP-BRAND-003 — LOCKED — Philosophy: “Write What You See.”

PP-BRAND-004 — LOCKED — Explanation: “Plot your story. Build your world. See it on screen.”

PP-BRAND-005 — LOCKED — Creative Room personality line: “In a plot pickle? Bring in the room.”

PP-BRAND-006 — LOCKED — PlotPickle is a visual, collaborative, agentic creative-writing environment in which the written story and visual story are developed together.

PP-BRAND-007 — LOCKED — PlotPickle is not primarily an AI screenplay generator, image generator, or production-management application. It is the creative environment carrying an idea through story, world, characters, structure, writing, visualization, storyboard, graphic novel, moving imagery, refinement, and screen production.

## PP-STORY — Story First

PP-STORY-001 — LOCKED — The story is the source of truth. Technology serves the story.

PP-STORY-002 — LOCKED — Normal creative workflows MUST NOT require the user to choose models, providers, APIs, or technical pipelines. Technical overrides belong in Settings.

PP-STORY-003 — LOCKED — The user creates; PlotPickle coordinates; Settings contains technical choices; Dashboard communicates state; Creative Room provides collaboration; PPF remembers the story.

PP-STORY-004 — LOCKED — PlotPickle retains the four-Act, 24-Block, 96-Mini-Block architecture as a visual organizational system, not a rule forcing every writer to write identically.

PP-STORY-005 — LOCKED — Block and Mini-Block identity MUST persist across relevant writing, visual, scene, asset, feedback, and production workspaces.

## PP-UX — Unified Product Experience

PP-UX-001 — LOCKED — PlotPickle MUST feel like one continuous application. Learn, Plan, Storyboard, Write, Edit, Graphic Novel, Build, Feedback, Refine, Reports, and Settings MUST NOT feel like unrelated applications.

PP-UX-002 — LOCKED — Primary creative workspaces use a persistent three-column full-screen shell.

PP-UX-003 — LOCKED — Left column: Story Navigator. It contains project context, workflow position, Acts, Blocks, Mini-Blocks, characters, locations, canon, and story navigation.

PP-UX-004 — LOCKED — Centre column: Creative Canvas. This is the dominant working surface and changes according to the active workflow.

PP-UX-005 — LOCKED — Right column: Creative Room. It is conversational, not an agent-status console.

PP-UX-006 — LOCKED — Side columns MAY collapse or resize when visual work needs more canvas space, but their roles remain consistent.

PP-UX-007 — LOCKED — Normal users MUST NOT need terminal/command windows to use PlotPickle or its creative agents.

## PP-VIS — Visual System and Visual-First Creation

PP-VIS-001 — LOCKED — The interface is cinematic, calm, highly readable, and visually subordinate to the story content.

PP-VIS-002 — LOCKED — The core interface uses two principal colour families with five controlled shades of each. Story-generated images and video are not restricted by this palette.

PP-VIS-003 — LOCKED — Colour is not the only carrier of state. Typography, icons, position, labels, and brightness MUST also communicate state.

PP-VIS-004 — LOCKED — Red is reserved for actual problems. Green is reserved for confirmed/healthy states.

PP-VIS-005 — LOCKED — PlotPickle does not wait for a completed screenplay before visualization. Writing and visualization develop together.

PP-VIS-006 — LOCKED — Characters, worlds, Blocks, Mini-Blocks, scenes, and important narrative moments MAY acquire visual identity while their written form is still developing.

PP-VIS-007 — LOCKED — Visual production distinguishes at least: required, planned, generating, candidate available, reviewed, accepted, and missing.

PP-VIS-008 — LOCKED — Video production follows equivalent explicit production states.

PP-VIS-009 — LOCKED — Posters/key art, character imagery, locations, important story moments, Graphic Novel panels, and video assets retain story context and asset lineage.

## PP-PPF — Canonical Story Data

PP-PPF-001 — LOCKED — The PPF is the canonical story record.

PP-PPF-002 — LOCKED — Agents, chats, generated assets, screenplay exports, and external providers do not independently own canon.

PP-PPF-003 — LOCKED — Accepted creative information ultimately belongs to the PPF.

PP-PPF-004 — LOCKED — Candidate/proposed material MUST remain distinguishable from accepted canon until approved.

PP-PPF-005 — LOCKED — A story retains one identity across Learn, Plan, Storyboard, Write, Edit, Graphic Novel, Build, Feedback, Refine, Reports, and Story Archive.

PP-PPF-006 — LOCKED — Completing or expanding a story MUST NOT silently create an unrelated parallel project.

## PP-ARCHIVE — Persistence

PP-ARCHIVE-001 — LOCKED — Every real project is persistently saved and discoverable in Story Archive.

PP-ARCHIVE-002 — LOCKED — A user can close PlotPickle, restart the computer/application, reopen PlotPickle, find the project, and continue from persisted state.

PP-ARCHIVE-003 — LOCKED — Autosave and rolling backup are required.

PP-ARCHIVE-004 — LOCKED — Acceptance testing MUST distinguish true local/archive persistence from browser-local persistence.

## PP-ROOM — Interactive Creative Room

PP-ROOM-001 — LOCKED — The Creative Room is a coordinated writers’ room, not one generic chatbot presented as multiple personalities.

PP-ROOM-002 — LOCKED — The Creative Director is the primary coordinating agent.

PP-ROOM-003 — LOCKED — Users can select which specialist they want to talk with directly.

PP-ROOM-004 — LOCKED — Conversational tone can be tuned for the selected agent without changing that agent’s role, expertise, permissions, or canon rules.

PP-ROOM-005 — LOCKED — Specialist roles can include Story Architect, Character, World, Continuity, Visual Director, Screenwriter, Graphic Novel, Production, Feedback/Critic, Canon Keeper, and other explicitly defined specialists.

PP-ROOM-006 — LOCKED — Specialists MAY work in the background and provide structured findings to the Creative Director.

PP-ROOM-007 — LOCKED — Agents MAY disagree. Disagreement is surfaced as observations, alternatives, or conflicts; it MUST NOT silently rewrite canon.

PP-ROOM-008 — LOCKED — The user remains the final creative authority over what becomes canon.

## PP-AGENT — Agent Harness

PP-AGENT-001 — LOCKED — Every PlotPickle creative agent runs within a common PlotPickle Agent Harness/runtime contract.

PP-AGENT-002 — LOCKED — The harness controls context, tools, memory, permissions, collaboration, structured output, retries/timeouts, failure classification, tracing, and human approval.

PP-AGENT-003 — LOCKED — Agents receive the smallest useful story context for their task rather than the entire PPF by default.

PP-AGENT-004 — LOCKED — Agent context is role-specific. Character, Continuity, Visual, Production, and other agents receive context and tools appropriate to their responsibilities.

PP-AGENT-005 — LOCKED — Agent cleanup/infrastructure failures MUST be distinguished from actual audit/creative failures. Recoverable cleanup problems should be retried and reported as warnings rather than falsely failing completed work.

PP-AGENT-006 — LOCKED — Long-running agent work has explicit working, blocked/waiting, failed, and complete states available to PlotPickle UI/supervision.

PP-AGENT-007 — LOCKED — Agent framework implementation is replaceable. The PlotPickle Agent Harness requirements are the contract; Mastra or another framework is an implementation candidate, not itself a locked dependency.

## PP-AI — Provider Routing

PP-AI-001 — LOCKED — Creative workflows request capabilities rather than hard-coding providers.

PP-AI-002 — LOCKED — Capabilities include text reasoning, image generation/editing, video generation, upscaling, transcription, and future creative capabilities.

PP-AI-003 — LOCKED — Provider routing chooses among enabled local/cloud providers according to user configuration and capability.

PP-AI-004 — LOCKED — Local-first operation remains possible.

PP-AI-005 — LOCKED — Cloud services remain optional where a local capability exists.

PP-AI-006 — LOCKED — Paid generation MUST NOT occur through an invisible fallback. Required consent/authorization is explicit.

## PP-DASH — Dashboard

PP-DASH-001 — LOCKED — Dashboard communicates project and system condition; it is not a configuration workspace.

PP-DASH-002 — LOCKED — Dashboard answers: what stories exist, where the user was, what needs attention, what is available, what is working, and what should happen next.

PP-DASH-003 — LOCKED — Provider/configuration controls link to Settings rather than being configured directly on Dashboard.

## PP-SETTINGS — Settings

PP-SETTINGS-001 — LOCKED — Technical complexity belongs in Settings rather than normal creative workflows.

PP-SETTINGS-002 — LOCKED — Each configurable component has an independent understandable section with availability/state, configuration, and testing where applicable.

PP-SETTINGS-003 — LOCKED — Integrations such as Ollama, ComfyUI, GitHub, Buzz, and cloud AI providers can be tested independently.

## PP-LEARN — Learn

PP-LEARN-001 — LOCKED — Learn is part of the active creative workflow, not disconnected educational content.

PP-LEARN-002 — LOCKED — Learning can be applied directly to the user’s active story, characters, Blocks, Mini-Blocks, scenes, and visual direction.

PP-LEARN-003 — LOCKED — Material developed through Learn remains part of the same active project and persists into later workflows and Story Archive.

PP-LEARN-004 — LOCKED — The Creative Room remains available while learning.

## PP-COMPAT — Backward Compatibility

PP-COMPAT-001 — LOCKED — Older valid PlotPickle projects MUST NOT crash merely because newer schema fields are absent.

PP-COMPAT-002 — LOCKED — New schema fields require normalization, migrations, safe defaults, or equivalent compatibility handling.

PP-COMPAT-003 — LOCKED — New UI/business logic MUST NOT directly assume optional/new nested project fields exist without compatibility handling.

PP-COMPAT-004 — LOCKED — Regression coverage is required for runtime crashes caused by legacy or partially migrated project shapes.

## PP-UAT — Acceptance and Visual Verification

PP-UAT-001 — LOCKED — A feature is not complete solely because unit tests pass.

PP-UAT-002 — LOCKED — PlotPickle requires Quality, Safety, Visual, and Release Readiness gates before merge unless this contract is explicitly changed.

PP-UAT-003 — LOCKED — Important workflows require human-like end-to-end acceptance testing.

PP-UAT-004 — LOCKED — The canonical acceptance journey must prove: create story -> develop story -> converse with agents -> build structure -> create writing -> create visual material -> save -> close -> restart -> Story Archive -> reopen -> continue.

PP-UAT-005 — LOCKED — Tests MUST NOT claim permanent/archive persistence when they only prove browser-local persistence.

PP-UAT-006 — LOCKED — Important UI changes require rendered visual evidence. Visual defects are product defects even when JavaScript/tests do not crash.

PP-UAT-007 — LOCKED — Visual review includes navigation continuity, layout consistency, colour drift, readability, hidden actions, technical complexity leakage, and workflow clarity.

## PP-CI — Develop and Lock

PP-CI-001 — LOCKED — Development follows: DISCOVER -> DEFINE -> BUILD -> TEST -> VISUALLY VERIFY -> LOCK -> MOVE FORWARD.

PP-CI-002 — LOCKED — Once a requirement is LOCKED, later work may extend it but MUST NOT silently reinterpret, remove, rename, relocate, or weaken it.

PP-CI-003 — LOCKED — Any intentional change to a LOCKED requirement requires a LOCK CHANGE record.

PP-CI-004 — LOCKED — New implementation work should reference applicable requirement IDs in issues, PRs, tests, or documentation so product intent remains traceable.

PP-CI-005 — LOCKED — When a locked behavior receives a regression fix, appropriate automated or visual acceptance coverage should be added so the same behavior cannot casually regress.

## LOCK CHANGE Template

LOCK CHANGE: <requirement-id>

Contract version: <new-version>

Old rule:
<previous locked requirement>

New rule:
<replacement requirement>

Reason:
<why the product contract must change>

Evidence:
<UAT, research, user decision, technical constraint, or other evidence>

Affected workflows/tests:
<references>

Approved:
<date/decision reference>

## Reference Rule

When product behavior is ambiguous, this contract is the first product-level reference. More detailed workflow, schema, security, or visual documents MAY elaborate on it but MUST NOT contradict a LOCKED requirement without a recorded LOCK CHANGE.
