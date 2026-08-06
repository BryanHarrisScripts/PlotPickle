#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.argv[2] ?? ".");
const outputDirectory = path.resolve(process.argv[3] ?? path.join(root, "reports", "visual-audit"));
const configPath = path.join(root, "config", "visual-audit-captures.json");
const registryPath = path.join(root, "config", "ui-ux-screen-registry.json");
const runnerPath = path.join(root, "scripts", "visual-audit-capture.mjs");
const batchSize = Math.max(1, Math.min(Number(process.env.PLOTPICKLE_VISUAL_BATCH_SIZE || 6), 8));
const warmupScreenId = "__visual-audit-warmup";

const originalConfigText = await readFile(configPath, "utf8");
const originalRegistryText = await readFile(registryPath, "utf8");
const fullConfig = JSON.parse(originalConfigText);
const fullRegistry = JSON.parse(originalRegistryText);
const captures = fullConfig.captures ?? [];

function captureBatches(values, size) {
  const result = [];
  let current = [];
  const flush = () => {
    if (!current.length) return;
    result.push(current);
    current = [];
  };
  for (const capture of values) {
    if (capture.isolated) {
      flush();
      result.push([capture]);
      continue;
    }
    current.push(capture);
    if (current.length >= size) flush();
  }
  flush();
  return result;
}

function run(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { ...options, stdio: "inherit" });
    child.once("error", (error) => {
      console.error(error.stack || error.message || String(error));
      resolve(1);
    });
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function writeCombinedIndex(manifest) {
  const cards = manifest.items.map((item) => `
    <article>
      <header><strong>${htmlEscape(item.label)}</strong><span>${htmlEscape(item.screenId)} · ${htmlEscape(item.viewport)}</span></header>
      <a href="${htmlEscape(item.filename)}"><img src="${htmlEscape(item.filename)}" alt="${htmlEscape(item.label)} at ${htmlEscape(item.viewport)} viewport"></a>
      <p>${htmlEscape(item.headings?.join(" · ") || item.title || item.url)}</p>
      ${item.referenceOnly ? "<p class=\"reference\">Reference evidence: no independent destination is currently exposed.</p>" : ""}
      ${item.horizontalOverflow ? "<p class=\"warning\">Horizontal overflow detected.</p>" : ""}
    </article>`).join("\n");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PlotPickle visual audit</title>
<style>body{font:14px/1.45 system-ui;margin:0;background:#111;color:#eee}header.top{padding:24px;position:sticky;top:0;background:#111;border-bottom:1px solid #444;z-index:2}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px;padding:18px}article{background:#1d1d1d;border:1px solid #3a3a3a;border-radius:12px;overflow:hidden}article header{display:flex;justify-content:space-between;gap:12px;padding:12px}article header span{color:#aaa}img{display:block;width:100%;height:320px;object-fit:contain;object-position:top;background:#fff}p{padding:0 12px 12px;margin:8px 0;color:#bbb}.warning{color:#ffca63}.reference{color:#8bc9ff}</style></head>
<body><header class="top"><h1>PlotPickle visual audit</h1><p>${manifest.items.length} screenshots · ${manifest.coveredScreens}/${manifest.registryScreens} registry screens · ${manifest.batches} isolated batches</p></header><main class="grid">${cards}</main></body></html>`;
  await writeFile(path.join(outputDirectory, "index.html"), html);
  await writeFile(path.join(outputDirectory, "README.md"), [
    "# PlotPickle visual audit",
    "",
    `Generated: ${manifest.generatedAt}`,
    `Registry coverage: ${manifest.coveredScreens}/${manifest.registryScreens}`,
    `Screenshots: ${manifest.items.length}`,
    `Isolated batches: ${manifest.batches}`,
    "",
    "## Review order",
    "",
    ...manifest.items.map((item) => `- [${item.label} · ${item.viewport}](${item.filename})${item.referenceOnly ? " — reference evidence only" : ""}${item.horizontalOverflow ? " — horizontal overflow detected" : ""}`),
    "",
  ].join("\n"));
}

async function main() {
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  const batches = captureBatches(captures, batchSize);
  const combined = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    registryScreens: fullRegistry.screens.length,
    coveredScreens: 0,
    batches: batches.length,
    batchSize,
    viewports: fullConfig.viewports,
    items: [],
    failures: [],
  };

  try {
    for (let index = 0; index < batches.length; index += 1) {
      const batch = batches[index];
      const batchNumber = String(index + 1).padStart(2, "0");
      const batchName = `batch-${batchNumber}`;
      const batchDirectory = path.join(outputDirectory, batchName);
      const screenIds = new Set(batch.map((capture) => capture.screenId));
      const warmupCapture = {
        screenId: warmupScreenId,
        label: "Internal application warmup",
        route: "/?workspace=dashboard",
        variant: "warmup",
        viewports: ["desktop"],
      };
      const batchConfig = { ...fullConfig, captures: [warmupCapture, ...batch] };
      const batchRegistry = { ...fullRegistry, screens: fullRegistry.screens.filter((screen) => screenIds.has(screen.id)) };
      await writeFile(configPath, `${JSON.stringify(batchConfig, null, 2)}\n`);
      await writeFile(registryPath, `${JSON.stringify(batchRegistry, null, 2)}\n`);
      console.log(`Capturing ${batchName}: ${[...screenIds].join(", ")}`);
      const code = await run(process.execPath, [runnerPath, root, batchDirectory], {
        cwd: root,
        env: { ...process.env },
        windowsHide: true,
      });
      let batchManifest;
      try {
        batchManifest = JSON.parse(await readFile(path.join(batchDirectory, "visual-audit-manifest.json"), "utf8"));
      } catch (error) {
        combined.failures.push({
          batch: batchName,
          error: `Batch manifest was not produced: ${error instanceof Error ? error.message : String(error)}`,
        });
        continue;
      }
      const batchCaptureByKey = new Map(batch.map((capture) => [
        `${capture.screenId}::${capture.variant ?? capture.settingsTarget ?? ""}`,
        capture,
      ]));
      for (const item of batchManifest.items ?? []) {
        if (item.screenId === warmupScreenId) continue;
        const sourceCapture = batchCaptureByKey.get(`${item.screenId}::${item.variant ?? ""}`);
        combined.items.push({
          ...item,
          batch: batchName,
          filename: `${batchName}/${item.filename}`,
          expectedText: sourceCapture?.expectedText ?? null,
          referenceOnly: Boolean(sourceCapture?.referenceOnly),
        });
      }
      for (const failure of batchManifest.failures ?? []) {
        if (failure.screenId !== warmupScreenId) combined.failures.push({ ...failure, batch: batchName });
      }
      if (code !== 0 && !(batchManifest.failures?.filter((failure) => failure.screenId !== warmupScreenId).length)) {
        combined.failures.push({ batch: batchName, error: `Capture runner exited with code ${code}.` });
      }
    }
  } finally {
    await writeFile(configPath, originalConfigText);
    await writeFile(registryPath, originalRegistryText);
  }

  const capturedIds = new Set(combined.items.map((item) => item.screenId));
  combined.coveredScreens = capturedIds.size;
  for (const screen of fullRegistry.screens) {
    if (!capturedIds.has(screen.id)) combined.failures.push({ screenId: screen.id, label: screen.label, error: "No screenshot was produced in any batch." });
  }
  await writeFile(path.join(outputDirectory, "visual-audit-manifest.json"), `${JSON.stringify(combined, null, 2)}\n`);
  await writeCombinedIndex(combined);
  if (combined.failures.length) {
    throw new Error(`Visual audit captured ${combined.items.length} screenshots with ${combined.failures.length} failure(s). Review ${outputDirectory}.`);
  }
  console.log(`Visual audit captured ${combined.items.length} screenshots across ${batches.length} isolated batches.`);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
