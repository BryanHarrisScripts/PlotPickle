import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #169 defines exactly three release builds from one product contract", async () => {
  const [contract, splash] = await Promise.all([
    source("lib/product-direction.ts"),
    source("app/marketing-splash-base.tsx"),
  ]);
  for (const value of [
    "PlotPickle-Windows.zip",
    "Start-PlotPickle.bat",
    "PlotPickle-macOS.zip",
    "Start-PlotPickle.command",
    "PlotPickle-Linux.zip",
    "start-plotpickle.sh",
  ]) assert.ok(contract.includes(value), `Missing release contract: ${value}`);
  assert.equal([...contract.matchAll(/id: "(windows|macos|linux)"/g)].length, 3);
  assert.match(splash, /PLOTPICKLE_DESKTOP_BUILDS\.map/);
  assert.match(splash, /One application\. Three desktop packages\./);
  assert.match(splash, /built on its target operating system/);
  assert.match(splash, /SHA-256 checksum/);
  assert.match(splash, /Open release downloads/);
});

test("issue #169 presents the complete current workspace model", async () => {
  const [splash, contract, collab] = await Promise.all([
    source("app/marketing-splash-base.tsx"),
    source("lib/product-direction.ts"),
    source("app/collab-workspace.tsx"),
  ]);
  assert.match(splash, /PRIMARY_WORKFLOW_NAVIGATION/);
  assert.match(splash, /COLLABORATION_NAVIGATION/);
  for (const label of ["Dashboard", "Learn", "Plan", "Storyboard", "Write", "Graphic Novel", "Build", "Feedback", "Refine", "Reports", "Collab"]) {
    assert.ok(contract.includes(`label: "${label}"`), `Missing workspace: ${label}`);
  }
  assert.doesNotMatch(contract, /id: "buzz", label: "Buzz"/);
  assert.match(collab, /id: "buzz", label: "Buzz"/);
  assert.match(collab, /<BuzzCollabPanel/);
  for (const phrase of [
    "Available now · Dashboard",
    "Available now · Graphic Novel + Storyboard",
    "Available now · Feedback + Reports",
    "Optional · Collab",
    "Optional · Buzz",
    "Available now · Local-first",
  ]) assert.ok(splash.includes(phrase), `Missing feature story: ${phrase}`);
  for (const boundary of [
    "Product-authentic PlotPickle Dashboard preview",
    "One living story graph",
    "Native bundled Buzz binaries are not advertised as shipped",
    "Settings configures services. Collab and Buzz use those connections",
  ]) assert.ok(splash.includes(boundary), `Missing product-authentic boundary: ${boundary}`);
});

test("splash follows an AIDA path from story pain to a concrete open-source action", async () => {
  const splash = await source("app/marketing-splash-base.tsx");
  const sequence = [
    "Stop losing the story",
    "Learn the craft inside the story you are building.",
    "Start privately. Add people only when the story needs them.",
    "Load Afterglow",
  ];
  let cursor = -1;
  for (const phrase of sequence) {
    const next = splash.indexOf(phrase);
    assert.ok(next > cursor, `AIDA sequence is missing or out of order: ${phrase}`);
    cursor = next;
  }
  for (const pillar of ["self-paced modules", "story graph", "portable PPF", "Story logic", "Visual writing", "Visual pitch", "Community feedback"]) {
    assert.match(splash, new RegExp(pillar, "i"), `Missing marketing pillar: ${pillar}`);
  }
});

test("splash compares the three operating modes with Afterglow and Learning flowing through all", async () => {
  const splash = await source("app/marketing-splash-base.tsx");
  for (const phrase of [
    "Local Story Mode",
    "Writers’ Room Mode",
    "Cloud Collab Mode",
    "PlotPickle installed locally",
    "Afterglow or your own local story",
    "Learn workspace · 81 modules · local guides",
  ]) assert.ok(splash.includes(phrase), `Missing mode-comparison contract: ${phrase}`);
  assert.match(splash, /operatingModes\.map/);
  assert.match(splash, /id="modes"/);
});

test("issue #169 distinguishes open software, open learning and user ownership", async () => {
  const [splash, contract] = await Promise.all([
    source("app/marketing-splash-base.tsx"),
    source("lib/product-direction.ts"),
  ]);
  assert.match(splash, /OPEN_SOURCE_FOUNDATIONS\.map/);
  for (const phrase of [
    "GNU AGPLv3 or later",
    "Creative Commons BY-SA 4.0",
    "Your story remains yours",
    "Bryan Elgin Harris",
    "Portable projects, plugins and SDK",
  ]) assert.ok(contract.includes(phrase) || splash.includes(phrase), `Missing ownership boundary: ${phrase}`);
});

test("issue #169 keeps the official edition local and integrations optional", async () => {
  const splash = await source("app/marketing-splash-base.tsx");
  for (const phrase of [
    "local-first",
    "Works without AI",
    "There is no required PlotPickle cloud account",
    "No AI",
    "OpenAI API",
    "Local or compatible model",
    "Manual prompt export",
    "Buzz is dormant by default",
    "nothing becomes canonical until a person approves it",
  ]) assert.ok(splash.includes(phrase), `Missing local or optional-integration boundary: ${phrase}`);
  assert.doesNotMatch(splash, /Try PlotPickle Online|official online edition/i);
});

test("issue #169 splash remains accessible and responsive", async () => {
  const [splash, css] = await Promise.all([
    source("app/marketing-splash-base.tsx"),
    source("app/marketing-splash.module.css"),
  ]);
  assert.match(splash, /aria-label="Splash page navigation"/);
  assert.match(splash, /aria-label="PlotPickle operating principles"/);
  assert.match(splash, /aria-label="Product-authentic PlotPickle Dashboard preview"/);
  assert.equal((splash.match(/onClick=\{onEnter\}/g) ?? []).length, 3);
  assert.match(splash, /\/brand\/favicon\/plotpickle-icon-128\.png/);
  assert.match(splash, /plotpickle-multi-server-collaboration\.svg/);
  for (const target of ["studio", "modes", "builds", "open-source", "collaboration"]) {
    assert.ok(splash.includes(`href="#${target}"`), `Missing splash navigation target: ${target}`);
    assert.ok(splash.includes(`id="${target}"`), `Missing splash section id: ${target}`);
  }
  const usedClasses = new Set([...splash.matchAll(/styles\.([A-Za-z][A-Za-z0-9]*)/g)].map((match) => match[1]));
  for (const className of usedClasses) {
    assert.match(css, new RegExp(`\\.${className}\\b`), `Missing splash CSS module class: ${className}`);
  }
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /@media \(max-width: 780px\)/);
});

test("issue #169 regression test is registered and its scope is locked", async () => {
  const [packageText, documentation] = await Promise.all([
    source("package.json"),
    source("docs/issue-169-splash-builds-open-source.md"),
  ]);
  const packageJson = JSON.parse(packageText);
  assert.match(packageJson.scripts.test, /issue-169-splash-builds-open-source\.test\.mjs/);
  assert.equal(packageJson.scripts["test:splash-builds-open-source"], "node --test tests/issue-169-splash-builds-open-source.test.mjs");
  for (const phrase of [
    "## Scope lock",
    "satisfies an acceptance criterion in issue #169",
    "corrects a verified factual mismatch with the current `main` branch",
    "primary navigation order, containers or active-state presentation",
    "Settings information architecture",
    "Refine ownership and workspace routing",
    "New ideas belong in their own issue and PR.",
  ]) assert.ok(documentation.includes(phrase), `Missing scope-lock rule: ${phrase}`);
});
