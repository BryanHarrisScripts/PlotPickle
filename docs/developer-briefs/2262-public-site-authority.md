# Developer Brief — #2262 PlotPickle.com GitHub Authority

## Decision

GitHub `main` is the canonical source for PlotPickle.com. ChatGPT Sites is the hosting and Human-controlled publication surface.

The public website is a deliberate projection of the PlotPickle repository, not a second application authority. Direct prompt-only Sites edits are non-authoritative unless they are brought back into GitHub before publication.

## Reconciliation evidence

On 2026-09-19 the live site exposed the newer public narrative headed by “Storywriting has changed. Now shape it.” while the checked-in marketing source used the older “Storytelling Has Changed / Write the narrative. Shape the vision.” presentation.

The implementation therefore checks the selected live narrative into `app/site/` and routes the production custom domain root to that source while preserving the local application root on loopback hosts.

The existing Sites project binding remains:

`appgprj_6a5e2646a06081918b0f4809b6af5cc6`

No project or domain replacement is authorized by this issue.

## Publication contract

`GitHub source → verified exact-commit build → saved Sites version → Human review → Sites deploy → plotpickle.com`

The build stamps `public/source.json` with the source commit. `scripts/verify-public-site-drift.mjs` compares production provenance with an expected commit and fails visibly on drift.

## Public corpus

`content/blog/posts.json` is the initial repository-owned Blog corpus.

Public projections include:

- `/blog`
- `/blog/<slug>`
- `/blog/feed.xml`
- `/blog/index.json`
- `/llms.txt`
- `/sitemap.xml`
- `/robots.txt`
- `/source.json` generated from the build commit.

## OSS Radar

OSS Radar remains internal architecture intelligence. It now emits `public-blog-draft.md` as a Human-review artifact. The draft strips internal scoring/roadmap authority and cannot publish itself.

## Application boundary

There is no Dashboard Blog and no in-application OSS Radar reader. Public routes bypass the local profile gate and legacy onboarding surface while local application routes retain their existing authority.

## Verification

Focused regression:

`node --test tests/issue-2262-public-site-authority.test.mjs`

Full merge authority remains exact-head Architecture Verification.
