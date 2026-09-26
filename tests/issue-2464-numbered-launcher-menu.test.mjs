import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readLauncher = () => readFile("PlotPickle.ps1", "utf8");

test("#2464/#2468 launcher exposes the three numbered startup modes in product order", async () => {
  const launcher = await readLauncher();

  assert.match(launcher, /\$startupOptions = \[ordered\]@\{/u);
  assert.match(launcher, /"1" = @\{[\s\S]*?Mode = "normal"[\s\S]*?Label = "Open PlotPickle normally"/u);
  assert.match(launcher, /"2" = @\{[\s\S]*?Mode = "webmcp"[\s\S]*?Label = "WebMCP Testing"/u);
  assert.match(launcher, /"3" = @\{[\s\S]*?Mode = "conversational-uat"[\s\S]*?Label = "Conversational UAT"/u);
  assert.match(launcher, /foreach \(\$entry in \$startupOptions\.GetEnumerator\(\)\)/u);
  assert.match(launcher, /Run PlotPickle\? \[SELECT\]: 1\/2\/3/u);

  const normalIndex = launcher.indexOf('"1" = @{');
  const webmcpIndex = launcher.indexOf('"2" = @{');
  const uatIndex = launcher.indexOf('"3" = @{');
  assert.ok(normalIndex >= 0 && webmcpIndex > normalIndex && uatIndex > webmcpIndex);
});

test("#2464/#2468 launcher defaults to pristine normal PlotPickle after five seconds", async () => {
  const launcher = await readLauncher();

  assert.match(launcher, /\[DateTime\]::UtcNow\.AddSeconds\(5\)/u);
  assert.match(launcher, /\[AUTO\] Starting \[1\] in \{0\}\.\.\./u);
  assert.match(launcher, /\[Console\]::KeyAvailable/u);
  assert.match(launcher, /\[Console\]::ReadKey\(\$true\)/u);
  assert.match(launcher, /Start-Sleep -Milliseconds 100/u);
  assert.match(launcher, /if \(-not \$selection\) \{[\s\S]*?\$selection = "1"/u);
  assert.match(launcher, /No selection received\. Starting \[1\] Open PlotPickle normally\./u);
  assert.match(launcher, /& \$launcher --normal/u);
  assert.doesNotMatch(launcher, /Read-Host/u);
});

test("#2468 routes numbered and explicit modes deterministically", async () => {
  const launcher = await readLauncher();

  assert.match(launcher, /if \(\$mode -eq "webmcp"\)[\s\S]*?& \$launcher --webmcp-testing/u);
  assert.match(launcher, /elseif \(\$mode -eq "conversational-uat"\)[\s\S]*?& \$launcher --conversational-uat/u);
  assert.match(launcher, /else \{[\s\S]*?& \$launcher --normal/u);
  assert.match(launcher, /\[switch\]\$WebMCPTesting/u);
  assert.match(launcher, /\[switch\]\$HumanTesting/u);
  assert.match(launcher, /\[switch\]\$ConversationalUAT/u);
  assert.match(launcher, /\$explicitModes\.Count -gt 1/u);
  assert.match(launcher, /elseif \(\$HumanTesting\) \{[\s\S]*?"normal"/u);
  assert.match(launcher, /exit \$LASTEXITCODE/u);
});
