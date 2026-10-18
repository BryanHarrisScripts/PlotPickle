# #3098 — Cline Plan bounded source coverage follow-up

Parent #3096. Follows independent Cline challenger #3105.

The on-demand independent challenger receives an allowlisted list of changed
paths from the exact commit/base checkout. Very large generated verification
catalogs, binary source and files deleted at the reviewed head are common in
real PRs and cannot safely enter the bounded third-party model input bundle.
Previously a single >24K source file blocked the entire review.

Now executable changed source is ordered before generated metadata. Ordinary
reviewable files (up to 24K each/160K total) enter an immutable source bundle.
Files absent at the current reviewed head, or exceeding budget/binary source,
are explicitly OMITTED in the private manifest. If no reviewable source
remains, the worker is BLOCKED before any CLI/model request. Symlinks,
unsafe paths and cross-root traversals are still rejected. The result states
the selected/requested file counts and the evidence digest includes omitted
coverage. No agent statement is a claim of full changed-file coverage.

This is a synthetic contract regression, not a fresh on-host Cline/Windows
provider call. Normal CI W8/W9 exact source digest, source owner and green
exact-head proof remain mandatory. No other permission, startup, BUZZ, merge
or autonomous scheduling grant is added.
