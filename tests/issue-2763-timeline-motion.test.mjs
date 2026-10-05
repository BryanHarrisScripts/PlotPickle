import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2763 phase 3 persists one governed motion state per Timeline Shot", async () => {
  const [contract, commands, reducer] = await Promise.all([
    read("core/contracts/previs/index.ts"),
    read("core/contracts/story-command.ts"),
    read("core/project/apply-command.ts"),
  ]);

  assert.match(contract, /interface TimelineMotionShot/u);
  assert.match(contract, /requestedDurationSeconds: 3/u);
  assert.match(contract, /status: TimelineMotionShotStatus/u);
  assert.match(contract, /timelineMotionShots\?: readonly TimelineMotionShot\[\]/u);
  assert.match(contract, /normalizeTimelineMotionShot/u);
  assert.match(commands, /"production\.timeline\.motion\.store"/u);
  assert.match(reducer, /timelineMotionShots: \[command\.motion, \.\.\.existing\]/u);
});

test("#2763 phase 3 grounds motion in screenplay, approved first frame, and three-second Shot authority", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  assert.match(workspace, /function timelineMotionPrompt/u);
  assert.match(workspace, /Mapped screenplay:/u);
  assert.match(workspace, /Approved image intention:/u);
  assert.match(workspace, /Use the approved first frame as the strict visual and character reference/u);
  assert.match(workspace, /Timeline slot is exactly three seconds/u);
  assert.match(workspace, /motionSourceKey\(placement, shotNumber, artifactId\)/u);
  assert.match(workspace, /sourceAssetUrl: presentation\.artifact\.assetUrl/u);
  assert.match(workspace, /requestedDurationSeconds: 3/u);
});

test("#2763 phase 3 refuses incompatible local text-to-video routes before generation", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  assert.match(workspace, /async function imageToVideoRoute/u);
  assert.match(workspace, /\/api\/local-ai\/plugins\/video/u);
  assert.match(workspace, /modes\?\.includes\("image-to-video"\)/u);
  assert.match(workspace, /workflowFamily === "image-to-video"/u);
  assert.match(workspace, /No ready image-to-video route is selected/u);
  assert.match(workspace, /current local video plug-in supports/u);
});

test("#2763 phase 3 requires explicit Human confirmation before any provider request", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  const confirmIndex = workspace.indexOf("await requestPlotPickleConfirmation");
  const generationIndex = workspace.indexOf('fetch("/api/local-ai/generate/video"');
  assert.ok(confirmIndex >= 0);
  assert.ok(generationIndex > confirmIndex);
  assert.match(workspace, /No request is made unless you confirm/u);
  assert.match(workspace, /Motion generation was cancelled\. The locked still remains unchanged/u);
});

test("#2763 phase 3 tracks jobs, retries failures, and never silently substitutes stills in motion mode", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  assert.match(workspace, /\/api\/local-ai\/video\/\$\{encodeURIComponent\(current\.id\)\}/u);
  assert.match(workspace, /status: "succeeded"/u);
  assert.match(workspace, /status: "failed"/u);
  assert.match(workspace, /Retry motion/u);
  assert.match(workspace, /Regenerate motion/u);
  assert.match(workspace, /Timeline does not silently substitute the still image/u);
  assert.match(workspace, /Playback: \{playbackMode === "stills" \? "Still images" : "Generated motion"\}/u);
  assert.match(workspace, /selectedMotionSucceeded\}\/25 generated Shots ready/u);
});
