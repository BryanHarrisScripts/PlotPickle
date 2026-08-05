import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app/creative-director-actions.tsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../app/creative-director-actions.module.css", import.meta.url), "utf8");

test("Creative Director actions keep story and intent ahead of provider configuration", () => {
  assert.match(source, /storyMoment/);
  assert.match(source, />Illustrate</);
  assert.match(source, />Animate</);
  assert.match(source, /Advanced direction/);
  assert.match(source, /Provider, model, checkpoint and workflow choices stay in Settings/);
  assert.doesNotMatch(source, /OpenAI|Ollama|ComfyUI|MiniMax/);
});

test("Creative Director actions expose plain-language recovery and accessible status", () => {
  assert.match(source, /Open generation settings/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-label="Direct this story moment"/);
  assert.match(source, /disabled={busy}/);
});

test("Creative Director actions protect responsive, focus, reduced-motion and forced-colour behaviour", () => {
  assert.match(styles, /@media\(max-width:720px\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(styles, /@media\(forced-colors:active\)/);
  assert.match(styles, /min-height:44px/);
});
