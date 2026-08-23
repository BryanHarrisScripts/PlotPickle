import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("#1283 makes Human-purpose BUZZ rooms and Direct Messages first-class without the legacy terminal", async () => {
  const source = await read("app/community-workspace.tsx");
  assert.match(source, /data-community-native-buzz="true"/);
  assert.match(source, /aria-label="Community rooms and Direct Messages"/);
  assert.match(source, />Rooms</);
  assert.match(source, />Direct Messages</);
  assert.match(source, /<CommunityBuzzSocial target=\{selectedTarget\}/);
  assert.doesNotMatch(source, /<CommunityBackdoorTerminal/);
});

test("#1283 opens the verified Great Hall through the normal BUZZ conversation surface", async () => {
  const source = await read("app/community-workspace.tsx");
  assert.match(source, /const greatHallDefinition = PUBLIC_ROOMS\.find\(\(room\) => room\.id === "great-hall"\)/);
  assert.match(source, /chooseRoom\("great-hall"\)/);
  assert.match(source, /data-community-bbs-server="true"/);
  assert.match(source, /data-community-caller="verified-human"/);
  assert.match(source, /<CommunityBuzzSocial target=\{selectedTarget\}/);
  assert.doesNotMatch(source, /type CommunitySection =/);
});

test("#1283 derives Community readiness from the verified Human identity and prepared plugin rooms", async () => {
  const source = await read("app/community-workspace.tsx");
  assert.match(source, /const connected = Boolean\(community\?\.identityVerified && humanCanPost\)/);
  assert.match(source, /const operational = Boolean\(guildhall\?\.operational\)/);
  assert.match(source, /BUZZ CONNECTED/);
  assert.match(source, /BUZZ IDENTITY REQUIRED/);
  assert.match(source, /Community requires BUZZ/);
  assert.match(source, /Prepare Community/);
});

test("#1283 preserves one Private Story Room, Connected Studios and Agents beside plugin rooms", async () => {
  const source = await read("app/community-workspace.tsx");
  for (const label of ["Private Story Room", "Connected Studios", "Agents"]) {
    assert.match(source, new RegExp(label), `Missing PlotPickle destination ${label}`);
  }
  assert.match(source, /CommunityStoryRoomAccess/);
  assert.match(source, /ConnectedStudiosPanel/);
  assert.match(source, /CommunityAgentRoster/);
  assert.match(source, /PUBLIC_ROOMS\.map/);
  assert.match(source, /definition\.id === "great-hall"|room\.id === "great-hall"/);
});

test("terminal provides keyboard-first controls and Enter-to-send without stealing typing shortcuts", async () => {
  const source = await read("app/community-backdoor-terminal.tsx");
  for (const command of ["W", "A", "B", "T", "R", "H", "X"]) {
    assert.match(source, new RegExp(`key: "${command}"`), `Missing terminal command ${command}`);
  }
  assert.match(source, /window\.addEventListener\("keydown"/);
  assert.match(source, /editableTarget\(event\.target\)/);
  assert.match(source, /target\.isContentEditable/);
  assert.match(source, /\["INPUT", "TEXTAREA", "SELECT"\]/);
  assert.match(source, /event\.key !== "Enter" \|\| event\.shiftKey \|\| event\.nativeEvent\.isComposing/);
  assert.match(source, /event\.preventDefault\(\); void sendRoomMessage\(\)/);
  assert.match(source, /event\.preventDefault\(\); void sendTalkMessage\(\)/);
  assert.match(source, /onExit\(\)/);
});

test("#1123 gives the centre screen the PlotPickle dragon room-first BBS treatment while commands stay on the right", async () => {
  const source = await read("app/community-backdoor-terminal.tsx");
  assert.match(source, /const COMMUNITY_BBS_ASCII = String\.raw/);
  assert.match(source, /PLOTPICKLE COMMUNITY BBS/);
  assert.match(source, /ROOM-FIRST TERMINAL/);
  assert.match(source, /STORY HALLS 2-6/);
  assert.match(source, /aria-label="PlotPickle Community BBS dragon and hall welcome banner"/);
  assert.match(source, /Sage is who you talk to\. Sage is not who you are/);
  assert.match(source, /aside className=\{styles\.commandRail\} aria-label="Terminal keyboard commands"/);
  assert.doesNotMatch(source, /Playhouse/i);
  assert.doesNotMatch(source, /<div className=\{styles\.menuBlock\}>/);
});

test("current Community conversation uses real BUZZ routes rather than fake users or a second backend", async () => {
  const [terminal, workspace, social, communityGateway] = await Promise.all([
    read("app/community-backdoor-terminal.tsx"),
    read("app/community-workspace.tsx"),
    read("modules/community/community-buzz-social.tsx"),
    read("build/buzz-community-gateway.ts"),
  ]);
  assert.match(terminal, /BUZZ_GUILDHALL_ACTORS/);
  assert.match(terminal, /BUZZ_GUILDHALL_CHANNELS/);
  assert.match(terminal, /\/api\/local-buzz/);
  assert.match(social, /\/messages\?channel=/);
  assert.match(social, /community\/forum-topic/);
  assert.match(social, /\? \{ roomId: target\.id, channel: target\.channelId, content \}/);
  assert.match(social, /: \{ channel: target\.channelId, content \}/);
  assert.match(communityGateway, /"--kind", "45001"/);
  assert.match(workspace, /members=\{community\?\.members \?\? \[\]\}/);
  assert.match(workspace, /canPost=\{humanCanPost\}/);
  assert.match(workspace, /target=\{selectedTarget\}/);
});

test("TALK is honest about shared human routes and agent home-room addressing", async () => {
  const source = await read("app/community-backdoor-terminal.tsx");
  assert.match(source, /SIGNED BUZZ HOME ROOM/);
  assert.match(source, /ADDRESSED GREAT HALL ROUTE · SHARED, NOT 1:1 DM/);
  assert.match(source, /actor\.primaryChannel/);
  assert.match(source, /`@\$\{selectedTarget\.label\} \$\{talkDraft\.trim\(\)\}`/);
});

test("terminal is a themed UI and never exposes an operating-system shell", async () => {
  const [source, css] = await Promise.all([
    read("app/community-backdoor-terminal.tsx"),
    read("app/community-backdoor-terminal.module.css"),
  ]);
  assert.match(source, /THIS TERMINAL NEVER EXECUTES OS\/SHELL COMMANDS/);
  assert.doesNotMatch(source, /child_process|spawn\(|exec\(|powershell|cmd\.exe|bash\b|xterm/i);
  assert.match(css, /scanlines/);
  assert.match(css, /terminalGrid/);
  assert.match(css, /commandRail/);
  assert.match(css, /Courier New/);
  assert.match(css, /prefers-reduced-motion/);
});