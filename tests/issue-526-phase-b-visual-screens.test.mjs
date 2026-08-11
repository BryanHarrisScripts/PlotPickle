import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const phaseB = await readFile(new URL("../app/phase-b-visual-writing-screens.css", import.meta.url), "utf8");
const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("Phase B keeps the approved matte-black teal-orange typewriter visual contract", () => {
  assert.match(phaseB, /var\(--pp-matte\)/);
  assert.match(phaseB, /var\(--pp-teal\)/);
  assert.match(phaseB, /var\(--pp-orange-bright\)/);
  assert.match(phaseB, /Courier New/);
  assert.match(phaseB, /#a9823b/i);
  assert.doesNotMatch(phaseB, /purple|#7c3aed|#8b5cf6/i);
  assert.match(layout, /import "\.\/phase-b-visual-writing-screens\.css";/);
});

test("Story Setup is treated as a creative brief with a distinct project identity surface", () => {
  assert.match(phaseB, /editor-page:has\(#field-primary-audience\)/);
  assert.match(phaseB, /#field-title/);
  assert.match(page, /SectionHeading eyebrow="01 · Story Setup"/);
  for (const label of ["Title", "Format", "Language", "Primary audience", "Story scope"]) {
    assert.match(page, new RegExp(`label="${label}"`));
  }
});

test("Concept Canvas keeps creative seed and visual intent ahead of provider configuration", () => {
  assert.match(phaseB, /\.concept-canvas-page/);
  assert.match(phaseB, /field-concept-seed/);
  assert.match(page, /Start exploration/);
  for (const label of ["Concept seed", "Emotional purpose", "Audience experience", "Desired visual impact", "Must-keep constraints", "Open exploration"]) {
    assert.match(page, new RegExp(`label="${label}"`));
  }
  assert.match(page, /Provider, model, workflow and billing settings stay out of the canvas and remain in Settings\./);
});

test("24 Blocks presents four-act architecture beside a selected visual story moment", () => {
  assert.match(phaseB, /\.blocks-page \.blocks-workspace/);
  assert.match(phaseB, /grid-template-columns: minmax\(370px/);
  assert.match(phaseB, /\.block-card\.active/);
  assert.match(phaseB, /\.block-inspector/);
  assert.match(phaseB, /field-story-text/);
  assert.match(phaseB, /field-storyboard-direction/);
  assert.match(page, /Open visual board/);
  assert.match(page, /Characters in this block/);
  assert.match(page, /Locations in this block/);
  assert.match(page, /Storyboard direction/);
});
