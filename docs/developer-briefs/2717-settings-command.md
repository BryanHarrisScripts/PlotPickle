# Pi 1.0.1, FFrames 1.2.0 and Settings / Command

## Approved outcome

Continue #2717 from main after #2718. The Human explicitly places Command under Settings. Do not add a top-level Dashboard Command destination. Main already uses Pi 0.99.1; upgrade that live runtime to exactly 1.0.1 while retaining the historical 0.87 and 0.99 evaluation records. Pin the optional Rust FFrames bridge to exactly 1.2.0.

## Existing owners and implementation

- Reuse the managed Pi installer, DSDD persistent-session bridge and package-root SDK probes. Pi 1.0.1 no longer publishes its npm shrinkwrap; a repository-owned managed lock must be consumed by npm ci in the private tool directory. Keep the current extension, native MCP, Codemode, compute and durable-adapter authority policies.
- Reuse core/media/fframes-local-media-engine.ts and tools/fframes-bridge. Check the 1.2.0 API, commit a Cargo lock and observe native Windows video duration, final frames and color. Keep installation optional and preserve the existing supported media fallback. Do not claim hardware acceleration without an observed supported encoder/hardware combination.
- Add a Settings child named exactly Command using the Dashboard Settings owner. Reuse the existing DSDD interpret, read-only technical brief and explicit publication/approval chain for comments, bug/UAT reports and bounded requests. Keep session evidence and current project continuity. Normal startup performs no request/model inference.
- Add read-only Hunk review through an authenticated loopback host adapter beneath build/dsdd. Resolve only the current checkout and validated patches/PR identities; use fixed executable arguments without shell interpolation. Report missing tooling and launch/cancellation errors accurately. Agent notes are advisory; no source mutation or merge authority comes from review.

## Acceptance and evidence

1. Managed Pi manifest, lock, executable and session identity agree on 1.0.1. Windows installer/SDK/context/RPC/extension, native MCP, DSDD, Codemode and durable tests pass without widening grants.
2. FFrames 1.2.0 bridge and Cargo lock agree; real Windows media evidence verifies output duration, final frame and color. Missing native prerequisites remain unavailable, never fake success.
3. Settings exposes Command, Escape/Back returns to Settings, and opening/closing it preserves the loaded story. Existing DSDD status and evidence appear with governed engine settings.
4. Hunk can review the bounded target through the native terminal or supported browser adapter. Authentication, CSRF, invalid targets, missing executable, launch errors and cancellation have executable regressions and Windows proof.
5. Relevant regressions, focused UAT, production build, independent convergence and exact-head CI pass. Maintain the PR Development Run ledger. Leave the PR green for review; #2718's merge authority does not automatically authorize merging #2717.

Keep #2711/#2707 application acceptance and #2706 security work separate.

## Review adapter and proof limits

Hunk is optional and installed separately; the product never installs it. The proof fixture installs reviewed hunkdiff 0.23.0 from tools/hunk-review/package-lock.json. The adapter starts only fixed diff or PlotPickle PR commands with user/project extensions disabled. Bounded advisory file/line notes become an owned temporary Hunk agent-context sidecar and are removed on observed close or cancellation. The application has no browser Hunk adapter and does not invoke an agent to write review notes merely by opening Settings. Review process ownership is ephemeral; an already open native window can also be closed directly in Hunk.

Command is a declared Settings child in the canonical surface census. It has focused rendered Windows proof without changing the historical 30-surface baseline set. The Windows Product Gate also exercises the private locked Pi installer and actual Hunk inline-note discovery/cancellation. A separate native-media job compiles the locked FFrames bridge and verifies every decoded color frame. GPU use and binary redistribution remain unproven.
