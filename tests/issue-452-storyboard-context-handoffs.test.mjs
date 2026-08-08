import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#452 selected Storyboard moment visibly carries Plan intention and story purpose", async () => {
  const host = await source("app/storyboard-moment-context-host.tsx");

  assert.match(host, /Plan intention/);
  assert.match(host, /Story purpose/);
  assert.match(host, /Same PPF story moment/);
  assert.match(host, /#visual-language/);
  assert.match(host, /pitch visual statement/i);
  assert.match(host, /world visual language/i);
  assert.match(host, /storyPurpose/);
});

test("#452 selected Storyboard moment carries the same Block mini-block and scene identity forward", async () => {
  const host = await source("app/storyboard-moment-context-host.tsx");

  assert.match(host, /searchParams\.set\("block", String\(selection!\.block\)\)/);
  assert.match(host, /searchParams\.set\("mini", String\(selection!\.mini\)\)/);
  assert.match(host, /searchParams\.set\("scene", selection!\.scene\)/);
  assert.match(host, /Open in Write/);
  assert.match(host, /Open in Graphic Novel/);
  assert.match(host, /Send to Build/);
  assert.match(host, /openWorkspace\("write"\)/);
  assert.match(host, /openWorkspace\("pitch"\)/);
  assert.match(host, /openWorkspace\("build"\)/);
});

test("#452 Storyboard handoff is presentation-only and never creates parallel story or approval state", async () => {
  const host = await source("app/storyboard-moment-context-host.tsx");

  assert.match(host, /#storyboard-decisions/);
  assert.match(host, /createPortal/);
  assert.match(host, /MutationObserver/);
  assert.doesNotMatch(host, /setProject|onChange|commit\(|approvedImageVersionId|approvedVideoVersionId|localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(host, /Ollama|ComfyUI|MiniMax|checkpoint|endpoint|apiKey/i);
});

test("#452 handoff strips Storyboard-only focus while preserving canonical story identity", async () => {
  const host = await source("app/storyboard-moment-context-host.tsx");

  assert.match(host, /searchParams\.delete\("visualSection"\)/);
  assert.match(host, /searchParams\.delete\("decision"\)/);
  assert.match(host, /window\.location\.assign\(url\)/);
  assert.match(host, /The Block, mini-block and scene identity travel with you/);
  assert.match(host, /never overwrites screenplay or production canon automatically/);
});

test("#452 Storyboard context host mounts only alongside the existing Storyboard hosts", async () => {
  const layout = await source("app/layout.tsx");

  assert.match(layout, /import StoryboardMomentContextHost/);
  assert.match(layout, /<StoryboardMomentContextHost \/>/);
  assert.match(layout, /<StoryboardNavigationGroupsHost \/>/);
  assert.match(layout, /<StoryboardStudioHost \/>/);
});
