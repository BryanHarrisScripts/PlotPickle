# Issue 505 - Local UAT evidence parsing

Observed in the real Windows smoke UAT after #504:

- every screen showed `Active workspace / URL: unknown`
- Edit was marked FAIL only because its URL could not be parsed
- all other screens were marked WARN because the console summary text contained the word `error` even while it explicitly reported `Errors: 0`

The browser journey and screenshots completed. The failure is in evidence interpretation, not Playwright MCP startup.

Fix requirements:

- parse the Playwright MCP `browser_evaluate` result section without accidentally consuming the later `Ran Playwright code` block
- treat `Errors: 0` / `Returning 0 messages for level "error"` as no console error
- require a positive active-workspace or route match rather than treating missing active state as a match
- keep screenshots and deterministic navigation evidence unchanged
- add regression coverage for the exact real-world console summary and evaluate-result format

Refs #490 #501 #503 #504.
