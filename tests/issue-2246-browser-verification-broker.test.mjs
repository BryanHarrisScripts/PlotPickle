import assert from "node:assert/strict";
import test from "node:test";
import {
  BROWSER_DIAGNOSTIC_SCHEMA_VERSION,
  BROWSER_VERIFICATION_ADAPTERS,
  browserDiagnosticFingerprint,
  browserVerificationAdapterCapabilities,
  sanitizeBrowserDiagnosticText,
  sanitizeBrowserDiagnosticUrl,
} from "../lib/verification/browser-verification-broker.mjs";

test("#2246 exposes a swappable browser adapter contract without changing PlotPickle policy authority", () => {
  assert.equal(BROWSER_DIAGNOSTIC_SCHEMA_VERSION, 1);
  assert.deepEqual(
    Object.keys(BROWSER_VERIFICATION_ADAPTERS),
    ["playwright-test", "playwright-cli", "playwright-mcp"],
  );
  assert.equal(browserVerificationAdapterCapabilities("playwright-test").role, "deterministic-ci");
  assert.equal(browserVerificationAdapterCapabilities("playwright-cli").role, "developer-agent");
  assert.equal(browserVerificationAdapterCapabilities("playwright-mcp").role, "persistent-exploratory");
  assert.throws(() => browserVerificationAdapterCapabilities("unknown"), /Unsupported Browser Verification adapter/);
});

test("#2246 browser diagnostic evidence redacts secrets and local paths", () => {
  const text = sanitizeBrowserDiagnosticText(
    "Authorization: Bearer abc.def token=secret123 C:\\Users\\Bryan\\private.txt /home/test/private.txt",
  );
  assert.doesNotMatch(text, /abc\.def|secret123|Bryan|\/home\/test/);
  assert.match(text, /REDACTED/);
  assert.match(text, /LOCAL_PATH/);

  const url = sanitizeBrowserDiagnosticUrl("http://127.0.0.1:4173/api/test?token=secret#private");
  assert.equal(url, "http://127.0.0.1:4173/api/test");
});

test("#2246 browser diagnostic fingerprints are stable and context-sensitive", () => {
  const common = {
    category: "runtime-exception",
    surfaceId: "storyboard",
    route: "http://127.0.0.1:4173/storyboard",
    actionId: "open-storyboard",
    summary: "ReferenceError",
    detail: "thing is not defined",
  };
  assert.equal(browserDiagnosticFingerprint(common), browserDiagnosticFingerprint({ ...common }));
  assert.notEqual(browserDiagnosticFingerprint(common), browserDiagnosticFingerprint({ ...common, surfaceId: "previs" }));
});

test("#2246 canonical browser verification callers use the broker rather than direct Chromium launch", async () => {
  const { readFile } = await import("node:fs/promises");
  const targets = [
    "lib/verification/webmcp-standard-surface-catalogue.mjs",
    "lib/verification/webmcp-surface-visual-audit.mjs",
    "lib/verification/ui-axe-audit.mjs",
    "lib/verification/ui-experience-audit.mjs",
    "lib/verification/sitemap/ui-sitemap-rendered-audit.mjs",
    "lib/verification/skin-v1-menu-contract-audit.mjs",
    "lib/verification/skin-v1-visual-director.mjs",
  ];
  for (const target of targets) {
    const source = await readFile(new URL(`../${target}`, import.meta.url), "utf8");
    assert.match(source, /createBrowserVerificationSession/, `${target} must consume the Browser Verification Broker`);
    assert.doesNotMatch(source, /chromium\.launch\(/, `${target} must not launch Chromium directly`);
  }
});
