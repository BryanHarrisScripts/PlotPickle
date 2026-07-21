import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
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

test("renders the Resonance Engine route", async () => {
  const html = await render("/resonance");
  assert.match(html, /Resonance Engine/);
  assert.match(html, /Ask a question the story must earn/);
  assert.match(html, /Make this block carry part of the argument/);
  assert.match(html, /Evidence channels/);
  assert.match(html, /Restraint rule/);
});

test("renders the DraftLens Engine route", async () => {
  const html = await render("/draftlens");
  assert.match(html, /DraftLens Engine/);
  assert.match(html, /Record the experience before trying to repair it/);
  assert.match(html, /Six diagnostic lenses/);
  assert.match(html, /Separate the visible symptom from the root cause/);
  assert.match(html, /Notes protocol/);
});

test("Windows launcher repairs interrupted dependency installs", async () => {
  const launcher = await readFile(new URL("../Start-PlotPickle.bat", import.meta.url), "utf8");
  assert.ok(launcher.includes('set "VITE_CMD=node_modules\\.bin\\vite.cmd"'));
  assert.ok(launcher.includes("npm ci --include=dev --prefer-offline"));
  assert.ok(launcher.includes("npm install --include=dev --prefer-offline"));
  assert.ok(launcher.includes('call "%VITE_CMD%" --host 127.0.0.1 --port %PLOTPICKLE_PORT%'));
  assert.ok(launcher.includes("An incomplete PlotPickle component folder was detected."));
});

test("Windows launcher explains and verifies the local installation", async () => {
  const launcher = await readFile(new URL("../Start-PlotPickle.bat", import.meta.url), "utf8");
  assert.ok(launcher.includes("[STEP 1 OF 4] Checking Node.js and npm"));
  assert.ok(launcher.includes("Continue with this local installation? [Y/N]"));
  assert.ok(launcher.includes("SUCCESS - PLOTPICKLE COMPONENTS ARE READY") || launcher.includes('node "%SETUP_REPORT%" success'));
  assert.ok(launcher.includes("Only this computer can use this 127.0.0.1 address."));
  assert.ok(launcher.includes("does not require Administrator rights"));
});

test("Windows setup report lists space, packages, privacy, and local-server meaning", async () => {
  const reportUrl = new URL("../scripts/windows-setup-report.mjs", import.meta.url);
  const { stdout } = await execFileAsync(process.execPath, [reportUrl.pathname, "plan"], {
    cwd: new URL("..", import.meta.url),
  });
  assert.match(stdout, /PLOTPICKLE INSTALLATION PLAN/);
  assert.match(stdout, /Recommended free space before setup: 2\.00 GB/);
  assert.match(stdout, /Local development server: vite/);
  assert.match(stdout, /does not request Administrator rights/);
  assert.match(stdout, /server listens on 127\.0\.0\.1/);
  assert.match(stdout, /does not upload your story project/);
});
