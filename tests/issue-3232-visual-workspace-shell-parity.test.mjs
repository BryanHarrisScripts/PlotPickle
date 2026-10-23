import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#3232 five Visualize workspaces share the full-width outer Matrix shell", async () => {
  const [css, outlineCss, host] = await Promise.all([
    read("app/skin-v1/preproduction-review-flow.css"),
    read("app/skin-v1/dashboard-bbs-review-host.module.css"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
  ]);
  for (const stage of ["outline", "storyboard", "previs", "timeline", "production"]) {
    assert.ok(outlineCss.includes('.reviewSurface[data-dashboard-review-surface="' + stage + '"]'), "missing host-level shell parity for " + stage);
  }
  assert.ok(outlineCss.includes("width: 100%;"), "Outline reference is full width");
  const start = css.indexOf("/* #2426/#2529/#3232:");
  assert.ok(start >= 0, "shared outer geometry contract must be documented");
  const end = css.indexOf("}", start);
  assert.ok(end > start, "outer geometry rule must be terminated");
  const shell = css.slice(start, end + 1);
  for (const stage of ["storyboard", "previs", "timeline", "production"]) {
    assert.ok(shell.includes('[data-dashboard-review-surface="' + stage + '"]'), stage + " must share the same outer CSS rule");
  }
  const declarations = shell.slice(shell.lastIndexOf("{") + 1).replaceAll(" ", "").replaceAll("\n", "");
  for (const rule of ["width:100%;", "max-width:none;", "min-width:0;", "margin:0;", "box-sizing:border-box;"]) {
    assert.ok(declarations.includes(rule), "missing outer-shell rule: " + rule);
  }
  assert.ok(!shell.includes("data-previs-flipbook"), "do not expand nested flipbook media");
  assert.ok(!shell.includes("timeline-shot-board"), "do not expand nested timeline tracks");
  assert.ok(!shell.includes(".pp-skin-v1-production-stage"), "do not expand nested media or editor panels");
  for (const [state, stage] of [
    ["outline", "outline"],
    ["storyboard", "storyboard"],
    ["previs", "previs"],
    ["timeline", "timeline"],
    ["production", "production"],
  ]) {
    const stageStart = host.indexOf("if (" + state + "Open) {");
    assert.ok(stageStart >= 0, state + " must have a canonical host");
    const next = host.indexOf("\n  if (", stageStart + 1);
    const body = host.slice(stageStart, next < 0 ? undefined : next);
    assert.ok(body.includes('data-dashboard-review-surface="' + stage + '"'), stage + " must retain its identity");
    // An unused CSS-module selector proves nothing: every actual host must apply the class.
    assert.match(body, /<section\s+className=\{reviewStyles\.reviewSurface\}[\s\S]*?data-dashboard-review-surface="[^"]+"/u, stage + " must attach the full-width CSS module class to its rendered section");
    assert.ok(body.includes('className="pp-skin-v1-bbs-banner"'), stage + " must retain a common title bar");
    assert.ok(body.includes("<StoryActRail "), stage + " must retain Act-rail controls");
    assert.ok(body.includes("Back to Dashboard"), stage + " must preserve in-app return");
  }
});

test("#3232 shell parity preserves media layout and responsive breakpoints", async () => {
  const css = await read("app/skin-v1/preproduction-review-flow.css");
  assert.ok(css.includes("@media (max-width: 760px) {"));
  assert.ok(css.includes("@media (max-width: 1100px) {"));
  const start = css.indexOf("/* #2426/#2529/#3232:");
  const end = css.indexOf("}", start);
  const shell = css.slice(start, end + 1);
  assert.ok(!shell.includes("overflow-x: hidden"), "do not hide overflow failures");
  assert.ok(!shell.includes("transform:"), "do not visually scale media");
  assert.ok(!shell.includes("height: 100vh"), "do not trap small-viewport height");
});
