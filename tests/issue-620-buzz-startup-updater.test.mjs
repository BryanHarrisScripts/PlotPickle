import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [installer, config, companion] = await Promise.all([
  readFile(new URL("../scripts/install-buzz-desktop.ps1", import.meta.url), "utf8"),
  readFile(new URL("../config/buzz-desktop.json", import.meta.url), "utf8"),
  readFile(new URL("../scripts/windows-companion-software.ps1", import.meta.url), "utf8"),
]);

const parsedConfig = JSON.parse(config);

test("PlotPickle keeps Buzz Desktop 0.5.14 as a verified reviewed fallback", () => {
  assert.equal(parsedConfig.releaseTag, "desktop-v0.5.14");
  assert.equal(parsedConfig.version, "0.5.14");
  assert.equal(parsedConfig.sourceCommit, "391495e7d347d20b67e39e3c240d17ef63c5c2c0");
  assert.equal(parsedConfig.windows.asset, "Buzz_0.5.14_x64-setup_alpha-unsigned.exe");
  assert.equal(parsedConfig.windows.sha256, "18499a628b673d4d4cb977626726071cdddab13e5ac5943b78a185308bd258a1");
  assert.match(parsedConfig.windows.downloadUrl, /^https:\/\/github\.com\/block\/buzz\/releases\/download\/desktop-v0\.5\.14\//);
});

test("startup maintenance checks block/buzz releases and selects the newest compatible Windows desktop asset", () => {
  assert.match(installer, /function Get-LatestBuzzDesktopRelease/);
  assert.match(installer, /api\.github\.com\/repos\/block\/buzz\/releases/);
  assert.match(installer, /\(\?:desktop-\)\?v\(\?<version>/);
  assert.match(installer, /Buzz_\(\?<assetVersion>/);
  assert.match(installer, /Sort-Object -Property ParsedVersion -Descending/);
  assert.match(installer, /Get-LatestBuzzDesktopRelease -ReleaseApi \$releaseApi -MinimumVersion \$version/);
  assert.match(installer, /Latest Buzz Desktop release:/);
});

test("live release lookup can never downgrade below the reviewed fallback", () => {
  assert.match(installer, /Compare-BuzzVersion -Installed \$latest\.Version -Reviewed \$MinimumVersion/);
  assert.match(installer, /-lt 0\) \{ return \$null \}/);
  assert.match(installer, /reviewed Buzz Desktop fallback/);
});

test("downloaded Buzz assets stay constrained to official block/buzz GitHub releases and verify release digests", () => {
  assert.match(installer, /\$uri\.Host -ne "github\.com"/);
  assert.match(installer, /\/block\/buzz\/releases\/download\/\$releaseTag\//);
  assert.match(installer, /digest.*sha256:/s);
  assert.match(installer, /Get-FileHash -LiteralPath \$installerPath -Algorithm SHA256/);
  assert.match(installer, /GitHub release SHA-256 verified/);
  assert.match(installer, /does not pass silent-install flags or request elevation/);
});

test("normal companion maintenance invokes the Buzz updater when Buzz is installed", () => {
  assert.match(companion, /\$buzzPath = Find-BuzzCli/);
  assert.match(companion, /Invoke-ReviewedScript -Path \$BuzzInstaller -Arguments @\("-Maintain"\) -Label "Buzz Desktop"/);
});
