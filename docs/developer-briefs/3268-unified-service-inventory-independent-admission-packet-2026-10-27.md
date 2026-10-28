# Independent admission packet — #3268 unified read-only service inventory

**Request:** Independent WHITE-PAPER-V3 W8/W9 test-truth admission for one new test edition; reviewer must not be the author of this PR. This is a **request for review, not an ADMIT verdict**. Owner: #3268; related independent QA #3302, Software Factory #3142.

## Exact source editions before this packet

The author-proposed branch was pinned at `d96a8a166c924c145a19ca05ec93ba8adeabdbc9` before adding this packet. Re-fetch the current PR SHA and verify Git blob IDs and **independent SHA-256** of each file at review time. The source contents are not permitted to drift silently.

| Scope | File | Git blob SHA |
| --- | --- | --- |
| New test | `tests/issue-3268-unified-service-inventory.test.mjs` | `c90930fe00b23b3d2e116a65840bb084b8f62ed4` |
| Implementation | `core/sidecars/runtime/unified-service-inventory.mjs` | `3c233fda4643d4143db233f8f94d9f561df8f3d7` |
| Read-only CLI | `scripts/engineering-team/windows/services/inspect-unified-services.mjs` | `b939957c37c06ab696e79bbde2a145585f664388` |
| Existing dependency | `core/sidecars/runtime/service-registry.mjs` | `021dbf1d9a729109d3fa2eae55034be20b31e29a` |
| Existing source inventory | `config/runtime-sidecars.json` | `cc60ff0815f712fcaa7ce6653d693ee0c1780d2d` |
| Existing managed components | `config/runtime-manifest.json` | `bdf403244ee36ee180c40dd1ad4de6bf6fffb961` |

## Normative scope and proposed assertions

- **W8 independent verification:** Do not confuse a source-local heartbeat, local listener or status file with independently verified process ownership, model execution, remote authentication, coding, signed test admission or Windows Product Gate. No self-assigned PASS/ADMIT.
- **W9 preserved obligations/stale evidence:** Unrecognized IDs, malformed status, stale/incorrect exact head, invalid data, replay/unknown process state and duplicate source entries must not turn a component READY or silently alter established approved tests. A planned factory listing is not an operational claim.
- **Existing runtime contract:** #2693/#2694 six governed sidecars remain owned by the current sidecar supervisor, and `config/runtime-manifest.json` owns the broader managed component declarations. No extra launcher, credential store, headless model dispatcher or second tunnel.

The 18 source-linked test cases cover registry composition, default unproven status, fresh-but-untrusted sidecar `ready`, forged supervisor acceptance, stale head/heartbeat, forged remote tunnel authorization, stale status, duplicate/unknown reports, duplicate/malformed service IDs, unsafe sidecar entrypoint, fixed-source CLI no-elevation inspection, unavailable sources, and actual six-sidecar/four-factory inventory without extra execution capability.

## Known limitations the independent reviewer must inspect

1. The author's in-memory V8 fixture execution registered 18/18 PASS; this was a **source-equivalent simulation**, **not Node's actual test runner**, hosted exact-head CI, independent QA or native Windows owner-product evidence.
2. The file/status sources are read-only projections and **do not cryptographically attest** to process ownership or remote plugin authorization. The inventory consequently returns zero proven-operational components, even for reported `ready` or `RUNNING` states.
3. `inspect-unified-services.mjs` is a fixed `--status` diagnostic, not the always-on Windows Service Manager or an installer. It does not replace existing supervisors or modify the owner's current tasks, tunnel or machine.
4. Direct file symlinks are rejected in the CLI. Windows parent-directory reparse-point handling, packaging, SCM identity/process-tree, restart/STOP and source-head witness are **not proved**. Read-only status alone must not become an action authorization or standalone verifier credential.
5. The new test is **not in the protected test-truth catalogue**. Do not mutate `config/verification/test-catalog.json` based on the author's review or bypass the admission gate. Independent reviewer must produce attributable `ADMIT`, `FIX`, `REJECT`, or `UNPROVEN` for exact assertions and input digests before an independently authorized maintainer adds bindings.
6. The shared factory lifecycle brief specifies common work-order stages while keeping Software, Learning, Story and Game domain acceptance distinct. The implementation only inventories those factories; no work-order engine or factory worker has been activated.

**Requested review outcome:** test edition truth/inputs, domain ownership/privilege boundary, and negative evidence scope. Until independently admitted, keep the implementation PR **DRAFT, unmerged and with no service installation or work authorization**.

## STOP-marker extension

Four additional cases cover a **present** existing `engineering-team/supervisor/stop-request.json` marker winning over an otherwise fresh RUNNING heartbeat; an unreadable marker remaining BLOCKED; the fixed-path read-only inspector observing STOP without parsing marker secrets; and STOP persisting in the inventory when no heartbeat exists. The marker is not cleared, modified or treated as an independent process-ownership receipt. A read of `PRESENT` is conservatively blocking; `ABSENT` is never permission to start.

The recorded 18/18 result is an *author-run in-memory V8 source-equivalent fixture*, not the Node test runner or an independent W8/W9 ADMIT. Review the four new assertions and source editions above prior to any catalogue update.
