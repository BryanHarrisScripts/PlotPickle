# Browser Verification Broker

Issue #2246 makes browser execution replaceable while preserving PlotPickle's existing verification authorities.

The current census found seven direct Playwright/Chromium launch sites in the canonical rendered verification stack:

- WebMCP standard surface catalogue
- WebMCP surface visual audit
- Skin V1 Visual Director
- Skin V1 menu contract audit
- UI axe audit
- UI experience audit
- rendered sitemap audit

The Browser Verification Broker now owns deterministic browser launch, adapter capability declaration and normalized browser-health evidence. WebMCP remains the PlotPickle-aware page capability layer. Surface Registry / Surface Grammar remain the expected-state authorities. UI Continuity, Visual Director and UAT keep their existing PASS/FAIL responsibilities.

The deterministic CI adapter is pinned Playwright Test from the existing verification tool root. Playwright CLI and Playwright MCP are declared as host-managed adapters behind the same capability contract so developer/exploratory hosts can be added without changing PlotPickle surface policy.

Every brokered context attaches the read-only browser diagnostics observer before page navigation. The observer captures bounded console/runtime/network/resource/page events, sanitizes evidence, fingerprints repeated findings, records governed checkpoints and writes evidence beneath `.artifacts/browser-diagnostics/<run-id>/`.

Blocking findings trigger bounded deep evidence: a viewport screenshot, structural browser metadata and retained Playwright trace. The deep pass never stores full page text, request/response bodies, cookies, authorization headers, provider credentials, PMK material or arbitrary private filesystem contents.

The reviewed allowlist is `config/verification/browser-diagnostics-allowlist.json`. New findings are never silently added to it. Console warnings remain advisory by default; uncaught runtime errors, console errors, page crashes, application 5xx responses, required same-origin resource failures and unexpected blocking dialogs are blockers unless an explicit reviewed exception applies.

This is local/development/UAT/CI verification infrastructure. It is not customer production telemetry and it does not grant agents arbitrary DevTools or RCE-equivalent execution.
