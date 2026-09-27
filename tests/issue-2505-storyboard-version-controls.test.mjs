import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2505 exposes concise Storyboard version controls through the bounded client bridge", async () => {
  const [bridge, host] = await Promise.all([
    read("app/_components/storyboard/storyboard-version-control-bridge.tsx"),
    read("app/_components/universal-voice-input-layer.tsx"),
  ]);

  assert.match(host, /import StoryboardVersionControlBridge/u);
  assert.match(host, /<StoryboardVersionControlBridge \/>/u);
  assert.match(bridge, /Review frame at position/u);
  assert.match(bridge, /label === "Save this Version" \|\| label === "Saved locally"/u);
  assert.match(bridge, /button\.textContent = "Save"/u);
  assert.match(bridge, /label === "Lock this Version" \|\| label === "Locked"/u);
  assert.match(bridge, /button\.textContent = "Lock"/u);
  assert.match(bridge, /label === "Redo"/u);
  assert.match(bridge, /label === "Reject"/u);
  assert.match(bridge, /button\.textContent = "Delete"/u);
});

test("#2505 requires inline permanent-delete confirmation before invoking the existing discard path", async () => {
  const [bridge, workspace] = await Promise.all([
    read("app/_components/storyboard/storyboard-version-control-bridge.tsx"),
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
  ]);

  assert.match(bridge, /role="alertdialog"/u);
  assert.match(bridge, /Delete this version forever\?/u);
  assert.match(bridge, /This cannot be undone\./u);
  assert.match(bridge, />Yes<\/button>/u);
  assert.match(bridge, />No<\/button>/u);
  assert.match(bridge, /event\.preventDefault\(\)/u);
  assert.match(bridge, /event\.stopImmediatePropagation\(\)/u);
  assert.match(bridge, /bypassDeleteConfirmation\.current = button/u);
  assert.match(bridge, /queueMicrotask\(\(\) => button\.click\(\)\)/u);
  assert.match(workspace, /applyStoryCommand\(next, \{ type: decision === "accept" \? "foundations\.visual\.accept" : "foundations\.visual\.discard"/u);
  assert.match(workspace, /saveFoundationProject\(next\)/u);
  assert.match(workspace, /artifact\.reviewState !== "rejected"/u);
});
