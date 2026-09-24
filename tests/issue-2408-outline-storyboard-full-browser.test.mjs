import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2408 makes Outline and Storyboard full-browser orchestrated workspaces", async () => {
  const css = await read("app/skin-v1-surface-orchestrator.css");

  assert.match(css, /data-skin-v1-active-surface="story-map"/u);
  assert.match(css, /data-skin-v1-active-surface="storyboard"/u);
  assert.match(css, /width:\s*calc\(100vw - 40px\);/u);
  assert.match(css, /max-width:\s*none;/u);
  assert.match(css, /data-skin-v1-surface-id="story-map"/u);
  assert.match(css, /data-skin-v1-surface-id="storyboard"/u);
  assert.match(css, /min-height:\s*calc\(100dvh - 40px\) !important;/u);
});

test("#2408 keeps shared chrome on the same full-browser boundary", async () => {
  const css = await read("app/skin-v1-surface-orchestrator.css");

  const start = css.indexOf("/* #2408:");
  const end = css.indexOf("/* Nested registered roots", start);
  const contract = css.slice(start, end);

  for (const selector of [
    ".pp-skin-v1-orchestrator-header",
    ".pp-skin-v1-orchestrator-actions",
    ".pp-skin-v1-orchestrator-workspace-header",
    ".pp-skin-v1-orchestrator-footer",
  ]) {
    assert.match(contract, new RegExp(selector.replaceAll(".", "\\."), "u"));
  }
  assert.match(contract, /width:\s*calc\(100vw - 40px\);/u);
});

test("#2408 makes the Outline and Storyboard host surfaces viewport owners", async () => {
  const css = await read("app/skin-v1/preproduction-review-flow.css");

  assert.match(css, /data-dashboard-review-surface="outline"/u);
  assert.match(css, /data-dashboard-review-surface="storyboard"/u);
  assert.match(css, /width:\s*100%;/u);
  assert.match(css, /max-width:\s*none;/u);
  assert.match(css, /min-height:\s*100dvh;/u);
});

test("#2408 preserves the restrained shell for other non-Dashboard surfaces", async () => {
  const css = await read("app/skin-v1-surface-orchestrator.css");

  assert.match(
    css,
    /width:\s*min\(100%,\s*var\(--pp-skin-shell-max\),\s*calc\(100vw - 40px\)\) !important;/u,
  );
  assert.match(css, /max-width:\s*var\(--pp-skin-shell-max\) !important;/u);
  assert.doesNotMatch(css, /margin-(?:left|right):\s*-\d+px/u);
});
