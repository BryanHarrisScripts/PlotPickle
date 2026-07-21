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

test("renders the local-first PlotPickle product and workspace contract", async () => {
  const html = await render("/");
  assert.match(html, developmentPreviewMeta);
  assert.match(html, /PlotPickle Playhouse/);
  assert.match(html, /Download for Windows/);
  assert.match(html, /Open local workspace/);
  assert.doesNotMatch(html, /PlotPickle Online/);
  assert.match(html, /Project Overview/);
  assert.match(html, /Structure Map/);
  assert.match(html, /Copyright &amp; licensing|Copyright & licensing/);
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

test("renders copyright ownership and server licensing guidance", async () => {
  const html = await render("/legal");
  assert.match(html, /Open software\. Shared method\. Your story remains yours\./);
  assert.match(html, /GNU Affero General Public License/);
  assert.match(html, /Creative Commons Attribution-ShareAlike 4\.0/);
  assert.match(html, /Server operator checklist/);
  assert.match(html, /Plesk or WordPress/);
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

test("Windows launcher reuses a package-lock-specific persistent runtime", async () => {
  const launcher = await readFile(new URL("../Start-PlotPickle.bat", import.meta.url), "utf8");
  assert.ok(launcher.includes('set "RUNTIME_MANAGER=scripts\\windows-runtime.mjs"'));
  assert.ok(launcher.includes('set "VITE_CMD=node_modules\\.bin\\vite.cmd"'));
  assert.ok(launcher.includes('set "npm_config_cache=%PLOTPICKLE_NPM_CACHE%"'));
  assert.ok(launcher.includes('npm ci --prefix "%PLOTPICKLE_RUNTIME_DIR%"'));
  assert.ok(launcher.includes('npm install --prefix "%PLOTPICKLE_RUNTIME_DIR%"'));
  assert.ok(launcher.includes("PLOTPICKLE_RUNTIME_REUSED"));
  assert.ok(launcher.includes("No package download or first-time installation was needed."));
  assert.ok(launcher.includes('call "%VITE_CMD%" --host 127.0.0.1 --port %PLOTPICKLE_PORT%'));
  assert.ok(launcher.includes("Repair-PlotPickle.bat"));
});

test("persistent runtime manager fingerprints package-lock and separates application files", async () => {
  const runtimePath = fileURLToPath(new URL("../scripts/windows-runtime.mjs", import.meta.url));
  const projectRoot = fileURLToPath(new URL("..", import.meta.url));
  const { stdout } = await execFileAsync(process.execPath, [runtimePath, "describe"], { cwd: projectRoot });
  assert.match(stdout, /Application folder:/);
  assert.match(stdout, /Dependency fingerprint: [a-f0-9]{20}/);
  assert.match(stdout, /Persistent runtime:/);
  assert.match(stdout, /Persistent dependencies:/);
  assert.match(stdout, /Persistent npm cache:/);
});

test("Windows updater overlays program files while preserving runtime and projects", async () => {
  const wrapper = await readFile(new URL("../Update-PlotPickle.bat", import.meta.url), "utf8");
  const updater = await readFile(new URL("../scripts/windows-update.ps1", import.meta.url), "utf8");
  assert.ok(wrapper.includes("Guided In-Place Updater"));
  assert.ok(wrapper.includes("reusable dependency runtime"));
  assert.ok(wrapper.includes("windows-update.ps1"));
  assert.ok(updater.includes("System.Windows.Forms.OpenFileDialog"));
  assert.ok(updater.includes("PlotPickle/archive/refs/heads/main.zip"));
  assert.ok(updater.includes('$preservedDirectories = @("node_modules", ".git", ".next", "dist", ".wrangler", ".plotpickle", "projects", "exports", "user-data", "backups")'));
  assert.ok(updater.includes("Persistent runtime left untouched"));
  assert.ok(updater.includes("User-owned projects, exports, user-data, and backups folders are preserved."));
  assert.ok(updater.includes("node_modules was not downloaded or copied"));
  assert.ok(updater.includes("Start PlotPickle now? [Y/N]"));
});

test("Windows repair resets only the current persistent runtime", async () => {
  const repair = await readFile(new URL("../Repair-PlotPickle.bat", import.meta.url), "utf8");
  assert.ok(repair.includes("reset-current"));
  assert.ok(repair.includes("does NOT delete"));
  assert.ok(repair.includes("browser-stored story projects"));
  assert.ok(repair.includes("call Start-PlotPickle.bat"));
});

test("Windows launcher explains and verifies the local installation", async () => {
  const launcher = await readFile(new URL("../Start-PlotPickle.bat", import.meta.url), "utf8");
  assert.ok(launcher.includes("[STEP 1 OF 4] Checking Node.js, npm, and the reusable runtime"));
  assert.ok(launcher.includes("Continue with this local runtime installation? [Y/N]"));
  assert.ok(launcher.includes('node "%SETUP_REPORT%" success'));
  assert.ok(launcher.includes('node "%SETUP_REPORT%" ready'));
  assert.ok(launcher.includes("Only this computer can use this 127.0.0.1 address."));
  assert.ok(launcher.includes("does not require Administrator rights"));
});

test("Windows setup report lists space, packages, persistent upgrades, privacy, and local-server meaning", async () => {
  const reportPath = fileURLToPath(new URL("../scripts/windows-setup-report.mjs", import.meta.url));
  const projectRoot = fileURLToPath(new URL("..", import.meta.url));
  const { stdout } = await execFileAsync(process.execPath, [reportPath, "plan"], {
    cwd: projectRoot,
  });
  assert.match(stdout, /PLOTPICKLE INSTALLATION PLAN/);
  assert.match(stdout, /Recommended free space before the first runtime setup: 2\.00 GB/);
  assert.match(stdout, /Every top-level package requested by PlotPickle/);
  assert.match(stdout, /Private local development server: vite/);
  assert.match(stdout, /Cloudflare\/Vite build compatibility: @cloudflare\/vite-plugin/);
  assert.match(stdout, /Reusable dependency runtime:/);
  assert.match(stdout, /code-only upgrades reuse this runtime/);
  assert.match(stdout, /does not request Administrator rights/);
  assert.match(stdout, /server listens on 127\.0\.0\.1/);
  assert.match(stdout, /does not upload your story project/);
});
