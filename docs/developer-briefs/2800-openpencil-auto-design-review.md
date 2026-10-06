# Developer Brief — #2800 Automatic OpenPencil design-review publishing

## Human outcome

Opening a named PlotPickle surface in OpenPencil is an intentional Human design action.

When the Human saves a real design change and closes the OpenPencil document, PlotPickle should publish that exact design state to GitHub automatically and create a developer-brief issue for discussion. The Human should not need to remember Git commands or manually run the previous review handoff.

Canonical flow:

```text
PlotPickle Command
→ OpenPencil open Timeline
→ edit / Save / close
→ PlotPickle regains focus
→ verify OpenPencil document is closed
→ compare design SHA-256
→ isolated design-review worktree
→ design/openpencil/<surface>-<hash>
→ commit only registered design artifact
→ push design-review branch
→ create/reuse GitHub developer-brief issue
→ Human/agent issue conversation
→ later implementation cycle
```

## Safety and authority

OpenPencil remains design authority only.

The automatic handoff does not:
- push protected `main`;
- change the Human's current branch;
- stage unrelated working-tree files;
- create an implementation PR;
- merge code;
- infer implementation intent from opaque FIG bytes.

Publishing uses a detached temporary Git worktree based on `origin/main` where available. Only the registered `designs/openpencil/<surface>.fig` artifact is copied, staged and committed. The Human's primary checkout is never checked out, staged, committed or pushed by this design publisher.

## Session contract

Immediately before the GUI launches, PlotPickle records a local session with:
- explicit surface and page;
- registered design artifact;
- base GitHub-main SHA;
- before SHA-256;
- before byte count;
- local session ID.

After the native editor gives focus back to PlotPickle, the browser asks the authenticated OpenPencil gateway to finalize that exact session.

If the document is still open, finalization stops and remains armed.

If the document is closed:
- identical SHA-256 → no Git or GitHub mutation;
- changed SHA-256 → publish design evidence;
- publishing failure → keep the local design and retryable session.

## GitHub publication

The branch is content-addressed:

`design/openpencil/<surface>-<first-12-of-after-sha256>`

That makes retries deterministic.

Before creating work:
1. authenticate GitHub through the existing local `gh` identity;
2. reuse the content-addressed remote branch if it already exists;
3. search existing issues for the exact full design marker;
4. create only the missing branch/issue portions.

The generated issue contains:
- surface and page;
- artifact path;
- design branch;
- design commit SHA;
- base main SHA;
- before/after SHA-256;
- before/after byte count;
- product-authority boundary;
- implementation constraints;
- bounded proposed scope;
- Human review questions;
- acceptance criteria.

Semantic design meaning is not invented from binary FIG bytes. The issue explicitly asks the Human/agents to discuss and refine that meaning before implementation.

## Failure and retry

A failed GitHub action never discards the saved design.

The session remains in PlotPickle local app data with failure state and enough identity to retry. `OpenPencil publish <surface>` is the explicit retry command; the normal path remains automatic.

If a branch was pushed but issue creation failed, retry reuses the branch.

If the same content hash already has a design-review issue, retry reuses that issue instead of creating spam.

## Existing compatibility

`OpenPencil review <surface>` remains available as the older Human-controlled DSDD review path.

The new automatic path is additive at the command boundary while preserving:
- explicit named surfaces;
- authenticated profile scope;
- Timeline live-snapshot capture;
- OpenPencil GUI-first editing;
- existing privacy/capture limits;
- later Human-governed implementation.

## Acceptance

- Explicit OpenPencil GUI sessions record the initial registered design hash.
- Save/close is detected when PlotPickle regains focus.
- An open document is never published mid-edit.
- No design delta creates no branch, push or issue.
- A changed design is committed only on a dedicated non-main branch.
- The primary checkout is not checked out, staged, committed or pushed.
- Only the registered design artifact is staged.
- The design branch is pushed automatically.
- A useful developer-brief issue is created automatically.
- The issue references the exact branch and design commit.
- Identical design states reuse existing branch/issue evidence.
- GitHub failure preserves local design and retry state.
- `OpenPencil publish <surface>` retries deterministically.
- No implementation PR is created automatically.
- Existing named-surface and manual review commands remain valid.
- Focused Windows Settings Command proof includes #2800.
- Exact-head Architecture Verification is green before merge.
