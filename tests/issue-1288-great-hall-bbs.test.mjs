import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1288 gives the Great Hall a graphic-led 1980s BBS centre without replacing the three-column Community shell", async () => {
  const [workspace, social, socialStyles, navigationStyles] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("modules/community/community-buzz-social.tsx"),
    read("modules/community/community-buzz-social.module.css"),
    read("app/community-navigation.module.css"),
  ]);

  assert.match(workspace, /<CommunityBuzzSocial target=\{selectedTarget\}/u);
  assert.match(navigationStyles, /\.communityContent\s*\{[^}]*grid-column:\s*2 \/ 4;[^}]*grid-template-columns:\s*subgrid;/su);
  assert.match(social, /function GreatHallBanner\(\)/u);
  assert.match(social, /PLOTPICKLE GREAT HALL/u);
  assert.match(social, /Great Hall line art/u);
  assert.match(social, /data-great-hall=\{greatHall \? "true"/u);
  assert.match(socialStyles, /\.greatHallBanner\s*\{[^}]*grid-template-columns:/su);
  assert.match(socialStyles, /\.greatHallArt\s*\{[^}]*stroke:\s*currentColor;/su);
});

test("#1288 enlarges Community typography and adds the terminal identity prompt", async () => {
  const [social, socialStyles, navigationStyles] = await Promise.all([
    read("modules/community/community-buzz-social.tsx"),
    read("modules/community/community-buzz-social.module.css"),
    read("app/community-navigation.module.css"),
  ]);

  assert.match(socialStyles, /\.message p\s*\{[^}]*font-size:\s*16px;/su);
  assert.match(socialStyles, /\.composer textarea\s*\{[^}]*font-size:\s*16px;/su);
  assert.match(socialStyles, /\.message strong\s*\{[^}]*font-size:\s*15px;/su);
  assert.match(navigationStyles, /\.subDestination span\s*\{[^}]*font-size:\s*13px;/su);
  assert.match(social, /promptHandle\(humanName\).*promptHandle\(target\.label\)/su);
  assert.match(social, /event\.key === "Enter" && !event\.shiftKey/u);
  assert.match(social, /Enter to post · Shift\+Enter for a new line/u);
});

test("#1288 carries Human and BUZZ profile avatars into Community while keeping Agent portraits separate", async () => {
  const [workspace, social, gateway] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("modules/community/community-buzz-social.tsx"),
    read("build/buzz-community-gateway.ts"),
  ]);

  assert.match(workspace, /\/api\/auth\/profile-presentation/u);
  assert.match(workspace, /humanPresentation\?\.avatarUrl/u);
  assert.match(workspace, /humanPresentation=\{humanPresentation\}/u);
  assert.doesNotMatch(workspace, /humanBuzzFingerprint|callerFingerprint/u);
  assert.match(social, /<AgentPortrait id=\{agentId\}/u);
  assert.match(social, /humanPresentation\?\.avatarUrl \|\| member\?\.picture/u);
  assert.match(social, /isPublicKey\(message\.author\) \? "BUZZ member"/u);
  assert.match(gateway, /picture:\s*profile \? publicPicture/u);
  assert.match(gateway, /url\.protocol === "https:"/u);
});

test("#1288 presents friendly conversation time instead of raw BUZZ timestamps", async () => {
  const social = await read("modules/community/community-buzz-social.tsx");
  assert.match(social, /function friendlyTime\(value: string\)/u);
  assert.match(social, /return `Today, \$\{time\}`/u);
  assert.match(social, /<time dateTime=\{message\.createdAt\}>\{friendlyTime\(message\.createdAt\)\}<\/time>/u);
});
