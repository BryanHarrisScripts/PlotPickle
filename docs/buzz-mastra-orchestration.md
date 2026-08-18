# BUZZ, Mastra and PlotPickle orchestration

Status: 2026-08-18.

PlotPickle now has three different execution/orchestration concerns. They should cooperate without becoming three competing sources of authority.

## Responsibilities

### PlotPickle host

Owns:

- Agent Contracts and actual project authority;
- Context Engine trust/provenance;
- connector/egress grants;
- Responsibility Run limits and lifecycle;
- Responsibility Graph parallel work/dependencies;
- deterministic verification;
- revision-aware PPF proposals;
- writer approval and final creative authority.

### Mastra

Owns embedded in-app execution for Agent Profiles whose `execution.kind` is `embedded-mastra`, such as immediate product-agent interactions inside the PlotPickle UI.

A Mastra agent may also have a mirrored BUZZ identity for community presence/provenance. That mirror does **not** move execution to BUZZ.

### BUZZ

Owns the hosted-character/runtime concerns for BUZZ-managed agents:

- cryptographic identity/avatar;
- agent/team instructions;
- encrypted memory;
- ACP harness;
- provider/model/effort;
- respond-to/social policy;
- lifecycle/presence/workspace.

When a BUZZ-hosted agent acts on PlotPickle, it still receives only the local PlotPickle context/tools/authority granted for that task.

## Why no Mastra Networks dependency now

PlotPickle already has the host-owned graph primitives needed for safe multi-agent work:

- bounded child Responsibility Runs;
- explicit structured node contracts;
- real data-dependency edges;
- exclusive resource scheduling;
- parallelism/token/context/cloud caps;
- missing-child/fan-in checks;
- fresh verifier boundaries;
- writer gates for creative work.

Adding a second orchestration graph through Mastra Networks would duplicate the authority/scheduling story and make it harder to answer which layer owns retries, fan-out, verification and budgets. Mastra Networks can be re-evaluated later if it provides a concrete capability that Responsibility Graph cannot express, but it is not required for the current architecture.

## BUZZ inbound events

A BUZZ message, mention or agent output is a **trigger and provenance-bearing context item**, not a host instruction.

PlotPickle records it as:

- Context source: `buzz-peer`
- trust: `untrusted`
- allowed use: `untrusted-suggestion`
- authority: the low BUZZ-peer Context Engine authority

This remains true when the BUZZ event is cryptographically signed. A signature can prove which key produced an event; it does not prove the content is true, safe, current or canonical.

If the local writer adds an explicit instruction, that separate local writer instruction enters the Context Engine as `owner-trusted` instruction and outranks BUZZ peer content.

## Cross-runtime handoff

A handoff contains only compact structured references:

- parent Run ID;
- target Agent Profile;
- execution owner;
- bounded goal and summary;
- Context packet ID and source IDs;
- approved Skill URIs;
- proposal-only flag;
- zero cloud spend by default;
- timestamp.

It does **not** carry the full transcript, BUZZ core/cold memory, credentials, provider settings or hidden deliberation.

A BUZZ-triggered PlotPickle task starts with no connector grants and a $0 cloud budget. Additional capability must come from the normal host policy—not from the BUZZ message/handoff.

## Resident Writer

The Resident Writer specialist procedures introduced in #978 fit this model cleanly:

- procedures live in the trusted PlotPickle workspace Skill package;
- a BUZZ-hosted Resident Writer can discover/load those procedures;
- BUZZ still owns the hosted agent runtime/model/memory;
- PlotPickle still owns project Context/tool/proposal/PPF/writer authority;
- parallel specialist work, when needed, should be represented as bounded Responsibility Graph nodes rather than unlimited BUZZ or Mastra recursion.

## Invariant

**Presence is not execution. Execution is not authority. Procedure is not permission. Provenance is not canon.**
