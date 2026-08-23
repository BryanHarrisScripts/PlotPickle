import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const rooms = [
  ["great-hall", "great-hall.webp"],
  ["story-council", "story-workshop.webp"],
  ["wyrmwood-ring", "wyrmwood.webp"],
  ["marquee", "marquee.webp"],
];

function webpDimensions(buffer) {
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const fourCc = buffer.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    if (fourCc === "VP8 ") return [buffer.readUInt16LE(dataOffset + 6) & 0x3fff, buffer.readUInt16LE(dataOffset + 8) & 0x3fff];
    if (fourCc === "VP8X") return [buffer.readUIntLE(dataOffset + 4, 3) + 1, buffer.readUIntLE(dataOffset + 7, 3) + 1];
    offset = dataOffset + chunkSize + (chunkSize % 2);
  }
  assert.fail("The room artwork has no supported WebP image chunk.");
}

test("#1299 maps every canonical public room to unique artwork through one shared component", async () => {
  const [social, manifest] = await Promise.all([
    read("modules/community/community-buzz-social.tsx"),
    read("plugins/plotpickle-playhouse/community.json"),
  ]);

  assert.match(social, /const COMMUNITY_ROOM_ART = \{/u);
  assert.match(social, /function CommunityRoomBanner\(/u);
  assert.equal((social.match(/function CommunityRoomBanner\(/gu) ?? []).length, 1);
  for (const [roomId, asset] of rooms) {
    assert.match(social, new RegExp(`"?${roomId}"?:?\\s*\\{[\\s\\S]*?${asset.replace(".", "\\.")}`, "u"));
    assert.match(manifest, new RegExp(`"id": "${roomId}"`, "u"));
  }
  assert.doesNotMatch(social, /function (?:GreatHall|StoryWorkshop|Wyrmwood|Marquee)Banner\(/u);
});

test("#1299 ships substantial 1536x864 WebP room art", async () => {
  for (const [, asset] of rooms) {
    const url = new URL(`../public/assets/community-bbs/${asset}`, import.meta.url);
    const [contents, information] = await Promise.all([readFile(url), stat(url)]);
    assert.equal(contents.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(contents.subarray(8, 12).toString("ascii"), "WEBP");
    assert.deepEqual(webpDimensions(contents), [1536, 864]);
    assert.ok(information.size > 75_000, `${asset} should retain production artwork detail`);
  }
});

test("#1299 keeps room copy and helpers configuration-driven in the right rail", async () => {
  const social = await read("modules/community/community-buzz-social.tsx");

  assert.match(social, /PLOTPICKLE_COMMUNITY_EXTENSIONS\.rooms\.find/u);
  assert.match(social, /agentsForCommunityRoom\(PLOTPICKLE_COMMUNITY_EXTENSIONS, roomId\)/u);
  assert.match(social, /\{roomGuide \? <section[^>]*contextGuide/u);
  assert.match(social, /roomId \? <CommunityRoomBanner roomId=\{roomId\} label=\{target\.label\}/u);
});

test("#1299 provides the terminal block cursor with reduced-motion safety", async () => {
  const [social, styles] = await Promise.all([
    read("modules/community/community-buzz-social.tsx"),
    read("modules/community/community-buzz-social.module.css"),
  ]);

  assert.match(social, /styles\.terminalCursor[^>]*aria-hidden="true">█<\/span>/u);
  assert.match(styles, /\.terminalCursor\s*\{[^}]*animation:\s*terminal-cursor-blink/su);
  assert.match(styles, /@keyframes terminal-cursor-blink/u);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.terminalCursor\s*\{[^}]*animation:\s*none;[^}]*opacity:\s*1;/u);
});

test("#1299 lets new conversation smoothly carry the banner upward while the composer stays fixed", async () => {
  const [social, styles] = await Promise.all([
    read("modules/community/community-buzz-social.tsx"),
    read("modules/community/community-buzz-social.module.css"),
  ]);

  assert.match(social, /<section className=\{styles\.timeline\}[\s\S]*<CommunityRoomBanner[\s\S]*styles\.timelineBody/su);
  assert.match(social, /conversationAdvanced[\s\S]*timelineEndRef\.current\?\.scrollIntoView\(\{ behavior: reducedMotion \? "auto" : "smooth", block: "end" \}\)/su);
  assert.match(styles, /\.timeline\s*\{[^}]*overflow:\s*auto;[^}]*scroll-behavior:\s*smooth;/su);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.timeline\s*\{[^}]*scroll-behavior:\s*auto;/u);
  assert.match(styles, /\.composer\s*\{[^}]*border-top:/su);
});

test("#1299 preserves signed BUZZ transport and keyboard composer behavior", async () => {
  const social = await read("modules/community/community-buzz-social.tsx");

  assert.match(social, /await sendMessage\(target, draft\.trim\(\)\)/u);
  assert.match(social, /community\/forum-topic/u);
  assert.match(social, /window\.setInterval\(\(\) => \{ void refresh\(true\); \}, 5000\)/u);
  assert.match(social, /event\.key === "Enter" && !event\.shiftKey/u);
  assert.match(social, /humanPresentation\?\.avatarUrl \|\| member\?\.picture/u);
  assert.match(social, /<AgentPortrait id=\{agentId\}/u);
});
