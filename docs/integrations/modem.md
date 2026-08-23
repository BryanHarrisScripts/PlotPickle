# Modem product-intelligence connection

Modem is an optional product-intelligence layer around PlotPickle development. It is not part of the PlotPickle application runtime, does not own story canon, and is not required for local-first operation.

## Recommended first connection: GitHub

Connect Modem to only `BryanHarrisScripts/PlotPickle` through Modem **Settings -> Integrations -> GitHub**.

This gives Modem the development conversations PlotPickle already produces:

- UAT-created GitHub issues become product/bug feedback signals;
- issue comments retain repair and investigation context;
- pull request titles, descriptions, review comments, labels, and merge state provide shipping context;
- Modem can relate recurring feedback topics to the PRs that addressed them.

Modem's GitHub integration does not read repository source code or full diffs. Keep repository selection narrow rather than granting all repositories by default.

## Optional later connection: Modem MCP

Modem exposes a beta remote MCP server at `https://mcp.modem.dev/mcp` using Streamable HTTP and OAuth. A compatible developer client can use it to search Modem data or invoke the Modem Agent.

For PlotPickle this should remain optional. The preferred direction is:

`GitHub issues / PR conversations -> Modem -> developer query/review context`

Do not expose PlotPickle's local MCP server to the public internet merely so Modem can reach it. PlotPickle's local MCP remains local and permission-bounded.

## Privacy boundary

- Do not send PPF story files, unpublished screenplay text, credentials, local file paths, or local UAT evidence to Modem automatically.
- GitHub remains the deliberate publication boundary for development context.
- If the Modem ingest API is added later, use an explicit opt-in and sanitize/redact payloads before transmission.
- Modem is never allowed to make story canon decisions.

## Initial setup

1. Create the PlotPickle organization/project in Modem.
2. Open **Settings -> Integrations -> GitHub**.
3. Install and authorize the Modem GitHub App.
4. Choose **Selected repositories** and select only `BryanHarrisScripts/PlotPickle` initially.
5. Allow the first sync to ingest recent open issues and ongoing PR activity.
6. Confirm UAT issues and recent PRs appear in Modem Topics/Stories before adding any other data source.

Slack, Discord, email, custom ingest, and Modem MCP can be added later only if they provide useful signal beyond GitHub.
