import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboard = await readFile(new URL("../app/dashboard-story-library.module.css", import.meta.url), "utf8");
const phaseA = await readFile(new URL("../app/phase-a-visual-writing-screens.css", import.meta.url), "utf8");
const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const browserActions = await readFile(new URL("../scripts/creative-uat/browser-actions.mjs", import.meta.url), "utf8");

test("approved Phase A screens use the matte-black, muted-gold, typewriter visual contract", () => {
  assert.match(dashboard, /background:\s*#070707/);
  assert.match(dashboard, /font-family:\s*ui-monospace/);
  assert.match(dashboard, /#cda758/i);
  assert.match(phaseA, /--pp-matte:\s*#070707/);
  assert.match(phaseA, /--pp-gold:\s*#cda758/);
  assert.match(phaseA, /font-family:\s*var\(--font-mono\)/);
  assert.doesNotMatch(`${dashboard}\n${phaseA}`, /purple|#7c3aed|#8b5cf6/i);
});

test("World, Character Identity and Storyboard receive dedicated approved creative surfaces", () => {
  assert.match(phaseA, /editor-page:has\(#field-ordinary-world\)/);
  assert.match(phaseA, /editor-page:has\(\.character-roster\)/);
  assert.match(phaseA, /visual-studio-layout/);
  assert.match(phaseA, /CANDIDATE/);
  assert.match(phaseA, /APPROVED CANON/);
  assert.match(layout, /import "\.\/phase-a-visual-writing-screens\.css";/);
});

test("World keeps visible local-first location creation controls", () => {
  assert.match(page, /onClick=\{addLocation\}>Add location<\/button>/);
  assert.match(page, /onClick=\{addLocation\}>Create the first location<\/button>/);
  assert.match(page, /<FormField label="Location name"/);
  assert.match(page, /<FormField label="Description"/);
});

test("Creative Writer UAT can activate an exact visible control when Playwright omits its ref", () => {
  assert.match(browserActions, /async function clickExactDomControl/);
  assert.match(browserActions, /Used exact visible DOM click fallback/);
  assert.match(browserActions, /control\.click\(\)/);
  assert.match(browserActions, /node\.getClientRects|control\.getClientRects/);
});
