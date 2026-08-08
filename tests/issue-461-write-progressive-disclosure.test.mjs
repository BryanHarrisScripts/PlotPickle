import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#461 keeps advanced Write capability but moves it behind one deliberate disclosure", async () => {
  const [writer, host] = await Promise.all([
    source("app/script-workspace.tsx"),
    source("app/write-studio-host.tsx"),
  ]);

  for (const capability of ["Export Fountain", "Export Final Draft", "Print / PDF", "ProductionDraftPanel"]) {
    assert.ok(writer.includes(capability), `Missing preserved advanced Write capability: ${capability}`);
  }

  assert.match(host, /More writing tools/);
  assert.match(host, /Exports and Shooting Script controls stay available here when you need them/);
  assert.match(host, /data-write-advanced-tools/);
});

test("#461 hides export and production panels until More writing tools is opened", async () => {
  const styles = await source("app/write-studio-progressive.css");

  assert.match(styles, /\[class\*="exportActions"\],[\s\S]*\[class\*="productionDraftPanel"\][\s\S]*display:\s*none\s*!important/);
  assert.match(styles, /data-write-advanced="open"/);
  assert.match(styles, /\[class\*="exportActions"\][\s\S]*display:\s*flex\s*!important/);
  assert.match(styles, /\[class\*="productionDraftPanel"\][\s\S]*display:\s*block\s*!important/);
});

test("#461 Write Studio host toggles presentation only and never screenplay or project state", async () => {
  const host = await source("app/write-studio-host.tsx");

  assert.match(host, /workspace\.dataset\.writeStudio = "true"/);
  assert.match(host, /workspace\.dataset\.writeAdvanced = "open"/);
  assert.match(host, /delete workspace\.dataset\.writeAdvanced/);
  assert.match(host, /createPortal/);
  assert.match(host, /MutationObserver/);
  assert.doesNotMatch(host, /setProject|onProjectChange|commit\(|localStorage|sessionStorage|approvedImageVersionId|approvedVideoVersionId/i);
});

test("#461 progressive disclosure is loaded after the canonical Write Studio skin", async () => {
  const layout = await source("app/layout.tsx");
  const phase = layout.indexOf('import "./write-studio-phase-c.css"');
  const treatment = layout.indexOf('import "./write-studio-treatment.css"');
  const progressive = layout.indexOf('import "./write-studio-progressive.css"');

  assert.ok(phase >= 0 && treatment > phase && progressive > treatment, "Write progressive disclosure must load after the canonical Write Studio layers");
});

test("#461 advanced disclosure stays provider-neutral", async () => {
  const [host, styles] = await Promise.all([
    source("app/write-studio-host.tsx"),
    source("app/write-studio-progressive.css"),
  ]);
  assert.doesNotMatch(host, /Ollama|ComfyUI|MiniMax|OpenAI|checkpoint|endpoint|apiKey/i);
  assert.doesNotMatch(styles, /Ollama|ComfyUI|MiniMax|OpenAI|checkpoint|endpoint|apiKey/i);
});
