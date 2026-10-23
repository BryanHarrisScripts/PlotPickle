# Developer brief: bidirectional ChatGPT–PlotPickle Gateway

Date: October 23, 2026
Parent issue: #3259
Status: architecture proposal; not implemented autonomous ChatGPT sessions.

## Goal

Eliminate the Human-as-message-courier. PlotPickle and AI workers should ask questions, return answers, request evidence and verifiable tests, and coordinate Software, Learning & Evolution, and Creative factories using a shared, versioned, durable protocol. Preserve owner control of creative decisions and provable source truth.

## Reality of current architecture

The authenticated MCP tunnel supports tools invoked by ChatGPT during a live conversation. It does not establish the reverse capability of PlotPickle initiating or waking this exact ChatGPT chat. Unattended work requires a separate persistent, credentialed dispatcher using a supported AI API or equivalent integration. Keep that distinction explicit in UI and documentation.

The existing Factory has five blocked, reserved issues; its observer currently identifies the ChatGPT-only dispatcher as not implemented. PR #3253 merged; PR #3255 (self-service Tunnel in Settings / Compute) needs merge-conflict resolution and independently verified native Windows acceptance.

## Data and control plane

Define transport-agnostic versioned envelopes for `question`, `answer`, `command.request`, `command.result`, `status.event`, `evidence.append`, `human.decision.request`, `human.decision.result`, `ack` and `error`.

Required fields: `protocolVersion`, `messageId`, `correlationId`, `causationId`, `createdAt`, `expiresAt`, `sender`, `recipient`, `projectId`, `taskId`, `kind`, `schemaId`, `payload`, `capabilityScope`, `expectedSourceHead`, `idempotencyKey`, `evidenceRefs`, `sourceChannel`, `integrity`. Any gateway `conversationId` must not falsely imply access to an existing ChatGPT UI session.

Implement durable inbox/outbox and immutable sanitized receipts. Model `queued -> leased -> executing -> completed/failed/expired/cancelled`. Recovery from unknown results must not silently replay non-idempotent operations. Support disconnect, restart, duplicate deliveries, invalid auth and timeout. No secrets in envelopes, logs or status.

Transport A: ChatGPT -> authenticated MCP -> PlotPickle observation/commands.
Transport B: PlotPickle outbox -> credentialed outbound AI dispatcher -> recorded reply -> PlotPickle GUI/CMD and MCP receipt reader.
Begin with polling; optional push delivery is not a prerequisite.

## Capability and approval model

Owner-configurable OBSERVE, ENGINEER, ORCHESTRATE, AUTONOMOUS_POLICY levels, scoped per actor, project, repository, task, operation, exact source SHA, spend, and expiry. Broader AI freedom should support isolated source editing, bounded verification and coordination, but not turn tool availability into permission. Merges, destructive changes, releases, credential actions and spending outside an approved policy must require explicit owner decisions. Independent exact-commit CI and Windows/browser product verification are separate from any AI self-attestation.

## Delivery sequence

- P0: Resolve #3255 conflict and prove real Windows owner launch, authenticated remote plugin connection, proper STOP/cleanup and truthful Settings channel/SHA.
- P1: Land protocol schemas, durable inbox/outbox, idempotency, authentication, receipts and negative security tests without changing Factory policy.
- P2: Expose scoped MCP question submission and receipt reading; show pending/answered/failed in PlotPickle's GUI and CMD.
- P3: Integrate owner-configured outbound AI dispatcher/API with durable reply, retries and recovery; demonstrate a truly unattended turn independently of this ChatGPT UI session.
- P4: Add governed engineering execution, isolated edits, exact-source verification and reviewable PR handoff.
- P5: Reuse the same bus for Learning and Creative factory agents, evolving owner authority controls.

## First independently witnessed acceptance

1. PlotPickle submits a unique, source-bound question and persists it locally.
2. The separately hosted AI dispatcher receives it under the owner's credentials.
3. AI responds with the matching correlation ID; response is durably persisted.
4. PlotPickle displays result and state; MCP reads the same receipt.
5. Duplicate deliveries do not duplicate execution; wrong auth and malformed messages fail closed.
6. Offline/restart works; timeout remains unknown or failed rather than green.
7. The test records source SHA, channel, actor, timestamps, and sanitized evidence.

## Explicit non-claims

A live tunnel connection is not a background agent. Green CI is not native Windows product acceptance. A schema or mock round-trip is not proof of end-to-end autonomous AI delivery.

## Next code PR

Implement P1 in an isolated branch: versioned envelope validation + durable receipts and replay/negative tests. Keep scope narrow enough for an independently checked next merge.
