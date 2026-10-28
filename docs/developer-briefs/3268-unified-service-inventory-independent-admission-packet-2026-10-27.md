# Independent admission packet — #3268 unified read-only service inventory

**Request:** Independent WHITE-PAPER-V3 W8/W9 test-truth admission for one new test edition; reviewer must not be the author of this PR. This is a **request for review, not an ADMIT verdict**. Owner: #3268; related independent QA #3302, Software Factory #3142.

## Exact source editions before this packet

The latest source and regression editions were pinned at `83d12dfbc2ac371d19a291895919659b7e24b6d9` before this packet update; the current PR head must still be rechecked. Re-fetch the current PR SHA and verify Git blob IDs and **independent SHA-256** of each file at review time. The source contents are not permitted to drift silently.

| Scope | File | Git blob SHA |
| --- | --- | --- |
| New test | `tests/issue-3268-unified-service-inventory.test.mjs` | `b12eed2cbf37fb1cb52a030d32ef96c748c4d984` |
| Implementation | `core/sidecars/runtime/unified-service-inventory.mjs` | `c4d3b3ac0f1e7392deebd9c6f89bd714ded51a40` |
| Read-only CLI | `scripts/engineering-team/windows/services/inspect-unified-services.mjs` | `b939957c37c06ab696e79bbde2a145585f664388` |
| Existing dependency | `core/sidecars/runtime/service-registry.mjs` | `021dbf1d9a729109d3fa2eae55034be20b31e29a` |
| Existing source inventory | `config/runtime-sidecars.json` | `cc60ff0815f712fcaa7ce6653d693ee0c1780d2d` |
| Existing managed components | `config/runtime-manifest.json` | `bdf403244ee36ee180c40dd1ad4de6bf6fffb961` |

## Normative scope and proposed assertions

- **W8 independent verification:** Do not confuse a source-local heartbeat, local listener or status file with independently verified process ownership, model execution, remote authentication, coding, signed test admission or Windows Product Gate. No self-assigned PASS/ADMIT.
- **W9 preserved obligations/stale evidence:** Unrecognized IDs, malformed status, stale/incorrect exact head, invalid data, replay/unknown process state and duplicate source entries must not turn a component READY or silently alter established approved tests. A planned factory listing is not an operational claim.
- **Existing runtime contract:** #2693/#2694 six governed sidecars remain owned by the current sidecar supervisor, and `config/runtime-manifest.json` owns the broader managed component declarations. No extra launcher, credential store, headless model dispatcher or second tunnel.

The 21 source-linked test cases cover registry composition, default unproven status, fresh-but-untrusted sidecar `ready`, forged supervisor acceptance, stale head/heartbeat, forged remote tunnel authorization, stale status, duplicate/unknown reports, duplicate/malformed service IDs, unsafe sidecar entrypoint, fixed-source CLI no-elevation inspection, unavailable sources, and actual six-sidecar/four-factory inventory without extra execution capability.

## Known limitations the independent reviewer must inspect

1. The author's in-memory V8 fixture execution registered 20/20 PASS; this was a **source-equivalent simulation**, **not Node's actual test runner**, hosted exact-head CI, independent QA or native Windows owner-product evidence.
2. The file/status sources are read-only projections and **do not cryptographically attest** to process ownership or remote plugin authorization. The inventory consequently returns zero proven-operational components, even for reported `ready` or `RUNNING` states.
3. `inspect-unified-services.mjs` is a fixed `--status` diagnostic, not the always-on Windows Service Manager or an installer. It does not replace existing supervisors or modify the owner's current tasks, tunnel or machine.
4. Direct file symlinks are rejected in the CLI. Windows parent-directory reparse-point handling, packaging, SCM identity/process-tree, restart/STOP and source-head witness are **not proved**. Read-only status alone must not become an action authorization or standalone verifier credential.
5. The new test is **not in the protected test-truth catalogue**. Do not mutate `config/verification/test-catalog.json` based on the author's review or bypass the admission gate. Independent reviewer must produce attributable `ADMIT`, `FIX`, `REJECT`, or `UNPROVEN` for exact assertions and input digests before an independently authorized maintainer adds bindings.
6. The shared factory lifecycle brief specifies common work-order stages while keeping Software, Learning, Story and Game domain acceptance distinct. The implementation only inventories those factories; no work-order engine or factory worker has been activated.

**Requested review outcome:** test edition truth/inputs, domain ownership/privilege boundary, and negative evidence scope. Until independently admitted, keep the implementation PR **DRAFT, unmerged and with no service installation or work authorization**.

## STOP-marker extension

Four additional cases cover a **present** existing `engineering-team/supervisor/stop-request.json` marker winning over an otherwise fresh RUNNING heartbeat; an unreadable marker remaining BLOCKED; the fixed-path read-only inspector observing STOP without parsing marker secrets; and STOP persisting in the inventory when no heartbeat exists. The marker is not cleared, modified or treated as an independent process-ownership receipt. A read of `PRESENT` is conservatively blocking; `ABSENT` is never permission to start.

The recorded 18/18 result is an *author-run in-memory V8 source-equivalent fixture*, not the Node test runner or an independent W8/W9 ADMIT. Review the four new assertions and source editions above prior to any catalogue update.

## Candidate exact-source SHA-256 digest set (author-calculated, independently recompute)

The following SHA-256 values were calculated from the exact GitHub UTF-8 file contents (not from git blob IDs). This aids a separate reviewer but **does not constitute an independent signature or ADMIT**.

| Evidence file | SHA-256 |
| --- | --- |
| `tests/issue-3268-unified-service-inventory.test.mjs` | `f3c53fa592fd2fda51b5a1d959098e3f6e66b5dbda7caf3fb639d4bef6220a27` |
| `core/sidecars/runtime/unified-service-inventory.mjs` | `10eadf51cff4ede8bd404bcc16ccdd49ec3832829420eee6faee54d5610db261` |
| `scripts/engineering-team/windows/services/inspect-unified-services.mjs` | `efdabe90b98d6c508ef09d1c70f0d3e0c83e8f02191240e4abfe48af4dde5224` |
| `core/sidecars/runtime/service-registry.mjs` | `64f4d72796a55d9bb535913035aed1d5a7f32d979354636650f44b1cc1c618a2` |
| `config/runtime-sidecars.json` | `3f9a5f25f916ccf295441e7c005a88c0edb19f66961b1db94a70dec6a6c648c8` |
| `config/runtime-manifest.json` | `cc9c40bbab3c416e2106aaa8e98cea0dad83c5f09810cb4f64416736bd40aadf` |

**Approved normative source:** `WHITE-PAPER-V3` version 3.0, `docs/white-papers/AI_Programming_Evolution_White_Paper.md`; recomputed SHA-256 `7fd538b813014cf94505903a32e171fca344068d67d15036fbe0fdcb7859c27d` **matches** the already approved `config/verification/test-catalog.json` truth's `sourceDigest`. The obligations are W8 and W9; these are *candidate mappings only*. No bound edition exists for this new test yet.

**Review-only candidate binding:** `target` equals the new test path above; `targetDigest` equals its SHA-256 above; proposed `truthRefs` are `[{truthId:"WHITE-PAPER-V3",obligationId:"W8"},{truthId:"WHITE-PAPER-V3",obligationId:"W9"}]`. The source `inputs` list contains all five other SHA-256 files in this table. Potential existing owner catalogue IDs for independent consideration are `production.modular-runtime-2697`, `agent.persistent-windows-supervisor-3110`, and `agent.settings-compute-tunnel-3254`; the reviewer/maintainer must decide accurate owner mapping without inventing a new approved suite. Scope should be limited to `unit-fixture` and `static-source`. No OS service ownership, native Windows STOP, remote ChatGPT authentication, actual factory work or GitHub merge is proved by those fixtures.

**Owner Windows preflight note:** An authenticated read-only `factory-pr-head` check of the candidate was `BLOCKED / CANDIDATE_BASE_MISMATCH` because the current owner checkout was `8a6bec0b1137adf6d515f8314d158df155357b9d`, five commits behind GitHub MAIN `8a122d9984760a86faa20a6b8210459896d70b17`; no source staging occurred. A separately allowlisted `factory-qa-handoff` Node suite **did pass** on that older Windows source head, with `independentVerification:false`; that is proof only of the old Windows test route, not this exact new test or Product Gate.

The real F00 reviewer must independently recompute all digests, inspect assertions and source consequences, and write an attributable signed `ADMIT/FIX/REJECT/UNPROVEN` receipt. The author must not edit the protected catalogue.

## Supervisor pause/stop status extension

Two additional negative tests ensure already-existing `PAUSE_REQUESTED`, `PAUSED`, `STOP_REQUESTED`, and `STOPPED` supervisor statuses are represented conservatively, not silently discarded; owner STOP marker presence still overrides even an apparently PAUSED heartbeat. No state confers process owner verification, a start command, or acknowledgement of true Windows teardown. These remain author-generated in-memory source-equivalent assertions, **not** native Windows proof. The historical 20/20 fixture count predates the new 21st regression; current source/test digests in this packet supersede earlier packet SHA values.

## October 27 — canonical UTC status freshness

A status observation was accepted as fresh when its timestamp was parseable but noncanonical (for example `2026-10-27T23:00:00+00:00`). The source now requires a normalized UTC `Z` timestamp and rejects impossible calendar dates before projecting sidecar observations. Added a negative regression for an offset timestamp and a positive canonical UTC control. **Correction:** a preliminary author-side change treated third duplicate IDs as a gap, but the existing `Map.has` already quarantined them; that redundant change and its test were removed before this packet. The final new test edition contains **21 test cases, NOT EXECUTED OR INDEPENDENTLY ADMITTED**. Prior 20/20 in-memory fixture results do not cover this change. The current source/test SHA-256 values and Git blob IDs above are author-prepared candidates for independent recomputation. Do not promote these to trusted truth or merge before external W8/W9 review and exact-head CI/Windows gates.
