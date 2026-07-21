import assert from "node:assert/strict";
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

test("renders the main PlotPickle workspace", async () => {
  const html = await render("/");
  assert.match(html, developmentPreviewMeta);
  assert.match(html, /PlotPickle Playhouse/);
  assert.match(html, /Download for Windows/);
  assert.match(html, /Explore PlotPickle Online/);
  assert.match(html, /\/brand\/plotpickle-header-horizontal-600\.png/);
  assert.match(html, /\/brand\/favicon\/plotpickle-icon-192\.png/);
  for (const section of [
    "Story Setup",
    "Pitch &amp; Vision",
    "World",
    "Characters",
    "Ghost",
    "Catalyst",
    "Foundations",
    "The Pickle",
    "Dialogue",
    "24 Blocks",
    "Storyboard",
    "Notes",
  ]) {
    assert.match(html, new RegExp(section));
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
  assert.match(html, /Write the movie the reader can see/);
  assert.match(html, /Revision signals/);
  assert.match(html, /Five-pass rewrite/);
});
