# Issue 503 — Windows Playwright MCP spawn

The local acceptance engine keeps Agent Plugins as the portable browser-tool boundary. The Agent Plugin starts Playwright MCP through `scripts/run-npx-stdio.mjs` rather than asking Node to spawn `npx.cmd` directly.

On Windows, `.cmd` launchers pass through PlotPickle's shared reviewed `cmd.exe` boundary. Dynamic command paths and arguments are validated and carried in the child environment rather than concatenated into shell command text. On macOS and Linux the launcher continues to invoke `npx` directly. Standard input/output/error remain inherited so JSON-RPC stdio is preserved end to end.

The local UAT remains cloud-independent. GitHub CLI authentication is optional and only affects posting the completed report back to the tracking issue.
