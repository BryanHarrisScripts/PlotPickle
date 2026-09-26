# 2470 Phases 2–5: Human-validated Conversational UAT loop

This completes the remaining #2470 path on top of the merged Phase 1 finding contract.

## Runtime behavior

Launcher option [3] now starts one read-only closed-loop observer after the PlotPickle startup contract is ready. The observer writes bounded candidate evidence to the existing local UAT artifact root, using the current PlotPickle source head when available. It never enables raw GitHub reporting or semantic repair.

The DSDD session gateway reconciles only candidates produced for the current head into a separate private Conversational UAT evidence object. Human journey evidence records only semantic surface transitions. It does not persist arbitrary DOM text, story prose, provider keys, raw keystrokes, or screen recordings.

## Human checkpoint

The global Conversational UAT overlay exposes the pending count and at most one candidate at a time. Presentation waits for a short settled checkpoint and refuses keyboard handling while a form control, busy region, generation marker, destructive confirmation, or provider-key entry is active.

[Y] confirms the finding. [N] records that the behavior is expected and publishes nothing. Safe navigation is offered only for a bounded local route supplied by the finding evidence.

## Confirmed finding handoff

Human Y is the specification-publication authority for an agent-discovered candidate. The gateway:

1. persists the Human confirmation in UAT evidence;
2. creates a bounded DSDD source statement from the confirmed finding;
3. creates deterministic, testable DSDD interpretation text;
4. locks the current intent;
5. attaches originating UAT fingerprint/session/head/evidence provenance;
6. runs the existing read-only Pi Draft path;
7. publishes through the existing DSDD GitHub Issue boundary.

This path does not edit source, invoke semantic repair, create an implementation branch or PR, run implementation CI, or merge code.

## Story/canon boundary

Conversational UAT evidence remains under the dedicated developer/UAT memory object and local UAT artifact root. No active PPF/story object is written by observation, Y/N confirmation, safe navigation, or publication. Existing Storyboard Keep/Lock recovery authority is unchanged.

## Verification

Focused #2470 coverage is registered in the existing Experience Contract, Agent Runtime and Story/Canon catalog owners. The exact PR head must also keep the canonical Layer 1 Skin/navigation/WebMCP suites and Layer 5 story/canon baseline green before merge.
