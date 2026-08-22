import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
const rosterUi = read("modules/learn/model/learn-agent-roster.ts");
const portraitAtlasPath = resolve(root, "public/assets/agent-profile-atlas.webp");

function webpDimensions(buffer) {
  assert.equal(buffer.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(buffer.subarray(8, 12).toString("ascii"), "WEBP");
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const fourCc = buffer.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    if (fourCc === "VP8 ") { assert.deepEqual([...buffer.subarray(dataOffset + 3, dataOffset + 6)], [0x9d, 0x01, 0x2a]); return [buffer.readUInt16LE(dataOffset + 6) & 0x3fff, buffer.readUInt16LE(dataOffset + 8) & 0x3fff]; }
    if (fourCc === "VP8X") return [buffer.readUIntLE(dataOffset + 4, 3) + 1, buffer.readUIntLE(dataOffset + 7, 3) + 1];
    if (fourCc === "VP8L") { assert.equal(buffer[dataOffset], 0x2f); return [1 + buffer[dataOffset + 1] + ((buffer[dataOffset + 2] & 0x3f) << 8), 1 + ((buffer[dataOffset + 2] & 0xc0) >> 6) + (buffer[dataOffset + 3] << 2) + ((buffer[dataOffset + 4] & 0x0f) << 10)]; }
    offset = dataOffset + chunkSize + (chunkSize % 2);
  }
  assert.fail("The supplied portrait atlas has no supported WebP image chunk.");
}

const activePortraitSources = [JSON.stringify(helperDirectory), portraitUi, portraitCss, settingsUi, settingsCss, communityUi, marqueeUi, marqueeCss].join("\n");

test("#1106 keeps one shared painterly portrait authority for the complete helper roster", () => {
  assert.equal(helperDirectory.schemaVersion, 2); assert.equal(helperDirectory.portraitSystem, "painterly-fantasy-v1"); assert.equal(helperDirectory.helpers.length, 17);
  for (const helper of helperDirectory.helpers) assert.match(portraitUi, new RegExp(`id: ["']${helper.id}["']`), `${helper.id} is missing from the portrait component registry`);
  const atlasCoordinates = [...portraitUi.matchAll(/column: ([0-4]), row: ([0-3])/g)].map((match) => `${match[1]},${match[2]}`);
  assert.equal(atlasCoordinates.length, helperDirectory.helpers.length); assert.equal(new Set(atlasCoordinates).size, helperDirectory.helpers.length);
  assert.doesNotMatch(activePortraitSources, /\/assets\/helpers\/16bit\//i); assert.doesNotMatch(activePortraitSources, /image-rendering:\s*pixelated/i);
});

test("final agent artwork uses the supplied portrait atlas instead of generated portrait fallbacks", () => {
  assert.ok(existsSync(portraitAtlasPath)); const portraitAtlas = readFileSync(portraitAtlasPath); assert.deepEqual(webpDimensions(portraitAtlas), [2560, 2048]);
  assert.equal(createHash("sha256").update(portraitAtlas).digest("hex"), "ecf886037a292aa930bf839ffa05ffcb357ea63bc74325d68f38b7fe80f2ba7b");
  assert.match(portraitCss, /background-image:\s*url\("\/assets\/agent-profile-atlas\.webp"\)/); assert.match(portraitUi, /data-agent-artwork="user-supplied"/);
});

test("final supplied artwork preserves Sage, the five-wizard roster and Marquee identities", () => {
  assert.match(portraitUi, /id: "sage-brinewick"[\s\S]*supplied elder wizard/);
  assert.match(portraitUi, /id: "marquee-director"[\s\S]*adult female elf[\s\S]*red-golden copper hair/);
  assert.match(rosterUi, /"sage-brinewick"[\s\S]*"tamsin-hearthquill"[\s\S]*"master-oaken-vague"[\s\S]*"rowan-scalequill"[\s\S]*"quillan-reedcloak"/);
  assert.match(marqueeUi, /<AgentPortrait id=\{wizard\.id\} alt="" locked=\{!wizard\.available\} size=\{48\} \/>/);
  assert.match(marqueeUi, /<AgentPortrait id="marquee-director" alt="" size=\{48\} \/>/);
  assert.match(marqueeUi, /isMarqueeDirectorUnlocked/);
  assert.match(portraitCss, /\.frame\[data-locked="true"\] \.atlasPortrait[\s\S]*grayscale\(1\)/);
});

test("#1106 shares one circular medallion component across LEARN, Community and Settings Help", () => {
  assert.match(portraitUi, /data-agent-portrait="painterly-fantasy"/); assert.match(portraitCss, /border-radius:\s*50%/); assert.match(portraitCss, /--agent-portrait-size/);
  assert.match(settingsUi, /<AgentPortrait[\s\S]*id=\{profile\.id\}/); assert.match(communityUi, /<AgentPortrait id=\{agent\.id\}/);
  assert.match(marqueeUi, /<AgentPortrait id=\{wizard\.id\}/); assert.match(rosterUi, /"sage-brinewick"/); assert.match(marqueeUi, /<AgentPortrait id="marquee-director"/);
});

test("#1106 keeps archived 16-bit masters historical rather than runtime dependencies", () => {
  assert.ok(existsSync(resolve(root, "public/assets/helpers/16bit"))); assert.doesNotMatch(JSON.stringify(helperDirectory), /16bit/i); assert.doesNotMatch(settingsUi, /16bit|pixelated/i); assert.doesNotMatch(communityUi, /avatarInitials/);
});
