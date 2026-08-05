import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (relativePath) => readFile(path.join(root, relativePath), "utf8");

test("issue #351 renders all 24 canonical Block positions in four acts", async () => {
  const component = await source("app/build-health-map.tsx");
  assert.match(component, /Array\.from\(\{ length: 24 \}/);
  assert.match(component, /\[1, 2, 3, 4\]\.map/);
  assert.match(component, /Math\.floor\(index \/ 6\) \+ 1/);
  assert.match(component, /ACT_LABELS = \["Setup", "Confrontation", "Complication", "Resolution"\]/);
  assert.ok(component.includes("Missing Block"));
  assert.ok(component.includes("disabled={!position.card}"));
});

test("issue #351 applies the shared green yellow red readiness contract", async () => {
  const component = await source("app/build-health-map.tsx");
  for (const contract of [
    'locked: { tone: "green", label: "Locked", symbol: "✓" }',
    'ready: { tone: "green", label: "Ready", symbol: "✓" }',
    'developing: { tone: "yellow", label: "Developing", symbol: "!" }',
    'empty: { tone: "red", label: "Empty", symbol: "×" }',
    'missing: { tone: "red", label: "Missing", symbol: "×" }',
    "24-Block readiness totals",
    "Ready or locked",
    "Empty or missing",
  ]) assert.ok(component.includes(contract), `Missing health-map contract: ${contract}`);
  assert.match(component, /data-tone=\{position\.tone\}/);
  assert.match(component, /position\.symbol/);
  assert.match(component, /position\.label/);
});

test("issue #351 provides keyboard and screen-reader navigation", async () => {
  const component = await source("app/build-health-map.tsx");
  const workspace = await source("app/build-workspace.tsx");
  for (const contract of [
    'aria-labelledby="build-health-map-title"',
    "aria-pressed={position.card ? selected : undefined}",
    "aria-label={`Block ${position.number}",
    "onClick={() => position.card && onSelect(position.card)}",
  ]) assert.ok(component.includes(contract), `Missing accessible map contract: ${contract}`);
  for (const contract of [
    'import BuildHealthMap from "./build-health-map"',
    "<BuildHealthMap cards={model.cards}",
    'setView("blocks")',
    'setStatus("all")',
    "document.getElementById(`build-block-${card.id}`)?.focus",
    "aria-label={`Block ${card.number}",
  ]) assert.ok(workspace.includes(contract), `Missing Build integration contract: ${contract}`);
});

test("issue #351 protects touch, responsive, focus, motion and forced-colour states", async () => {
  const css = await source("app/build-health-map.module.css");
  for (const contract of [
    "min-height:94px",
    ":focus-visible",
    "overflow-x:auto",
    "@media(max-width:560px)",
    "@media(prefers-reduced-motion:reduce)",
    "@media(forced-colors:active)",
    "data-selected=true",
  ]) assert.ok(css.includes(contract), `Missing health-map visual contract: ${contract}`);
});

test("issue #351 migrates Build recovery to the shared confirmation layer", async () => {
  const workspace = await source("app/build-workspace.tsx");
  const inventory = JSON.parse(await source("config/overlay-confirmation-inventory.json"));
  assert.ok(workspace.includes('import { requestPlotPickleConfirmation } from "./common-overlay-layer"'));
  assert.ok(workspace.includes("await requestPlotPickleConfirmation({"));
  assert.ok(workspace.includes('confirmLabel: "Restore arrangement"'));
  assert.doesNotMatch(workspace, /\bwindow\.confirm\s*\(/);
  assert.ok(!inventory.entries.some((entry) => entry.path === "app/build-workspace.tsx"));
});

test("issue #351 is registered as the Build screen audit", async () => {
  const registry = JSON.parse(await source("config/ui-ux-screen-registry.json"));
  const entry = registry.screens.find((screen) => screen.id === "build");
  assert.ok(entry);
  assert.equal(entry.issue, 351);
  assert.ok(["in-progress", "audited"].includes(entry.status));
});
