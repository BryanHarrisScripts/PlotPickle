# PlotPickle Community — BUZZ OSS reuse record

PlotPickle Community intentionally uses BUZZ as its social authority rather than maintaining a second social network.

Upstream repository: `https://github.com/block/buzz`

Reviewed implementation baseline for issue #1129: `2edacde4d4c01490834725774aa878dbc373c41d`

Upstream license: Apache License 2.0, Copyright 2026 Block, Inc.

## What PlotPickle reuses

PlotPickle consumes the supported BUZZ contracts and follows the established BUZZ interaction model for:

- Stream/Channel messages;
- Forum channels;
- Direct Messages (`buzz dms list`, `buzz dms open`);
- member/presence truth;
- signed message history shared with Buzz Desktop;
- native Huddle voice through Buzz Desktop.

No BUZZ source file is copied verbatim by this issue. PlotPickle adapts the interaction model and calls the existing BUZZ CLI/relay contracts through its local profile-scoped gateway.

## Huddle boundary

The reviewed BUZZ desktop Huddle implementation is not a standalone React widget. `desktop/src/features/huddle/HuddleContext.tsx` owns audio through Tauri commands such as `start_huddle`, `join_huddle`, `leave_huddle`, `confirm_huddle_active` and the Rust-managed WebSocket/Opus path.

PlotPickle therefore does not transplant or imitate that audio stack. The Community right rail hands Huddle use to the installed native Buzz Desktop client. This keeps one BUZZ voice implementation and avoids presenting a fake in-browser connected state.

If BUZZ later exposes a stable browser/client SDK for the same native Huddle contract, PlotPickle may adopt that supported interface in a focused follow-up without changing the Community identity or conversation model.

## Great Hall exception

Great Hall / Hall 1 keeps PlotPickle's original ASCII-dragon, Matrix/BBS presentation. Its presentation is PlotPickle-specific; its messages are not. Great Hall reads/writes the same authoritative BUZZ channel history visible from Buzz Desktop.

## Excluded upstream capabilities

Issue #1129 does not adopt BUZZ Mesh or peer compute. Community membership, DMs and Huddles do not grant access to another PlotPickle Node's hardware, models, filesystem, credentials, project state, agents or execution capability.

## Attribution discipline

If a later PlotPickle change copies or modifies BUZZ source code rather than consuming a supported interface, that change must retain the Apache-2.0 license/copyright notices and mark modified files as required by the upstream license. BUZZ/Block names and trademarks are not PlotPickle branding.
