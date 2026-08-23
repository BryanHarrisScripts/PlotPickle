# PlotPickle Application Stack

Status: CANDIDATE IMPLEMENTATION / LOCKED ARCHITECTURAL DIRECTION

This document defines the current intended PlotPickle application stack. The product contract remains authoritative. Framework and provider implementations remain replaceable where the contract requires replaceability.

## Stack

PlotPickle UI
→ Vercel AI SDK
→ Mastra Agent Runtime
→ Creative Director
→ Specialist Agents
→ Provider Router
→ Ollama / OpenAI / other text models
→ ComfyUI / image providers
→ H3 / video providers
→ PPF canonical state
→ Story Archive

## Layer Responsibilities

### PlotPickle UI
The three-column product experience: Story Navigator, Creative Canvas, and conversational Creative Room. Users interact with PlotPickle, not terminal windows or provider-specific consoles.

### Vercel AI SDK
Candidate TypeScript application-facing AI transport/streaming layer. It should support model/provider abstraction and interactive responses without becoming the owner of story state or canon.

### Mastra Agent Runtime
Candidate embedded agent/workflow runtime for the PlotPickle Agent Harness. It should provide orchestration, memory/context handling, tools, structured outputs, retries, tracing, suspend/resume, human approval, and specialist coordination. Mastra is an implementation candidate, not a permanent product dependency until validated and explicitly locked.

### Creative Director
Primary user-facing coordinator inside the Creative Room. It understands the active story task, chooses when to consult specialists, synthesizes useful findings, and never silently changes canon.

### Specialist Agents
Role-specific creative collaborators such as Story Architect, Character, World, Continuity, Visual Director, Screenwriter, Graphic Novel, Production, Feedback/Critic, and Canon Keeper. Each receives bounded context, tools, permissions, and structured output appropriate to its role.

### Provider Router
Capability-based routing layer. Creative workflows ask for capabilities rather than named providers. The router selects among enabled local/cloud providers according to user configuration, availability, cost/consent requirements, and task capability.

### Text Models
Ollama is a local-first text/reasoning route. OpenAI and other supported providers may be enabled as optional cloud text/reasoning routes. No creative workflow should be hard-coded to one text provider.

### Image Providers
ComfyUI is the primary local image workflow route. Additional image providers may be enabled through the same capability-routing contract. Generated assets remain candidates until reviewed/accepted.

### Video Providers
H3 and other supported video routes are accessed through the provider router. Paid/cloud generation requires explicit authorization and must never occur through silent fallback.

### PPF Canonical State
The PPF is the shared story blackboard and canonical record. Agent chat, model output, generated media, and external provider state are not canon until accepted into the PPF.

### Story Archive
Persistent local project library and recovery surface. A real PlotPickle project must survive application/computer restart and reopen with its story identity, canon, agent decisions, assets, and workflow position intact.

## Architectural Rule

The stack is layered, not chained by ownership. Vercel AI SDK and Mastra may be replaced if a better implementation satisfies the same locked PlotPickle contracts. PlotPickle owns the story model, PPF, UX, agent roles, provider-routing rules, consent rules, and archive behavior.

## Validation Before Mastra/Vercel Lock

Before either framework becomes a locked dependency, a controlled PlotPickle proof must demonstrate:

1. One interactive Creative Room with no user-facing command windows.
2. Creative Director plus multiple selectable specialist agents.
3. Role-specific context from the active PPF rather than full-story prompt dumping.
4. Parallel specialist work and structured synthesis.
5. Suspend/resume and restart recovery.
6. Explicit human approval for canon changes and paid/cloud generation.
7. Local-first routing through Ollama/ComfyUI where configured.
8. Provider substitution without rewriting creative workflows.
9. Traceable agent status and failures inside PlotPickle.
10. Persistent PPF/Story Archive state after restart.

If the proof fails materially, the product contract stays unchanged and another runtime may replace the candidate implementation.