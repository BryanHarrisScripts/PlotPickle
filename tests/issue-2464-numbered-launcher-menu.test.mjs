import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readLauncher = () => readFile("PlotPickle.ps1", "utf8");

test("#2464/#2835 launcher starts normally without a mode menu or delay", async () => {
  const launcher = await readLauncher();
  assert.doesNotMatch(launcher, /startupOptions|KeyAvailable|ReadKey|Start-Sleep|AddSeconds|Read-Host/u);
  assert.match(launcher, /else \{\s+"normal"\s+\}/u);
  assert.match(launcher, /& \$launcher --normal/u);
});

test("#2468 retains explicit developer modes deterministically", async () => {
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
