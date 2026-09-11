# PlotPickle Stack Contract

Status: LOCKED ARCHITECTURE / CURRENT REFERENCE IMPLEMENTATION
Version: 1.0

Implementation status reconciled: 2026-09-11

This stack contract extends the PlotPickle Product Contract without changing its framework-replaceability rules. Vercel AI SDK and Mastra are active in the current reference implementation; their use does not change the locked rule that frameworks and providers remain replaceable behind PlotPickle-owned contracts.

PP-STACK-001 — LOCKED — PlotPickle uses a layered application architecture: PlotPickle UI → AI application layer → Agent Runtime/Harness → Creative Director → Specialist Agents → Provider Router → Model/Media Providers → PPF Canonical State → Story Archive.

PP-STACK-002 — REFERENCE IMPLEMENTATION — Vercel AI SDK is the current TypeScript application-facing AI transport/streaming layer. It remains replaceable under PP-STACK-012.

PP-STACK-003 — REFERENCE IMPLEMENTATION — Mastra is the current embedded Agent Runtime implementation. It remains replaceable under PP-STACK-012.

PP-STACK-004 — LOCKED — Creative Director is the primary coordinating agent for the interactive Creative Room.

PP-STACK-005 — LOCKED — Specialist agents are role-specific collaborators operating through the common PlotPickle Agent Harness.

PP-STACK-006 — LOCKED — Provider Router is capability-based and isolates creative workflows from provider-specific implementation.

PP-STACK-007 — LOCKED — Ollama is supported as a local-first text/reasoning provider route; OpenAI and other supported text providers may be enabled through the same routing contract.

PP-STACK-008 — LOCKED — ComfyUI is supported as the primary local image workflow route; additional image providers may plug into the same capability contract.

PP-STACK-009 — LOCKED — H3 and other supported video providers route through the same provider/consent architecture.

PP-STACK-010 — LOCKED — PPF remains the canonical shared story state beneath all agents and providers.

PP-STACK-011 — LOCKED — Story Archive remains the persistent project/recovery layer beneath canonical PPF state.

PP-STACK-012 — LOCKED — Frameworks do not own the product. Vercel AI SDK, Mastra, model providers, and media providers may be replaced without changing PlotPickle’s locked story, UX, agent, consent, provider-routing, PPF, and archive contracts.

PP-STACK-013 — LOCKED — Normal PlotPickle users interact through the application UI and Creative Room, not framework consoles, terminal windows, or provider dashboards.

PP-STACK-014 — LOCKED — The stack must support local-first operation, optional cloud use, explicit paid/cloud consent, structured agent state, restart recovery, and Story Archive persistence.

Implementation detail and validation expectations are defined in docs/PLOTPICKLE-STACK.md.