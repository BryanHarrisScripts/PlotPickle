import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("main application exposes Refine as the connected Engines workspace", async () => {
  const [page, shell, splash, navigation] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/application-shell-header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/marketing-splash.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/product-direction.ts", import.meta.url), "utf8"),
  ]);
  assert.ok(page.includes("type MainTab = ProductNavigationId"));
  assert.ok(page.includes('import ApplicationShellHeader from "./application-shell-header"'));
  assert.match(shell, /PRODUCT_NAVIGATION\.filter/);
  assert.match(navigation, /id: "engines", label: "Refine", description: "Refine the story", zone: "workflow"/);
  assert.ok(page.includes('import EngineHub from "./engine-hub"'));
  assert.ok(page.includes('{activeTab === "engines" ? <EngineHub /> : null}'));
  assert.ok(splash.includes("components.map"));
  assert.ok(splash.includes("An open film-development platform."));
});

test("Engines workspace explains every specialist before opening it", async () => {
  const source = await readFile(new URL("../app/engine-hub.tsx", import.meta.url), "utf8");
  for (const title of [
    "Structure Engine",
    "Resonance Engine",
    "Voiceprint Engine",
    "PageFlow Engine",
    "DraftLens Engine",
    "CraftLoop Engine",
  ]) {
    assert.ok(source.includes(title), `Engines workspace is missing ${title}`);
  }
  for (const contract of [
    "Use it when",
    "Works with shared project data",
    "Expected result",
    "One active project",
    "There is no required order.",
  ]) {
    assert.ok(source.includes(contract), `Engines workspace is missing guidance: ${contract}`);
  }
});
