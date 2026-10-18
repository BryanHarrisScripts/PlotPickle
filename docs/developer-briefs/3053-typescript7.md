# TypeScript 7 native compiler with the retained TypeScript 6 API

Parent: #3053. The Human authorized build, test, fix and green merge of the remaining software-update queue on 17 October 2026.

## Assessment and scope

Microsoft's TypeScript 7 release does not provide the JavaScript compiler API. Existing PlotPickle fixtures, the exact 6.0.3 fixture helper, Next and typescript-eslint import that API. Replacing their package with native TypeScript would break those consumers. Microsoft documents the side-by-side npm alias configuration used here: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-60.

- `@typescript/native` is exact-aliased to `typescript@7.0.2`, providing native `tsc`.
- `typescript` is exact-aliased to Microsoft's `@typescript/typescript6@6.0.2` compatibility wrapper. Its locked `@typescript/old` dependency remains TypeScript 6.0.3 and exports the same API used by the existing fixture helper. The compatibility wrapper's version is not a downgrade of the actual compiler API.
- No model, provider, story, profile or runtime authority changes. TypeScript remains development tooling. The existing fixture helper and its version guard remain unchanged.

## Acceptance and proof

1. A genuine npm lock records both official distributions and their platform dependencies; clean install resolves native 7.0.2 and API 6.0.3.
2. Existing enum, parameter-property, syntax error and native Node26 stripping controls still pass. Add a native CLI check that accepts a valid typed fixture and rejects a mismatched value with TS2322 and the source filename. Preserve all existing assertions.
3. The same admitted compiler suite runs in the existing Windows build/installer lane on Node26, alongside the Linux production-harness catalogue. CLI version alone is insufficient.
4. Retain W8/W9 approved truth, input digests and disclosed evidence limits. Run focused UAT, lint configuration loading, production build, BEN, convergence and exact-head Architecture/Windows gates.

This bounded update proves the native compiler on controlled fixtures and compatibility with the existing build/test tooling. It does not certify every source file as semantically type-correct or complete the remaining historical fixture migrations in #3061. `npx tsc` invokes TypeScript7; tools importing `typescript` use the retained6.0.3 API. No claimed speedup is inferred from upstream benchmarks.

## Ownership and rollback

Existing owners are the root package/lock, `scripts/verification/typescript-fixture-transform.mjs`, its #3061 test/catalogue, and the Windows product workflow. No second compiler harness or global Node patch is introduced. Rollback is a reviewed revert of this package/lock/workflow/test wave; no user data migration is involved.
