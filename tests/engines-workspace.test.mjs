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
  assert.match(navigation, /id: "engines", label: "Refine", description: "Refine the story", zone: "production"/);
  assert.ok(page.includes('import EngineHub from "./engine-hub"'));
  assert.match(page, /activeTab === "engines"[\s\S]*<EngineHub onOpenBuild=/);
  assert.match(page, /setReportBuildTargetId\("mini-blocks"\)/);
  assert.match(page, /setActiveTab\("build"\)/);
  assert.ok(splash.includes("components.map"));
  assert.ok(splash.includes("An open film-development platform."));
});

test("Refine explains each diagnostic pass and routes edits to their owners", async () => {
  const source = await readFile(new URL("../app/engine-hub.tsx", import.meta.url), "utf8");
  for (const title of [
    "Overview & Diagnostic Queue",
    "Structure & Pacing Diagnostics",
    "Story & Theme through Resonance",
    "Character & Dialogue Diagnostics",
    "Page & Scene Diagnostics through PageFlow",
    "Full-Draft Diagnosis through DraftLens",
    "Revision Passes & Essential Craft Audit",
  ]) {
    assert.ok(source.includes(title), `Refine is missing ${title}`);
  }
  for (const contract of [
    "Use it when",
    "Reads shared canonical evidence",
    "Expected result",
    "Refine diagnoses and proposes.",
    "Tools that edit or approve now open from their owner.",
  ]) {
    assert.ok(source.includes(contract), `Refine is missing guidance: ${contract}`);
  }
  assert.match(source, /Build owns arrangement\. Refine reads the same structure for diagnosis\./);
  assert.match(source, /Open Build structure editor/);
  assert.doesNotMatch(source, /title: "Structure Engine"|href: "\/structure"/);
});
