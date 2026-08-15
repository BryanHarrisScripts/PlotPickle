#!/usr/bin/env node

// Stable public entrypoint. Install the local-only writer/browser recovery layer
// before loading the journey implementation so real Windows runs can recover
// intermittent empty local replies and native Settings disclosure roles.
await import("./writer-in-residence-runtime-recovery.mjs");
await import("./run-writer-in-residence-v4.mjs");
