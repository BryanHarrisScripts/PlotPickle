# Developer Brief — Outline Story Architect Assessment Receipts

Issue: #2434

## Intent

Make Story Architect assessment work visible, persistent, and auditable in Outline without silently changing accepted story content.

The current assessment action already produces source-cited structural, character, Mini-Block, and Storyboard-cue proposals. The defect is that successful work can appear to vanish: the run status resets, the user may see the original assessment CTA again, and reassessment replaces the current per-Block record without a durable user-facing run receipt.

## Product contract

1. Story Architect assessment is proposal/evidence work, not canon mutation.
2. A successful current assessment must remain visibly assessed.
3. The UI must distinguish assessment activity from accepted story-content edits.
4. Block assessment uses the latest valid fingerprint-matching assessment.
5. Act assessment creates one run receipt covering its six requested Blocks.
6. Reassessment preserves prior run receipts while replacing only the current Block proposal.
7. Partial and failed runs must report their status truthfully.
8. History must be bounded and store summaries/citations counts, not duplicate screenplay text.
9. Legacy PPF projects without receipt history must normalize safely.

## Data design

Extend ProjectSourceEvidence with a bounded outlineAssessmentRuns collection.

Each receipt records:
- immutable run id
- block or act scope
- requested Block numbers
- completed Block numbers
- Blocks whose findings changed compared with the prior current assessment
- completed / partial / failed state
- completion timestamp
- optional bounded error message
- compact per-Block summary: structural state, unique cited passage count, character finding count, four Mini-Block states, model

Current outlineAssessments remains the latest-per-Block proposal store used by downstream Storyboard handoff.

## Outline UX

Per Block:
- show ASSESSED + timestamp when a current fingerprint-matching assessment exists
- show structural state, cited passage count, and four Mini-Blocks reviewed
- state explicitly that accepted story content did not change
- keep existing source-cited finding detail
- show Reassess this Block for a current assessment

Bottom of foundation board:
- Story Architect Assessment History
- newest relevant runs first
- scope, status, timestamp, completion count, changed-findings count
- explicit “No accepted story content changed”
- expandable compact Block summaries

## Refresh guarantee

After the receipt is persisted, reload the latest foundation project and send that saved object through onProjectChange. This gives Block and Act runs a final authoritative refresh instead of relying on intermediate state from each Block save.

## Verification

Focused regression coverage must prove:
- assessment proposal normalization remains strict
- receipt normalization rejects malformed history and bounds retained runs
- ProjectSourceEvidence normalizes receipt history for legacy/current projects
- board contains persistent assessed-state copy and Reassess CTA
- board records and renders run history
- Act flow records requested/completed Blocks and changed findings
- assessment action continues to state that accepted story content is not rewritten

CI remains the full-system authority per the PlotPickle development policy.
