import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readLauncher = () => readFile("PlotPickle.ps1", "utf8");

test("#2464 launcher exposes a numbered, extensible startup menu", async () => {
  const launcher = await readLauncher();

  assert.match(launcher, /\$startupOptions = \[ordered\]@\{/u);
  assert.match(launcher, /"1" = @\{[\s\S]*?Mode = "human"[\s\S]*?Label = "Open PlotPickle normally"/u);
  assert.match(launcher, /"2" = @\{[\s\S]*?Mode = "webmcp"[\s\S]*?Label = "WebMCP Testing"/u);
  assert.match(launcher, /Skin V1 Matrix/u);
  assert.match(launcher, /foreach \(\$entry in \$startupOptions\.GetEnumerator\(\)\)/u);
  assert.match(launcher, /Run PlotPickle\? \[SELECT\]: 1\/2/u);

  const normalIndex = launcher.indexOf('"1" = @{');
  const webmcpIndex = launcher.indexOf('"2" = @{');
  assert.ok(normalIndex >= 0 && webmcpIndex > normalIndex);
});

test("#2464 launcher defaults to normal PlotPickle after a visible five-second countdown", async () => {
  const launcher = await readLauncher();

  assert.match(launcher, /\[DateTime\]::UtcNow\.AddSeconds\(5\)/u);
  assert.match(launcher, /\[AUTO\] Starting \[1\] in \{0\}\.\.\./u);
  assert.match(launcher, /\[Console\]::KeyAvailable/u);
  assert.match(launcher, /\[Console\]::ReadKey\(\$true\)/u);
  assert.match(launcher, /Start-Sleep -Milliseconds 100/u);
  assert.match(launcher, /if \(-not \$selection\) \{[\s\S]*?\$selection = "1"/u);
  assert.match(launcher, /No selection received\. Starting \[1\] Open PlotPickle normally\./u);
  assert.doesNotMatch(launcher, /Read-Host/u);
  assert.doesNotMatch(launcher, /Run autonomous WebMCP Testing\? \[Y\/N\]/u);
});

test("#2464 launcher consumes only valid numbered choices and preserves existing routing", async () => {
  const launcher = await readLauncher();

  assert.match(launcher, /if \(\$startupOptions\.Contains\(\$pressed\)\) \{[\s\S]*?\$selection = \$pressed/u);
  assert.match(launcher, /\$startupOptions\[\$selection\]\.Mode/u);
  assert.match(launcher, /if \(\$mode -eq "webmcp"\)[\s\S]*?& \$launcher --webmcp-testing/u);
  assert.match(launcher, /else \{[\s\S]*?& \$launcher --human-testing/u);
  assert.match(launcher, /exit \$LASTEXITCODE/u);
});

test("#2464 preserves explicit mode switches and mutual exclusion", async () => {
  const launcher = await readLauncher();

  assert.match(launcher, /\[switch\]\$WebMCPTesting/u);
  assert.match(launcher, /\[switch\]\$HumanTesting/u);
  assert.match(launcher, /if \(\$WebMCPTesting -and \$HumanTesting\)/u);
  assert.match(launcher, /Choose either -WebMCPTesting or -HumanTesting, not both\./u);
  assert.match(launcher, /\$mode = if \(\$WebMCPTesting\) \{[\s\S]*?"webmcp"[\s\S]*?\} elseif \(\$HumanTesting\) \{[\s\S]*?"human"/u);
});
