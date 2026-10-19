# PlotPickle Software Factory — autonomous engineering delivery brief (2026-10-19)

Parent: #3110. Existing dependent work: #3100, #3118, #3123, #3128, #3135, #3141. Research-only: #3117.
Owner intent: One Start command in CMD or the PlotPickle UI operates a durable local engineering worker which selects eligible GitHub issues, changes source in isolated worktrees, builds/tests/repairs, opens a PR, waits for independent exact-head green gates, merges, records results and advances to the next issue. It can also identify reproducible product defects and file deduplicated issues through an authorized GitHub boundary.

## Baseline and non-claims
- Already present: explicitly admitted Engineering Team runner (`scripts/engineering-team/run-local.mjs`), Pi Durable opt-in checkpoint, Tester/Challenger receipts, exact-head CI gates, limited Windows UAT control (`scripts/windows-uat-control.mjs`) and manually polled authenticated GitHub-to-Windows start/status/stop (`scripts/engineering-team/windows/paired-github-control.mjs`).
- `docs/developer-briefs/3110-authenticated-windows-github-control.md` expressly says this is **not** an always-on Windows service and has no autonomous repair dispatch or merge authority.
- `docs/developer-briefs/3126-engineering-evidence-fresh-restart.md` explicitly separates durable evidence infrastructure from source mutation, model dispatch and independent product proof.
- `app/skin-v1/help-issue-log-skin-panel.tsx` currently copies a sanitized draft; it does **not** submit to GitHub.
- The exact product build and live Windows acceptance gates cannot be marked green by an agent's assertions. This brief is a plan, not evidence the factory is operational.

## Product contracts
1. **One authority, two interfaces.** The CMD and in-product GUI use the same authenticated local service and queue state. Proposed operator UX: `plotpickle factory start|status|pause|resume|stop`; command spelling is not implemented until tested. GUI shows exact issue, worker state, PID/process scope, head SHA, evidence, attempt, PR and gate verdict.
2. **Independent of the browser.** A Windows service/scheduled agent runs in the user's authorized session or controlled service identity, heartbeat/restarts cleanly, survives browser closure and machine reboot, and persists leases and checkpoints with no ambiguous replay of source edits or merges.
3. **Durable queue.** Fetch eligible open GitHub issues via authenticated API, respect dependencies/priority/labels/holds, take a single lease, pin issue revision/base/head, deduplicate and enforce bounded retries. New issues are not trusted shell instructions.
4. **Repair loop.** Dispatch a deliberately authorized Pi/Cline/OpenAI-capable source-editing worker into a scoped worktree. Require source diff, bounded build/test cycles, failure classification, fresh-evidence restart and explicit exit when blocked. No agent-written test may substitute for the independent oracle.
5. **Independent verification.** Build, unit/integration/contract CI, exact-head W8/W9 truth gates, and real Windows/browser UAT where required. Missing, stale, cancelled or uncertain results are NOT GREEN. Test owner machine paths and stop semantics for #3123.
6. **PR and merge controller.** Open a PR against main; wait for exact commit SHA checks and required reviews/policy; merge only when all required gates independently pass and branch is mergeable. If head changes, invalidate old evidence and reverify. Finalize issue closure after observing merge and recording receipt.
7. **Self-reporting issues.** Reproduce failures; sanitize private paths, tokens, unpublished project/story content and PII; attach safe minimal logs/test case/evidence references; search for duplicates; create/update GitHub issue with provenance and a severity label via a restricted mutation boundary. Offer GUI issue submission with explicit authorization; a copied draft must never be shown as submitted.
8. **Operator control.** Start/Pause/Resume/Stop/Emergency Stop, current task and reason, owned process-tree termination and independently verified descendant cleanup, bounded concurrency, rate/spend caps set by owner, merge authority policy, audit trail, blocked queue, and a manual override for high-risk changes. Stop cannot target arbitrary PIDs.
9. **No false completion.** Product dashboard distinguishes PLANNED, IMPLEMENTED, INTEGRATION-TESTED, WINDOWS-VERIFIED, END-TO-END-VERIFIED and BLOCKED. A green fixture is never sufficient to claim a functioning unattended factory.

## Phases and acceptance gates

### Phase 1 — Windows lifecycle foundation (#3110, #3135)
Install/configure persistent authorized host worker; durable single-instance lock, heartbeat, retry and reboot recovery, owned process tree and STOP receipt. Prove on real Windows: start, status, pause, resume, stop, crash/reboot recovery and no orphan descendants. Pairing remains explicit, revocable and secure.
**Exit:** independent native-Windows evidence for lifecycle and exact worker identity.

### Phase 2 — Backlog orchestration (#3100, #3110)
Issue eligibility filter and priority/dependency DAG; lease/lock/retry/dead-letter queue; durable issue snapshot and per-attempt audit. Implement continuous dequeue only after worker health and manual consent. Hold/blocked issues are never silently treated as complete.
**Exit:** restart-safe queue replay and deduplication proven with competing-worker and lost-heartbeat tests.

### Phase 3 — Source-editing agent (#3128)
Bind existing Engineering Team to authenticated scoped source-editing tools and model selection; check out isolated worktree, apply patch, run build/tests, classify failures, retry with limited budget, produce reviewable diff and evidence-only restart. Separate editor from Tester/Challenger.
**Exit:** real issue repair creates a source change and passes focused tests without a human writing it.

### Phase 4 — Verifier, PR, merge and advance (#3118, #3128, #3141)
Independent checks bound to exact-head, native Windows browser/product verification where applicable, create/update PR, inspect required status checks and branch protection, merge only if all gates pass, observe merge/issue closure, then select next eligible issue. Force stale/false green and changed-head negative tests.
**Exit:** uninterrupted real issue -> patch -> build/test/fix -> PR -> independently green -> merge -> next-issue admission, with failure cases blocking merge.

### Phase 5 — CMD/GUI and defect intake (new follow-up issues if missing)
Expose same authenticated factory operations through CMD and PlotPickle GUI. Display live receipts not optimistic states. Connect a sanitized and deduplicated issue creation endpoint, including defects discovered by browser UAT and agent diagnostics. Guard against ticket storms, secrets and issue-body prompt injection.
**Exit:** user can start/stop and inspect one real run from both interfaces; reproducible defect creates exactly one GitHub ticket and appears in queue subject to eligibility.

### Phase 6 — Unattended campaign proof (#3141, #3123)
Run a bounded campaign of multiple genuinely separate eligible issues, one failure/retry, one Windows/browser UAT, one safe merge and automatic next-issue selection. Power/browser loss and interrupted merges are tested. Track resolution rate, time, compute, false-green rate, reproducibility and original-oracle pass. Do not imply a 37-issue backlog has been processed unless per-issue receipts prove it.
**Exit:** operator authorizes unattended mode; persistent worker demonstrates several consecutive independently verified end-to-end cycles and correct stop/blocked behavior.

## Execution order
1. Keep and refine existing #3110, #3135, #3100, #3128, #3118 and #3141; avoid competing implementations.
2. File only absent work for a persistent service/operator surface and the GUI-to-GitHub defect route.
3. Complete Phase 1 real Windows proof before enabling an unattended mutation or merge worker.
4. Use #3141 as a narrow docs-only dry pilot, then a separate real source repair with #3123 original product oracle.
5. Enable continuous backlog after policy and end-to-end evidence—not by switching on a boolean without proof.

## Stop/merge invariants
- Stop affects only this worker's cryptographically/scoped-owned process tree; unknown ownership fails closed.
- An issue, PR or model output cannot authorize arbitrary shell commands or grant its own merge privilege.
- A missing check, stale head, fabricated PASS, uncertain Windows UAT, pending review, conflicts, expired token or missing protected-branch requirement blocks merge.
- Exactly one active lease per issue and one merge transaction per accepted head; no replay after uncertain completion.
- Any newly created GitHub issue is evidence-backed, sanitized and deduplicated before entering the queue.
- Record observed status separately from inferred or proposed status.
