# Full Verification testing cleanup

This maintenance pass fixes three verification-harness defects without changing PlotPickle product behavior:

- materialize PowerShell verification stage records as a plain object array before JSON serialization;
- satisfy the current Playwright MCP screenshot `scale` requirement through the shared schema-aware argument normalizer;
- reconcile harmless accessibility-name differences conservatively while preserving role matching, duplicate occurrence selection, and ambiguity rejection.

The exhaustive UI/UX contract remains strict: enabled controls must still produce an observable result after they are deterministically targeted.
