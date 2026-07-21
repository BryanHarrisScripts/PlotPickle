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

test("registers the CraftLoop client route and preserves its workspace contract", async () => {
  const html = await render("/craftloop");
  assert.match(html, /page:\/craftloop/);

  const source = await readFile(new URL("../app/craftloop/page.tsx", import.meta.url), "utf8");
  for (const phrase of [
    "CraftLoop Engine",
    "Give the audience something active to track",
    "Make Block {selectedBlock.number} end differently than it began",
    "Observe motive, rhythm, silence, and status",
    "Repeatable studio loop",
  ]) {
    assert.ok(source.includes(phrase), `CraftLoop source is missing: ${phrase}`);
  }
});

test("registers the Structure Engine and preserves the 4-12-24-48-96 workspace", async () => {
  const html = await render("/structure");
  assert.match(html, /page:\/structure/);

  const source = await readFile(new URL("../app/structure/page.tsx", import.meta.url), "utf8");
  for (const phrase of [
    "Structure Engine",
    "12-Sequence Navigator",
    "Story Clock",
    "Rebalance full timeline",
    "Mini-block B{block.number}.{mini.number}",
    "calculated ASL",
  ]) {
    assert.ok(source.includes(phrase), `Structure Engine source is missing: ${phrase}`);
  }
});

test("schema 1.4 requires twelve sequences, two scenes per block, and two mini-blocks per scene", async () => {
  const raw = await readFile(new URL("../schema/plotpickle-project.schema.json", import.meta.url), "utf8");
  const schema = JSON.parse(raw);
  assert.equal(schema.properties.schemaVersion.const, "1.4.0");
  assert.ok(schema.required.includes("structure"));
  assert.equal(schema.$defs.structure.properties.sequences.minItems, 12);
  assert.equal(schema.$defs.structure.properties.sequences.maxItems, 12);
  assert.equal(schema.$defs.block.properties.scenes.minItems, 2);
  assert.equal(schema.$defs.block.properties.scenes.maxItems, 2);
  assert.equal(schema.$defs.scene.properties.miniBlocks.minItems, 2);
  assert.equal(schema.$defs.scene.properties.miniBlocks.maxItems, 2);
});

test("project migration accepts earlier schemas and creates the new hierarchy", async () => {
  const projectSource = await readFile(new URL("../lib/project.ts", import.meta.url), "utf8");
  const structureSource = await readFile(new URL("../lib/structure.ts", import.meta.url), "utf8");
  for (const version of ["1.0.0", "1.1.0", "1.2.0", "1.3.0", "1.4.0"]) {
    assert.ok(projectSource.includes(`\"${version}\"`), `Migration no longer accepts ${version}`);
  }
  assert.ok(projectSource.includes('schemaVersion: "1.4.0"'));
  assert.ok(projectSource.includes("createDefaultScenes(index + 1, targetMinutes)"));
  assert.ok(structureSource.includes("sequenceTemplates.map"));
  assert.ok(structureSource.includes("beatTarget: 4"));
  assert.ok(structureSource.includes("shotTarget: 16"));
});

test("Windows launcher repairs interrupted installs and performs dependency-aware upgrades", async () => {
  const launcher = await readFile(new URL("../Start-PlotPickle.bat", import.meta.url), "utf8");
  assert.ok(launcher.includes('set "VITE_CMD=node_modules\\.bin\\vite.cmd"'));
  assert.ok(launcher.includes('set "LOCK_HASH_FILE=%INSTALL_STATE_DIR%\\package-lock.sha256"'));
  assert.ok(launcher.includes("npm ci --include=dev --prefer-offline"));
  assert.ok(launcher.includes("npm install --include=dev --prefer-offline"));
  assert.ok(launcher.includes(":lock_matches"));
  assert.ok(launcher.includes(":write_lock_hash"));
  assert.ok(launcher.includes("This is not a new first-time installation."));
  assert.ok(launcher.includes('call "%VITE_CMD%" --host 127.0.0.1 --port %PLOTPICKLE_PORT%'));
  assert.ok(launcher.includes("An incomplete or incompatible PlotPickle component folder was detected."));
});

test("Windows updater preserves components and overlays a selected official ZIP", async () => {
  const wrapper = await readFile(new URL("../Update-PlotPickle.bat", import.meta.url), "utf8");
  const updater = await readFile(new URL("../scripts/update-plotpickle.ps1", import.meta.url), "utf8");
  assert.ok(wrapper.includes("In-Place Updater"));
  assert.ok(wrapper.includes("Run Start-PlotPickle.bat to verify components and start the app."));
  assert.ok(updater.includes("System.Windows.Forms.OpenFileDialog"));
  assert.ok(updater.includes("'node_modules', '.git', '.next', 'dist', '.wrangler', '.plotpickle'"));
  assert.ok(updater.includes("Installed npm components were preserved."));
  assert.ok(updater.includes("it will update npm components only if package-lock.json changed"));
});

test("Windows launcher explains and verifies the local installation", async () => {
  const launcher = await readFile(new URL("../Start-PlotPickle.bat", import.meta.url), "utf8");
  assert.ok(launcher.includes("[STEP 1 OF 4] Checking Node.js, npm, and PlotPickle version"));
  assert.ok(launcher.includes("Continue with this local installation? [Y/N]"));
  assert.ok(launcher.includes("Continue with this PlotPickle component upgrade? [Y/N]"));
  assert.ok(launcher.includes('node "%SETUP_REPORT%" success'));
  assert.ok(launcher.includes('node "%SETUP_REPORT%" ready'));
  assert.ok(launcher.includes("Only this computer can use this 127.0.0.1 address."));
  assert.ok(launcher.includes("does not require Administrator rights"));
});

test("Windows setup report lists space, every package, privacy, and local-server meaning", async () => {
  const reportPath = fileURLToPath(new URL("../scripts/windows-setup-report.mjs", import.meta.url));
  const projectRoot = fileURLToPath(new URL("..", import.meta.url));
  const { stdout } = await execFileAsync(process.execPath, [reportPath, "plan"], {
    cwd: projectRoot,
  });
  assert.match(stdout, /PLOTPICKLE INSTALLATION PLAN/);
  assert.match(stdout, /Recommended free space before setup: 2\.00 GB/);
  assert.match(stdout, /Every top-level package requested by PlotPickle/);
  assert.match(stdout, /Private local development server: vite/);
  assert.match(stdout, /Cloudflare\/Vite build compatibility: @cloudflare\/vite-plugin/);
  assert.match(stdout, /does not request Administrator rights/);
  assert.match(stdout, /server listens on 127\.0\.0\.1/);
  assert.match(stdout, /does not upload your story project/);
});
