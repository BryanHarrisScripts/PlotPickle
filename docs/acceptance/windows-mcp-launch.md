# Windows MCP launch acceptance note

For the local PlotPickle UAT, Playwright MCP is still declared by the Agent Plugin. Windows command wrappers such as `npx.cmd` must be started through `cmd.exe`; direct Node `spawn()` of the `.cmd` launcher can fail with `EINVAL`.

The portable stdio launcher preserves the MCP JSON-RPC streams and does not add any cloud AI dependency.
