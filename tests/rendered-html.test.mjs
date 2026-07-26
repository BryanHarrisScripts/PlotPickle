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

test("renders the premium startup splash and preserves the local-first workspace contract", async () => {
  const html = await render("/");
  assert.match(html, developmentPreviewMeta);
  assert.match(html, /PlotPickle Playhouse/);
  assert.match(html, /Story Planner/);
  assert.match(html, /Simple Start/);
  for (const phrase of ["Learn the craft", "Plan the whole story", "Write the screenplay", "See the film", "Refine with purpose"]) {
    assert.match(html, new RegExp(phrase));
  }
  assert.match(html, /\/brand\/favicon\/plotpickle-icon-128\.png/);

  const [source, navigation] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/product-direction.ts", import.meta.url), "utf8"),
  ]);
  for (const phrase of [
    'id: "simpleStart", code: "SS", label: "Simple Start"',
    'id: "overview", code: "OV", label: "Project Overview"',
    'id: "structureMap", code: "ST", label: "Structure Map"',
    "One story. Five connected workspaces.",
    "Script Viewer",
    "Copyright & licensing",
  ]) {
    assert.ok(source.includes(phrase), `Root workspace source is missing: ${phrase}`);
  }
  assert.ok(navigation.includes('{ id: "reports", label: "Reports", description: "Understand the screenplay" }'));
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

test("renders the Voiceprint Engine route", async () => {
  const html = await render("/voiceprint");
  assert.match(html, /Voiceprint Engine/);
  assert.match(html, /Project dialogue system/);
  assert.match(html, /Character-specific language/);
  assert.match(html, /Scene pressure reference/);
});

test("renders the PageFlow Engine route", async () => {
  const html = await render("/pageflow");
  assert.match(html, /PageFlow Engine/);
  assert.match(html, /Project screenplay intelligence/);
  assert.match(html, /Scene page rhythm/);
  assert.match(html, /Action-to-dialogue balance/);
});

test("renders the Resonance Engine route", async () => {
  const html = await render("/resonance");
  assert.match(html, /Resonance Engine/);
  assert.match(html, /Theme and meaning/);
  assert.match(html, /Motif evidence/);
});

test("renders the DraftLens Engine route", async () => {
  const html = await render("/draftlens");
  assert.match(html, /DraftLens Engine/);
  assert.match(html, /Draft diagnostics/);
  assert.match(html, /Priority revision pass/);
});

test("registers the CraftLoop client route and preserves its workspace contract", async () => {
  const html = await render("/craftloop");
  assert.match(html, /CraftLoop Engine/);
  assert.match(html, /Deliberate practice/);
  const source = await readFile(new URL("../app/craftloop/page.tsx", import.meta.url), "utf8");
  assert.match(source, /CraftLoopWorkspace/);
});

test("registers the Structure Engine and preserves the 4-12-24-48-96 workspace", async () => {
  const html = await render("/structure");
  assert.match(html, /Structure Engine/);
  const source = await readFile(new URL("../app/structure/page.tsx", import.meta.url), "utf8");
  assert.match(source, /StructureWorkspace/);
});

test("build script remains executable", async () => {
  const script = fileURLToPath(new URL("../scripts/build-verified.mjs", import.meta.url));
  const result = await execFileAsync(process.execPath, [script, "--help"], { timeout: 30_000 });
  assert.equal(result.stderr, "");
});