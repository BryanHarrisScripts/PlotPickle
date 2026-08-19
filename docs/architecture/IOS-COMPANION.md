# PlotPickle iOS Companion Contract

Status: first implementation contract for #1090.

The iOS Companion is intentionally not a mobile edition of the full PlotPickle Studio. Its top-level product surface is exactly:

1. LEARN
2. COMMUNITY

The desktop/laptop application remains the complete LEARN -> PLAN -> BUILD workstation and PPF/project authority.

## Shared authority

The mobile client consumes existing PlotPickle contracts rather than creating mobile-specific authorities:

- Person and canonical Avatar authority: #1072 / #1073;
- portable LEARN state: #1073;
- BUZZ signed conversation/event transport and Merrin moderation: existing Community/BBS contracts;
- future remote work: bounded host-owned capabilities, not arbitrary commands.

The phone does not own or copy:

- unrestricted PPF/project state;
- provider credentials;
- Node private keys;
- ComfyUI/model configuration;
- direct GPU/Node management;
- arbitrary shell/MCP execution;
- BUILD UI.

## Five Communities

The first architecture exposes exactly five identities:

- The Scriptorium — writing, structure, character, world and story craft;
- The Atelier — visual development, continuity, storyboard/graphic-novel thinking and key art;
- The Workshop — editing, screenplay execution, production, sound, film and animation discussion;
- The Engine Room — BEN evidence, system health, provider/readiness and bounded support capability requests;
- The Great Hall — human-to-human social Community.

Merrin Bellwarden is the moderation identity across eligible Community areas. The Great Hall permits ordinary human messages and Merrin moderation only. It does not accept specialist/system agents or remote-control/job event types.

## Agent discovery

The client renders one conversation model regardless of specialist count.

Agent Profiles remain host-owned. A mobile projection may contain:

- stable agent ID;
- display name;
- Community and room;
- agent kind;
- required curriculum milestones;
- explicit capability IDs;
- current unlocked/locked state.

This supports 20+ specialists without 20+ mobile UIs. Curriculum progression determines whether a profile is currently available. For example, Sage may be available immediately while Marquee can remain locked until the Foundations milestone is complete.

## BUZZ event boundary

The initial signed event vocabulary is:

- `message`;
- `agent_request`;
- `agent_response`;
- `job_requested`;
- `job_started`;
- `job_completed`;
- `artifact_ready`;
- `approval_required`.

Events must be signature-verified before the mobile projection accepts them.

An `agent_request` or `job_requested` carries one explicit PlotPickle capability ID. The event itself is never a permission grant. The desktop/runtime host must map that capability ID through the normal Agent Profile, curriculum, project-context and tool-permission rules before anything can execute.

The Great Hall accepts only ordinary `message` events.

## LEARN

Mobile LEARN is the same portable state from #1073:

- current lesson;
- completion state;
- notes/answers already allowed by the portable sync contract;
- bookmarks;
- resume position.

The mobile layer calls the existing portable-state sanitizer instead of inventing a broader sync schema. PPF and provider state remain outside LEARN sync.

## Session boundary

The mobile session binds to the same Person and canonical Avatar and one device ID. It is revocable and expiring. Session state contains no Node private key or provider credential.

A future native SwiftUI client should keep durable secrets in the appropriate platform secure store and consume this contract through authenticated APIs/events. SwiftUI remains a client technology, not identity/project authority.

## Relationship to #1077 and #1079

#1077 and #1090 are sibling client surfaces. They should converge on common authenticated account/Avatar, LEARN, BUZZ projection and bounded remote-capability contracts after those primitives stabilize.

#1079 is the local host/supervisor. It is the natural place for managed services that fulfill an approved remote capability. The iOS client never manages those processes directly.

This separation yields:

`iOS Companion -> signed/sanitized PlotPickle contracts -> desktop/runtime host -> approved capability`

not:

`iOS Companion -> shell / provider / ComfyUI / arbitrary MCP`.

## Native-client phase

This PR establishes and tests the cross-platform contract first. A later phase can add the SwiftUI shell once authentication and BUZZ mobile transport are selected, without changing the authority model.
