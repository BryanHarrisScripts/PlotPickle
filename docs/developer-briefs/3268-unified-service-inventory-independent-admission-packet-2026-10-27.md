# #3268 unified service inventory — one-edition independent admission request

**Disposition:** AUTHOR-PREPARED / NOT ADMITTED. Review requested from `PP-QA-A-W1` (Lane A); the author is `PP-ENG-W1` and cannot issue an independent verdict. This packet does not grant signing, catalogue, test-execution, Windows, coding, service, or merge authority.

**Issue:** #3268; trust-governance dependency #3302; **draft PR:** #3325.
**Exact implementation-and-test source head:** `66a980f74c2b34194202e12ee6958abde3bda19d`.
**Source identity rule:** All test and binding-input blobs below were fetched from that exact commit. This packet-only revision creates a newer Git PR head without changing these seven evidence files. The durable SHT-C on PR #3325 must pin the final packet commit SHA and packet blob/digest; reviewers must check the live PR head against that SHT-C and re-fetch all paths before issuing any verdict. Any subsequent input/test mutation invalidates this edition. A Git commit cannot contain its own SHA.

## Proposed single current source/test edition

Digests are SHA-256 of **UTF-8 bytes after CRLF/CR-to-LF normalization**, not Git blob IDs. The author computed these from the exact GitHub file contents. They are evidence for independent recomputation, not a reviewer signature.

| Role | Path | Git blob SHA-1 | LF UTF-8 SHA-256 |
| --- | --- | --- | --- |
| Governed test target | `tests/issue-3268-unified-service-inventory.test.mjs` | `4111aed33a0e11b4d137d41a7810b7dca4bea2c7` | `6b8e1173edb1cc8948ddfa9030130114342e1b3a8c298b75a7e4124a027ead60` |
| Implementation input 1 | `core/sidecars/runtime/unified-service-inventory.mjs` | `57263b4288abfc8f017fead6a26c0aa87dce87bb` | `fd6b2de13bb4352748b53b895b4dbce12d62e07acfc430ebaa67a6d183f9b4b7` |
| Read-only inspector input 2 | `scripts/engineering-team/windows/services/inspect-unified-services.mjs` | `5e73c8afc0867dd652fb317e2da98482943fe9c9` | `367dc9b897787393244a8c0f84f10d83857df75a542bda2cb4ad518ddb069078` |
| Existing runtime registry input 3 | `core/sidecars/runtime/service-registry.mjs` | `021dbf1d9a729109d3fa2eae55034be20b31e29a` | `64f4d72796a55d9bb535913035aed1d5a7f32d979354636650f44b1cc1c618a2` |
| Sidecar configuration input 4 | `config/runtime-sidecars.json` | `cc60ff0815f712fcaa7ce6653d693ee0c1780d2d` | `3f9a5f25f916ccf295441e7c005a88c0edb19f66961b1db94a70dec6a6c648c8` |
| Managed component configuration input 5 | `config/runtime-manifest.json` | `bdf403244ee36ee180c40dd1ad4de6bf6fffb961` | `cc9c40bbab3c416e2106aaa8e98cea0dad83c5f09810cb4f64416736bd40aadf` |
| Approved normative source (not an implementation input) | `docs/white-papers/AI_Programming_Evolution_White_Paper.md` | `1d3d49300d04f9784d94568d9cb36348eb290ba3` | `7fd538b813014cf94505903a32e171fca344068d67d15036fbe0fdcb7859c27d` |

**Import/input boundary:** The test imports the two new modules; the inventory module imports the existing `service-registry.mjs`; the test reads both configuration JSON files. The inspector imports the inventory module. Node built-ins are runtime dependencies, not proposed repository source-edition bindings. No other repository binding input is proposed for this edition. A reviewer must independently confirm the dependency closure.

## Exact test count and proposed W8/W9 mapping

**22 top-level `node:test` cases**, counted from the exact test file at the source head above. This count supersedes earlier author fixture counts. **Do not execute this unadmitted test as part of this review-preparation work order.**

Approved truth: `WHITE-PAPER-V3`, version `3.0`, in the existing protected `config/verification/test-catalog.json`; the approved `sourceDigest` is `7fd538b813014cf94505903a32e171fca344068d67d15036fbe0fdcb7859c27d`, matching the normative source above.

| Proposed obligation | Specific cases (1-based order in test file) | Intended independent review question |
| --- | --- | --- |
| `WHITE-PAPER-V3/W8` — independent verification | 2, 3, 4, 6, 11, 13, 14, 15, 18, 20, 21 | Do reported heartbeat, READY, local listener, STOP and source observations remain untrusted without separate evidence of actual process, authentication, execution, Windows acceptance and authority? |
| `WHITE-PAPER-V3/W9` — preserve obligations / prevent unexpected regressions | 1, 5, 7, 8, 9, 10, 12, 15, 16, 17, 18, 19, 20, 21, 22 | Do duplicate IDs, malformed timestamps, stale heads, invalid entrypoints, absent sources, PAUSE/STOP and malformed marker states fail closed without changing existing runtime ownership? |

The mapping is a **candidate whole-file `truthRefs` binding** to W8 and W9; overlap is intentional. No source-author ADMIT, independent signed reviewer receipt or protected catalogue change exists.

**Candidate binding fields for the separate catalogue maintainer after actual independent ADMIT:** `target` is the test path in row 1; `targetDigest` is its SHA-256; `inputs` are precisely the five implementation/configuration input rows with their SHA-256 values; `truthRefs` are `[{"truthId":"WHITE-PAPER-V3","obligationId":"W8"},{"truthId":"WHITE-PAPER-V3","obligationId":"W9"}]`. Candidate existing owner entries to inspect are `production.modular-runtime-2697` (production-harness), `agent.persistent-windows-supervisor-3110` (agent-runtime), and `agent.settings-compute-tunnel-3254` (agent-runtime). These are alternatives for reviewer/maintainer determination, not approved ownership or permission to add a new suite. Proposed scope: `unit-fixture` and `static-source`, with `network=false`, `native=false`, `secrets=false`.

## Limits and reviewer obligations

The implementation is a **read-only inventory and fixed-path `--status` inspector**, not a Windows Service Manager installation or an execution API. Its six governed sidecars, five managed components, four planned factories and coordinator remain separately owned. No reported component becomes independently READY, no worker is launched, no credentials or remote authorization are inferred, and no STOP marker is cleared.

The test edition includes negative checks for untrusted READY/remote authentication, stale and noncanonical UTC observations, duplicate/unknown IDs, malformed marker states, PAUSE/STOP precedence, read-only path restrictions and the absence of coding/merge capability. Those source-level assertions do **not** establish native Windows reparse/junction defenses, ACL/service-token identity, restart/crash recovery, real process ownership, trusted signed admission, independent Windows Product Gate or a running coding worker.

Earlier in-memory V8 author fixture results were **not** the Node test runner or independent evidence for this exact 22-case edition. No `node --test` execution is claimed here; the new test is deliberately unadmitted. The existing protected catalogue is unchanged. Hosted CI may remain BLOCKED at the approved-truth gate; that is not an invitation to bypass it. The Factory's existing STOP/no-replay rules remain in force.

**Required next role:** `PP-QA-A-W1` must independently recompute the exact digests and source closure, inspect the 22 assertions against W8/W9, verify the current PR head and reviewer independence, and issue an attributable source-specific `ADMIT`, `FIX`, `REJECT` or `UNPROVEN`. Only a separately authorized catalogue maintainer may apply an admitted binding. Thereafter `PP-TST-W1` may run admitted tests, followed by `PP-QA-B-W1`, `PP-WIN-W1` and `PP-REL-W1` according to their distinct gates. This packet itself is **NOT** a gate receipt.
