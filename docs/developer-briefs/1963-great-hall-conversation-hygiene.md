# #1963 — Great Hall conversation hygiene and BUZZ reply visibility

Parent: #1962  
Blocks: #1918 Phase 5

## Why this exists

Real-machine review after #1918 Phase 4 found the Great Hall visibly accumulating PlotPickle BUZZ live-health probe messages dating back to August 25. Those events prove transport, but they are not conversation and must not appear beside Human or Agent messages.

The current architecture is already correct in one important respect: `modules/community/community-buzz-social.tsx` reads the authoritative BUZZ channel, sends through `/api/local-buzz/messages`, keeps stable BUZZ event IDs, and quietly polls every five seconds for incoming replies. Do not replace that with a second chat store.

## Root cause

`build/buzz-live-health-gateway.ts` intentionally signs and sends a uniquely tagged message into the retained `great-hall` room:

- tag prefix: `plotpickle-buzz-health:`
- human-readable line: `PlotPickle signed BUZZ round-trip connection probe`

The Community renderer already excludes older `plotpickle-live-activity:`/verification dumps, but it does not classify the live-health signature as diagnostic. Therefore every explicit connection test becomes visible Great Hall history.

## Build contract

1. Extend the existing Human-facing diagnostic filter to exclude both the live-health tag prefix and its stable human-readable probe sentence.
2. Keep the old operational-dump filters intact.
3. Keep `readMessages()` pointed at the authoritative BUZZ `/messages` endpoint and retain chronological ordering.
4. Keep the signed composer on the same `/messages` endpoint.
5. Keep the existing five-second quiet refresh so Human or Agent replies posted from BUZZ appear without page reload.
6. Preserve `data-buzz-event-id={message.id}` and Agent presentation so one BUZZ event stays one visible event.
7. Use the existing right context rail to state that this is a live BUZZ conversation and that Human/Agent replies refresh from the same signed room history.
8. Do not reset/delete the Great Hall or erase legitimate room history.
9. Do not move #1918 into Phase 5.

## Architecture boundaries

Preserve:

- #926: human conversation is separated from UAT/transport telemetry.
- #1067: PlotPickle and BUZZ Desktop are clients of one BUZZ room/history.
- #1129: BUZZ remains social/message authority.
- Human and Agent signing identities remain distinct.
- four public Community rooms, current three-column shell, BUZZ Desktop/Huddle handoff.

No new backend, event format, room, identity model, provider or Agent runtime is introduced.

## Verification

Focused regression must prove:

- historical/current live-health signatures are excluded from the Human-facing conversation;
- old operational-dump filtering remains;
- normal messages still render with stable BUZZ IDs;
- Agent messages still retain Agent presentation;
- polling stays at five seconds and uses quiet refresh;
- signed sends and reads still share `/api/local-buzz/messages`;
- the right rail explicitly describes live BUZZ reply behavior;
- production ownership and test selection are registered in the seven-layer Architecture Verification mesh;
- #1963 development convergence reports `CONVERGED` only when its manifest is part of the current diff.

## Stop condition

Open one PR for #1963, fix until all seven Architecture Verification layers pass on the exact head, then stop for Human merge approval. Do not begin #1962 Slice 2 in the same PR.
