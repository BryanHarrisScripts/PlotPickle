# Community Experience Boundary

Issue: #1757

Community is a PlotPickle capability, not a mandatory story-building stage and not a source of Canon authority.

## Product position

The 24/96 story workspace remains the centre of gravity. Community is available from the Dashboard at any time, beside the core creative journey rather than inside PLAN -> BUILD -> STORYBOARD.

The successful Great Hall, public rooms, Story Rooms, Direct Messages, Connected Studios and Community Agents remain intact. This work is an integration boundary, not a Community rewrite.

## Architecture

Skin -> Experience intent -> Harness authority/consent -> Community capability -> BUZZ adapter

A Skin may render Community differently, but it must not depend directly on BUZZ transport, membership internals, persistence, agent runtime, or a specific model/provider.

Representative semantic intents for the Experience layer are:

- community.open
- community.listRooms
- community.enterRoom
- community.requestAccess
- community.postMessage
- community.listMembers
- community.openAgent
- community.createRoom
- community.leaveRoom

These are PlotPickle-owned contracts. BUZZ is the first Community provider behind them.

## Community is not Canon

Messages, images, shared references, member ideas and Agent results remain Community material. They never mutate the PPF automatically.

The intended future bridge is:

Community material -> Bring into Story -> Candidate -> Evidence/Revision -> Human approval -> PPF Canon

The Harness owns the story-side authority check. BUZZ owns Community-level membership, identity, permissions and publication behavior.

## BUZZ v0.5.23+

BUZZ Desktop v0.5.23 is a good fit for this boundary because managed agents can receive BUZZ context and skills through the BUZZ-owned launch path, forum-owned agents can be invited into Community spaces, and publication authorization is rechecked at execution time. PlotPickle should leverage those provider capabilities through the Community adapter instead of reproducing them in the Skin.

PlotPickle Agent definitions remain separate from any one model or runtime. Conceptually an Agent is identity + instructions + skills + allowed Community context + story context permitted by the Harness + provider/runtime.

## Skin rule

During the Experience/SKIN migration, the current Community interaction design is preserved but presented in a monochrome black-and-white treatment. The treatment is presentation-only and must not change Community behavior.

## Validation rule

Normal pull requests rely on the two visible gates. Do not add historical Community screenshot suites or broad UI lock-in while the Skin is changing rapidly. Exact changed-code checks are sufficient locally; deeper BUZZ/provider verification remains specialized when needed.
