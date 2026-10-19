# #3154 — ChatGPT Chat -> PlotPickle Factory: read-only MCP proof

**Purpose:** let regular ChatGPT Chat *call tools that inspect the owner's Windows Factory*. Never treat this as a means for Pi/Cline to consume regular ChatGPT Plus conversation tokens. This bridge cannot run AI coding agents, enable issues, restart failed #3141 attempts, change source, stop a process, or merge a PR.

## Implemented tools

| Tool | Inputs | Verified result |
| --- | --- | --- |
| `factory_status` | none | enabled/freshness, local heartbeat/state, finite approved count, latest sanitized issue/attempt/state/phase |
| `factory_evidence` | integer issueNumber, attempt 1 or 2 | one immutable reservation/result summary; attempt 2 only allowed for #3141 |
| `factory_issue_preview` | none | read-only newest-first GitHub open-issue list using existing `gh issue list`; does not modify permissions |

All return an exact bounded schema. MCP descriptions and annotations say **read-only**, **not a self-verifier**. No prompts, private paths, model transcripts, identity, OAuth data or raw stderr are included. Unknown/corrupt/unverifiable receipts are not treated as passes.

The implementation uses built-in Node libraries for a minimal, stateless MCP JSON-RPC 2.0 `2025-06-18` tools protocol. It has **no added npm dependency, extra provider, daemon, shell execution via MCP inputs or API bill**. Its default paths are fixed under the owner's private LOCALAPPDATA. Unit/live transport tests validate schemas, a real initialize/tools-list/tools-call cycle, stdio, loopback Host and Origin checks, result immutability, tool denylist and oversized input rejection.

## Step 1 — Run on Windows, read-only

After this PR merges (do not pull main during a running factory attempt):

```powershell
cd C:\Users\bryan\plotpickle
git pull --ff-only
node --test tests/issue-3154-chatgpt-factory-mcp.test.mjs
node scripts/engineering-team/mcp/factory-readonly-server.mjs --http
```

This starts a **foreground**, local-only server bound to `127.0.0.1:43115`. Its endpoint is `http://127.0.0.1:43115/mcp`. This is for local MCP Inspector only. The script does NOT write to the queue or contact any LLM. It does not auto-start or alter the existing `PlotPickleSoftwareFactory` Task Scheduler entry. Ctrl+C closes it.

In another PowerShell tab, use `npx @modelcontextprotocol/inspector` if Inspector is available and open **Streamable HTTP** `http://127.0.0.1:43115/mcp`; check `factory_status` and `factory_evidence` issue #3141 attempt 2. The local Inspector is diagnostic only; it is not proof that ChatGPT Plus web can connect.

On a supported ChatGPT **Desktop** local-plugin transport, `node scripts/engineering-team/mcp/factory-readonly-server.mjs --stdio` provides line-delimited MCP JSON-RPC via stdin/stdout, with no status banners on stdout. Desktop use must be separately demonstrated.

## Step 2 — Connect to ordinary ChatGPT Chat browser (not implemented in this slice)

Official ChatGPT custom-MCP instructions require either an authenticated, remote public **HTTPS** `/mcp` endpoint or supported **Secure MCP Tunnel**. **Do not paste a localhost URL into the ChatGPT web plugin connection; web cannot reach it directly. Do not publicly tunnel the unauthenticated loopback prototype or enter account tokens in a proxy.** Build/verify transport authentication and owner access controls before networking it outside localhost. A reachable endpoint is distinct from an authenticated connection.

Navigate Plugins → Add → Add custom MCP server. The user's Plus account showed this option, but tool discovery/actual call permissions remain **UNPROVEN** until tested on that exact account. If the account cannot connect, report the limitation and keep the local server unpublished; the already-connected GitHub app remains the supported chat-level fallback.

Reference:
- https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt
- https://help.openai.com/en/articles/20001256-plugins-in-chatgpt
- https://developers.openai.com/plugins/build/mcp-server
- https://developers.openai.com/plugins/build/auth

## Step 3 — Only if enabled by owner and product capability

Open a separate PR for an owner-authenticated HTTPS/tunnel adapter with scoped auth, private credential storage and a native Windows test. Then separately authorize narrowly named write tools (build/test, STOP) **only** if platform plan supports them and Windows owned-process controls #3135 are proven. Keep issue #3153 Cline/Codex route blocked per user preference. Never bypass uncertain attempt receipts (#3141 attempts 1 and 2 remain immutable) or invent an unattended ChatGPT Chat inference API.

The Factory can display a live Node terminal status under #3142, but this MCP service is intentionally independent and read-only.
