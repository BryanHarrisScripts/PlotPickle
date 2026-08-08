import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app/creative-director-actions.tsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../app/creative-director-actions.module.css", import.meta.url), "utf8");
const storyboard = fs.readFileSync(new URL("../app/visual-storyboard.tsx", import.meta.url), "utf8");
const storyboardStyles = fs.readFileSync(new URL("../app/visual-storyboard.module.css", import.meta.url), "utf8");
const project = fs.readFileSync(new URL("../lib/project.ts", import.meta.url), "utf8");
const workflow = fs.readFileSync(new URL("../.github/workflows/creative-director-actions.yml", import.meta.url), "utf8");

test("Creative Director actions keep story and human decisions ahead of provider configuration", () => {
  assert.match(source, /storyMoment/);
  for (const decision of ["Keep", "Change Direction", "Try Again", "Compare"]) assert.match(source, new RegExp(decision));
  assert.match(source, /Illustrate this moment/);
  assert.match(source, /Animate approved image/);
  assert.match(source, /Creative direction/);
  assert.match(source, /Technical routing stays in Settings/);
  assert.match(source, />Open Settings</);
  assert.doesNotMatch(source, /OpenAI|Ollama|ComfyUI|MiniMax/);
});

test("Creative Director actions expose plain-language recovery and accessible status", () => {
  assert.match(source, /Open Settings/);
  assert.match(source, /writerFacingMessage/);
  assert.match(source, /generation request/);
  assert.match(source, /generation job/);
  assert.match(source, /role="status"/);
  assert.match(source, /<fieldset className=\{styles\.decisions\}>/);
  assert.match(source, /<legend>What do you want to do with this visual\?<\/legend>/);
  assert.match(source, /<fieldset className=\{styles\.generationActions\}>/);
  assert.match(source, /<legend className=\{styles\.actionLegend\}>Create another visual version<\/legend>/);
  assert.doesNotMatch(source, /role="group"/);
  assert.match(source, /<figure className=\{styles\.preview\}>/);
  assert.match(source, /<p className=\{styles\.empty\}>/);
  assert.doesNotMatch(source, /<div className=\{styles\.empty\}>/);
  assert.doesNotMatch(source, /<figcaption className=\{styles\.empty\}>/);
  assert.match(source, /disabled=\{busy\}/);
});

test("Creative Director actions protect responsive, focus, reduced-motion and forced-colour behaviour", () => {
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /min-height: 44px/);
  assert.match(styles, /\.actionLegend\s*\{[\s\S]*position:\s*absolute/);
  assert.match(styles, /min-inline-size:\s*0/);
  assert.match(styles, /\.decisions\s*\{[\s\S]*grid-template-columns:\s*repeat\(4/);
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
  assert.match(source, /approveButton\.click\(\)/);
  assert.doesNotMatch(source, /approvedImageVersionId|approvedVideoVersionId|setProject/);
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

test("Creative Director CI covers the integrated Storyboard flow with immutable action pins", () => {
  assert.match(workflow, /app\/visual-storyboard\.tsx/);
  assert.match(workflow, /app\/visual-storyboard\.module\.css/);
  assert.match(workflow, /lib\/project\.ts/);
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/);
  assert.match(workflow, /node --test tests\/issue-367-creative-director-actions\.test\.mjs/);
});
