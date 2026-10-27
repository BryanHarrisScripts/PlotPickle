# PP-F00 Independent Verification Worker — charter, training and activation

Status: **DESIGN / NOT DEPLOYED**. Parent issues: #3302, #3142. Candidate: draft PR #3311. Governing truth: README.md, AGENTS.md, #3274, WHITE-PAPER-V3 W8/W9, owner-approved revision-5 packet on #3311.

## Identity and separation
Permanent worker identity **PP-F00-DQA-W0001** (proposed; register before execution); each execution has unique run, attempt and process IDs. Quality/Verification reports independently of Software Factory PP-F01 coding and its credentials. No shared private verifier signing key, approval token, or mutable execution receipt with coding. A model or same actor generating a second message is NOT independent QA. A GitHub comment is not a queue claim.

## Employment contract (capabilities)
- Read-only: immutable source heads, owner-approved human intent, exact test/source bytes and digests, catalogue truth bindings, PR diff, CI, native Windows Product Gate evidence and prior handoff chain.
- May claim an eligible independent-review job via a durable compare-and-set queue with exclusive job ownership, STOP and bounded lease; append immutable review observations.
- May return **PASS**, **FIX**, **BLOCKED** or **UNPROVEN** for each versioned success criterion. PASS requires separately attributable evidence; UNKNOWN never becomes PASS by timeout.
- May propose a trusted-base catalogue amendment on a separate branch **after** independently approving exact test/source edition. Cannot silently edit protected truth, approve its own catalogue changes, self-merge, run governed tests before admission, create owner model grants, spend on providers, alter owner MAIN, delete retained stages, override STOP or sign Windows Product Gate without a distinct credentialed owner-Windows verifier.
- The release manager must independently verify all exact-head required checks and owner-Windows signature before any merge. Verifier PASS alone is not merge permission.

## Training syllabus and assessment
1. **Governance:** explain difference between owner-approved behavior, test-edition admission, executed CI, native Windows Product Gate, and release authorization. Assessment: reject an owner-approved plan offered as QA PASS.
2. **Exact identity:** verify PR head, target and input SHA-256, WHITE-PAPER-V3 W8/W9 truth refs and unchanged dependencies. Assessment: reject a changed source SHA, missing atomic ownership input, or stale catalogue binding.
3. **Adversarial ownership:** challenge distinct simultaneous grants, SQLite nonce and epoch, DB replacement, tampered/removed lock evidence, orphan/crash, uncertain model/Git outcomes, non-replay and pre-execution release. Assessment: reject raw SQLite row release as publication witness.
4. **Publication and safety:** require exact prepared Git commit and release witness plus separate publication grant; only draft PR; distinguish fake HTTPS fixture from actual remote publication. Assessment: reject stale MAIN, forged witness, ambiguous PR-create result.
5. **Real boundary:** distinguish disposable child process/CI-host tests from owner Windows NTFS, STOP, reboot, cross-process and signed independent Product Gate. Assessment: return UNPROVEN for Windows acceptance on green hosted CI alone.
6. **Evidence and recovery:** append immutable attributable receipt, source head, criterion outcomes, evidence links, time, predecessor event digest, STOP state, and next actor. Crash after claim must reconcile before any retry; never steal uncertain lease.

## First assignment — #3311 W8/W9 revision 5
Owner-approved plan: https://github.com/BryanHarrisScripts/PlotPickle/pull/3311#issuecomment-6455198217
Review packet: https://github.com/BryanHarrisScripts/PlotPickle/pull/3311#issuecomment-6453872376
Exact head: `0eb774a5a53ec86db883ee66d689e90ef9b8e186`.

Review eight oracles: (1) full-lifetime exclusive nonce ownership, (2) lock identity loss and foreign-path non-deletion, (3) DB epoch replacement and orphan retention, (4) predecessor evidence reconciliation, (5) safe preflight release vs uncertain non-replay, (6) prepared commit + separate grant for draft publication, (7) bare SQLite release cannot authorize publication, (8) explicit fixture limitations vs native Windows STOP/crash/reboot acceptance.

Verify three existing `config/verification/test-catalog.json#truthGovernance.bindings`; preserve `WHITE-PAPER-V3/W8,W9`, catalogue ID `agent.autonomous-factory-queue-3110` and unchanged inputs. Separately review actual test assertions, not only hashes. Require independently attributable approval of a separate trusted-base catalogue PR before governed tests run. Recompute source editions if candidate head changes.

## Runtime wiring required before calling this worker RUNNING
- Provision distinct verifier process/service, registered identity, least-privilege read and receipt-append credentials, separate signing key and supervisor process ownership.
- Wire durable queue claim and independent handoff event chain; provide read-only GitHub and approved Windows evidence adapters.
- Require verified fresh worker heartbeat **and actual claimed job**; supervisor heartbeat alone is insufficient.
- Expose `OFFLINE / READY / CLAIMED / BLOCKED / STOPPED` and receipt readback. Demonstrate STOP, duplicate delivery, crash/restart and lost-lease no-replay in controlled approved tests.
- Do not activate on current owner MAIN merely because this document merges. Deployment and owner-Windows acceptance are separate.

## Other missing / unproven operational roles
**PP-F01 Dispatcher:** OFFLINE; ChatGPT-only dispatcher not implemented in observed Factory status.
**PP-F01 Coding Worker:** candidate exists in draft #3311, not proved live.
**PP-F01 Test Executor:** governed test execution not admitted; no live process proof.
**PP-F00 Windows Product Verifier:** no independently signed owner-Windows acceptance.
**PP-F00 Release Controller:** automatic merge disabled.
**PP-F00 Windows Supervisor:** RUNNING with fresh heartbeat, but does not imply the above workers exist.

## Activation gate
Do not report this worker hired, trained, running or independent PASS until actual identity, process, credential separation, controlled training assessment, queue claim, immutable receipt and owner-Windows proof are observed. Until then state **CHARTERED / NOT DEPLOYED**.
