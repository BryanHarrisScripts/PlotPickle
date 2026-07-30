import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
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

test("renders the approved product-authentic startup splash and preserves the local-first workspace contract", async () => {
  const html = await render("/");
  assert.match(html, developmentPreviewMeta);
  for (const phrase of [
    "PlotPickle",
    "Build better stories.",
    "Review faster. Stay in control.",
    "Product-authentic PlotPickle Dashboard preview",
    "Storyworld Overview",
    "Writing Progress",
    "GitHub Approvals",
    "Optional Buzz",
    "Graphic Novel",
    "One application. Three desktop packages.",
    "Works without AI",
    "There is no required PlotPickle cloud account",
    "Open software. Open method. Your story.",
    "Shape the storyworld. Review the evidence. Stay in control.",
  ]) {
    assert.ok(html.includes(phrase), "Rendered splash is missing: " + phrase);
  }
  assert.match(html, /\/brand\/favicon\/plotpickle-icon-128\.png/);

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

test("the build script emits a worker that serves the home page", async () => {
  const script = fileURLToPath(new URL("../scripts/build-verified.mjs", import.meta.url));
  const { stdout, stderr } = await execFileAsync(process.execPath, [script], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: process.env,
  });
  assert.match(`${stdout}\n${stderr}`, /Build completed successfully|Build verified/);
});
