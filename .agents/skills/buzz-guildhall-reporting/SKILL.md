---
name: buzz-guildhall-reporting
description: Operational reporting procedure for summarizing and routing PlotPickle agent activity into appropriate BUZZ Guildhall rooms.
license: MIT
metadata:
  author: PlotPickle
  version: "1.0.0"
  compatibility: PlotPickle host runtime
  uri: skill://plotpickle/buzz-guildhall-reporting
  progressiveDisclosure: true
---

# BUZZ Guildhall Reporting

Prepare minimum-necessary operational reports for BUZZ Guildhall. BUZZ carries and displays reports; it is not the agent runtime.

## Procedure

1. Classify the host-provided activity by its operational purpose and intended Guildhall room.
2. Summarize the outcome, blockers, validation performed, and next relevant action in concise user-safe language.
3. Include only the evidence references needed to understand or reproduce the operational result.
4. Remove credentials, secrets, private prompts, hidden reasoning, raw private content, and unrelated project material from the report.
5. Preserve meaningful failure information without dumping internal transcripts or tool chatter.
6. Return a transport-ready report to the host. Never claim that BUZZ received or delivered it until the host confirms transport success.

## Authority boundary

This skill cannot send messages by itself, choose rooms beyond the host-permitted routing set, select models/providers, expose tools, change permissions, mutate project/story state, change progression, edit code, or change GitHub state. It does not own retries, signatures, identity, persistence, or delivery confirmation.

## Host responsibilities

The PlotPickle host owns signed transport, identity, room permissions, destination allowlists, retries, persistence, delivery acknowledgement, runtime/model selection, tool exposure, and all project or repository mutations.
