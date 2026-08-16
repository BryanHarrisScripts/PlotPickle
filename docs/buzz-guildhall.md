# PlotPickle BUZZ Guildhall

The Guildhall is PlotPickle's coordination layer. It gives humans, PlotPickle agents, deterministic observers, UAT gates and developer workflows one signed, searchable place to exchange short operational handoffs without moving creative or code authority into BUZZ.

## Authority

- PPF is the creative authority. BUZZ discussion may become a reviewable PlotPickle proposal, but only explicit human approval changes PPF canon.
- GitHub is the code authority. Issues, pull requests, CI and merge state remain GitHub facts.
- Mastra remains the product-agent runtime. BUZZ coordinates those agents; it does not replace their reasoning runtime.
- Pi and Cline remain external developer workers governed by `AGENTS.md`.
- The Guildhall never stores hidden reasoning, credentials, full prompts, full model responses or unpublished story text in coordination events.

## Lore roster

The names are original PlotPickle lore. Existing named characters remain intact and gain a Guildhall title rather than being renamed.

| Guild member | Guild title | What they do | Runtime / identity |
|---|---|---|---|
| Sage Brinewick | Lorekeeper | Curriculum mentor and conversational story guide | Mastra, mirrored into BUZZ |
| Master Oaken-Vague | Keeper of the Wyrmwood | Wyrmwood Rival Director | Mastra, mirrored into BUZZ |
| Rowan Scalequill | Arbiter of Lessons | Wyrmwood curriculum evaluator | Mastra, mirrored into BUZZ |
| Avery North | The Wayfarer | Synthetic first-time writer and experience observer | PlotPickle UAT, mirrored into BUZZ |
| Quillan Reedcloak | Story Scribe | Creative-room coordinator | Mastra, mirrored into BUZZ |
| Elowen Mapweaver | Cartographer of Beats | Structure and 24/96 story-map specialist | Mastra, mirrored into BUZZ |
| Mira Threadmere | Threadkeeper | Continuity and accepted-canon guardian | Mastra, mirrored into BUZZ |
| Luma Glassfern | Lantern Warden | Read-only rendered visual observer | Deterministic service identity |
| Bram Gatewick | Gatewarden | Deterministic UAT and quality gates | Deterministic service identity |
| Rook Ironquill | Forgekeeper | Verified development handoffs to Pi, Cline or humans | Repository workflow identity |
| Orin Ledgerbark | Archivist of the Hall | Searches BUZZ history and returns decision receipts | BUZZ-native, owner-reviewed agent draft |
| Fen Copperwind | Herald of the Forge | Turns verified engineering findings into GitHub-ready summaries | BUZZ-native, owner-reviewed agent draft |

A mirrored or service identity is a label on signed PlotPickle coordination events. It is not a second autonomous copy of the Mastra agent. This avoids two Sages or two Oaken-Vagues independently answering the same problem.

## Guildhall rooms

The bootstrap creates private rooms only:

- `great-hall` — cross-agent handoffs.
- `lore-library` — Sage and curriculum coordination.
- `wayfarer-journal` — Avery sessions and experience findings.
- `wyrmwood-ring` — Wyrmwood director/evaluator runs.
- `story-council` — creative discussion that may become a PPF proposal.
- `thread-vault` — continuity and canon conflicts.
- `lantern-watch` — visual observer findings.
- `gatehouse` — UAT, tests and runtime health.
- `forge` — verified repair work.
- `github-herald` — GitHub issue/PR/CI/merge status.
- `archive` — durable summaries and receipts.

## PlotPickle to BUZZ bridge

`lib/buzz-guildhall.ts` uses PlotPickle's existing local BUZZ gateway rather than reading BUZZ credentials itself.

The bridge first reads `/api/local-buzz/rooms`, finds the configured Guildhall room, then posts a signed operational summary through `/api/local-buzz/messages`. The existing gateway continues to own the encrypted BUZZ connection and private key.

Guildhall events intentionally have a narrow shape: event type, actor, short summary, severity, optional project/target labels, verification/actionable flags and compact evidence references. There is no story-body or full-model-response field.

GitHub escalation is only eligible when the event type is allowlisted, severity is medium or higher, and both `verified` and `actionable` are true. Eligibility still does not create or merge anything by itself.

## Bootstrap

Dry run, no BUZZ writes:

```text
node scripts/bootstrap-buzz-guildhall.mjs
```

Apply the room bootstrap to the explicitly selected relay:

```text
BUZZ_RELAY_URL=https://your-relay.example BUZZ_PRIVATE_KEY=<process-only-secret> node scripts/bootstrap-buzz-guildhall.mjs --apply
```

On PowerShell, set those values only for the current process before running the command. Do not put the private key in source, JSON, a command transcript, a GitHub issue or a PlotPickle project.

To additionally open owner-reviewed create-agent drafts for Orin Ledgerbark and Fen Copperwind in BUZZ Desktop:

```text
node scripts/bootstrap-buzz-guildhall.mjs --apply --draft-agents
```

BUZZ Desktop owns the final review/save step for those agent drafts. The bootstrap does not bypass that owner approval boundary.

## Event examples

Avery can post a medium, not-yet-verified `writer.feedback` event to the Wayfarer Journal. It remains product feedback and is not GitHub-eligible until deterministic UAT or a human reproduces it.

Bram Gatewick can post a verified high-severity `uat.result` with a test name and artifact reference. That event becomes GitHub-eligible, but a separate explicit GitHub action still creates an issue or PR.

Mira Threadmere can post a `continuity.warning` to the Thread Vault. It can lead to a reviewable PPF proposal, never a silent canon rewrite.

## Why only two BUZZ-native agents in v1

BUZZ is the coordination substrate, not a second PlotPickle runtime. Orin and Fen are useful specifically because their work happens inside the Guildhall: retrieving history and preparing verified handoffs. Product specialists continue to run where PlotPickle already controls curriculum context, PPF boundaries, local-model routing and deterministic game rules.

This keeps the architecture modular and avoids duplicate agents, duplicate memory and conflicting authority.
