import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #1020 scopes native Python probe errors instead of aborting configuration", async () => {
  const script = await source("scripts/configure-hardware-aware-local-ai.ps1");
  const probe = script.slice(
    script.indexOf("function Get-PythonVersion"),
    script.indexOf("function Test-RagPythonVersion"),
  );

  assert.match(script, /\$ErrorActionPreference\s*=\s*"Stop"/);
  assert.match(probe, /\$previousErrorActionPreference\s*=\s*\$ErrorActionPreference/);
  assert.match(probe, /\$ErrorActionPreference\s*=\s*"Continue"/);
  assert.match(probe, /catch\s*\{\s*return \$null/s);
  assert.match(probe, /finally\s*\{[\s\S]*\$ErrorActionPreference\s*=\s*\$previousErrorActionPreference/);
  assert.match(probe, /\$exitCode\s*=\s*\$LASTEXITCODE/);
  assert.match(probe, /\$exitCode -ne 0/);
});

test("issue #1020 keeps legacy or unavailable launcher candidates ineligible and preserves fallback", async () => {
  const script = await source("scripts/configure-hardware-aware-local-ai.ps1");
  const finder = script.slice(
    script.indexOf("function Find-RagPython"),
    script.indexOf("function Configure-RetrievalService"),
  );
  const configureTail = script.slice(script.lastIndexOf("New-Item -ItemType Directory"));

  for (const selector of ["-3.13", "-3.12", "-3.11", "-3.10"]) {
    assert.ok(finder.includes(`\"${selector}\"`) || finder.includes(`"${selector}"`), `missing launcher selector ${selector}`);
  }
  assert.match(script, /\$MinimumRagPythonMinor\s*=\s*10/);
  assert.match(configureTail, /Configure-PascalComfyUI[\s\S]*Configure-RetrievalService/);
  assert.match(configureTail, /bounded lexical fallback/i);
  assert.doesNotMatch(script, /winget|choco|Invoke-WebRequest.*python|cloud fallback enabled/i);
});
