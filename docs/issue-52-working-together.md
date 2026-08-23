# Issue 52 — Working Together in PlotPickle

## Purpose

Issue #52 replaces the legacy Afterglow-specific Collaborators guide with a general contributor onboarding and review handbook for local, private, commissioned, co-written, production, public-feedback and openly licensed PlotPickle projects.

## Legacy source-to-learning map

| Legacy phrase or section | PlotPickle lesson |
| --- | --- |
| Your Role and Key Questions | Choose the Collaboration Model; Define Roles and Decision Authority; Create a Contribution Brief |
| Process Post-Submission | Start From the Approved Story; Submit a Reviewable Proposal; Decide, Disagree and Record Canon |
| Feedback and Communication | Review the Change, Not the Person |
| Unlimited Contributions | Protect Privacy and Scale the Review Queue |
| Evolving Together | Decide, Disagree and Record Canon |
| Act review questions | Contextual Block and mini-block review questions |
| Afterglow collaborator guide | Working Together in PlotPickle collection and contributor welcome card |

## Canonical record mapping

The project schema remains at PlotPickle 1.7. The collaboration handbook uses existing canonical records rather than adding an incompatible parallel schema.

- Collaboration operating agreement: encoded project-level review thread.
- Contribution brief: encoded anchored review thread linked to a project, story field, Block, scene, screenplay element or character.
- Categorized feedback: anchored review thread using required, continuity, rights, craft, question, preference or praise.
- Canon decision: resolved review thread plus a revision-history snapshot containing the outcome and rationale.
- Contributor credit and agreement reference: existing Rights & Provenance collaborator record.
- Proposal packet: in-app creative summary used before the existing GitHub proposal queue.
- Approved story, stale-base protection and owner-controlled merge: existing GitHub collaboration engine.

Records use the marker `PLOTPICKLE_COLLABORATION_RECORD` inside the first review-thread comment so older project files remain valid and ordinary review threads remain unaffected.

## Authority boundaries

Creative roles and authority are documented separately from GitHub permissions. Repository permissions and branch protection remain the technical enforcement layer, while the collaboration model records who may view, comment, propose, edit rights, approve assets, merge canon, change licences or invite collaborators.

The project owner retains final canon authority unless a written agreement establishes shared or delegated authority.

## Rights and privacy boundaries

- Feedback does not automatically create ownership.
- A contribution does not automatically transfer copyright.
- A pull request is not a collaboration, employment, assignment or licence agreement.
- A public repository is not an open licence.
- PlotPickle software and documentation licences do not automatically apply to a user's screenplay.
- Local-only and file-based collaboration remain supported.
- Local drafts, autosaves, AI prompts, credentials and private assets are not shared merely because GitHub is connected.
- Only deliberately submitted proposal material enters the repository review queue.

## Product surfaces

- Read & Learn → Working Together
- Working Together contributor onboarding workspace
- Settings → GitHub & Backups contributor-onboarding entry point
- Pitch & Review navigation
- Existing Review Threads, Revision History, Rights & Provenance and GitHub proposal queue

## Validation coverage

Regression tests verify the legacy source map, eight collaboration models, roles and authority, welcome cards, contribution briefs, proposal packets, feedback categories, decision outcomes, contextual review questions, rights and privacy boundaries, learning integration and owner-controlled stale-base-safe proposal flow.
