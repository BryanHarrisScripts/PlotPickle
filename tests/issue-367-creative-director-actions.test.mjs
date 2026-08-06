import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app/creative-director-actions.tsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../app/creative-director-actions.module.css", import.meta.url), "utf8");
const storyboard = fs.readFileSync(new URL("../app/visual-storyboard.tsx", import.meta.url), "utf8");
const storyboardStyles = fs.readFileSync(new URL("../app/visual-storyboard.module.css", import.meta.url), "utf8");
const project = fs.readFileSync(new URL("../lib/project.ts", import.meta.url), "utf8");

test("Creative Director actions keep story and intent ahead of provider configuration", () => {
  assert.match(source, /storyMoment/);
  assert.match(source, /"Illustrate"/);
  assert.match(source, /"Animate"/);
  assert.match(source, /Advanced direction/);
  assert.match(source, /Provider, model, checkpoint and workflow choices stay in Settings/);
  assert.doesNotMatch(source, /OpenAI|Ollama|ComfyUI|MiniMax/);
});

test("Creative Director actions expose plain-language recovery and accessible status", () => {
  assert.match(source, /Open generation settings/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-label="Direct this story moment"/);
  assert.match(source, /<figure className={styles\.preview}>/);
  assert.match(source, /<figcaption className={styles\.empty}>/);
  assert.match(source, /disabled={busy}/);
});

test("Creative Director actions protect responsive, focus, reduced-motion and forced-colour behaviour", () => {
  assert.match(styles, /@media\(max-width:720px\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(styles, /@media\(forced-colors:active\)/);
  assert.match(styles, /min-height:44px/);
});

test("Creative Director actions are the primary Storyboard inspector flow", () => {
  assert.match(storyboard, /<CreativeDirectorActions/);
  assert.match(storyboard, /storyMoment=/);
  assert.match(storyboard, /onIllustrate=\{\(\) => void generateImage\(\)\}/);
  assert.match(storyboard, /onAnimate=\{\(\) => void animateVideo\(\)\}/);
  assert.match(storyboard, /onOpenSettings=\{openGenerationSettings\}/);
  assert.match(storyboard, /window\.location\.assign\("\/ai-routing"\)/);
  assert.doesNotMatch(storyboard, /className=\{styles\.generate\}/);
});

test("Storyboard illustration and animation remain reviewable versions", () => {
  assert.match(project, /export type VisualMediaVersion/);
  assert.match(project, /status: "candidate" \| "approved" \| "archived"/);
  assert.match(project, /approvedImageVersionId/);
  assert.match(project, /approvedVideoVersionId/);
  assert.match(storyboard, /appendVersion/);
  assert.match(storyboard, /approveVersion/);
  assert.match(storyboard, /keepCurrent/);
  assert.match(storyboard, /A new image version is ready/);
  assert.match(storyboard, /A new video version is ready/);
  assert.match(storyboard, /Versions attached to this story moment/);
});

test("Animate starts from the approved image and polls the configured video route", () => {
  assert.match(storyboard, /if \(!frameSource\)/);
  assert.match(storyboard, /sourceAssetUrl: frameSource/);
  assert.match(storyboard, /"\/api\/local-ai\/generate\/video"/);
  assert.match(storyboard, /\/api\/local-ai\/video\/\$\{encodeURIComponent\(current\.id\)\}/);
  assert.match(storyboard, /billingAcknowledged: true/);
  assert.match(storyboard, /dataSharingAcknowledged: true/);
  assert.match(storyboard, /requestPlotPickleConfirmation/);
  assert.doesNotMatch(storyboard, /window\.confirm\("Generate one storyboard image/);
});

test("Storyboard version review remains responsive and keyboard visible", () => {
  assert.match(storyboardStyles, /\.versionQueue/);
  assert.match(storyboardStyles, /\.versionCard/);
  assert.match(storyboardStyles, /\.versionActions button/);
  assert.match(storyboardStyles, /@media\(max-width:640px\)/);
  assert.match(storyboardStyles, /:focus-visible/);
});
