# Issue 503 — Windows Playwright MCP spawn

The local acceptance engine keeps Agent Plugins as the portable browser-tool boundary. The Agent Plugin now starts Playwright MCP through `scripts/run-npx-stdio.mjs` rather than asking Node to spawn `npx.cmd` directly.

On Windows, the wrapper executes the command through `%ComSpec%` / `cmd.exe`, which is required for `.cmd` launchers. On macOS and Linux it continues to invoke `npx` directly. Standard input/output/error remain inherited so JSON-RPC stdio is preserved end to end.

The local UAT remains cloud-independent. GitHub CLI authentication is optional and only affects posting the completed report back to the tracking issue.
