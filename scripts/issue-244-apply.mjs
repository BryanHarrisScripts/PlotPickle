import { readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
const write = (file, content) => writeFileSync(path.join(root, file), content);

function replaceOnce(file, before, after) {
  const source = read(file);
  if (!source.includes(before)) throw new Error(`${file}: replacement anchor was not found.`);
  if (source.indexOf(before) !== source.lastIndexOf(before)) throw new Error(`${file}: replacement anchor was not unique.`);
  write(file, source.replace(before, after));
}

const buzzConfig = {
  schemaVersion: 1,
  releaseTag: "desktop-v0.5.3",
  version: "0.5.3",
  sourceCommit: "3a96ace",
  windows: {
    asset: "Buzz_0.5.3_x64-setup_alpha-unsigned.exe",
    downloadUrl: "https://github.com/block/buzz/releases/download/desktop-v0.5.3/Buzz_0.5.3_x64-setup_alpha-unsigned.exe",
    unsigned: true,
  },
};
write("config/buzz-desktop.json", `${JSON.stringify(buzzConfig, null, 2)}\n`);

write("scripts/install-buzz-desktop.ps1", String.raw`[CmdletBinding(DefaultParameterSetName = "Check")]
param(
  [Parameter(ParameterSetName = "Check")]
  [switch]$CheckOnly,

  [Parameter(ParameterSetName = "Install")]
  [switch]$Install
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptRoot
$ConfigPath = Join-Path $ProjectRoot "config\buzz-desktop.json"

function Write-PlotPickleBuzzStatus {
  param(
    [Parameter(Mandatory = $true)][string]$Status,
    [string]$Executable = ""
  )

  Write-Output "PLOTPICKLE_BUZZ_STATUS=$Status"
  if ($Executable) {
    Write-Output "PLOTPICKLE_BUZZ_CLI=$Executable"
  }
}

function Get-BuzzCliCandidates {
  $roots = New-Object System.Collections.Generic.List[string]
  if ($env:LOCALAPPDATA) {
    $roots.Add((Join-Path $env:LOCALAPPDATA "Buzz"))
    $roots.Add((Join-Path $env:LOCALAPPDATA "Programs\Buzz"))
  }
  if ($env:ProgramFiles) {
    $roots.Add((Join-Path $env:ProgramFiles "Buzz"))
  }
  if (${env:ProgramFiles(x86)}) {
    $roots.Add((Join-Path ${env:ProgramFiles(x86)} "Buzz"))
  }

  $relativeExecutables = @(
    "buzz.exe",
    "resources\buzz.exe",
    "buzz-x86_64-pc-windows-msvc.exe",
    "resources\buzz-x86_64-pc-windows-msvc.exe"
  )

  $candidates = New-Object System.Collections.Generic.List[string]
  foreach ($rootPath in $roots) {
    foreach ($relativeExecutable in $relativeExecutables) {
      $candidates.Add((Join-Path $rootPath $relativeExecutable))
    }
  }
  return $candidates | Select-Object -Unique
}

function Find-BuzzCli {
  foreach ($candidate in Get-BuzzCliCandidates) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }
  return ""
}

if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) {
  Write-Warning "The packaged Buzz Desktop compatibility file is missing: $ConfigPath"
  Write-PlotPickleBuzzStatus -Status "configuration-missing"
  exit 1
}

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$releaseTag = [string]$config.releaseTag
$version = [string]$config.version
$assetName = [string]$config.windows.asset
$downloadUrl = [string]$config.windows.downloadUrl

$existingCli = Find-BuzzCli
if ($existingCli) {
  Write-Host "[OK] Buzz Desktop $version CLI detected at $existingCli"
  Write-PlotPickleBuzzStatus -Status "detected" -Executable $existingCli
  exit 0
}

if ($CheckOnly -or -not $Install) {
  Write-Host "[INFO] Buzz Desktop $version was not detected in a supported Windows installation folder."
  Write-PlotPickleBuzzStatus -Status "missing"
  exit 3
}

if (-not [Environment]::Is64BitOperatingSystem) {
  Write-Warning "Buzz Desktop $version currently provides an x64 Windows installer."
  Write-PlotPickleBuzzStatus -Status "unsupported-platform"
  exit 1
}

$uri = [Uri]$downloadUrl
if ($uri.Scheme -ne "https" -or $uri.Host -ne "github.com" -or -not $uri.AbsolutePath.StartsWith("/block/buzz/releases/download/$releaseTag/")) {
  Write-Warning "The Buzz Desktop download URL is not the pinned official block/buzz release URL."
  Write-PlotPickleBuzzStatus -Status "invalid-download-url"
  exit 1
}
if ($uri.Segments[-1] -ne $assetName) {
  Write-Warning "The Buzz Desktop asset name does not match the pinned release configuration."
  Write-PlotPickleBuzzStatus -Status "invalid-asset"
  exit 1
}

$downloadRoot = Join-Path ([IO.Path]::GetTempPath()) "PlotPickle\BuzzDesktop-$version"
$installerPath = Join-Path $downloadRoot $assetName

try {
  if (Test-Path -LiteralPath $downloadRoot) {
    Remove-Item -LiteralPath $downloadRoot -Recurse -Force
  }
  New-Item -ItemType Directory -Path $downloadRoot -Force | Out-Null

  Write-Host "Downloading the official Buzz Desktop $version installer from block/buzz..."
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing -MaximumRedirection 10

  $downloaded = Get-Item -LiteralPath $installerPath
  if ($downloaded.Length -lt 1MB) {
    throw "The downloaded installer is unexpectedly small."
  }

  $stream = [IO.File]::OpenRead($installerPath)
  try {
    if ($stream.ReadByte() -ne 0x4D -or $stream.ReadByte() -ne 0x5A) {
      throw "The downloaded file is not a Windows executable."
    }
  }
  finally {
    $stream.Dispose()
  }

  $hash = (Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash
  Write-Host "Downloaded $assetName"
  Write-Host "SHA-256: $hash"
  Write-Warning "Buzz Desktop $version is a separate third-party application. Its current Windows asset is labelled alpha-unsigned, so Windows SmartScreen may ask you to confirm before it opens."
  Write-Host "The installer will remain visible. PlotPickle does not pass silent-install flags or request elevation."

  $process = Start-Process -FilePath $installerPath -Wait -PassThru
  Write-Host "Buzz Desktop installer exited with code $($process.ExitCode)."
  Start-Sleep -Seconds 2

  $installedCli = Find-BuzzCli
  if ($installedCli) {
    Write-Host "[SUCCESS] Buzz Desktop $version CLI detected at $installedCli"
    Write-PlotPickleBuzzStatus -Status "installed" -Executable $installedCli
    exit 0
  }

  Write-Warning "The installer closed, but PlotPickle could not find the Buzz Desktop CLI. The install may have been cancelled or placed somewhere unsupported."
  Write-PlotPickleBuzzStatus -Status "not-completed"
  exit 4
}
catch {
  Write-Warning "Buzz Desktop installation could not finish: $($_.Exception.Message)"
  Write-PlotPickleBuzzStatus -Status "failed"
  exit 1
}
finally {
  if (Test-Path -LiteralPath $downloadRoot) {
    Remove-Item -LiteralPath $downloadRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
`);

replaceOnce(
  "Start-PlotPickle.bat",
  'set "RUNTIME_MANAGER=scripts\\windows-runtime.mjs"\n',
  'set "RUNTIME_MANAGER=scripts\\windows-runtime.mjs"\nset "BUZZ_INSTALLER=scripts\\install-buzz-desktop.ps1"\nset "BUZZ_DESKTOP_VERSION=0.5.3"\n',
);
replaceOnce(
  "Start-PlotPickle.bat",
  "It does not install a Windows service and does not require Administrator rights.\n",
  "It does not install a Windows service and does not require Administrator rights.\nBuzz Desktop is optional; when missing, this launcher can offer its official visible installer.\n",
);
replaceOnce(
  "Start-PlotPickle.bat",
  "echo [STEP 3 OF 4] Verifying installed components and reporting results...\n",
  "echo [STEP 3 OF 4] Verifying installed components and checking optional Buzz Desktop...\n",
);
replaceOnce(
  "Start-PlotPickle.bat",
  "if errorlevel 1 goto :setup_failed\n\necho.\necho [STEP 4 OF 4] Starting the private local server...\n",
  "if errorlevel 1 goto :setup_failed\n\ncall :ensure_buzz_desktop\n\necho.\necho [STEP 4 OF 4] Starting the private local server...\n",
);
replaceOnce(
  "Start-PlotPickle.bat",
  "\n:ensure_dependencies\n",
  String.raw`
:ensure_buzz_desktop
if not exist "%BUZZ_INSTALLER%" (
  echo [INFO] The optional Buzz Desktop installer helper is not included in this download.
  echo PlotPickle will continue normally; Buzz can still be installed separately.
  exit /b 0
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%BUZZ_INSTALLER%" -CheckOnly
set "BUZZ_CHECK_RESULT=!ERRORLEVEL!"
if "!BUZZ_CHECK_RESULT!"=="0" (
  echo [OK] Buzz Desktop !BUZZ_DESKTOP_VERSION! CLI detected. Buzz remains available inside PlotPickle Settings and Collab.
  exit /b 0
)
if not "!BUZZ_CHECK_RESULT!"=="3" (
  echo [WARNING] PlotPickle could not determine whether Buzz Desktop is installed.
  echo PlotPickle will continue without changing Buzz.
  exit /b 0
)

echo.
echo Buzz Desktop !BUZZ_DESKTOP_VERSION! is optional and is used for Buzz Story Rooms.
echo Buzz remains inside the PlotPickle UI; this only installs the local Buzz Desktop dependency.
echo The current Windows installer is published by block/buzz and is labelled alpha-unsigned.
echo Windows SmartScreen may ask you to confirm before it opens.
echo.
choice /C YN /N /M "Install Buzz Desktop !BUZZ_DESKTOP_VERSION! now? [Y/N]: "
if errorlevel 2 (
  echo [INFO] Buzz Desktop installation skipped. PlotPickle will continue normally.
  exit /b 0
)

echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%BUZZ_INSTALLER%" -Install
set "BUZZ_INSTALL_RESULT=!ERRORLEVEL!"
if "!BUZZ_INSTALL_RESULT!"=="0" (
  echo [SUCCESS] Buzz Desktop !BUZZ_DESKTOP_VERSION! is installed and its CLI was detected.
) else (
  echo [WARNING] Buzz Desktop installation was not completed.
  echo PlotPickle will continue normally. Run Start-PlotPickle.bat again to retry.
)
exit /b 0

:ensure_dependencies
`,
);

replaceOnce(
  "app/buzz-settings-panel.tsx",
  '<small>Buzz Desktop v0.5.3 includes the supported CLI sidecar.</small>',
  '<small>Buzz Desktop v0.5.3 includes the supported CLI sidecar. On Windows, Start-PlotPickle.bat can offer the official installer when Buzz is missing.</small>',
);
replaceOnce(
  "app/buzz-settings-panel.tsx",
  '!cliAvailable ? "Install Buzz Desktop v0.5.3 or select a supported Buzz CLI. " : ""',
  '!cliAvailable ? "Run Start-PlotPickle.bat and accept the optional Buzz Desktop v0.5.3 installer, or select a supported Buzz CLI. " : ""',
);
replaceOnce(
  "app/buzz-settings-panel.tsx",
  '<li>No Buzz service starts when PlotPickle is installed.</li>',
  '<li>No Buzz service starts when PlotPickle is installed.</li><li>The Windows launcher asks before downloading or opening the separate Buzz Desktop installer.</li>',
);

replaceOnce(
  "scripts/package-smoke.mjs",
  '  "config/google-oauth.json",\n',
  '  "config/google-oauth.json",\n  "config/buzz-desktop.json",\n',
);
replaceOnce(
  "scripts/package-smoke.mjs",
  '  "scripts/google-oauth-registration.mjs",\n',
  '  "scripts/google-oauth-registration.mjs",\n  "scripts/install-buzz-desktop.ps1",\n',
);
replaceOnce(
  "scripts/package-smoke.mjs",
  'assert.ok(!launcherSource.includes("0.0.0.0"), "Release launcher must remain loopback-only.");\n',
  String.raw`assert.ok(!launcherSource.includes("0.0.0.0"), "Release launcher must remain loopback-only.");
const buzzDesktop = JSON.parse(readFileSync(path.join(folder, "config", "buzz-desktop.json"), "utf8"));
assert.equal(buzzDesktop.releaseTag, "desktop-v0.5.3");
assert.equal(buzzDesktop.version, "0.5.3");
assert.equal(buzzDesktop.windows.asset, "Buzz_0.5.3_x64-setup_alpha-unsigned.exe");
assert.equal(buzzDesktop.windows.downloadUrl, "https://github.com/block/buzz/releases/download/desktop-v0.5.3/Buzz_0.5.3_x64-setup_alpha-unsigned.exe");
assert.equal(buzzDesktop.windows.unsigned, true);
if (manifest.platform === "windows") {
  assert.match(launcherSource, /scripts\\install-buzz-desktop\.ps1/i);
  assert.match(launcherSource, /Install Buzz Desktop !BUZZ_DESKTOP_VERSION! now\? \[Y\/N\]:/);
  assert.match(launcherSource, /PlotPickle will continue normally/);
}
`,
);

const testsPath = "tests/issue-242-buzz-desktop-discovery.test.mjs";
let testsSource = read(testsPath);
if (!testsSource.includes('test("issue #244 offers the pinned Buzz Desktop installer without moving Buzz out of PlotPickle"')) {
  testsSource += String.raw`

test("issue #244 offers the pinned Buzz Desktop installer without moving Buzz out of PlotPickle", async () => {
  const [launcher, installer, configText, packageSmoke, settings] = await Promise.all([
    source("Start-PlotPickle.bat"),
    source("scripts/install-buzz-desktop.ps1"),
    source("config/buzz-desktop.json"),
    source("scripts/package-smoke.mjs"),
    source("app/buzz-settings-panel.tsx"),
  ]);
  const config = JSON.parse(configText);

  assert.equal(config.releaseTag, discovery.exports.BUZZ_DESKTOP_COMPATIBILITY.releaseTag);
  assert.equal(config.version, discovery.exports.BUZZ_DESKTOP_COMPATIBILITY.version);
  assert.equal(config.sourceCommit, discovery.exports.BUZZ_DESKTOP_COMPATIBILITY.sourceCommit);
  assert.equal(config.windows.asset, discovery.exports.BUZZ_DESKTOP_COMPATIBILITY.windowsAsset);
  assert.equal(config.windows.downloadUrl, "https://github.com/block/buzz/releases/download/desktop-v0.5.3/Buzz_0.5.3_x64-setup_alpha-unsigned.exe");
  assert.equal(config.windows.unsigned, true);

  assert.match(launcher, /BUZZ_INSTALLER=scripts\\install-buzz-desktop\.ps1/);
  assert.match(launcher, /-File "%BUZZ_INSTALLER%" -CheckOnly/);
  assert.match(launcher, /Install Buzz Desktop !BUZZ_DESKTOP_VERSION! now\? \[Y\/N\]:/);
  assert.match(launcher, /-File "%BUZZ_INSTALLER%" -Install/);
  assert.match(launcher, /Buzz remains inside the PlotPickle UI/);
  assert.match(launcher, /Buzz Desktop installation was not completed[\s\S]*PlotPickle will continue normally/);

  assert.match(installer, /Invoke-WebRequest -Uri \$downloadUrl -OutFile \$installerPath/);
  assert.match(installer, /Start-Process -FilePath \$installerPath -Wait -PassThru/);
  assert.match(installer, /Get-FileHash -LiteralPath \$installerPath -Algorithm SHA256/);
  assert.match(installer, /alpha-unsigned/);
  assert.match(installer, /PLOTPICKLE_BUZZ_STATUS=/);
  assert.doesNotMatch(installer, /-Verb\s+RunAs|--silent|\/S(?:\s|$)|Invoke-Expression|\biex\b/i);
  assert.doesNotMatch(installer, /privateKey|relayUrl|writeCredential|canon|\.ppf/i);

  assert.match(packageSmoke, /scripts\/install-buzz-desktop\.ps1/);
  assert.match(packageSmoke, /config\/buzz-desktop\.json/);
  assert.match(settings, /Start-PlotPickle\.bat can offer the official installer/);
  assert.match(settings, /Open Story Room/);
});
`;
}
write(testsPath, testsSource);

const docsPath = "docs/issue-242-buzz-desktop-discovery.md";
let docs = read(docsPath);
if (!docs.includes("## Optional installation from the Windows launcher")) {
  docs += String.raw`

## Optional installation from the Windows launcher

` + "`Start-PlotPickle.bat`" + String.raw` remains the single Windows startup entry point. After PlotPickle's own reusable runtime is ready, the launcher checks the same supported Buzz Desktop installation roots.

When Buzz Desktop is missing, the launcher presents one explicit Y/N choice. Choosing Yes runs the packaged ` + "`scripts/install-buzz-desktop.ps1`" + String.raw` helper, which downloads the exact ` + "`desktop-v0.5.3`" + String.raw` Windows asset from the official ` + "`block/buzz`" + String.raw` GitHub release and opens the installer visibly. It does not pass silent-install arguments or request elevation. The current asset is labelled alpha-unsigned, so Windows SmartScreen may require confirmation.

Choosing No, cancelling the third-party installer or encountering a download failure does not block PlotPickle startup. No relay, identity or story data is created by the launcher.

Buzz still lives in PlotPickle:

- Settings owns detection, relay configuration, encrypted identity and connection testing.
- Collab owns Buzz Story Rooms, messages and proposal creation.
- Buzz Desktop supplies the local client/CLI dependency underneath those PlotPickle surfaces.
`;
}
write(docsPath, docs);

rmSync(path.join(root, "scripts", "issue-244-apply.mjs"));
console.log("Applied Issue #244 Buzz Desktop launcher installation changes.");
