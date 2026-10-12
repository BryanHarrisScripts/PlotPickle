# #2936 White paper coverage audit

## Human intent

“We have not yet demonstrated coverage of every white paper requirement. Untouched legacy tests remain unaudited, and green CI does not prove real device or provider behavior. We need a requirement-by-requirement coverage map to show what is enforced, observed, and still unproven.” The Human directed work to begin after #2935 merged. GitHub confirmed merge 96f75ff5e0c80ac72d803f8610e8bc7310f94fe7.

## Assessment — GO

Reuse the seven-layer catalogue, approved source registry, bounded claim/evidence contracts and development loop. Current main has 49 catalogue groups, 197 distinct catalogue targets and three full-file truth bindings. There are 1,139 tracked files under tests, including fixtures and helpers. None of those counts proves a requirement is fulfilled. Existing #2932 baseline probes and #2935 CI establish bounded engineering execution; there is no complete white paper requirement inventory or independently admitted device/provider conformance ledger.

## Scope and authority

Create an exhaustive source-accounting ledger for white paper v3.0, a proposed requirement-level coverage map, a digest-pinned legacy test inventory, a readable report and deterministic integrity checks. Record source, interpretation review, enforcement and observation as distinct facts. Reuse approved document bytes and version; do not silently turn proposed interpretations into approved obligations. Human review of requirement interpretation and exclusions remains pending. This change does not modify the approved paper or product contracts, execute paid providers, certify all legacy assertions, or establish universal software correctness.

## Acceptance criteria

1. Account for every substantive source unit and every numbered section 1–13 using exact locations and content digests. Candidate requirements have stable IDs; examples, explanatory text and uncertain applicability retain explicit classifications and review status. Missing source coverage fails integrity.
2. Each candidate requirement records proposed interpretation, owner, applicability, contract/test/enforcement references, expected observable result, a meaningful negative-control requirement, scope and limits, and remaining work. Repeated claims are linked rather than silently discarded.
3. Enforcement and observation have separate states. Missing, mocked, stale or mismatched receipts cannot become OBSERVED product conformance. Engineering execution evidence remains explicitly engineering-only. Contradicted requirements remain visible.
4. Inventory tracked tests/helpers/fixtures and standalone catalogue targets with complete text or byte digests, catalogue owners, bindings and semantic-review state. A binding alone does not mark a legacy assertion audited.
5. Explicit gaps cover real device/provider/storage/restart observations, mathematical safety/progress/model correspondence, composition/migration/recovery, and the pilot's reliability/rework/Human-burden measurements. Link actionable gaps to bounded follow-up issues. Unknown baseline measurements remain unknown.
6. All integrity checks run under existing Layer 7 ownership and the approved-truth admission gate. The report labels this an audit proposal awaiting Human semantic review, and cannot imply full conformance from a valid map.

## Plan and validation

Preserve the paper and current approved registry. Build the coverage and inventory records under docs/verification; put shared validation beneath lib/verification/development and its stable command in scripts with explicit ownership. Add adversarial integrity regressions bound to existing approved white-paper obligations. Run admission, focused regressions, focused UAT contracts, production build, BEN, convergence and independent exact-head CI. Open a draft PR for review. Do not close #2936 or self-certify the requirement interpretation before Human review.
