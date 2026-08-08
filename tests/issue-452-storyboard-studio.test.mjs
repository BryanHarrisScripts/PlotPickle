import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#452 Storyboard wireframe follows the #444 Studio and continuity contract", async () => {
  const wireframe = await source("docs/wireframes/issue-452-storyboard-studio.md");

  for (const contract of [
    "Storyboard is the visual-directing workspace",
    "4 Acts",
    "24 Blocks",
    "96",
    "Keep",
    "Change direction",
    "Try Again",
    "Compare",
    "Plan → Storyboard continuity",
    "Storyboard → Write / Graphic Novel / Build",
    "same canonical",
    "human approval",
    "provider/model/endpoint/checkpoint terminology never appears",
  ]) assert.ok(wireframe.toLowerCase().includes(contract.toLowerCase()), `Missing Storyboard wireframe contract: ${contract}`);

  assert.match(wireframe, /Review against #444/);
  assert.match(wireframe, /Implementation gate/);
});

test("#452 gives Storyboard a full-width matte-black Studio boundary without changing other modules", async () => {
  const [layout, styles, polish] = await Promise.all([
    source("app/layout.tsx"),
    source("app/storyboard-studio-phase-d.css"),
    source("app/storyboard-studio-polish.css"),
  ]);

  assert.match(layout, /storyboard-studio-phase-d\.css/);
  assert.match(layout, /storyboard-studio-polish\.css/);
  assert.match(styles, /\.workspace:has\(\.visual-studio-layout\)/);
  assert.match(styles, /> \.story-rail\s*\{[\s\S]*display:\s*none/i);
  assert.match(styles, /section\[aria-label\$="capabilities"\]/);
  assert.match(styles, /#090909/i);
  assert.match(styles, /#cda758/i);
  assert.match(styles, /nav\[aria-label="Visual Board sections"\]/);
  assert.match(styles, /data-visual-section="blocks"/);
  assert.match(styles, /data-visual-section="frames"/);
  assert.match(polish, /feedback records/);
  assert.match(polish, /button:nth-of-type\(7\)\[aria-current\]/);
  assert.match(polish, /data-visual-section="frames"/);
  assert.match(polish, /display:\s*none/i);
});

test("#452 preserves the existing canonical Storyboard identity and deep-link machinery", async () => {
  const storyboard = await source("app/visual-storyboard.tsx");

  assert.match(storyboard, /type VisualSection = "overview"/);
  assert.match(storyboard, /storyboardPrompt\(project, block, scene, mini, frame\)/);
  assert.match(storyboard, /storyboardIdentityInputs\(project, block, scene, mini\)/);
  assert.match(storyboard, /URLSearchParams\(window\.location\.search\)/);
  assert.match(storyboard, /params\.get\("block"\)/);
  assert.match(storyboard, /params\.get\("mini"\)/);
  assert.match(storyboard, /approvedImageVersionId/);
  assert.match(storyboard, /approvedVideoVersionId/);
  assert.match(storyboard, /status:\s*"candidate"/);
  assert.match(storyboard, /requestPlotPickleConfirmation/);
});

test("#452 waits for a deep-linked Storyboard section before focusing it", async () => {
  const [layout, host] = await Promise.all([
    source("app/layout.tsx"),
    source("app/storyboard-studio-host.tsx"),
  ]);

  assert.match(layout, /import StoryboardStudioHost/);
  assert.match(layout, /<StoryboardStudioHost \/>/);
  assert.match(host, /workspace\) !== "storyboard"/);
  assert.match(host, /visualSection/);
  assert.match(host, /document\.getElementById\(`visual-\$\{requestedSection\}`\)/);
  assert.match(host, /MutationObserver/);
  assert.match(host, /scrollIntoView\(\{ block: "start" \}\)/);
  assert.doesNotMatch(host, /setProject|localStorage|sessionStorage|provider|apiKey/i);
});

test("#452 keeps image and video assets visually primary while application chrome stays restrained", async () => {
  const styles = await source("app/storyboard-studio-phase-d.css");

  assert.match(styles, /Natural image\/video colour remains untouched/);
  assert.match(styles, /selected visual story moment/i);
  assert.match(styles, /Review generated versions/);
  assert.match(styles, /background:\s*#19150d/i);
  assert.doesNotMatch(styles, /#287b78|#dff2ee|#eff9f6/i);
});
