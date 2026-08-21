import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("#1217 makes native BUZZ social destinations first-class while retaining the Great Hall terminal", async () => {
  const source = await read("app/community-workspace.tsx");
  assert.match(source, /data-community-native-buzz="true"/);
  assert.match(source, /aria-label="Channels, Forums and Direct Messages"/);
  assert.match(source, />Channels</);
  assert.match(source, />Forums</);
  assert.match(source, />Direct Messages</);
  assert.match(source, /<CommunityBackdoorTerminal/);
});

test("#1217 opens the verified BUZZ Great Hall through the terminal without restoring the retired destination menu", async () => {
  const source = await read("app/community-workspace.tsx");
  assert.match(source, /setActiveRoom\(\(current\) => current \?\? createGreatHallActiveRoom\(communityBody\.greatHall\)\)/);
  assert.match(source, /activeRoom \? <CommunityBackdoorTerminal/);
  assert.match(source, /data-community-bbs-server="true"/);
  assert.match(source, /data-community-caller="verified-human"/);
  assert.match(source, /CALLER/);
  assert.doesNotMatch(source, /type CommunitySection =/);
});

test("#1217 derives Community readiness from verified Human BUZZ identity and operational native rooms", async () => {
  const source = await read("app/community-workspace.tsx");
  assert.match(source, /const connected = Boolean\(community\?\.identityVerified && humanCanPost\)/);
  assert.match(source, /const operational = Boolean\(guildhall\?\.operational\)/);
  assert.match(source, /HUMAN BUZZ IDENTITY VERIFIED/);
  assert.match(source, /BUZZ IDENTITY REQUIRED/);
  assert.match(source, /Community requires BUZZ/);
  assert.match(source, /Prepare Community rooms/);
});

test("#1217 preserves PlotPickle Story Rooms, Connected Studios and agents beside native BUZZ social navigation", async () => {
  const source = await read("app/community-workspace.tsx");
  for (const label of ["Private Story Rooms", "Connected Studios"]) {
    assert.match(source, new RegExp(label), `Missing PlotPickle compatibility destination ${label}`);
  }
  assert.match(source, /Agents &amp; Stewards/);
  assert.match(source, /CommunityStoryRoomAccess/);
  assert.match(source, /ConnectedStudiosPanel/);
  assert.match(source, /CommunityAgentRoster/);
  assert.match(source, /data-community-room=\{room\.id\}/);
  assert.match(source, /room\.id === "great-hall"/);
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

test("terminal uses real Community and Guildhall routes rather than fake users or a second backend", async () => {
  const [terminal, workspace] = await Promise.all([
    read("app/community-backdoor-terminal.tsx"),
    read("app/community-workspace.tsx"),
  ]);
  assert.match(terminal, /BUZZ_GUILDHALL_ACTORS/);
  assert.match(terminal, /BUZZ_GUILDHALL_CHANNELS/);
  assert.match(terminal, /members\.filter\(\(member\) => member\.presence === "online"\)/);
  assert.match(terminal, /\/api\/local-buzz/);
  assert.match(terminal, /\/messages\?channel=/);
  assert.match(terminal, /body: JSON\.stringify\(\{ channel: channelId, content \}\)/);
  assert.match(workspace, /humanIdentity=\{humanIdentity\}/);
  assert.match(workspace, /activeRoom=\{activeRoom\}/);
  assert.match(workspace, /members=\{community\?\.members \?\? \[\]\}/);
  assert.match(workspace, /recentActivity=\{community\?\.recentActivity \?\? \[\]\}/);
  assert.match(workspace, /readyGuildhallRooms=\{guildhall\?\.readyRooms \?\? \[\]\}/);
  assert.match(workspace, /storyRooms=\{storyRooms\}/);
  assert.match(workspace, /reviews=\{\[\]\}/);
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
