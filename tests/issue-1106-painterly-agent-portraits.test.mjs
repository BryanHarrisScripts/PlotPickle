import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(resolve(root, path), "utf8");
const helperDirectory = JSON.parse(read("config/helper-directory.json"));
const registry = read("lib/agent-portrait-registry.ts");
const portraitUi = read("components/agent-portrait.tsx");
const portraitCss = read("components/agent-portrait.module.css");
const settingsUi = read("app/settings-helper-directory.tsx");
const settingsCss = read("app/settings-helper-directory.module.css");
const communityUi = read("app/community-agent-roster.tsx");
const marqueeUi = read("modules/learn/ui/marquee-agent-overlay.tsx");
const marqueeCss = read("modules/learn/ui/marquee-agent-overlay.module.css");
const learnUi = read("modules/learn/ui/learn-workspace.tsx");

const activePortraitSources = [
  JSON.stringify(helperDirectory),
  registry,
  portraitUi,
  portraitCss,
  settingsUi,
  settingsCss,
  communityUi,
  marqueeUi,
  marqueeCss,
].join("\n");

test("#1106 makes the painterly registry the only product-facing helper portrait authority", () => {
  assert.equal(helperDirectory.schemaVersion, 2);
  assert.equal(helperDirectory.portraitSystem, "painterly-fantasy-v1");
  assert.equal(helperDirectory.helpers.length, 17);
  for (const helper of helperDirectory.helpers) {
    assert.deepEqual(Object.keys(helper).sort(), ["group", "how", "id"]);
    assert.match(registry, new RegExp(`id: ["']${helper.id}["']`), `${helper.id} is missing from the portrait registry`);
  }

  assert.doesNotMatch(activePortraitSources, /\/assets\/helpers\/16bit\//i);
  assert.doesNotMatch(activePortraitSources, /image-rendering:\s*pixelated/i);
  assert.doesNotMatch(activePortraitSources, /shape-rendering=["']crispEdges["']/i);
});

test("#1106 preserves the approved Sage portrait and explicitly rejects the disallowed Sage reference", () => {
  assert.match(registry, /id: "sage-brinewick"[\s\S]*source: "\/assets\/curriculum-guide-master-storyteller\.png"/);
  assert.ok(existsSync(resolve(root, "public/assets/curriculum-guide-master-storyteller.png")));
  assert.match(learnUi, /src="\/assets\/sage-brinewick-v2\.png"/);
  assert.doesNotMatch(`${registry}\n${portraitUi}\n${learnUi}\n${marqueeUi}`, /Sage543x768-v2/i);
});

test("#1106 gives Marquee the required copper-red adult elf identity and canonical lock treatment", () => {
  assert.match(registry, /id: "marquee-director"[\s\S]*adult female elf[\s\S]*red-golden copper hair[\s\S]*elf: true/);
  assert.match(marqueeUi, /<AgentPortrait id="marquee-director" alt="" locked=\{!unlocked\} size=\{48\} \/>/);
  assert.match(marqueeUi, /disabled=\{!unlocked\}/);
  assert.match(marqueeUi, /isMarqueeDirectorUnlocked/);
  assert.match(portraitCss, /\.frame\[data-locked="true"\][\s\S]*grayscale\(1\)/);
});

test("#1106 shares one circular medallion component across LEARN, Community and Settings Help", () => {
  assert.match(portraitUi, /data-agent-portrait="painterly-fantasy"/);
  assert.match(portraitUi, /role="img" aria-label=\{label\}/);
  assert.match(portraitCss, /border-radius:\s*50%/);
  assert.match(portraitCss, /border:\s*2px solid #d7bc76/);
  assert.match(portraitCss, /--agent-portrait-size/);
  assert.match(settingsUi, /<AgentPortrait[\s\S]*id=\{profile\.id\}/);
  assert.match(communityUi, /<AgentPortrait id=\{agent\.id\}/);
  assert.match(marqueeUi, /<AgentPortrait id="sage-brinewick"/);
  assert.match(marqueeUi, /<AgentPortrait id="marquee-director"/);
});

test("#1106 keeps archived 16-bit masters historical rather than runtime dependencies", () => {
  assert.ok(existsSync(resolve(root, "public/assets/helpers/16bit")), "historical 16-bit directory may remain for repository history");
  assert.doesNotMatch(JSON.stringify(helperDirectory), /16bit/i);
  assert.doesNotMatch(settingsUi, /16bit|pixelated/i);
  assert.doesNotMatch(communityUi, /avatarInitials/);
});
