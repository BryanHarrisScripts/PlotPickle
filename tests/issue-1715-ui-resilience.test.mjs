import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("#1715 Phase 1C exposes the five mandatory human-centered states", async () => {
  const component = await source("app/_components/foundation/ui-state-surface.tsx");
  for (const state of ["ideal", "empty", "loading", "partial", "error"]) {
    assert.match(component, new RegExp(`\\b${state}\\b`), `Missing mandatory UI state: ${state}`);
  }
  assert.match(component, /data-pp-state=\{state\}/);
  assert.match(component, /aria-busy=\{state === "loading"/);
  assert.match(component, /action\?/);
  assert.match(component, /detail\?/);
});

test("#1715 Phase 1C five-state styling is token-only and motion-safe", async () => {
  const styles = await source("app/_components/foundation/ui-state-surface.module.css");
  assert.match(styles, /var\(--pp-surface\)/);
  assert.match(styles, /var\(--pp-danger\)/);
  assert.match(styles, /var\(--pp-warning\)/);
  assert.match(styles, /overflow-wrap:\s*anywhere/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(styles, /\b(?:rgb|hsl)a?\(/i);
});

test("#1715 Phase 1C makes save, retry, resume and STORY resolution truth visible", async () => {
  const component = await source("app/_components/foundation/ui-work-status.tsx");
  for (const status of [
    "saving",
    "saved",
    "retrying",
    "offline",
    "stale",
    "resumed",
    "validating",
    "resolving",
    "session-accepted",
    "rejected",
  ]) assert.match(component, new RegExp(status));

  assert.match(component, /Offline — your local work is safe/);
  assert.match(component, /Accepted in this STORY session/);
  assert.match(component, /role="status"/);
  assert.match(component, /aria-live="polite"/);
  assert.doesNotMatch(component, /canon accepted/i);
});

test("#1715 Phase 1C status feedback stays satisfying without becoming inaccessible motion", async () => {
  const styles = await source("app/_components/foundation/ui-work-status.module.css");
  assert.match(styles, /data-pp-work-status="resolving"/);
  assert.match(styles, /var\(--pp-success\)/);
  assert.match(styles, /var\(--pp-warning\)/);
  assert.match(styles, /var\(--pp-danger\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(styles, /\b(?:rgb|hsl)a?\(/i);
});

test("#1715 Phase 1C deduplicates rapid actions while allowing safe retry after settlement", async () => {
  const hook = await source("app/_components/foundation/use-single-flight-action.ts");
  assert.match(hook, /if \(activePromise\.current\) return activePromise\.current/);
  assert.match(hook, /setPending\(true\)/);
  assert.match(hook, /execution\.then\(settle, settle\)/);
  assert.match(hook, /activePromise\.current = null/);
  assert.match(hook, /setPending\(false\)/);
});

test("#1715 Phase 1C bounds and coalesces shared notifications instead of creating a second feedback system", async () => {
  const overlay = await source("app/common-overlay-layer.tsx");
  const layout = await source("app/layout.tsx");
  assert.equal((layout.match(/<CommonOverlayLayer \/>/g) ?? []).length, 1);
  assert.match(overlay, /withoutDuplicate/);
  assert.match(overlay, /notice\.message !== message \|\| notice\.tone !== tone/);
  assert.match(overlay, /withoutDuplicate\.slice\(-2\)/);
  assert.doesNotMatch(overlay, /current\.slice\(-3\)/);
});

test("#1715 Phase 1C presents STORY checkpoint truth without moving authority into UI", async () => {
  const sessionMachine = await source("modules/story-the-unwritten/session-machine.mjs");
  const history = await source("modules/story-the-unwritten/history-persistence.mjs");
  const status = await source("app/_components/foundation/ui-work-status.tsx");

  assert.match(sessionMachine, /latestCheckpointRef/);
  assert.match(sessionMachine, /acceptedEventLogRef/);
  assert.match(history, /story-checkpoint:/);
  assert.doesNotMatch(status, /writeStory|saveStory|admit.*canon|canonAdmission/i);
});
