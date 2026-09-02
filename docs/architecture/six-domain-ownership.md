# PlotPickle six-domain ownership model

Status: target architecture for repository ownership. Runtime/package weight remains governed separately by #1412.

PlotPickle uses six main ownership domains. These are navigation and responsibility boundaries, not six new runtime layers. Every durable file should ultimately have one obvious domain owner and then a bounded subdomain beneath it.

## 1. Core

Owns canonical product state and contracts that must remain stable regardless of UI, model provider, or community transport.

Representative subdomains:
- PPF / canon
- projects
- persistence and storage
- auth and identity
- revisions and provenance
- shared product contracts

## 2. Story

Owns the story-shaping system and the writer-facing story model.

Representative subdomains:
- curriculum and LEARN
- PLAN
- BUILD and 24/96 structure
- Story Workflow
- Story Council story responsibilities
- Story Decisions
- Story Workbench
- Storyboard and visual story state

## 3. Intelligence

Owns reasoning/execution capabilities that can understand evidence and propose work without owning canon.

Representative subdomains:
- Agents
- Agent Skills
- context and evidence assembly
- evidence-learning and approved durable knowledge
- local model runtime coordination
- provider routing
- image/video generation coordination

The Human and PPF authority boundaries remain unchanged. Intelligence may produce candidates and evidence; it does not silently grant itself durable knowledge or operational authority.

## 4. Community & Integrations

Owns optional external/social connectivity and adapters around the local core.

Representative subdomains:
- BUZZ
- Great Hall / BBS
- GitHub
- Google
- Ollama and ComfyUI adapters where they are optional integrations
- cloud/provider adapters
- other optional external services

An integration being owned here does not mean every contract it touches is optional. Core and Story contracts remain owned by their canonical domains.

## 5. Experience

Owns the application experience presented to the writer.

Representative subdomains:
- application UI
- navigation
- Library
- Settings
- onboarding
- accessibility
- branding and theme
- desktop/window experience

Experience renders and edits canonical state through owned contracts; it does not become a parallel store of story truth.

## 6. Platform

Owns delivery, execution safety, engineering infrastructure, and release mechanics.

Representative subdomains:
- startup and launcher
- Windows/portable runtime
- packaging and installer
- update and repair
- performance evidence and budgets
- Developer Workbench
- BEN
- testing and CI
- release tooling

## Ownership is separate from shipping weight

The six domains answer: where does this responsibility belong?

#1412 keeps five independent runtime-weight classes that answer: should this payload cost the normal user runtime/package weight?

1. core runtime
2. core maintenance/runtime tooling
3. optional integration/runtime
4. reference/example payload
5. developer/test-only

Examples:

- Story -> Workbench -> apply-change logic can be Story-owned and classified as core runtime.
- Platform -> Developer Workbench -> BEN runner can be Platform-owned and classified as developer/test-only.
- Community & Integrations -> BUZZ adapter can be Community-owned and classified as optional integration/runtime while the Story Decision contract it carries remains Story-owned core behavior.

Do not infer shipping class from repository location alone, and do not infer domain ownership from package.json dependency sections alone.

## Migration rule

Current roots may contain mixed responsibilities. During #1412 and the architecture tracker #1460, inventory them truthfully before moving anything. A mixed legacy root may temporarily map to more than one target domain in inventory evidence, but each eventual file/subdomain should converge on one clear owner.

Migration remains bounded:

review exact main -> inventory consumers -> move or split the smallest coherent responsibility -> update imports/config/tests -> focused tests -> BEN -> production build -> required CI -> exact-head green -> merge.

Do not combine architecture cleanup with unrelated product behavior changes.
