import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("defines the five canonical connection lifecycle states", async () => {
  const lifecycle = await source("lib/connection-lifecycle.ts");
  for (const state of ["optional", "connecting", "connected", "attention", "failed"]) {
    assert.match(lifecycle, new RegExp(`"${state}"`));
  }
});

test("never-configured services remain neutral and optional", async () => {
  const lifecycle = await source("lib/connection-lifecycle.ts");
  assert.match(lifecycle, /return \{ state: "optional", label: "Optional · not configured", tone: "neutral" \}/);
  assert.match(lifecycle, /return "optional"/);
});

test("error tone is reserved for a previously connected failed service", async () => {
  const lifecycle = await source("lib/connection-lifecycle.ts");
  assert.match(lifecycle, /input\.failed && input\.previouslyConnected/);
  assert.match(lifecycle, /case "failed":[\s\S]*tone: "error"/);
  assert.match(lifecycle, /mayUseErrorTone[\s\S]*=== "failed"/);
});

test("GitHub and Buzz use the shared lifecycle adapters", async () => {
  const [lifecycle, status] = await Promise.all([
    source("lib/connection-lifecycle.ts"),
    source("app/project-collaboration-status.tsx"),
  ]);
  assert.match(lifecycle, /githubConnectionLifecycle/);
  assert.match(lifecycle, /buzzConnectionLifecycle/);
  assert.match(status, /githubConnectionLifecycle\(collaboration\)/);
  assert.match(status, /buzzConnectionLifecycle\(buzz\)/);
  assert.match(status, /data-tone=\{buzzStatus\.tone\}/);
  assert.match(status, /data-tone=\{github\.tone\}/);
});

test("dashboard styling exposes error only through the shared semantic tone", async () => {
  const css = await source("app/project-collaboration-status.module.css");
  assert.match(css, /data-tone="neutral"/);
  assert.match(css, /data-tone="working"/);
  assert.match(css, /data-tone="healthy"/);
  assert.match(css, /data-tone="attention"/);
  assert.match(css, /data-tone="error"/);
  assert.doesNotMatch(css, /data-state=/);
});
