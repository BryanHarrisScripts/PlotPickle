import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #87 opens the Dashboard directly and keeps Simple Start optional", async () => {
  const [page, middleware] = await Promise.all([source("app/page.tsx"), source("middleware.ts")]);
  assert.match(page, /useState<MainTab>("dashboard")/);
  assert.match(page, /useState(false)/);
  assert.match(page, /id: "simpleStart"[sS]*label: "Simple Start"/);
  assert.match(page, /<SimpleStart/);
  assert.match(page, /setShowLanding(true)/);
  assert.match(page, /Open the PlotPickle marketing page/);
  assert.doesNotMatch(middleware, /NextResponse.redirect/);
  assert.doesNotMatch(middleware, /plotpickle-open-last/);
});

test("issue #87 places Reports in core navigation and Terminology in learning", async () => {
  const [page, contract] = await Promise.all([source("app/page.tsx"), source("lib/product-direction.ts")]);
  assert.match(contract, /id: "reports", label: "Reports"/);
  assert.match(page, /activeTab === "reports"[sS]*ScreenplayReports/);
  assert.match(page, /Screenplay terminology[sS]*TerminologyIndex/);
});

test("issue #87 groups GitHub, AI and Music under Settings Setup", async () => {
  const settings = await source("app/settings-panel.tsx");
  assert.match(settings, /Settings · Setup/);
  assert.match(settings, /GitHub setup/);
  assert.match(settings, /AI setup/);
  assert.match(settings, /Music setup/);
  assert.doesNotMatch(settings, /<b>Reports</b>/);
  assert.doesNotMatch(settings, /<b>Terminology Index</b>/);
});

test("issue #87 preserves the Welcome deep link as optional Simple Start", async () => {
  const welcome = await source("app/welcome/page.tsx");
  assert.match(welcome, /Simple Start · optional guided entry/);
  assert.match(welcome, /Open main workspace/);
  assert.match(welcome, //?workspace=1/);
  assert.doesNotMatch(welcome, /plotpickle-open-last/);
  assert.doesNotMatch(welcome, /Open my last project directly/);
});
