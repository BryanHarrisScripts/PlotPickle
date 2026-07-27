import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #87 keeps Dashboard ready behind the startup splash and Simple Start optional", async () => {
  const [page, shell, middleware] = await Promise.all([
    source("app/page.tsx"),
    source("app/application-shell-header.tsx"),
    source("middleware.ts"),
  ]);
  assert.match(page, /useState<MainTab>\("dashboard"\)/);
  assert.match(page, /useState\(true\)/);
  assert.match(page, /id: "simpleStart"[\s\S]*label: "Simple Start"/);
  assert.match(page, /<SimpleStart/);
  assert.match(page, /<ApplicationShellHeader[\s\S]*onOpenLanding=\{\(\) => setShowLanding\(true\)\}/);
  assert.match(shell, /Open the PlotPickle marketing page/);
  assert.doesNotMatch(middleware, /NextResponse\.redirect/);
  assert.doesNotMatch(middleware, /plotpickle-open-last/);
});

test("issue #87 places Reports in core navigation and Terminology in learning", async () => {
  const [page, contract] = await Promise.all([source("app/page.tsx"), source("lib/product-direction.ts")]);
  assert.match(contract, /id: "reports", label: "Reports"/);
  assert.match(page, /activeTab === "reports"[\s\S]*ReportsWorkspace/);
  assert.match(page, /Screenplay terminology[\s\S]*TerminologyIndex/);
});

test("issue #87 keeps GitHub AI and Music capabilities inside the expanded Settings workspace", async () => {
  const settings = await source("app/settings-panel.tsx");
  assert.match(settings, /label: "GitHub"/);
  assert.match(settings, /label: "AI providers"/);
  assert.match(settings, /Music service links/);
  assert.doesNotMatch(settings, /<b>Reports<\/b>/);
  assert.doesNotMatch(settings, /<b>Terminology Index<\/b>/);
});

test("issue #87 preserves the Welcome deep link as optional Simple Start", async () => {
  const welcome = await source("app/welcome/page.tsx");
  assert.match(welcome, /Simple Start · optional guided entry/);
  assert.match(welcome, /Open main workspace/);
  assert.match(welcome, /\/\?workspace=1/);
  assert.doesNotMatch(welcome, /plotpickle-open-last/);
  assert.doesNotMatch(welcome, /Open my last project directly/);
});
