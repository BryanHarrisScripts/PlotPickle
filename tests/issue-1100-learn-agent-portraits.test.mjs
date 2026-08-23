import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1100 LEARN agent selector uses illustrated non-pixel canonical wizard and Marquee identities", async () => {
  const [overlay, portraitUi] = await Promise.all([
    read("modules/learn/ui/marquee-agent-overlay.tsx"),
    read("components/agent-portrait.tsx"),
  ]);
  assert.match(overlay, /<AgentPortrait id=\{wizard\.id\}/);
  assert.match(overlay, /<AgentPortrait id="marquee-director"/);
  assert.match(portraitUi, /id: "sage-brinewick"[\s\S]*elder wizard and curriculum-guide portrait[\s\S]*column: 0, row: 0/);
  assert.match(portraitUi, /id: "marquee-director"[\s\S]*adult female elf with red-golden copper hair[\s\S]*column: 3, row: 1/);
  assert.match(portraitUi, /className=\{styles\.atlasPortrait\}[\s\S]*data-agent-artwork="user-supplied"/);
  assert.doesNotMatch(`${overlay}\n${portraitUi}`, /\/assets\/helpers\/16bit\/|shape-rendering="crispEdges"|8-bit|16-bit|pixelated/i);
});

test("#1100 keeps the canonical five-wizard roster visible with Sage and Tamsin available and three future wizards locked", async () => {
  const [overlay, roster] = await Promise.all([
    read("modules/learn/ui/marquee-agent-overlay.tsx"),
    read("modules/learn/model/learn-agent-roster.ts"),
  ]);
  for (const id of ["sage-brinewick", "tamsin-hearthquill", "master-oaken-vague", "rowan-scalequill", "quillan-reedcloak"]) {
    assert.ok(roster.includes(`"${id}"`), `Missing canonical LEARN wizard ${id}`);
  }
  assert.match(roster, /available = id === "sage-brinewick" \|\| id === "tamsin-hearthquill"/);
  assert.match(overlay, /data-wizard-roster="canonical-five"/);
  assert.match(overlay, /locked=\{!wizard\.available\}/);
  assert.match(overlay, /disabled=\{!wizard\.available\}/);
  assert.match(overlay, /window\.location\.assign\("\/\?workspace=plan&section=foundations"\)/);
  assert.match(overlay, /\{unlocked \? \([\s\S]*Marquee · Marketing Director/);
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

test("#1100 locked wizard portraits are visibly desaturated while available portraits remain selectable", async () => {
  const [overlay, portraitCss] = await Promise.all([
    read("modules/learn/ui/marquee-agent-overlay.tsx"),
    read("components/agent-portrait.module.css"),
  ]);
  assert.match(overlay, /<AgentPortrait id=\{wizard\.id\} alt="" locked=\{!wizard\.available\} size=\{48\} \/>/);
  assert.match(portraitCss, /\.frame\[data-locked="true"\][\s\S]*grayscale\(1\)/);
  assert.match(await read("modules/learn/ui/marquee-agent-overlay.module.css"), /content: "LOCKED"/);
  assert.match(await read("modules/learn/ui/marquee-agent-overlay.module.css"), /\.agentChoice:focus-visible/);
});

test("#1100 preserves the deterministic one-poster PPF Marketing Reference authority", async () => {
  const overlay = await read("modules/learn/ui/marquee-agent-overlay.tsx");
  assert.match(overlay, /requestCount: 1/);
  assert.match(overlay, /type: "foundations\.visual\.store"/);
  assert.match(overlay, /automatically saved as the PPF Marketing Reference/);
  assert.doesNotMatch(overlay, />\s*(Approve|Accept|Reject|Regenerate|Try again)\s*</i);
});
