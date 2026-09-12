import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { changedFilesFromGit, runDevelopmentConvergence } from "../scripts/run-development-convergence.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const CURRENT_CATEGORY = "AI-native agentic story operating system";
const STALE_CATEGORY = /AI-native visual writing and creative direction/i;

test("#1971 canonical PlotPickle positioning uses the agentic story operating system category", async () => {
  const contract = await read("lib/product-direction.ts");
  assert.match(contract, /PLOTPICKLE_PRODUCT_CATEGORY = "AI-native agentic story operating system"/u);
  assert.match(contract, /category: PLOTPICKLE_PRODUCT_CATEGORY/u);
  assert.doesNotMatch(contract, STALE_CATEGORY);
});

test("#1971 active product surfaces share the current category without stale current-product copy", async () => {
  const paths = [
    "app/layout.tsx",
    "app/profile-access/profile-access-boundary.tsx",
    "app/about/page.tsx",
    "app/about/about-content.ts",
    "app/welcome/page.tsx",
    "app/marketing-splash-base.tsx",
  ];
  const sources = await Promise.all(paths.map(read));
  for (const [index, source] of sources.entries()) {
    assert.doesNotMatch(source, STALE_CATEGORY, `${paths[index]} still presents the retired category as current PlotPickle identity`);
  }
  for (const source of sources) assert.match(source, /PLOTPICKLE_PRODUCT_CATEGORY/u);
  assert.match(sources[0], /title: `PlotPickle — \$\{PLOTPICKLE_PRODUCT_CATEGORY\}`/u);
  assert.match(sources[1], /document\.title = `PlotPickle — \$\{PLOTPICKLE_PRODUCT_CATEGORY\}`/u);
});

test("#1971 browser and installed-app identity use the green-square favicon", async () => {
  const [layout, manifestSource, icon] = await Promise.all([
    read("app/layout.tsx"),
    read("public/manifest.webmanifest"),
    read("public/brand/favicon/plotpickle-green-square.svg"),
  ]);
  const manifest = JSON.parse(manifestSource);
  assert.equal(manifest.description, `PlotPickle is an ${CURRENT_CATEGORY} for local-first story development.`);
  assert.equal(manifest.theme_color, "#38d996");
  assert.deepEqual(manifest.icons.map((entry) => entry.src), ["/brand/favicon/plotpickle-green-square.svg"]);
  assert.match(layout, /icon: "\/brand\/favicon\/plotpickle-green-square\.svg"/u);
  assert.match(layout, /shortcut: "\/brand\/favicon\/plotpickle-green-square\.svg"/u);
  assert.match(layout, /apple: "\/brand\/favicon\/plotpickle-green-square\.svg"/u);
  assert.doesNotMatch(`${layout}\n${manifestSource}`, /plotpickle-ouroboros-v2/u);
  assert.match(icon, /<rect/u);
  assert.match(icon, /#38d996/u);
});

test("#1971 retains the historical #382/#383 visual-writing programme as history rather than current positioning", async () => {
  const registry = JSON.parse(await read("config/ai-native-visual-writing-programme.json"));
  const historicalDoc = await read("docs/AI-NATIVE-VISUAL-WRITING.md");
  assert.equal(registry.programmeIssue, 382);
  assert.equal(registry.foundationIssue, 383);
  assert.equal(registry.productCategory, "AI-native visual writing and creative direction studio");
  assert.match(historicalDoc, /Programme: \[#382\]/u);
  assert.match(historicalDoc, /Foundation: \[#383\]/u);
});

test("#1971 is governed and selected by the seven-layer verification mesh", async () => {
  const [catalogSource, ownershipSource] = await Promise.all([
    read("config/verification/test-catalog.json"),
    read("config/verification/ownership-map.json"),
  ]);
  const catalog = JSON.parse(catalogSource);
  const ownership = JSON.parse(ownershipSource);
  const entry = catalog.entries.find((candidate) => candidate.id === "experience.product-identity-1971");
  assert.ok(entry);
  assert.equal(entry.ownerLayer, "experience-skins");
  assert.deepEqual(entry.runner.targets, ["tests/issue-1971-product-identity-favicon.test.mjs"]);
  assert.ok(entry.triggerTokens.includes("surface"));
  assert.ok(entry.triggerTokens.includes("visual"));
  const owner = ownership.rules.find((rule) => rule.id === "product-identity-surfaces");
  assert.ok(owner);
  assert.equal(owner.ownerLayer, "experience-skins");
  assert.ok(owner.include.includes("lib/product-direction.ts"));
  assert.ok(owner.include.includes("public/manifest.webmanifest"));
});

test("#1971 canonical development convergence reports CONVERGED against the real diff", async (t) => {
  const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "main";
  const changedFiles = changedFilesFromGit({ root: process.cwd(), baseRef });
  if (!changedFiles.includes("config/development-convergence/1971.json")) {
    t.skip("#1971 issue-specific convergence only applies when its convergence manifest is part of the current diff.");
    return;
  }

  const result = await runDevelopmentConvergence([
    "--manifest",
    "config/development-convergence/1971.json",
    "--base-ref",
    baseRef,
    "--report-dir",
    ".artifacts/development-convergence",
  ]);

  assert.equal(result.exitCode, 0);
  assert.equal(result.reports.length, 1);
  assert.equal(result.reports[0].issue, 1971);
  assert.equal(result.reports[0].status, "CONVERGED");
  assert.deepEqual(result.reports[0].remaining, []);
});
