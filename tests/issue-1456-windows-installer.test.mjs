import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#1456 native Windows launcher is a hidden self-contained WinExe", async () => {
  const project = await source("windows/launcher/PlotPickleLauncher.csproj");
  const launcher = await source("windows/launcher/Program.cs");

  assert.match(project, /<OutputType>WinExe<\/OutputType>/);
  assert.match(project, /<TargetFramework>net8\.0-windows<\/TargetFramework>/);
  assert.match(project, /<PublishSingleFile>true<\/PublishSingleFile>/);
  assert.match(project, /<SelfContained>true<\/SelfContained>/);
  assert.match(launcher, /CreateNoWindow = true/);
  assert.match(launcher, /Arguments = \$"\/d \/s \/c/);
  assert.doesNotMatch(launcher, /ArgumentList\.Add/);
  assert.match(launcher, /WindowStyle = ProcessWindowStyle\.Hidden/);
  assert.match(launcher, /runtime", "node/);
  assert.match(launcher, /startInfo\.Environment\["PATH"\] = bundledNode/);
  assert.match(launcher, /PLOTPICKLE_HOME/);
  assert.match(launcher, /PLOTPICKLE_INSTALLED/);
  assert.match(launcher, /--verify-install/);
  assert.match(launcher, /launcher\.log/);
});

test("#1456 installer stage bundles Node and dependencies instead of requiring developer tooling", async () => {
  const stage = await source("scripts/windows-installer/stage.mjs");
  for (const contract of [
    'process.platform !== "win32"',
    'path.join(root, "node_modules")',
    "path.dirname(process.execPath)",
    '"node.exe", "npm.cmd"',
    "cpSync(appModules, stagedModules",
    '"prune", "--prefix", stage, "--omit=dev"',
    "cpSync(nodeRoot, stagedNode",
    'manifest.distribution = "windows-installer"',
    "manifest.dependenciesBundled = true",
    'manifest.dependencyProfile = "production"',
    "manifest.developerDependenciesBundled = false",
    'manifest.userDataHome = "%LOCALAPPDATA%/PlotPickle"',
    'manifest.applicationHome = "%LOCALAPPDATA%/Programs/PlotPickle"',
  ]) assert.ok(stage.includes(contract), `Missing installer staging contract: ${contract}`);
});

test("#1456 release package includes root-level UI and community dependencies", async () => {
  const packagePlatform = await source("scripts/package-platform.mjs");
  assert.match(packagePlatform, /"components"/);
  assert.match(packagePlatform, /"plugins"/);
});

test("#1456 installer is per-user, creates normal shortcuts and leaves user data outside the app directory", async () => {
  const installer = await source("windows/installer/PlotPickle.iss");
  assert.match(installer, /DefaultDirName=\{localappdata\}\\Programs\\PlotPickle/);
  assert.match(installer, /DisableDirPage=yes/);
  assert.match(installer, /PrivilegesRequired=lowest/);
  assert.doesNotMatch(installer, /PrivilegesRequiredOverridesAllowed/);
  assert.match(installer, /OutputBaseFilename=PlotPickleSetup/);
  assert.match(installer, /VersionInfoProductVersion=\{#WindowsProductVersion\}/);
  assert.match(installer, /Name: "\{autoprograms\}\\PlotPickle"/);
  assert.match(installer, /Name: "\{autodesktop\}\\PlotPickle"/);
  assert.match(installer, /UninstallDisplayName=PlotPickle/);
  assert.match(installer, /Filename: "\{app\}\\\{#AppExeName\}"/);
  assert.match(installer, /FileAttributeReparsePoint/);
  assert.match(installer, /rmdir "' \+ ModulesPath \+ '"/);
  assert.match(installer, /function PrepareToInstall/);
  assert.match(installer, /StopPlotPickleProcessTree/);
  assert.match(installer, /Result := DetachPersistentRuntime\(\)/);
  assert.match(installer, /\[InstallDelete\][\s\S]*Name: "\{app\}\\app"/);
  assert.match(installer, /PrepareToInstall removes any node_modules junction[\s\S]*Name: "\{app\}\\node_modules"/);
  assert.match(installer, /User stories, profiles, settings and persistent runtimes live under/);
  assert.doesNotMatch(installer, /\[UninstallDelete\][\s\S]*localappdata.*PlotPickle/i);
});

test("#1456 runtime migration handles a custom install directory on another volume", async () => {
  const runtime = await source("scripts/windows-runtime.mjs");
  assert.match(runtime, /function moveDirectory\(source, target\)/);
  assert.match(runtime, /error\?\.code !== "EXDEV"/);
  assert.match(runtime, /cpSync\(source, target, \{ recursive: true, errorOnExist: true, force: false \}\)/);
  assert.match(runtime, /moveDirectory\(info\.appModules, info\.runtimeModules\)/);
});

test("#1456 release build produces a signing-ready PlotPickleSetup.exe deterministically", async () => {
  const build = await source("scripts/windows-installer/build.ps1");
  for (const contract of [
    'scripts/package-platform.mjs", "windows"',
    'scripts/windows-runtime.mjs", "verify-modules", "node_modules"',
    "scripts/windows-installer/stage.mjs",
    '"publish", $launcherProject',
    '"--self-contained", "true"',
    "Get-WindowsProductVersion",
    "/DWindowsProductVersion=$windowsProductVersion",
    "Find-Iscc",
    "PlotPickleSetup.exe",
    "PLOTPICKLE_SIGN_CERT_SHA1",
    "signtool.exe",
    "Get-FileHash $setup -Algorithm SHA256",
  ]) assert.ok(build.includes(contract), `Missing release-build contract: ${contract}`);
});

test("#1456 installed-app smoke covers real launch, junction-safe upgrade and uninstall preservation", async () => {
  const [smoke, launcher] = await Promise.all([
    source("scripts/windows-installer/smoke.ps1"),
    source("Start-PlotPickle.bat"),
  ]);
  for (const contract of [
    "/VERYSILENT",
    "PlotPickle.exe",
    'Join-Path $env:LOCALAPPDATA "PlotPickle-Installer-Smoke-$PID"',
    "runtime\\node\\node.exe",
    "node_modules\\vite\\package.json",
    "worker\\index.ts",
    "--verify-install",
    "Start-InstalledPlotPickle",
    "Wait-ForStartup",
    "Write-LauncherDiagnostics",
    "plotpickle-startup-v4",
    "Resolve-PersistentRuntimeModules",
    "Upgrade wrote the new payload through the previous persistent-runtime junction",
    "Same-version upgrade changed the runtime fingerprint unexpectedly",
    "unins*.exe",
    "installer-smoke-preserve.marker",
    "Uninstall removed PlotPickle user data",
    "Uninstall followed the application junction and damaged the persistent runtime",
  ]) assert.ok(smoke.includes(contract), `Missing installer-smoke contract: ${contract}`);
  assert.match(smoke, /\$startupRequestTimeoutSeconds = 30/);
  assert.match(smoke, /\$startupProbeUserAgent = "PlotPickle-Installer-Smoke\/\$PID"/);
  assert.match(smoke, /-Uri \$baseUrl -TimeoutSec \$startupRequestTimeoutSeconds -UserAgent \$startupProbeUserAgent/);
  assert.match(launcher, /set "READY_REQUEST_TIMEOUT_SECONDS=30"/);
  assert.match(launcher, /:open_when_ready[\s\S]*-Uri \$base -TimeoutSec %READY_REQUEST_TIMEOUT_SECONDS%/);
  assert.doesNotMatch(smoke, /\b\d+_\d+\b/, "PowerShell numeric literals must not use JavaScript-style separators.");
  assert.ok(smoke.match(/Install-PlotPickle/g).length >= 3, "Installer smoke must install and then exercise an in-place upgrade.");
});

test("#1456 exact Windows CI builds and exercises the distributable installer", async () => {
  const [workflow, interactionSmoke] = await Promise.all([
    source(".github/workflows/windows-installer.yml"),
    source("scripts/windows-interaction-smoke.mjs"),
  ]);
  for (const contract of [
    "windows-latest",
    'node-version: "24.19.0"',
    "dotnet-version: \"8.0.x\"",
    "npm ci --include=dev",
    "issue-1456-windows-installer.test.mjs",
    "choco install innosetup",
    "scripts/windows-installer/build.ps1",
    "windows-interaction-smoke.mjs",
    "scripts/windows-installer/smoke.ps1",
    "PlotPickleSetup.exe",
    "actions/upload-artifact@v4",
  ]) assert.ok(workflow.includes(contract), `Missing installer CI contract: ${contract}`);
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
  assert.match(workflow, /PLOTPICKLE_SMOKE_TOTAL_TIMEOUT_MS: "360000"/);
  assert.match(interactionSmoke, /PLOTPICKLE_SMOKE_ROUTE_TIMEOUT_MS \|\| 30_000/);
  assert.match(interactionSmoke, /PLOTPICKLE_SMOKE_MAX_ROUTES \|\| \(process\.env\.CI === "true" \? 1 : 60\)/);
  assert.match(interactionSmoke, /PLOTPICKLE_SMOKE_MAX_STATES \|\| \(process\.env\.CI === "true" \? 1 : 60\)/);
  assert.match(interactionSmoke, /PLOTPICKLE_SMOKE_MAX_ACTIONS \|\| \(process\.env\.CI === "true" \? 3 : 240\)/);
  assert.match(interactionSmoke, /PLOTPICKLE_SMOKE_MAX_DEPTH \|\| \(process\.env\.CI === "true" \? 0 : 3\)/);
  assert.match(interactionSmoke, /PLOTPICKLE_INSTALLED: "1"/);
  assert.doesNotMatch(interactionSmoke, /runRepositoryCollabScenario/);
  assert.match(interactionSmoke, /process\.env\.CI !== "true" && visitedStates\.size >= maximumStates/);
  assert.match(interactionSmoke, /process\.env\.CI !== "true" && report\.actions\.length >= maximumActions/);
  assert.match(interactionSmoke, /inventory\.routes\.slice\(0, maximumRoutes\)/);
  assert.match(interactionSmoke, /async function inspectHttpRoute\(url\)/);
  assert.match(interactionSmoke, /signal: AbortSignal\.timeout\(routeTimeoutMs\)/);
  assert.match(interactionSmoke, /client\.send\("Page\.navigate", \{ url \}, routeTimeoutMs\)/);
  assert.match(interactionSmoke, /waitForReady\(client, expectedOrigin, routeTimeoutMs\)/);
  assert.equal(interactionSmoke.match(/routeTimeoutMs \+ actionTimeoutMs \* state\.path\.length/g)?.length, 2);
  assert.match(interactionSmoke, /inspectHttpRoute\(new URL\(route/);
  assert.doesNotMatch(interactionSmoke, /withTimeout\(navigate\(client, new URL\(route/);
  assert.match(interactionSmoke, /this\.pending\.delete\(id\);[\s\S]*exceeded \$\{timeoutMs\} ms/);
});

test("#1456 installed and CI runtimes skip developer-repair bootstrap", async () => {
  const discovery = await source("build/uat-discovery-plugin.ts");
  assert.match(discovery, /PLOTPICKLE_INSTALLED === "1" \|\| process\.env\.CI === "true"/);
});
