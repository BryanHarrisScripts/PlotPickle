import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("#2063 mounts one Sage overlay across authenticated legacy and Skin V1 surfaces", async () => {
  const layout = await read("app/layout.tsx");

  assert.match(layout, /import GlobalSageOverlay from "\.\/global-sage-overlay"/u);
  assert.equal((layout.match(/<GlobalSageOverlay \/>/gu) ?? []).length, 1);
  assert.match(
    layout,
    /<ProfileAccessRouter>[\s\S]*<ReleaseExperienceBoundary>\{children\}<\/ReleaseExperienceBoundary>[\s\S]*<GlobalSageOverlay \/>[\s\S]*<\/ProfileAccessRouter>/u,
  );
});

test("#2063 reserves Shift+S for global help without stealing text entry or plain Storyboard S", async () => {
  const overlay = await read("app/global-sage-overlay.tsx");

  assert.match(overlay, /event\.key\.toLowerCase\(\) !== "s" \|\| !event\.shiftKey/u);
  assert.match(overlay, /event\.ctrlKey \|\| event\.metaKey \|\| event\.altKey/u);
  assert.match(overlay, /isTextEditingTarget\(event\.target\)/u);
  assert.match(overlay, /hasBlockingOverlay\(\)/u);
  assert.match(overlay, /hasVisiblePlotPickleSurface\(\)/u);
  assert.match(overlay, /"\[data-plotpickle-global-nav\]"/u);
  assert.match(overlay, /"\[data-story-map-shell\]"/u);
  assert.match(overlay, /"\.pp-skin-v1-dashboard"/u);
  assert.match(overlay, /window\.addEventListener\("keydown", onKeyDown, true\)/u);
  assert.match(overlay, /event\.preventDefault\(\)[\s\S]*event\.stopPropagation\(\)[\s\S]*setOpen\(true\)/u);
  assert.doesNotMatch(overlay, /router\.push|window\.location\.assign/u);
});

test("#2063 keeps the current screen underneath a blurred accessible modal and restores focus", async () => {
  const [overlay, styles] = await Promise.all([
    read("app/global-sage-overlay.tsx"),
    read("app/global-sage-overlay.module.css"),
  ]);

  assert.match(overlay, /role="dialog"/u);
  assert.match(overlay, /aria-modal="true"/u);
  assert.match(overlay, /id="global-sage-question"/u);
  assert.match(overlay, /questionRef\.current\?\.focus\(\)/u);
  assert.match(overlay, /event\.key === "Escape"[\s\S]*closeOverlay\(\)/u);
  assert.match(overlay, /event\.key !== "Tab"/u);
  assert.match(overlay, /originRef\.current\?\.isConnected[\s\S]*originRef\.current\.focus\(\)/u);
  assert.match(overlay, /data-overlay-close/u);

  assert.match(styles, /\.backdrop[\s\S]*position: fixed/u);
  assert.match(styles, /background: rgb\(0 0 0 \/ 58%\)/u);
  assert.match(styles, /backdrop-filter: blur\(8px\)/u);
  assert.match(styles, /\.panel[\s\S]*--pp-skin-line-strong/u);
  assert.match(styles, /\.thread[\s\S]*overflow-y: auto/u);
});

test("#2063 reuses the existing Sage authority and does not create a provider or storage path", async () => {
  const overlay = await read("app/global-sage-overlay.tsx");

  assert.match(overlay, /import \{ memoryAwareSageGuide \} from "\.\.\/modules\/creative-room\/memory-aware-sage-guide"/u);
  assert.match(overlay, /import \{ plotPickleCurriculum \} from "\.\.\/adapters\/curriculum\/current-catalog"/u);
  assert.match(overlay, /import \{ loadFoundationProject \} from "\.\.\/core\/storage\/foundation-project-browser"/u);
  assert.match(overlay, /await memoryAwareSageGuide\(\{/u);
  assert.match(overlay, /interactionMode: "conversation"/u);
  assert.doesNotMatch(overlay, /\/api\/writing-assistant\/chat/u);
  assert.doesNotMatch(overlay, /localStorage|sessionStorage|indexedDB/u);
  assert.doesNotMatch(overlay, /CommunityWorkspace|community-buzz|buzz-community/u);
});
