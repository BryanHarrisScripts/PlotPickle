#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const configPath = path.resolve(process.argv[2] ?? "config/visual-audit-captures.json");
const manifestPath = path.resolve(process.argv[3] ?? "reports/visual-audit/visual-audit-manifest.json");
const reportPath = path.join(path.dirname(manifestPath), "visual-audit-validation.json");
const marketingHeading = "stop losing the story between the notes, drafts and visuals";

const config = JSON.parse(await readFile(configPath, "utf8"));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const expectedViewports = Object.keys(config.viewports ?? {});
const failures = [];
const warnings = [];

function keyFor(value) {
  return `${value.screenId}::${value.variant ?? value.settingsTarget ?? ""}`;
}

function searchableText(item) {
  return [item.title, ...(item.headings ?? [])].filter(Boolean).join("\n").toLowerCase();
}

const itemsByKey = new Map();
for (const item of manifest.items ?? []) {
  const key = keyFor(item);
  const list = itemsByKey.get(key) ?? [];
  list.push(item);
  itemsByKey.set(key, list);
}

for (const capture of config.captures ?? []) {
  const key = keyFor(capture);
  const items = itemsByKey.get(key) ?? [];
  const requestedViewports = capture.viewports?.length ? capture.viewports : expectedViewports;
  for (const viewport of requestedViewports) {
    const item = items.find((candidate) => candidate.viewport === viewport);
    if (!item) {
      failures.push({ screenId: capture.screenId, variant: capture.variant ?? capture.settingsTarget ?? null, viewport, problem: "Screenshot missing" });
      continue;
    }
    const text = searchableText(item);
    if (capture.expectedText && !text.includes(String(capture.expectedText).toLowerCase())) {
      failures.push({
        screenId: capture.screenId,
        variant: capture.variant ?? capture.settingsTarget ?? null,
        viewport,
        problem: `Expected screen identity was not found: ${capture.expectedText}`,
        headings: item.headings ?? [],
      });
    }
    if (capture.screenId !== "public-marketing-splash" && text.includes(marketingHeading)) {
      failures.push({
        screenId: capture.screenId,
        variant: capture.variant ?? capture.settingsTarget ?? null,
        viewport,
        problem: "Public marketing splash was captured instead of the requested application screen",
        headings: item.headings ?? [],
      });
    }
    if (capture.referenceOnly) {
      warnings.push({
        screenId: capture.screenId,
        variant: capture.variant ?? capture.settingsTarget ?? null,
        viewport,
        problem: "Reference evidence only; no independent destination is currently exposed",
      });
    }
  }
}

const result = {
  schemaVersion: 1,
  validatedAt: new Date().toISOString(),
  captures: config.captures?.length ?? 0,
  screenshots: manifest.items?.length ?? 0,
  failures,
  warnings,
};
await writeFile(reportPath, `${JSON.stringify(result, null, 2)}\n`);

if (failures.length) {
  throw new Error(`Visual screen identity validation failed with ${failures.length} problem(s). Review ${reportPath}.`);
}
console.log(`Visual screen identity validation passed for ${result.screenshots} screenshots with ${warnings.length} reference warning(s).`);
