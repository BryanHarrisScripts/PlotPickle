# #3096 — Experimental Engineering Team: developer brief and acceptance map

Status: implementation underway; contract foundation does **not** equal a live autonomous team.
Parent: https://github.com/BryanHarrisScripts/PlotPickle/issues/3096
Date: 2026-10-18

## Decision

Extend PlotPickle's existing Responsibility Runs/Graphs, Pi Durable task
execution, Pi/Cline developer workers, autonomous QA, BEN, the ratified
performance baselines, BUZZ local evidence, and GitHub exact-head gates.
Do not install another agent factory, require one Linux VM per worker, or use
private IRC. The experiment is about communication and independent reasoning,
not a second permissions or merge system.

BUZZ's operational reporting code currently records sanitized local events.
An automated agent may not silently use the authenticated Human's BUZZ
signer; an external signed message requires real agent identity and separate
approval. Local evidence receipts are not external delivery receipts.

## Team and independent execution contracts

| Role | Existing execution owner | Permitted output |
| --- | --- | --- |
| Scout | Pi read-only review / repository scan | Candidate risks, paths and evidence refs |
| Tester | Autonomous QA / deterministic UAT | Exact-SHA reproductions and failures |
| Performance | BEN/performance baseline | Measured regressions against same workload |
| Challenger | Independent Pi/Cline read-only invocation | Supported, disputed or blocked claims |
| Maintainer | Evidence-learning maintainer | Source-provenanced architecture/skill suggestions |
| Reporter | Existing GitHub issue/PR publication wrapper | Only verified, deduplicated evidence |
| Repairer | Existing Pi/Cline isolated worktree repair | Fix proposals only, independently retested |

Named roles are scheduling capabilities, not automatically seven running model
processes. Their runtime identity and source I/O are checked individually.
An omitted role adapter must report BLOCKED.

## Package ordering

A. Contract + risk evidence: admitted exact SHA, task, role, budget and
readonly source scope; signed/outbound messaging and source mutation denied.
Advisory observations, lossy/structured summaries, independent corroboration,
same-input experiments. Prove failure paths with focused Node tests.

B. Host execution: bind those contracts to approved Responsibility Graph child
runs, isolated provider/tool grants and Pi Durable task checkpoints. Retry-safe
reopen only; fail closed on stale head, cancelled lease, replay or unsupported
tool. Runtime readiness isn't I/O proof.

C. Reviewer/tester adapters: use existing registered autonomous QA, BEN,
performance, Pi read-only and (if actually configured) Cline capabilities.
Dedupe by exact task/head/finding. Never use one worker or model's claimed
success to verify itself. All real routes require fresh device/source evidence.

D. BUZZ coordination: local signed-attribution provenance with compact
summaries, references and challenge receipts. Optional remote agent speech
only with verified distinct agent signer, authorized room and read-back.
Do not publish actual private code/story context into public Community.

E. Lossy-vs-structured study: freeze same PR SHA and budget; randomize run
ordering; record actual message sizes, tokens, wall duration, verifier-confirmed
defect discoveries, false positives and disagreement rate. A lossy summary
is informational only; the immutable original ledger remains authority.
Report results, not an invented statistical winner.

F. Existing GitHub/scheduler bridge: opt-in PR-head checks, main wake, nightly
depth and on-demand runs with existing #1571 scheduler. GH issue/PR
comment publication requires verified evidence and allowed GitHub credential.
The team never merges its own PR. A subsequent repair uses the existing
bounded worktree and exact head CI.

G. Advanced Settings/Command observability: enable/stop, no model requests at
startup, linked run receipts and signer/provider/coverage status, plain
BLOCKED/SKIPPED/UNKNOWN semantics.

H. Independent Windows product proof: real Pi and Cline role I/O, user-bound
BUZZ roundtrip (only after consent), interrupted resume and duplicate
suppression; performance across fixed baseline; hosted GitHub PR gate and
Product Gate on exact head. Only then label the end-to-end team operational.

## Exact proof matrix

1. Head A success must not apply to head B or another project/task/actor.
2. A model's review or self-generated test PASS cannot become verified without
   a distinct tester, distinct challenger and third independent deterministic
   verifier at the same commit.
3. Disproving observation prevents publishability despite three prior
   positive opinions until a new independently adjudicated resolution.
4. Lossy mode strips reference payload only from the message, never the
   underlying source ledger or the exact-head verifier.
5. Budget overflow, missing signers, unreadable archives, unknown roles,
   provider mismatch and unregistered tool escalations fail closed.
6. No automatic pay-per-token work, BUZZ external send, cloud VM/daemon
   installs, Human credentials or repository mutation.
7. Evidence-backed reporter output is deduplicated; GitHub remains sole
   issue, PR, CI and merge-state authority.
8. Reopen/resume proof requires real Pi Durable Windows task recovery,
   not a JSON serializability fixture alone.
9. Trial results separately label synthetic CI, real local Windows, remote
   BUZZ roundtrip and exact-head GitHub checks.

## Phase 1 implementation boundary

The first implementation ships standalone source-owned admission/observation/
handoff/adjudication/comparison contracts with focused negative tests. It
does not run models, open or comment on PRs, post BUZZ, schedule unattended
work, modify code or claim a completed end-to-end engineering campaign.
No new merge gate or runtime dependency is added. Later packages must
reuse these contracts rather than fabricate success.

## Related source and follow-up

- docs/architecture/developer-agent-stack.md
- docs/buzz-guildhall.md
- docs/buzz-live-health.md
- docs/buzz-mastra-orchestration.md
- docs/performance/1411-ratified-baseline.md
- build/autonomous-guest/qa/
- scripts/run-pi-code-quality-review.mjs
- scripts/run-uat-repair-agent.mjs
- scripts/autonomous-qa/publish-defect.mjs
- #1571, #1592, #3008, #3024

Completion rule: run the relevant focused tests, production build and exact-head
GitHub gates before merge. Keep #3096 open until packages B–H have actual
operational and independent device evidence; do not close on a documentation
or contract PR.
