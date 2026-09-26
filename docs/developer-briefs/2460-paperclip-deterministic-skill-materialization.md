# Developer Brief — Paperclip Pattern Adaptation: Deterministic Skill Materialization

Issue: #2460

## Objective

Adapt the useful deterministic skill-delivery pattern observed in Paperclip v2026.831.0 into PlotPickle's existing Agent Skill architecture.

Source reviewed:
- https://github.com/paperclipai/paperclip/releases/tag/v2026.831.0

This is a pattern adaptation, not a Paperclip dependency.

## Relevant source idea

Paperclip's release makes skill availability deterministic at agent-run time and surfaces materialization failures instead of allowing a skill to disappear silently.

PlotPickle already owns:
- config/agent-skills.json as the progressive discovery registry;
- .agents/skills/<id>/SKILL.md as procedure bodies;
- skill:// URIs;
- MCP-ready metadata;
- Agent Skill trust boundaries;
- AGENTS.md as the higher-level constitution.

Therefore the missing improvement is narrow: prepare a deterministic run-skill manifest and fail closed before worker handoff when a requested/required skill cannot be materialized.

## Current PlotPickle authority

REUSE:
- config/agent-skills.json remains the only discovery registry.
- AGENTS.md remains higher authority than every skill.
- Existing trust policy remains capability/authority boundary.
- Skills remain procedure, not permission.
- Progressive disclosure remains the loading model.
- MCP remains interoperability, not a second runtime.

ADAPT:
- Resolve skills deterministically for a consumer/worker.
- Produce a stable run manifest containing metadata needed to locate the skill.
- Validate concrete entry + URI + consumer eligibility before handoff.
- Surface a concise deterministic error when a required skill is unavailable.

NEW:
- One run-preparation helper/contract that derives from the canonical registry at runtime.
- No second persisted skill registry.

## Run-skill manifest

A materialized entry should contain only bounded metadata such as:
- id;
- name;
- uri;
- entry;
- roles;
- primaryWorker;
- localOnly;
- mcpReady.

The manifest should be deterministically sorted by skill id so equivalent inputs produce equivalent output.

The helper may select:
- every skill whose consumers contains the requested consumer; and/or
- an explicit list of required skill IDs supplied by the caller.

Explicit required IDs must fail closed if:
- unknown;
- not eligible for the requested consumer;
- missing a URI;
- missing an entry;
- the entry file cannot be resolved by the host in a real runtime path.

Repository tests may use an injectable existence predicate rather than mutating the filesystem.

## Failure contract

A failure should identify:
- error code;
- consumer;
- skill id where applicable;
- non-secret reason.

It must not include:
- skill body content;
- prompts;
- hidden reasoning;
- credentials;
- private project/story text.

No automatic recovery may grant a worker a different skill, broader permissions or authority.

## Relationship to prompts

Do not concatenate every SKILL.md into every system prompt.

The manifest exists so a worker or MCP resource layer can discover and load the needed procedure progressively.

That preserves:
- smaller context;
- model independence;
- runtime independence;
- one source of changing truth;
- explicit failure instead of silent omission.

## Verification

Focused tests must prove:
- same registry + consumer => stable ordering and stable manifest shape;
- consumer filtering works;
- explicit required skills are included when eligible;
- unknown required skill fails closed;
- ineligible required skill fails closed;
- malformed/missing materialization metadata fails closed;
- skill bodies are not embedded in the manifest;
- the canonical registry remains the source.

Architecture audit should continue to verify all registered entry files exist in the repository.

## Non-goals

- adopting Paperclip;
- replacing Mastra;
- changing Agent authority;
- granting tools through skills;
- installing or activating skills automatically;
- loading all skill bodies into prompts;
- creating a second registry;
- writing skill state into story projects;
- automatic reassignment or recovery that increases authority.

## Acceptance

- [ ] Deterministic run-skill materializer exists.
- [ ] It derives from config/agent-skills.json.
- [ ] Required missing/ineligible skills fail closed.
- [ ] Manifest contains metadata only, not skill bodies.
- [ ] Existing progressive disclosure and trust architecture remain intact.
- [ ] Focused regression covers success and failure paths.
