# Developer Brief — #2780 OpenPencil Command MCP connection

## Objective

Make the OpenPencil adapter from #2778 executable through Settings → Command without changing normal PlotPickle startup.

## Human outcome

From Command the Human can:

- see OpenPencil MCP readiness;
- choose an explicit existing local design workspace;
- connect the user-managed local MCP server;
- disconnect the PlotPickle-owned MCP child;
- use bounded natural Command verbs for help/status/connect/disconnect.

These operational commands do not become DSDD developer briefs.

## Runtime contract

Upstream reviewed contract:

- package: @open-pencil/mcp
- HTTP executable: openpencil-mcp-http
- local endpoint: http://127.0.0.1:7600/mcp
- filesystem boundary: OPENPENCIL_MCP_ROOT
- Windows 10+ supported.

PlotPickle rules:

- no auto-install;
- no launch on normal startup;
- no arbitrary shell/cmd execution;
- explicit existing absolute workspace required;
- localhost endpoint only;
- fail closed if port 7600 is already owned by another process;
- disconnect only the child PlotPickle launched;
- no cloud provider activation;
- no source mutation or merge authority.

## Command behavior

Recognized operational verbs:

OpenPencil help
OpenPencil status
OpenPencil connect <absolute local design workspace>
OpenPencil disconnect

The Command conversation records these in local UI roles command and tool; they are deliberately excluded from DSDD Human/interpretation persistence and Pi Draft context.

## Acceptance

1. Missing OpenPencil MCP reports unavailable and does not install or launch anything.
2. Windows resolves the npm global JS entrypoint and launches Node with shell: false.
3. Connect sets OPENPENCIL_MCP_ROOT to the exact selected workspace and uses localhost:7600.
4. Invalid/relative workspace roots are rejected.
5. Unowned use of port 7600 blocks connection.
6. Disconnect terminates only the owned child.
7. Settings → Command visibly exposes OpenPencil status/connect/disconnect.
8. Operational verbs bypass DSDD developer-brief publication.
9. Focused tests and exact-head CI pass.
