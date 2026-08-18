# Resident Writer specialist procedures

Status: first trusted workspace-Skill slice, 2026-08-18.

## Naming boundary

PlotPickle already has a **Writer-in-Residence** synthetic writer journey used for UAT. That journey proves the app can be navigated by a bounded writer persona and must remain test-only.

The **Resident Writer specialist procedures** added here are reusable production guidance packaged inside the trusted `skill://plotpickle/writer-in-residence` filesystem Skill. They do not turn the synthetic UAT persona into creative canon authority.

## Why one trusted package with on-demand specialists

The specialist procedures share one trusted package so PlotPickle can:

- hash/review the complete procedure set with #976's Skill trust record;
- let BUZZ/other compatible harnesses discover the same workspace Skill files without duplicating prompt text into runtime configuration;
- load only the relevant procedure for the current task;
- avoid permanently inflating every prompt with five specialist personas;
- invalidate the package hash automatically when any specialist procedure changes.

The current package version is `1.0.0` and contains:

- Story Structure Specialist
- Character & Continuity Specialist
- Scene Revision Specialist
- Visual Continuity Specialist
- Fresh Reader Specialist

## Selection

`config/resident-writer-specialists.json` contains lightweight discovery metadata and keywords. `scripts/resident-writer-specialists.mjs` selects zero, one or at most two specialists for a task and then loads the full Markdown procedure only after the trusted package is resolved through `trustedAgentSkillIndex()`.

This is progressive disclosure, not autonomous delegation. The selector does not call a model, tool, connector or BUZZ relay.

## Authority

A selected specialist procedure grants **nothing**. In particular it cannot grant:

- tools or MCP servers;
- network egress;
- provider/model selection;
- credentials;
- developer/GitHub authority;
- direct PPF mutation;
- final creative authority.

Any real action remains subject to the Agent Contract, Context Engine, connector/egress policy, Responsibility Run limits and PPF/writer approval boundary.

## BUZZ relationship

BUZZ can own a Resident Writer agent's cryptographic identity, instructions, encrypted memory, ACP harness, provider/model/effort, respond-to rules and lifecycle. PlotPickle should not copy those mutable BUZZ settings into this specialist manifest.

The workspace procedures are portable guidance. When a BUZZ-hosted agent acts on PlotPickle, the local host still decides what project context and tools are available and whether any proposal may proceed toward writer approval.

BUZZ memory is not PPF canon and is not automatically PlotPickle project memory.

## Revision procedure

The Scene Revision Specialist is intentionally aligned with #964:

- generated text is a proposal against a base canonical revision;
- it cannot silently replace accepted writer material;
- stale apply requires explicit rebase/merge/regenerate behavior;
- writer acceptance is still required before canon changes.

## Future expansion

New specialist procedures should be added only when they represent a genuinely reusable job. Changes automatically alter the trusted package hash and therefore remain visible to the #976 trust/eval process. External/community specialist procedures should enter quarantine rather than being copied directly into this built-in package.
