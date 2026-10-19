# #3126 — Engineering Team evidence state and fresh restart

Parent #3110 (human-governed autonomous Software Factory); research comparison #3117; initial real Story Factory failure #3123.

## Assessment

PlotPickle already has an explicitly admitted Engineering Team (`scripts/engineering-team/run-local.mjs`), a native opt-in Pi Durable checkpoint (`scripts/engineering-team/durable-checkpoint.mjs`), separate Tester/Challenger roles, private role receipts, read-only operator reporting, focused UAT and exact-head independent GitHub gates. Do not install another software factory, change AGENTS.md, create competing shell transport, add paid inference, or let the agent grant itself repair/merge authority.

The missing seam is a **compact, durable, private, exact-head input for a fresh Engineering Team worker**. Existing role receipts include prose; handing full previous model reasoning into a new turn causes anchoring and could disclose Human story material. A checkpoint can state only trusted scope, typed agent observations, evidence references, blocked approaches and explicit unproven product gates. The original immutable test oracle remains outside model control.

## Behavior

- After each explicitly admitted Engineering Team outcome, write a once-only `evidence-state.json` (or `resume-evidence-state.json` on explicit durable recovery) beside the existing private run receipt. Never overwrite or silently replay a previous task.
- The packet pins campaign, task, scope SHA-256 and exact 40-character head, plus bounded role/observation IDs and opaque evidence references. It strips model summaries, prompts, private file contents, executor logs, account information and raw exceptions. Classified exception codes are the only allowed failure descriptions.
- Every packet carries `restartContext: evidence-refs-only`, `originalTestOracle: unchanged`, `startedUncertainMayReplay: false`, `sourceMutationAllowed: false`, `modelDispatchAuthorized: false`, `paidDispatchAuthorized: false`, `independentProductVerification: unproven`, `mergeEligible: false`. Even observed roles cannot turn product state PASS.
- Expose a **read-only** operator command: `node scripts/engineering-team/operator-reporting.mjs --fresh-restart --scope <64hex> --head <40hex>`. The tool opens only the private scoped file under the existing per-user app root; requires exact head/scope, regular private files and hash match, rejects symlinks, unexpected fields and excess size, and never starts a provider or worker.
- A fresh worker may use this reference-only packet as evidence scope while separately requesting approved tools and maintaining the Pi Durable started-uncertain no-replay barrier. This slice does not itself attach an agent to a Windows host or generate/merge a patch.

## Source-driven case fixture

#3123 supplied owner Windows 55-checkpoint / six-fail UAT: selected project and registry expectation are true before Outline, while session selection and expected registry entry disappear as Outline renders; profile marker and parseable registry remain. The synthetic #3126 fixture uses only `issue-3123` and safe opaque evidence references. No story bytes, private project IDs, screenshots, vault state, or full prior model summary are ingested.

## Acceptance and product proof boundary

CI bound to approved WHITE-PAPER-V3 W8/W9 and exact source/test digests checks a valid packet, multiple role refs, no private prose, tamper/stale-head/foreign-scope/symlink/oversize denial, classified started-uncertain failure and observation-vs-product PASS separation. Normal Engineering Team start, stop, external Chat control, inference and actual Windows browser UAT are NOT performed by these fixture tests.

Merge only if exact-head architecture, BEN, convergence and required product gates are green. After merge, future #3110 increments must (1) verify pairing/authenticated Windows task transport, (2) permit a scoped agent repair worktree through existing mutation authority, (3) independently verify #3123's original 55/55 Windows browser checkpoints and STOP before product issue closure. The present increment is real software factory *evidence infrastructure*, NOT the completed autonomous Software Factory.
