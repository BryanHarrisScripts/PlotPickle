import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1100 LEARN agent selector uses illustrated non-pixel Sage and Marquee identities", async () => {
  const [overlay, marqueePortrait] = await Promise.all([
    read("modules/learn/ui/marquee-agent-overlay.tsx"),
    read("public/assets/marquee-director-portrait.svg"),
  ]);
  assert.match(overlay, /SAGE_PORTRAIT = "\/assets\/curriculum-guide-master-storyteller\.png"/);
  assert.match(overlay, /MARQUEE_PORTRAIT = "\/assets\/marquee-director-portrait\.svg"/);
  assert.doesNotMatch(overlay, /16bit|pixel/i);
  assert.doesNotMatch(marqueePortrait, /shape-rendering="crispEdges"|8-bit|16-bit|pixel/i);
  assert.match(marqueePortrait, /copper-gold hair/i);
});

test("#1100 keeps Sage first and Marquee visibly present beside Sage before unlock", async () => {
  const overlay = await read("modules/learn/ui/marquee-agent-overlay.tsx");
  const selectorStart = overlay.indexOf('aria-label="Creative Room agent selector"');
  const sage = overlay.indexOf('aria-label="Sage Brinewick · Curriculum Guide"', selectorStart);
  const marquee = overlay.indexOf('aria-label={unlocked ? "Marquee · Marketing Director"', selectorStart);
  assert.ok(selectorStart >= 0 && sage > selectorStart && marquee > sage);
  assert.match(overlay, /data-locked=\{unlocked \? "false" : "true"\}/);
  assert.match(overlay, /disabled=\{!unlocked\}/);
  assert.match(overlay, /Complete Foundations to unlock/);
});

test("#1100 derives Marquee unlock from canonical Foundations progression and falls back to Sage", async () => {
  const [overlay, model] = await Promise.all([
    read("modules/learn/ui/marquee-agent-overlay.tsx"),
    read("modules/learn/model/marquee-director.ts"),
  ]);
  assert.match(overlay, /isMarqueeDirectorUnlocked\(curriculum, project\)/);
  assert.match(overlay, /if \(!unlocked && activeAgent === "marquee"\) setActiveAgent\("sage"\)/);
  assert.match(model, /deriveGuidedCreationProgression\(curriculum, project\)\.foundations\.complete/);
  assert.doesNotMatch(overlay, /localStorage\.setItem.*marquee|marqueeUnlocked|marketingUnlocked/i);
});

test("#1100 locked portrait is visibly desaturated while unlocked portrait remains selectable", async () => {
  const css = await read("modules/learn/ui/marquee-agent-overlay.module.css");
  assert.match(css, /\.agentChoice\[data-locked="true"\] img/);
  assert.match(css, /grayscale\(1\)/);
  assert.match(css, /content: "LOCKED"/);
  assert.match(css, /\.agentChoice:focus-visible/);
});

test("#1100 preserves the deterministic one-poster PPF Marketing Reference authority", async () => {
  const overlay = await read("modules/learn/ui/marquee-agent-overlay.tsx");
  assert.match(overlay, /requestCount: 1/);
  assert.match(overlay, /type: "foundations\.visual\.store"/);
  assert.match(overlay, /automatically saved as the PPF Marketing Reference/);
  assert.doesNotMatch(overlay, />\s*(Approve|Accept|Reject|Regenerate|Try again)\s*</i);
});
