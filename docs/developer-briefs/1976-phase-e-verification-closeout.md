# #1976 Phase E — Verification and closeout

## Goal

Close #1976 without changing curriculum content. Phase E adds final deterministic integrity coverage for the eight Phase C1/C2 lessons promoted in Phase D, proves the research/provenance boundary remains intact, runs exact-head Architecture Verification, and then closes the issue when green.

## Current accepted state

- 6 Paths / 24 Craft Modules remain the permanent visible navigation frame.
- Current LEARN projection: 89 canonical lessons / 96 presentation lessons / 95 bundled sources.
- The frozen #1918 historical baseline remains 81 archived lessons / 88 presentation lessons / 95 bundled sources.
- Phase D enrichment SHA-256: `aaba9ad1ed37ea604fba63e7927d41138784a1eda6d1378b7d1e2007e2975e81`.
- Every promoted lesson already has one existing Craft Module owner.
- Journey and Explore remain unrestricted; `PPFProject.learning.completedLessonIds` remains progress authority.
- C3 is still deferred and unapproved.

## Verification contract

Phase E must prove, from repository evidence only:

1. The exact eight approved lesson IDs in the Phase B design are the exact eight lessons in the canonical Phase D enrichment registry.
2. Each approved lesson still matches its Phase B canonical topic, kind and single owner Craft Module.
3. Every promoted lesson carries explicit PlotPickle authorship/provenance metadata and at least one research/source note.
4. Research/source records are metadata only. They must not contain copied source bodies, excerpts, quotations, screenplay pages or external lesson/reference payloads.
5. The pinned external repository remains research-index-only and its body is not imported into PlotPickle.
6. The frozen base lesson/source hashes remain consistent across the Phase A ledger, #1918 baseline and Phase D registry.
7. The Phase D enrichment SHA-256 still recomputes exactly from the canonical eight lesson payloads.
8. No C3 lesson is admitted by this closeout.

## Copyright / provenance proof

The closeout does not claim semantic originality by comparing against an external corpus. Instead it enforces the repository boundary that makes copied corpus material inadmissible:

- external research is represented only by identifiers, titles, URLs/scope notes and provenance statements;
- source records may not contain `body`, `content`, `excerpt`, `quote`, `script`, `screenplayPages`, `skillBody` or `referenceBody` payload fields;
- canonical enrichment lesson JSON may not embed the pinned external repository path or external `SKILL.md` / `reference.md` payloads;
- each lesson must state independent PlotPickle authorship and its external-research role.

This is a deterministic structural copyright/provenance guard, not a plagiarism detector.

## Allowed changes

- this Phase E brief;
- #1976 development-convergence manifest;
- Phase E verification test(s);
- the existing LEARN Story/Canon test wrapper only as needed to ensure Phase E executes in the verification mesh.

No lesson body, runtime route, curriculum adapter, Path/Craft Module definition, Sage/EA behavior, provider configuration or UI may change.

## Acceptance

Phase E is complete only when:

- all verification-contract assertions above pass;
- no curriculum body changes are present in the Phase E diff;
- exact-head Architecture Verification is green on all seven layers;
- the PR is merged unchanged from the verified head;
- #1976 receives a closeout comment with the verified head, workflow run and merge SHA;
- #1976 is closed as completed.
