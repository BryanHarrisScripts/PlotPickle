# #3100 — Engineering Team operator status and evidence-backed GitHub candidates

Parent #3096, follow-up issue #3100.

## Implemented read-only scope

The current on-demand team writes restricted evidence receipts under
LOCALAPPDATA/PlotPickle/engineering-team/runs/. This package adds a read-only
status command:

    node scripts/engineering-team/operator-reporting.mjs --status --json

It reads a bounded set of local receipts and reports observed, blocked,
cancelled, stale or unknown status, number of roles observed, and whether the
optional local BUZZ journal recorded handoffs. It does not contact models,
GitHub, BUZZ relay or other external software and it cannot enable/disable
agents or start paid work. A missing or malformed receipt is UNKNOWN, not PASS.

Even a record that claims verified=true cannot promote status to independently
verified or mergeable. External agent signer, Windows provider operation,
scheduled continuous work and GitHub publication remain explicitly unproven.

## Draft finding contract

A GitHub candidate may be prepared from:
- one exact campaign commit and finding reference;
- a genuinely distinct Tester and Challenger with reproduction evidence;
- a separate exact-SHA deterministic verifier receipt;
- absence of contradicting/disproving observations;
- a deterministic duplicate fingerprint.

It is a private, source-minimized draft only. The candidate contains no
private model summaries, story data, raw credentials or published GitHub URL.
An independent existing reporter/approved process must independently verify
this input and obtain permission before posting any issue/PR comment.
Reporter cannot commit, merge or call a paid provider.

## Evidence and limits

Tests are synthetic temporary private-filesystem and source-only fixtures.
They cover corrupted/fabricated receipts, empty roots, no hidden provider
probes, stale/duplicate/disputed findings and explicit no-publication flags.
They do not demonstrate real Windows Pi, remote signed BUZZ, native Settings UI,
an active campaign scheduler or a real new GitHub issue. Keep #3100 OPEN for
real scheduled campaigns, Settings/Command integration and Windows product
acceptance.

White Paper V3 W8/W9 truth binding, normal architecture ownership and the
exact-head independent CI gate apply to this bounded software increment.
