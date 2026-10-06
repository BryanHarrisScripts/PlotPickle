# Developer Brief — #2791 OpenPencil clean-checkout design bootstrap

## Human outcome

From PlotPickle Command, `OpenPencil open Timeline` must work on a clean checkout without asking the Human to manually create a design file.

## Root cause

#2787 registered every named surface against a design target but did not ship or create that target. The command parser and GUI gateway were correct; the first design artifact was missing.

The pinned OpenPencil 0.15.1 release provides the deterministic bridge: `.pen` is readable and text-diffable, `openpencil convert` writes `.fig`, and normal GUI Save authority is `.fig`.

## Implementation

Every registered PlotPickle surface has a unique editable `.fig` target and repository-owned `.pen` seed. If the editable target already exists, PlotPickle opens it unchanged. If it is absent, PlotPickle requires the seed and reviewed CLI, converts seed → `.fig`, verifies the page, and launches Desktop. Missing/failed bootstrap conversion is visible and bounded. Review evidence remains pointed at the editable `.fig`.

## Authority

Bootstrap conversion is local design materialization only. It does not modify PlotPickle implementation source, publish an issue, create a pull request, or grant OpenPencil merge authority.

## Acceptance

- Clean `OpenPencil open Timeline` materializes `timeline.fig` and activates Timeline.
- Existing edited `.fig` files are never overwritten.
- Every registry surface has a unique target and matching bootstrap seed.
- The existing #2787 Windows Settings/OpenPencil regression exercises first-run materialization.
- OpenPencil runtime/design/test changes explicitly select the Windows Command proof in Architecture Verification.
- Exact-head CI is green before merge.
