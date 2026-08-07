import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("..", import.meta.url);
const source = (file) => readFile(new URL(file, root), "utf8");
const require = createRequire(import.meta.url);

function executableBatchLines(batch) {
  return batch
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^rem(?:\s|$)/i.test(line) && !/^::/.test(line))
    .join("\n");
}

async function compileDiscovery() {
  const text = await source("build/buzz-desktop-discovery.ts");
  const compiled = ts.transpileModule(text, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const runtimeModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: runtimeModule,
    exports: runtimeModule.exports,
    require,
    process,
    console,
  });
  return { text, exports: runtimeModule.exports };
}

const discovery = await compileDiscovery();

test("issue #242 records the supported Buzz Desktop v0.5.3 boundary", () => {
  assert.equal(discovery.exports.BUZZ_DESKTOP_COMPATIBILITY.releaseTag, "desktop-v0.5.3");
  assert.equal(discovery.exports.BUZZ_DESKTOP_COMPATIBILITY.version, "0.5.3");
  assert.equal(discovery.exports.BUZZ_DESKTOP_COMPATIBILITY.sourceCommit, "3a96ace");
  assert.equal(discovery.exports.BUZZ_DESKTOP_COMPATIBILITY.windowsAsset, "Buzz_0.5.3_x64-setup_alpha-unsigned.exe");
});

test("issue #320 includes the installed root Buzz CLI sidecar and alternate packaged layouts", () => {
  const candidates = discovery.exports.buzzDesktopCliCandidates("win32", {
    LOCALAPPDATA: "C:\\Users\\Bryan\\AppData\\Local",
    ProgramFiles: "C:\\Program Files",
    "ProgramFiles(x86)": "C:\\Program Files (x86)",
  }, "C:\\Users\\Bryan");

  assert.equal(candidates[0], "C:\\Users\\Bryan\\AppData\\Local\\Buzz\\buzz.exe");
  assert.ok(candidates.includes("C:\\Users\\Bryan\\AppData\\Local\\Buzz\\buzz-x86_64-pc-windows-msvc.exe"));
  assert.ok(candidates.includes("C:\\Users\\Bryan\\AppData\\Local\\Programs\\Buzz\\resources\\binaries\\buzz.exe"));
  assert.ok(candidates.includes("C:\\Program Files\\Buzz\\resources\\buzz.exe"));
  assert.ok(!candidates.some((candidate) => candidate.toLowerCase().endsWith("\\buzz-desktop.exe")));
  assert.equal(new Set(candidates).size, candidates.length);
});

test("issue #242 preserves explicit configuration and environment precedence", async () => {
  const explicit = await discovery.exports.resolveBuzzCliExecutable("D:\\Tools\\buzz.exe", {
    platform: "win32",
    env: { BUZZ_CLI_PATH: "C:\\Env\\buzz.exe" },
    canAccess: async () => true,
  });
  assert.equal(explicit.executable, "D:\\Tools\\buzz.exe");
  assert.equal(explicit.source, "configured");

  const environment = await discovery.exports.resolveBuzzCliExecutable("", {
    platform: "win32",
    env: { BUZZ_CLI_PATH: "C:\\Env\\buzz.exe" },
    canAccess: async () => true,
  });
  assert.equal(environment.executable, "C:\\Env\\buzz.exe");
  assert.equal(environment.source, "environment");
});

test("issue #320 discovers the root packaged CLI before PATH fallback", async () => {
  const desktopGuiPath = "C:\\Users\\Bryan\\AppData\\Local\\Programs\\Buzz\\buzz-desktop.exe";
  const sidecarPath = "C:\\Users\\Bryan\\AppData\\Local\\Programs\\Buzz\\buzz.exe";
  const checked = [];
  const discovered = await discovery.exports.resolveBuzzCliExecutable("", {
    platform: "win32",
    env: { LOCALAPPDATA: "C:\\Users\\Bryan\\AppData\\Local" },
    home: "C:\\Users\\Bryan",
    canAccess: async (candidate) => {
      checked.push(candidate);
      return candidate.toLowerCase() === sidecarPath.toLowerCase();
    },
  });

  assert.equal(discovered.executable, sidecarPath);
  assert.equal(discovered.source, "buzz-desktop");
  assert.equal(discovered.discovered, true);
  assert.equal(discovered.releaseTag, "desktop-v0.5.3");
  assert.ok(checked.some((candidate) => candidate.toLowerCase() === sidecarPath.toLowerCase()));
  assert.ok(!checked.some((candidate) => candidate.toLowerCase() === desktopGuiPath.toLowerCase()));

  const missing = await discovery.exports.resolveBuzzCliExecutable("", {
    platform: "win32",
    env: {},
    home: "C:\\Users\\Bryan",
    canAccess: async () => false,
  });
  assert.equal(missing.executable, "buzz.exe");
  assert.equal(missing.source, "path");
  assert.equal(missing.discovered, false);
});

test("issue #242 wires discovery into the gateway and explains blank-path behavior", async () => {
  const [gateway, settings] = await Promise.all([
    source("build/buzz-gateway.ts"),
    source("app/buzz-settings-panel.tsx"),
  ]);

  assert.match(gateway, /resolveBuzzCliExecutable/);
  assert.match(gateway, /source: resolution\.source/);
  assert.match(gateway, /releaseTag: resolution\.releaseTag/);
  assert.match(settings, /Buzz Desktop v0\.5\.3/);
  assert.match(settings, /Leave blank to use Buzz Desktop automatically/);
  assert.match(settings, /status\.cli\.source/);
  assert.doesNotMatch(discovery.text, /spawn\s*\(|writeFile|privateKey|relayUrl/);
});

test("issues #244 and #341 keep the pinned Buzz installer available while Settings owns setup", async () => {
  const [launcher, installer, configText, packageSmoke, settings] = await Promise.all([
    source("Start-PlotPickle.bat"),
    source("scripts/install-buzz-desktop.ps1"),
    source("config/buzz-desktop.json"),
    source("scripts/package-smoke.mjs"),
    source("app/buzz-settings-panel.tsx"),
  ]);
  const config = JSON.parse(configText);
  const executableLauncher = executableBatchLines(launcher);

  assert.equal(config.releaseTag, discovery.exports.BUZZ_DESKTOP_COMPATIBILITY.releaseTag);
  assert.equal(config.version, discovery.exports.BUZZ_DESKTOP_COMPATIBILITY.version);
  assert.equal(config.sourceCommit, discovery.exports.BUZZ_DESKTOP_COMPATIBILITY.sourceCommit);
  assert.equal(config.windows.asset, discovery.exports.BUZZ_DESKTOP_COMPATIBILITY.windowsAsset);
  assert.equal(config.windows.downloadUrl, "https://github.com/block/buzz/releases/download/desktop-v0.5.3/Buzz_0.5.3_x64-setup_alpha-unsigned.exe");
  assert.equal(config.windows.unsigned, true);

  assert.match(launcher, /optional connections remain independently configurable in PlotPickle Settings/i);
  assert.match(launcher, /Optional services remain available from their independent Settings pages/);
  assert.doesNotMatch(executableLauncher, /BUZZ_INSTALLER|install-buzz-desktop\.ps1|ensure_buzz_desktop/i);
  assert.doesNotMatch(executableLauncher, /Install Buzz Desktop.*\[Y\/N\]/i);

  assert.match(installer, /Invoke-WebRequest -Uri \$downloadUrl -OutFile \$installerPath/);
  assert.match(installer, /Start-Process -FilePath \$installerPath -Wait -PassThru/);
  assert.match(installer, /Get-FileHash -LiteralPath \$installerPath -Algorithm SHA256/);
  assert.match(installer, /alpha-unsigned/);
  assert.match(installer, /PLOTPICKLE_BUZZ_STATUS=/);
  assert.match(installer, /Windows\\CurrentVersion\\Uninstall\\\*/);
  assert.match(installer, /DisplayVersion/);
  assert.match(installer, /\$updateRequired = \$Maintain -and \$installedVersion -and \$installedVersion -ne \$version/);
  assert.match(installer, /Automatic reinstallation was skipped/);
  assert.doesNotMatch(installer, /-Verb\s+RunAs|--silent|\/S(?:\s|$)|Invoke-Expression|\biex\b/i);
  assert.doesNotMatch(installer, /privateKey|relayUrl|writeCredential|canon|\.ppf/i);

  assert.match(packageSmoke, /scripts\/install-buzz-desktop\.ps1/);
  assert.match(packageSmoke, /config\/buzz-desktop\.json/);
  assert.match(settings, /Buzz Desktop not detected/);
  assert.match(settings, /Install and open Buzz Desktop once, then refresh this screen/);
  assert.match(settings, /Buzz CLI path \(optional\)/);
  assert.match(settings, /Open Story Room/);
});

test("issue #244 executes the non-network Buzz Desktop check on Windows", { skip: process.platform !== "win32" }, () => {
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", "scripts\\install-buzz-desktop.ps1", "-CheckOnly"],
    { cwd: fileURLToPath(root), encoding: "utf8" },
  );
  assert.ok([0, 3].includes(result.status ?? -1), result.stderr || result.stdout || "Buzz Desktop check returned no output.");
  assert.match(result.stdout, /PLOTPICKLE_BUZZ_STATUS=(?:detected|missing)/);
});
