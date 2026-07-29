# Issue #172: Workspace ownership and Refine boundaries

PlotPickle uses one canonical project. This change moves access to existing capabilities without creating parallel story, screenplay, storyboard, production, review, or report models.

## Governing rule

Refine diagnoses and proposes. Plan, Build, Write, and Storyboard own canonical changes. Feedback owns discussion and approval. Reports owns read-only summaries.

## Ownership

| Capability | Owner | Refine relationship |
| --- | --- | --- |
| Lessons and CraftLoop | Learn | Refine links out when practice is useful |
| Research, canon, story experience, theme, motifs, and voice definitions | Plan | Refine reads the same evidence |
| Visual Bible, Shot Designer, and Animatic | Storyboard | Refine may identify visual or page symptoms |
| Screenplay text and final dialogue | Write | Refine produces page and dialogue evidence or proposals |
| Logline, pitch package, comic deck, and exports | Pitch | Refine does not package or export pitches |
| Sonic Bible, breakdowns, shoot groups, schedule, and distribution plan | Build | Refine diagnoses structure; Reports summarizes production |
| Anchored comments, revision comparisons, and saved-pass decisions | Feedback | Refine sends proposals through an explicit approval gate |
| Production and provenance summaries | Reports | Reports is read-only and links to the owning editor |

Stable project IDs and existing canonical services remain in use throughout.

## Refine structure

Refine presents seven diagnostic passes:

1. Overview and diagnostic queue
2. Structure and pacing diagnostics
3. Story and theme through Resonance
4. Character and dialogue diagnostics
5. Page and scene diagnostics through PageFlow
6. Full-draft diagnosis through DraftLens
7. Revision passes and the Essential Craft Audit

Resonance and PageFlow read canonical story and screenplay evidence without directly rewriting it. DraftLens may record diagnostic notes and bounded revision proposals, but canonical changes are completed in their owning workspace.

## Approval and safety

Specialist suggestions remain temporary. A lab outside Feedback stores a project-scoped pending proposal and sends it to Feedback. Only an explicit approval action in Feedback may apply the existing specialist suggestion operation. Discarding a suggestion removes the pending proposal. No AI, GitHub, or specialist tool is required for the core workflow, and no suggestion changes canonical content silently.

## Reports boundary

Production Reports no longer accepts a project mutation callback. Shoot-group acceptance, rejection, reset, manual scene adjustment, and producer notes live in Build Production Planning. Reports displays those decisions and provides a context link back to Build.

Provenance is a read-only Reports section derived from the existing rights, attribution, and AI-provenance records.

## Navigation

The primary sequence remains unchanged:

Dashboard, Learn, Plan, Storyboard, Write, Pitch, Build, Feedback, Refine, Reports.

Workspace query links open the requested owner while preserving one application shell and one active project.
