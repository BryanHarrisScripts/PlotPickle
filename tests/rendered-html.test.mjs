import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker;
}

async function render(pathname) {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  return response.text();
}

test("renders the visual-storytelling startup splash and preserves the local-first workspace contract", async () => {
  const html = await render("/");
  assert.match(html, developmentPreviewMeta);
  for (const phrase of [
    "PlotPickle",
    "Storytelling",
    "Has Changed.",
    "Write the narrative. Shape the vision.",
    "Build worlds, characters and story",
    "The writer is no longer only writing the story",
    "they are directing the storyworld.",
    "Narrative First",
    "World &amp; Character Vision",
    "Storyboard Thinking",
    "Human-Led Creative Direction",
    "From Concept to Visual Canon",
    "Start privately. Add people only when the story needs them.",
    "Load Afterglow",
    "Graphic Novel",
    "Works without AI",
    "AI can help you see possibilities. It does not get final cut.",
  ]) {
    assert.ok(html.includes(phrase), "Rendered splash is missing: " + phrase);
  }
  assert.match(html, /\/design\/plotpickle-splash-character\.svg/);
  assert.match(html, /\/design\/plotpickle-splash-world\.svg/);
  assert.match(html, /\/design\/plotpickle-splash-storyboard\.svg/);

  const [source, navigation, splash] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/product-direction.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/marketing-splash-base.tsx", import.meta.url), "utf8"),
  ]);
  for (const phrase of [
    'id: "simpleStart", code: "SS", label: "Simple Start"',
    'id: "overview", code: "OV", label: "Project Overview"',
    'id: "structureMap", code: "ST", label: "Structure Map"',
    "One story. Five connected workspaces.",
    "Introduction",
  ]) {
    assert.ok(source.includes(phrase), "Root workspace source is missing: " + phrase);
  }
  assert.match(splash, /OPEN_SOURCE_FOUNDATIONS\.map/);
  assert.match(splash, /href="\/legal"/);
  assert.match(splash, /plotpickle-multi-server-collaboration\.svg/);
  assert.match(splash, /Product-authentic PlotPickle Dashboard preview/);
  assert.match(splash, /Buzz is dormant by default/);
  assert.match(navigation, /id: "reports", label: "Reports", description: "Understand the screenplay", zone: "production"/);
  assert.match(navigation, /id: "pitch", label: "Graphic Novel"/);
  assert.ok(navigation.includes('{ id: "dashboard", label: "Dashboard"'));
  assert.ok(!source.includes("PlotPickle Online"), "Official product page should not advertise an online PlotPickle edition");
});

test("registers the legal route and preserves ownership and server-use guidance", async () => {
  await render("/legal");
  const source = await readFile(new URL("../app/legal/page.tsx", import.meta.url), "utf8");
  for (const phrase of [
    "Open software. Shared method. Your story remains yours.",
    "GNU Affero General Public License",
    "Creative Commons Attribution-ShareAlike 4.0",
    "Server operator checklist",
    "Plesk or WordPress",
  ]) {
    assert.ok(source.includes(phrase), `Legal route source is missing: ${phrase}`);
  }
});

test("renders the Plan-owned Voiceprint route", async () => {
  const html = await render("/voiceprint");
  assert.match(html, /Voiceprint Planner/);
  assert.match(html, /Project dialogue system/);
  assert.match(html, /Character-specific language/);
});
