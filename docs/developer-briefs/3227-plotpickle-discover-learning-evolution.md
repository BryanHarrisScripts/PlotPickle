# Developer Brief — PlotPickle Discover and Learning & Evolution Factory

Date: 2026-10-22
Parent: #3227
Status: PRODUCT DIRECTION / IMPLEMENTATION IN SLICES (not a claim of deployed functionality)

## Human intent

Build a living, source-linked discovery journal inside PlotPickle, connected to a truthful capability map. Creators should discover current filmmaking practice, screenplay craft, Blender/3D, lighting, blocking, directing, editing, sound, accessible methods, AI media and open-source tools. They should see what PlotPickle verifiably supports, what has an equivalent, what is still research, and what was deliberately not adopted. Keep learning from the community without silently changing PlotPickle.

## Two distinct outputs from one evidence system

1. **Discover journal:** readable, searchable entries with a dated headline, short copyright-safe original summary, source link, source type and publisher, date checked, relevance to story creation, and related LEARN / production domains. Include OSS and professional/primary craft sources; a GitHub README alone does not establish professional film practice.
2. **Capability map:** domain and concrete capability, PlotPickle-owning module/contract, current evidence/commit, status, comparison with an external technique, duplications/equivalents, limitations and next review. A research score is NOT a product verification score.

These outputs use OSS RADAR discovery and the #3227 evidence artifact for candidate inputs. Do not invent a second scheduler, product database, curriculum authority or automatically published blog.

## Candidate and capability states

Separate research lifecycle from implementation and verification:

- Research: NEW / EVIDENCE_INCOMPLETE / REVIEW_REQUIRED / REVIEWED / DECLINED.
- Product alignment: VERIFIED_NATIVE, VERIFIED_EQUIVALENT, EXTERNAL_OPTION, PROPOSED, DUPLICATE, DECLINED, UNKNOWN.
- Only VERIFIED_NATIVE and VERIFIED_EQUIVALENT display a user-facing check. Verification requires a current named owning module, exact commit, independent automated proof and real product acceptance when applicable. Status reverts to UNKNOWN when evidence expires or the owning implementation is removed.
- Never infer a PlotPickle feature from a source link, a proposal, a README claim, an AI score or a GitHub issue. A duplicate means intentionally covered elsewhere, not that a missing tool is implemented.

## Ownership and boundaries

- Research discovery: existing `.github/workflows/oss-radar.yml` and `lib/verification/oss-radar/` (daily 04:24 America/Toronto). This remains evidence-only.
- Candidate handoff: #3227 `learning-evolution-proposals.json` and `learning-evolution-review.md` in the existing Radar Actions artifact. Initial slice is not an in-app or published journal.
- Editorial/catalog authority: a separately Human-approved, versioned Discover catalog. A subsequent implementation may generate drafts from Radar artifacts, but publishing requires explicit review, preserves source lineage and rejects stale/spoofed/uncited entries.
- LEARN remains the canonical curriculum. Approved lessons, exercises, Skills or contextual help require separately reviewed original authoring and assessment.
- Software changes use the Software Factory's exact-head PR and Windows UAT gates, not the research workflow. No auto-clone/execute/install/merge, no paid provider calls, no PPF or creator canon mutation.
- Existing public site Blog (`content/blog/posts.json`) is a different authority and must not be automatically repurposed or published from the in-app journal.
- Honor LOCKED `docs/PLOTPICKLE-PRODUCT-CONTRACT.md`; an EXPLORE route must preserve the one-application experience and its existing navigation commitments.

## Next scoped delivery: in-app Discover (not implemented by the #3227 artifact PR)

Add EXPLORE > Discover as a read-only surface using existing skin navigation patterns. Provide a search/filterable journal and an adjacent capability map, a provenance/detail panel, and clear states for no data, stale research, source unavailable, and unknown capability evidence. The list must work without a loaded story, and must return safely to the Dashboard. Do not include fake successes or display a green check for proposed functionality.

Each entry: stable ID, title, category, source URL, published/checked dates, summary, editorial state, matched PlotPickle areas, evidence references, linked capability IDs, and decision history. Avoid collecting private project data. Deduplicate by canonical upstream source and topic; do not erase alternate viewpoints.

First in-app acceptance: no new user startup mode; read-only and browser-accessible from the existing MAIN/UAT app; search and filters work by keyboard; original source links are safe; capability status is evidence-backed or UNKNOWN; source failures are explicit; both empty and populated states render; Dashboard/Library/session continuity survives Back and F5; exact-head CI and genuine Windows browser UAT pass. No merge on synthetic-only evidence.

## Subsequent stages

1. Import/review approved discoveries from Radar and professional film sources through a bounded, source-backed editorial ingest; keep all original-source URLs.
2. Human review actions (accept research, request evidence, decline, propose authored lesson or product improvement), with a versioned decision ledger separate from publishing.
3. Compare against LEARN modules and existing capabilities; route approved lesson drafts or OSS/product changes to their respective owners.
4. Measure actual learning outcomes, accessibility, creator feedback and product improvement; retain corrections and source freshness; never claim model self-improvement from research count alone.

## First-slice proof

The #3227 source change only exports a deterministic read-only proposal projection from the existing Creative Focus Top 3 to the existing Actions artifact. Its tests challenge absent README, URL spoofing, duplicates, missing curriculum matches, unsupported domains, no candidates, and preservation of the existing report. Passing these tests does not mean the Discover UI or independent Windows acceptance is complete.
