import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1295 evolves the Great Hall artwork into the shared 16/32-bit BBS room presentation", async () => {
  const social = await read("modules/community/community-buzz-social.tsx");

  assert.match(social, /COMMUNITY_ROOM_ART/u);
  assert.match(social, /\/assets\/community-bbs\/great-hall\.webp/u);
  assert.match(social, /pixel-art dragon curled protectively/u);
  assert.match(social, /MEMBERS \{memberCount\} · MESSAGES \{messageCount\}/u);
  assert.doesNotMatch(social, /GREAT_HALL_ASCII_CHARACTER_ART|<svg|Great Hall line art/u);
});

test("#1295 bundles an open-licensed terminal font and applies one coherent BBS type system", async () => {
  const [workspaceStyles, socialStyles, navigationStyles, font, license] = await Promise.all([
    read("app/community-workspace.module.css"),
    read("modules/community/community-buzz-social.module.css"),
    read("app/community-navigation.module.css"),
    stat(new URL("../public/assets/fonts/vt323/VT323-Regular.ttf", import.meta.url)),
    read("public/assets/fonts/vt323/OFL.txt"),
  ]);

  assert.ok(font.size > 100_000);
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/u);
  assert.match(workspaceStyles, /@font-face\s*\{[^}]*font-family:\s*"PlotPickle VT323";[^}]*url\("\/assets\/fonts\/vt323\/VT323-Regular\.ttf"\)/su);
  assert.match(workspaceStyles, /--community-bbs-font:\s*"PlotPickle VT323"/u);
  assert.match(workspaceStyles, /font-family:\s*var\(--community-bbs-font\)/u);
  assert.doesNotMatch(socialStyles, /font-family:\s*Georgia/u);
  assert.doesNotMatch(navigationStyles, /font-family:\s*Georgia/u);
});

test("#1295 matches the supplied three-column hierarchy while preserving readable conversation and responsive stacking", async () => {
  const [social, socialStyles, navigationStyles] = await Promise.all([
    read("modules/community/community-buzz-social.tsx"),
    read("modules/community/community-buzz-social.module.css"),
    read("app/community-navigation.module.css"),
  ]);

  assert.match(navigationStyles, /\.communityContent\s*\{[^}]*grid-column:\s*2 \/ 4;[^}]*grid-template-columns:\s*subgrid;/su);
  assert.match(social, /roomId \? <CommunityRoomBanner/u);
  assert.match(social, /\{roomGuide \? <section/u);
  assert.match(socialStyles, /\.conversation\[data-community-room-template="bbs-v1"\]\s*>\s*\.conversationHeader\s*\{[^}]*display:\s*none;/su);
  assert.match(socialStyles, /\.message p\s*\{[^}]*font-size:\s*(?:16|17|18)px;/su);
  assert.match(socialStyles, /\.composer textarea\s*\{[^}]*font-size:\s*(?:16|17|18|19|20)px;/su);
  assert.match(socialStyles, /\.roomArtwork\s*\{[^}]*aspect-ratio:\s*16 \/ 9;/su);
  assert.match(socialStyles, /@media \(max-width: 900px\)[\s\S]*\.roomBanner\s*\{[^}]*padding-inline:/u);
  assert.match(socialStyles, /@media \(prefers-reduced-motion: reduce\)/u);
});

test("#1295 leaves signed BUZZ posting, polling, identity separation and native voice handoff unchanged", async () => {
  const social = await read("modules/community/community-buzz-social.tsx");

  assert.match(social, /authenticatedProfileFetch\(`\$\{BUZZ_API\}\/messages\?channel=/u);
  assert.match(social, /authenticatedProfileFetch\(`\$\{BUZZ_API\}\/messages`,[\s\S]*method:\s*"POST"/u);
  assert.match(social, /window\.setInterval\(\(\) => \{ void refresh\(true\); \}, 5000\)/u);
  assert.match(social, /<AgentPortrait id=\{agentId\}/u);
  assert.match(social, /humanPresentation\?\.avatarUrl \|\| member\?\.picture/u);
  assert.match(social, /Open in BUZZ Desktop/u);
  assert.match(social, /Enter to post · Shift\+Enter for a new line/u);
  assert.match(social, /isLegacyOperationalDump/u);
});