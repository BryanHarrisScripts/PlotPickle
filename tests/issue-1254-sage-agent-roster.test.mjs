import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1254 Sage keeps a curriculum-grounded answer when local generation fails and gives actionable setup recovery", async () => {
  const guide = await read("modules/creative-room/sage-unified-guide.ts");
  assert.match(guide, /export function sageRuntimeRecoveryMessage/);
  assert.match(guide, /Settings → Sage Setup/);
  assert.match(guide, /run Test Sage before retrying/);
  assert.match(guide, /const teaching = definition[\s\S]*lesson\.overview/);
  assert.match(guide, /const practical = lesson\.apply/);
  assert.match(guide, /let lastFailure: unknown/);
  assert.match(guide, /lastFailure = error/);
  assert.match(guide, /craft \? craftFallback\(request, retrieval, runtimeRecovery\) : conversationFallback\(runtimeRecovery\)/);
  assert.doesNotMatch(guide, /That local reply didn’t come through cleanly, so I dropped it instead of showing you nonsense/u);
});

test("#1254 LEARN renders exactly the canonical five-wizard first-row roster with three locked", async () => {
  const [roster, overlay, portraits, profiles] = await Promise.all([
    read("modules/learn/model/learn-agent-roster.ts"),
    read("modules/learn/ui/marquee-agent-overlay.tsx"),
    read("components/agent-portrait.tsx"),
    read("config/agent-profiles.json"),
  ]);
  const ids = ["sage-brinewick", "tamsin-hearthquill", "master-oaken-vague", "rowan-scalequill", "quillan-reedcloak"];
  for (const id of ids) {
    assert.ok(roster.includes(`"${id}"`), `Roster missing ${id}`);
    assert.ok(portraits.includes(`id: "${id}"`), `Painterly portrait missing ${id}`);
    assert.ok(profiles.includes(`"id": "${id}"`), `Canonical profile missing ${id}`);
  }
  assert.match(roster, /import agentProfiles from "\.\.\/\.\.\/\.\.\/config\/agent-profiles\.json"/);
  assert.match(roster, /available = id === "sage-brinewick" \|\| id === "tamsin-hearthquill"/);
  assert.match(overlay, /WIZARD_ROSTER\.map/);
  assert.match(overlay, /data-wizard-roster="canonical-five"/);
  assert.match(overlay, /data-locked=\{wizard\.available \? "false" : "true"\}/);
  assert.match(overlay, /locked=\{!wizard\.available\}/);
  assert.match(overlay, /disabled=\{!wizard\.available\}/);
});

test("#1254 unlocked Marquee remains an additive later specialist instead of replacing the five-wizard roster", async () => {
  const overlay = await read("modules/learn/ui/marquee-agent-overlay.tsx");
  const rosterStart = overlay.indexOf("WIZARD_ROSTER.map");
  const marquee = overlay.indexOf("Marquee · Marketing Director", rosterStart);
  assert.ok(rosterStart >= 0 && marquee > rosterStart);
  assert.match(overlay, /\{unlocked \? \([\s\S]*id="marquee-director"/);
  assert.match(overlay, /if \(!unlocked && activeAgent === "marquee"\) setActiveAgent\("sage"\)/);
});
