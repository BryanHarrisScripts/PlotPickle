import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #1018 keeps sentence-transformers on a Python 3.10+ RAG runtime", async () => {
  const [script, requirements] = await Promise.all([
    source("scripts/configure-hardware-aware-local-ai.ps1"),
    source("services/curriculum-rag/requirements.txt"),
  ]);

  assert.match(requirements, /sentence-transformers>=5\.4,<6/);
  assert.match(script, /\$MinimumRagPythonMajor\s*=\s*3/);
  assert.match(script, /\$MinimumRagPythonMinor\s*=\s*10/);
  assert.match(script, /function Find-RagPython/);
  assert.match(script, /Python 3\.10\+/);
  assert.match(script, /-3\.13/);
  assert.match(script, /-3\.12/);
  assert.match(script, /-3\.11/);
  assert.match(script, /-3\.10/);
});

test("issue #1018 does not reuse Comfy Desktop Python for curriculum RAG", async () => {
  const script = await source("scripts/configure-hardware-aware-local-ai.ps1");
  const ragFinder = script.slice(
    script.indexOf("function Find-RagPython"),
    script.indexOf("function Configure-RetrievalService"),
  );

  assert.doesNotMatch(ragFinder, /Find-ComfyPython|ComfyUI|Comfy-Desktop|Comfy Desktop/);
  assert.match(ragFinder, /Get-Command \"python\.exe\"/);
  assert.match(ragFinder, /Get-Command \"py\.exe\"/);
});

test("issue #1018 replaces a legacy PlotPickle RAG venv only after a compliant base Python is found", async () => {
  const script = await source("scripts/configure-hardware-aware-local-ai.ps1");
  const retrieval = script.slice(
    script.indexOf("function Configure-RetrievalService"),
    script.indexOf("function Configure-PascalComfyUI"),
  );

  assert.match(retrieval, /Test-RagPythonVersion/);
  assert.match(retrieval, /Find-RagPython/);
  assert.match(retrieval, /Remove-Item -LiteralPath \$RagRoot -Recurse -Force/);
  assert.match(retrieval, /bounded lexical fallback/i);
  assert.doesNotMatch(retrieval, /throw \"Could not install curriculum RAG dependencies\.\"/);
});

test("issue #1018 runs an explicitly approved Pascal Comfy repair before optional RAG provisioning", async () => {
  const script = await source("scripts/configure-hardware-aware-local-ai.ps1");
  const configureTail = script.slice(script.lastIndexOf("New-Item -ItemType Directory"));
  const comfyIndex = configureTail.indexOf("Configure-PascalComfyUI");
  const ragIndex = configureTail.indexOf("Configure-RetrievalService");

  assert.ok(comfyIndex >= 0, "Configure mode must retain the explicit Pascal repair action");
  assert.ok(ragIndex >= 0, "Configure mode must retain curriculum RAG provisioning");
  assert.ok(comfyIndex < ragIndex, "approved Comfy repair must run before optional RAG provisioning");
  assert.match(configureTail, /\$RagConfigured/);
  assert.match(configureTail, /lexical fallback/i);
});
