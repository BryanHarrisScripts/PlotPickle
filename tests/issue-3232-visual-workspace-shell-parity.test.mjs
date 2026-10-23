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
  assert.match(outlineCss, /\\.reviewSurface\\[data-dashboard-review-surface="outline"\\]\\s*\\{[^}]*width:\\s*100%/u);
  const start = css.indexOf("/* #2426/#2529/#3232:");
  assert.ok(start >= 0, "shared outer geometry contract must be documented");
  const end = css.indexOf("}", start);
  assert.ok(end > start, "outer geometry rule must be terminated");
  const shell = css.slice(start, end + 1);
  for (const stage of ["storyboard", "previs", "timeline", "production"]) {
    assert.ok(shell.includes(`[data-dashboard-review-surface="${stage}"]`), stage + " must share the same outer CSS rule");
  }
  const declarations = shell.slice(shell.lastIndexOf("{") + 1);
  for (const rule of [
    /width:\\s*100%\\s*;/u,
    /max-width:\\s*none\\s*;/u,
    /min-width:\\s*0\\s*;/u,
    /margin:\\s*0\\s*;/u,
    /box-sizing:\\s*border-box\\s*;/u,
  ]) assert.match(declarations, rule);
  assert.doesNotMatch(shell, /\\[data-(?:previs-flipbook|timeline-shot-board)|\\.pp-skin-v1-production-stage/u,
    "do not expand nested media or editor tracks");
  for (const [state, stage] of [
    ["outline", "outline"],
    ["storyboard", "storyboard"],
    ["previs", "previs"],
    ["timeline", "timeline"],
    ["production", "production"],
  ]) {
    const stageStart = host.indexOf(`if (${state}Open) {`);
    assert.ok(stageStart >= 0, state + " must have a canonical host");
    const next = host.indexOf("\n  if (", stageStart + 1);
    const body = host.slice(stageStart, next < 0 ? undefined : next);
    assert.ok(body.includes(`data-dashboard-review-surface="${stage}"`), stage + " must retain its identity");
    assert.ok(body.includes('className="pp-skin-v1-bbs-banner"'), stage + " must retain a common title bar");
    assert.ok(body.includes("<StoryActRail "), stage + " must retain Act-rail controls");
    assert.ok(body.includes("Back to Dashboard"), stage + " must preserve in-app return");
  }
});

test("#3232 width parity does not override nested panels or mobile breakpoints", async () => {
  const css = await read("app/skin-v1/preproduction-review-flow.css");
  assert.match(css, /@media \\(max-width:\\s*760px\\)/u);
  assert.match(css, /@media \\(max-width:\\s*1100px\\)/u);
  const start = css.indexOf("/* #2426/#2529/#3232:");
  const end = css.indexOf("}", start);
  const shell = css.slice(start, end + 1);
  assert.doesNotMatch(shell, /min-width:\\s*(?!0\\b)[1-9]\\d*px/u);
  assert.doesNotMatch(shell, /overflow-x:\\s*hidden|transform:|height:\\s*\\d+px/u);
});
