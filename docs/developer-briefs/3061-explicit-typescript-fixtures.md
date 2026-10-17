# Explicit TypeScript fixtures: production-harness wave

Issue #3061 and existing PR #3062. Current main already runs the seven architecture layers on Node 26.12.0 after #3063, with independent installed Windows Node 26 evidence from #3060. Preserve both outcomes.

Replace the proposed global Node built-in monkeypatch/preload with one explicitly imported compiler under scripts/verification. Require the existing exact TypeScript 6.0.3 dependency. Prove executable enum and constructor parameter-property semantics, caller-owned import isolation, malformed syntax diagnostics with filename, and unchanged native Node stripping. Isolated transpilation checks syntax; it is not a complete semantic type checker.

This first production-harness wave also removes obsolete transform options in three existing erasable-TypeScript suites: Director Specification Phase 0, instruction compiler Phase 2, and provider adapters Phase 3. Their assertions stay unchanged. Before repair Node 26 reports 11 failures across 15 cases; the legacy Node 24 runner passes all 15. Promote only those scoped suites with complete W8/W9 source/input bindings.

Nearby Phase 1 and Phase 4 suites already have source-assertion failures on the legacy runner. Record those as existing debt, without modifying their outcomes or claiming full historical migration. Remaining uncatalogued callers stay tracked under #3061.

Only the production-harness layer gains the same locked npm-ci setup already used by four layers. Cache npm through setup-node; dependency installation is governed CI setup under #3053, while fixture execution remains network-free. Do not preload the compiler into runners, alter NODE_OPTIONS, add dependencies, or change application/provider/story code.

Acceptance: admitted helper and migrated fixtures pass on exact Node 26.12; all seven exact-head CI layers, BEN and convergence pass; focused UAT and production build pass. Existing #3060 Windows installer evidence remains applicable because this wave changes only fixture/compiler and CI setup. Keep #3061 open for the remaining historical migration waves.
