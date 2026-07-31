import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const taxonomy = JSON.parse(await source("config/settings-system-taxonomy.json"));

function everyItem() {
  return [
    ...taxonomy.workspace.map((item) => ({ item, system: "Workspace" })),
    ...taxonomy.systems.flatMap((system) => system.items.map((item) => ({ item, system: system.label }))),
  ];
}

test("Settings uses the locked eight-bin system taxonomy", () => {
  assert.equal(taxonomy.schemaVersion, 1);
  assert.equal(taxonomy.groupLabel, "Systems");
  assert.deepEqual(
    taxonomy.systems.map((system) => system.label),
    ["Local", "Cloud", "Data", "Deploy", "Repos", "Auth", "Agents", "Open Source"],
  );
  assert.deepEqual(
    taxonomy.workspace.map((item) => item.label),
    ["General", "Appearance & Accessibility", "Project Defaults"],
  );
});

test("every Settings submenu item has repeatable help language and an honest destination", () => {
  const ids = new Set();
  const allowedStatuses = new Set(["installed", "configure", "optional", "planned", "reference"]);
  const allowedTargets = new Set(["general", "appearance", "project-defaults", "storage", "ai", "github", "plugins", "google", "privacy", "about"]);

  for (const { item, system } of everyItem()) {
    assert.ok(item.id && !ids.has(item.id), `Duplicate or missing Settings item id: ${item.id}`);
    ids.add(item.id);
    assert.ok(item.label.length >= 3, `${system} has an unusable submenu title.`);
    assert.ok(item.helpTerm.includes(system === "Workspace" ? item.label.split(" ")[0] : system), `${item.label} is missing a repeatable help term.`);
    assert.ok(item.description.endsWith("."), `${item.label} needs a complete plain-language description.`);
    assert.ok(allowedStatuses.has(item.status), `${item.label} has an unsupported availability state.`);
    if (item.target) assert.ok(allowedTargets.has(item.target), `${item.label} routes to an unknown Settings surface.`);
    if (item.href) assert.match(item.href, /^\/settings\//, `${item.label} routes outside Settings.`);
    if (!item.target && !item.href) assert.ok(["planned", "reference"].includes(item.status), `${item.label} exposes no honest destination.`);
  }
});

test("the planning mechanics live in their named system homes", () => {
  const text = JSON.stringify(taxonomy);
  for (const term of [
    "Prompting",
    "Tokens",
    "RAG pipelines",
    "Embeddings",
    "MCP server definitions",
    "ReAct loops",
    "Guardrails",
    "GGUF",
    "EXL2",
    "Function calling",
    "TTFT monitoring",
    "Human-in-the-loop authorization gates",
  ]) assert.ok(text.includes(term), `Settings taxonomy is missing: ${term}`);

  const bySystem = Object.fromEntries(taxonomy.systems.map((system) => [system.label, JSON.stringify(system)]));
  assert.match(bySystem.Local, /ComfyUI/);
  assert.match(bySystem.Cloud, /OpenAI API/);
  assert.match(bySystem.Cloud, /Modal/);
  assert.match(bySystem.Data, /Vector stores/);
  assert.match(bySystem.Deploy, /Cloudflare Workers/);
  assert.match(bySystem.Repos, /Afterglow repository/);
  assert.match(bySystem.Auth, /Windows DPAPI/);
  assert.match(bySystem.Agents, /Docker Compose/);
  assert.match(bySystem["Open Source"], /Hugging Face/);
});

test("the new Settings shell uses nested system menus while preserving working configuration surfaces", async () => {
  const [panel, css, legacy] = await Promise.all([
    source("app/settings-panel.tsx"),
    source("app/settings-system-navigation.module.css"),
    source("app/settings-panel-legacy.tsx"),
  ]);

  assert.match(panel, /settings-system-taxonomy\.json/);
  assert.match(panel, /aria-label="PlotPickle Settings systems"/);
  assert.match(panel, /aria-expanded=\{expanded\}/);
  assert.match(panel, /activeSubmenuItem/);
  assert.match(panel, /STATUS_LABELS/);
  assert.match(panel, /helpTerm/);
  assert.match(panel, /plotpickle:settings-section/);
  assert.match(panel, /LegacySettingsPanel/);
  assert.match(panel, /No configuration is active yet/);
  assert.match(css, /nav\[aria-label="Settings sections"\]\s*\{\s*display: none/s);
  assert.match(css, /grid-column: 1 \/ -1/);

  for (const preserved of [
    "Save key & connect",
    "Sign in with Google",
    "surface=\"configuration\"",
    "surface=\"storage\"",
    "Erase all credentials",
  ]) assert.ok(legacy.includes(preserved), `The preserved Settings engine is missing: ${preserved}`);
});

test("the taxonomy brief records the implementation boundary", async () => {
  const brief = await source("docs/settings-system-taxonomy.md");
  assert.match(brief, /information architecture and navigation/);
  assert.match(brief, /does not install Buzz, Docker, ComfyUI/);
  assert.match(brief, /canonical help terms/);
});
