# UI conformance runbook

Run the existing WebMCP visual audit against the local packaged or production UI, inspect deterministic conformance failures, repair only the reported root cause, rerun the visual contract, then run focused UAT contracts and the production build. Screenshot baseline comparison remains complementary evidence. Merge only after required GitHub checks pass on the exact head.