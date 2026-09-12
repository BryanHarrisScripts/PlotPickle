# #1927 — Layer 2 Node semantic identity repair

## Problem

The live WebMCP run after #1924 proved Profile UI conformance was repaired, then failed while entering Node because Playwright strict mode found two rendered sections with `aria-label="Node information"`.

This is not a visual-style problem. It is a Layer 2 Experience Contract problem: the Settings-owned Node surface and its inner detail region were using the same semantic identity.

## Decision

Preserve the established outer Node surface contract and change only the inner region.

- Outer Settings-owned surface remains `aria-label="Node information"`.
- Inner rows/details region becomes `aria-label="Node status details"`.
- Existing WebMCP, Visual Director and visual-candidate selectors therefore remain stable.
- Playwright strictness remains authoritative. Do not use `.first()`, `.nth()` or relaxed selectors to hide duplicate semantics.

This is deliberately smaller and safer than renaming the outer surface and then updating every verifier/capture consumer.

## Evidence protected

The focused regression proves:

1. only one source-owned rendered section carries the `Node information` surface identity;
2. the inner Node detail region has its own semantic identity;
3. the strict Settings/WebMCP navigation locator remains unchanged;
4. WebMCP readiness, Visual Director ownership and candidate capture still reference the established Node surface contract.

## Non-goals

- no Node API/runtime behavior changes;
- no Settings navigation redesign;
- no visual styling changes;
- no changes to Node readiness logic;
- no weakening of WebMCP/Playwright verification;
- no attempt to fix the separate Profile spacing-rhythm or heading-hierarchy advisories in this repair.

## Validation

Run the focused #1927 regression, development convergence, the normal exact-head PR/Product gates, then rerun local live WebMCP from merged `main`.

Expected final live result: the Node surface opens without strict-mode ambiguity and the audit proceeds beyond Node.
