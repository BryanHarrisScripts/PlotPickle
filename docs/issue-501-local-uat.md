# Issue #501 — local-first human acceptance testing

PlotPickle's baseline human acceptance test must not depend on ChatGPT, Codex quota, a cloud API key, or paid AI usage.

The local acceptance path keeps the Agent Plugins architecture. The PlotPickle workflow tester plugin remains the portable package for acceptance skills and MCP configuration. Its Playwright MCP server is started by the deterministic local runner and drives the actual rendered PlotPickle application at the loopback address.

The default Windows UAT engine is `local`:

1. wait for PlotPickle at `127.0.0.1`
2. load the PlotPickle Agent Plugin Playwright MCP configuration
3. walk the visible smoke journey through Dashboard, Plan, Storyboard, Write, Edit, Graphic Novel, Build and Feedback
4. capture accessibility snapshots, screenshots, active-workspace state and browser console errors
5. write a deterministic PASS/WARN/FAIL report under `%LOCALAPPDATA%\PlotPickle\uat`
6. when Ollama is already running with a suitable installed instruction model, optionally review the deterministic evidence for usability observations

The Ollama review is advisory. It cannot change the deterministic acceptance verdict and is skipped cleanly when no suitable model is installed.

Codex remains available as the explicit `codex` engine for deeper exploratory UAT. It retains the read-only sandbox, ChatGPT-login preference and API-key billing guardrails, but Codex availability or usage limits no longer determine whether the baseline UAT can run.

Safety boundaries remain unchanged: no repository edits by the tester, no external writes, no real credentials, no paid test calls, and no requirement for a cloud account.
