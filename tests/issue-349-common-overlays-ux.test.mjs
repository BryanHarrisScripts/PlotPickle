import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (relativePath) => readFile(path.join(root, relativePath), "utf8");

async function appSourceFiles(directory = path.join(root, "app")) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await appSourceFiles(absolute));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(absolute);
  }
  return files;
}

test("issue #349 mounts one shared overlay and feedback layer", async () => {
  const layout = await source("app/layout.tsx");
  assert.match(layout, /import CommonOverlayLayer from "\.\/common-overlay-layer"/);
  assert.equal((layout.match(/<CommonOverlayLayer \/>/g) ?? []).length, 1);
});

test("issue #349 exposes asynchronous confirmation and queued notification APIs", async () => {
  const overlay = await source("app/common-overlay-layer.tsx");
  for (const contract of [
    "requestPlotPickleConfirmation",
    "Promise<boolean>",
    'new CustomEvent("plotpickle:confirm"',
    "notifyPlotPickle",
    'new CustomEvent("plotpickle:notify"',
    'aria-labelledby="plotpickle-confirmation-title"',
    'aria-describedby="plotpickle-confirmation-description"',
    "onCancel",
    "Dismiss notification",
    'aria-atomic="true"',
  ]) assert.ok(overlay.includes(contract), `Missing shared overlay contract: ${contract}`);
  assert.match(overlay, /role === "alert" \? "assertive" : "polite"/);
  assert.match(overlay, /Math\.max\(0, Math\.min\(/);
});

test("issue #349 contains modal focus, Escape and legacy-toast behaviour", async () => {
  const overlay = await source("app/common-overlay-layer.tsx");
  for (const contract of [
    "FOCUSABLE_SELECTOR",
    "MutationObserver",
    'dialog[open], [role=\'dialog\'][aria-modal=\'true\']',
    'event.key === "Tab"',
    'event.key === "Escape"',
    "plotpickle:overlay-dismiss",
    "plotpickle-overlay-active",
    "plotpickleFeedback",
    'aria-live',
    "confirmationOriginRef.current.focus()",
  ]) assert.ok(overlay.includes(contract), `Missing focus or feedback contract: ${contract}`);
});

test("issue #349 protects responsive, touch, contrast and motion states", async () => {
  const css = await source("app/common-overlay-layer.module.css");
  for (const contract of [
    "min-height: 44px",
    "env(safe-area-inset-top)",
    "env(safe-area-inset-right)",
    ":focus-visible",
    "@media (max-width: 560px)",
    "@media (prefers-reduced-motion: reduce)",
    "@media (forced-colors: active)",
    "overflow: hidden",
  ]) assert.ok(css.includes(contract), `Missing overlay visual contract: ${contract}`);
});

test("issue #349 inventories every remaining native app confirmation", async () => {
  const inventory = JSON.parse(await source("config/overlay-confirmation-inventory.json"));
  const registry = JSON.parse(await source("config/ui-ux-screen-registry.json"));
  const registryIds = new Set(registry.screens.map((screen) => screen.id));
  const listed = inventory.entries.map((entry) => entry.path).sort();
  assert.equal(new Set(listed).size, listed.length, "Confirmation inventory paths must be unique");
  for (const entry of inventory.entries) {
    assert.ok(registryIds.has(entry.registryScreen), `Unknown registry owner for ${entry.path}: ${entry.registryScreen}`);
    assert.ok(entry.owner.trim().length >= 3, `Missing owner description for ${entry.path}`);
  }

  const discovered = [];
  for (const absolute of await appSourceFiles()) {
    const content = await readFile(absolute, "utf8");
    if (/\bwindow\.confirm\s*\(/.test(content)) discovered.push(path.relative(root, absolute).replaceAll(path.sep, "/"));
  }
  discovered.sort();
  assert.deepEqual(discovered, listed, "Raw window.confirm locations changed; migrate or register the owning screen explicitly");
});

test("issue #349 is recorded in the canonical UI/UX registry", async () => {
  const registry = JSON.parse(await source("config/ui-ux-screen-registry.json"));
  const entry = registry.screens.find((screen) => screen.id === "shell-common-overlays");
  assert.ok(entry);
  assert.equal(entry.issue, 349);
  assert.equal(entry.status, "in-progress");
  assert.equal(entry.pullRequest, 350);
});
