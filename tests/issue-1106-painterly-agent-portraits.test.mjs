import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(resolve(root, path), "utf8");
const helperDirectory = JSON.parse(read("config/helper-directory.json"));
const portraitUi = read("components/agent-portrait.tsx");
const portraitCss = read("components/agent-portrait.module.css");
const settingsUi = read("app/settings-helper-directory.tsx");
const settingsCss = read("app/settings-helper-directory.module.css");
const communityUi = read("app/community-agent-roster.tsx");
const marqueeUi = read("modules/learn/ui/marquee-agent-overlay.tsx");
const marqueeCss = read("modules/learn/ui/marquee-agent-overlay.module.css");

const activePortraitSources = [
  JSON.stringify(helperDirectory),
  portraitUi,
  portraitCss,
  settingsUi,
  settingsCss,
  communityUi,
  marqueeUi,
  marqueeCss,
].join("\n");

test("#1106 keeps one shared painterly portrait authority for the complete helper roster", () => {
  assert.equal(helperDirectory.schemaVersion, 2);
  assert.equal(helperDirectory.portraitSystem, "painterly-fantasy-v1");
  assert.equal(helperDirectory.helpers.length, 17);
  for (const helper of helperDirectory.helpers) {
    assert.deepEqual(Object.keys(helper).sort(), ["group", "how", "id"]);
    assert.match(portraitUi, new RegExp(`id: ["']${helper.id}["']`), `${helper.id} is missing from the portrait component registry`);
  }

  assert.doesNotMatch(activePortraitSources, /\/assets\/helpers\/16bit\//i);
  assert.doesNotMatch(activePortraitSources, /image-rendering:\s*pixelated/i);
  assert.doesNotMatch(activePortraitSources, /shape-rendering=["']crispEdges["']/i);
});

test("final agent artwork uses the supplied portrait atlas instead of generated portrait fallbacks", () => {
  assert.ok(existsSync(resolve(root, "public/assets/agent-profile-atlas.webp")));
  assert.match(portraitCss, /background-image:\s*url\("\/assets\/agent-profile-atlas\.webp"\)/);
  assert.match(portraitCss, /background-size:\s*500% 400%/);
  assert.match(portraitUi, /data-agent-artwork="user-supplied"/);
  assert.doesNotMatch(portraitUi, /<svg|feTurbulence|Accessory\(/);
  assert.doesNotMatch(portraitUi, /curriculum-guide-master-storyteller\.png/);
});

test("final supplied artwork preserves Sage and Marquee identities", () => {
  assert.match(portraitUi, /id: "sage-brinewick"[\s\S]*supplied elder wizard/);
  assert.match(portraitUi, /id: "marquee-director"[\s\S]*adult female elf[\s\S]*red-golden copper hair/);
  assert.match(marqueeUi, /<AgentPortrait id="marquee-director" alt="" locked=\{!unlocked\} size=\{48\} \/>/);
  assert.match(marqueeUi, /disabled=\{!unlocked\}/);
  assert.match(marqueeUi, /isMarqueeDirectorUnlocked/);
  assert.match(portraitCss, /\.frame\[data-locked="true"\] \.atlasPortrait[\s\S]*grayscale\(1\)/);
});

test("#1106 shares one circular medallion component across LEARN, Community and Settings Help", () => {
  assert.match(portraitUi, /data-agent-portrait="painterly-fantasy"/);
  assert.match(portraitUi, /aria-label=\{label\}/);
  assert.match(portraitUi, /role="img"/);
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
