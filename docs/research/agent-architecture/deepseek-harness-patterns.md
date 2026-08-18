# DeepSeek Harness patterns

**Reviewed:** 2026-08-17  
**Primary discussion source:** https://www.opensourceprojects.dev/post/deepseek-harness  
**Status:** Architecture research note; not a runtime dependency.

## Source-derived patterns

The reviewed DeepSeek Harness discussion highlighted five useful harness-engineering patterns:

1. **Derive model context from an append-only event log.** Record the event first, then reconstruct the outgoing model request from the recorded history so telemetry and actual context cannot silently drift apart.
2. **Interrupt repeated-tool loops with escalating reminders before hard failure.** Repeated equivalent calls are evidence the agent may be stuck; warn at bounded thresholds while retaining a deterministic outer stop limit.
3. **Tell the model what it did not see.** Truncated search results, policy denials and partial tool responses should be explicit. A denial should say it is policy, not a command bug that should be routed around.
4. **Code/programmatic tool execution must stay inside the same permission boundary.** A `run_code`-style tool must not create a bypass around per-tool policy, logging or denial behavior.
5. **Kill stale conversation context while keeping structured workspace state.** Long jobs can restart with fresh reasoning context while preserving bounded handoff fields and durable artifacts.

## PlotPickle interpretation

Harness reliability belongs below Agent Profiles and Agent Skills.

Target direction:

`Agent Profile + Skill -> Context/Policy -> Responsibility Run event log -> Capability Router -> provider/model adapter -> tools -> verifier`

Provider-specific protocol quirks stay below Profiles/Skills. The product should not become DeepSeek-specific.

## Decisions adopted

- #963 should make important task context reconstructable from recorded provenance/events rather than invisible ad-hoc prompt assembly.
- #965 keeps one permission pipeline for direct tool calls and future programmatic/code-mode execution.
- #966 uses bounded repeated-call detection, explicit retry/stop rules and fresh-context restart/handoff support.
- #967 preserves explicit failure routes and fresh verification context between graph nodes.
- #968 derives trajectory/observability from structured Run events where practical and tests provider-specific protocol adapters.

## Decisions not adopted

- Do not replace Mastra with DeepSeek Harness.
- Do not make DeepSeek the required model/provider.
- Do not persist or expose hidden chain-of-thought.
- Do not let an agent decide that a policy denial authorizes another route around the policy.

## Related issues

#963, #965, #966, #967, #968, #970.
