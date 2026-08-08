import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#452 makes human Storyboard decisions primary", async () => {
  const actions = await source("app/creative-director-actions.tsx");

  for (const label of ["Keep", "Change Direction", "Try Again", "Compare"]) {
    assert.ok(actions.includes(`>${label}<`) || actions.includes(`\"${label}\"`), `Missing Storyboard decision: ${label}`);
  }

  assert.match(actions, /What do you want to do with this visual\?/);
  assert.match(actions, /aria-label="Visual decision"/);
  assert.match(actions, /Approve the newest candidate for this exact story moment/);
  assert.match(actions, /Adjust composition, action, mood, continuity or visual emphasis/);
  assert.match(actions, /Create another image candidate from the same story context/);
  assert.match(actions, /Review saved alternatives beside the current approved direction/);
});

test("#452 Keep reuses the existing candidate approval control instead of inventing approval state", async () => {
  const actions = await source("app/creative-director-actions.tsx");

  assert.match(actions, /querySelectorAll<HTMLButtonElement>\("button"\)/);
  assert.match(actions, /Approve \(\?:image\|video\)/);
  assert.match(actions, /approveButton\.click\(\)/);
  assert.doesNotMatch(actions, /approvedImageVersionId|approvedVideoVersionId|setProject|commit\(/);
});

test("#452 Change Direction and Compare disclose existing controls without provider plumbing", async () => {
  const actions = await source("app/creative-director-actions.tsx");

  assert.match(actions, /directionRef\.current\.open = true/);
  assert.match(actions, /versionsRef\.current\.scrollIntoView/);
  assert.match(actions, /Technical routing stays in Settings\. Nothing becomes approved until you choose Keep\./);
  assert.doesNotMatch(actions, /Ollama|ComfyUI|MiniMax|checkpoint|apiKey/i);
});

test("#452 Try Again uses the existing illustration route and generation remains secondary", async () => {
  const actions = await source("app/creative-director-actions.tsx");

  assert.match(actions, /function tryAgain\(\)[\s\S]*onIllustrate\(\)/);
  assert.match(actions, /Illustrate this moment/);
  assert.match(actions, /Animate approved image/);
  assert.match(actions, /className=\{styles\.generationActions\}/);
});

test("#452 review deep link gives the decision panel the canvas and keeps Keep visually primary", async () => {
  const [layout, host, styles] = await Promise.all([
    source("app/layout.tsx"),
    source("app/storyboard-studio-host.tsx"),
    source("app/storyboard-studio-decisions.css"),
  ]);

  assert.match(layout, /storyboard-studio-decisions\.css/);
  assert.match(host, /params\.get\("review"\) === "1"/);
  assert.match(host, /dataset\.storyboardDecisionFocus = "review"/);
  assert.match(host, /Direct selected story moment/);
  assert.match(styles, /data-storyboard-decision-focus="review"/);
  assert.match(styles, /> main[\s\S]*display:\s*none/i);
  assert.match(styles, /> aside[\s\S]*max-height:\s*none/i);
  assert.match(styles, /\[aria-label="Visual decision"\] button:first-of-type/);
  assert.match(styles, /background:\s*#cda758\s*!important/i);
});
