import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("Community exposes the Backdoor Terminal as a first-class destination", async () => {
  const source = await read("app/community-workspace.tsx");
  assert.match(source, /type CommunitySection = [^;]*"terminal"/);
  assert.match(source, /\{ id: "terminal", label: "Terminal", primary: true \}/);
  assert.match(source, /<CommunityBackdoorTerminal/);
  assert.match(source, /Backdoor Terminal/);
});

test("#1027 makes the Community BBS the default front door", async () => {
  const source = await read("app/community-workspace.tsx");
  assert.match(source, /useState<CommunitySection>\("terminal"\)/);
  assert.match(source, /section !== "terminal" \? <header className=\{styles\.hero\}>/);
  assert.match(source, /data-community-bbs-server="true"/);
  assert.match(source, /SERVER \/ NODE/);
  assert.match(source, /CALLER/);
  assert.match(source, /CALLERS/);
});

test("#1027 derives the Buzz lamp from real Community readiness instead of decorative state", async () => {
  const source = await read("app/community-workspace.tsx");
  assert.match(source, /const connected = Boolean\(community\?\.identityVerified && community\.greatHall\)/);
  assert.match(source, /const buzzState = !community/);
  assert.match(source, /community\.configured && !community\.identityVerified/);
  assert.match(source, /community\.identityVerified && community\.message\.includes\("has not been created"\)/);
  assert.match(source, /BUZZ ONLINE/);
  assert.match(source, /BUZZ CHECKING/);
  assert.match(source, /BUZZ OFFLINE/);
  assert.match(source, /data-buzz-state=\{buzzState\}/);
  assert.match(source, /aria-label=\{buzzStatusLabel\}/);
});

test("#1027 keeps every established Community destination available after BBS entry", async () => {
  const source = await read("app/community-workspace.tsx");
  for (const label of ["Overview", "Terminal", "Great Hall", "Story Rooms", "Connected Studios", "People", "Agents & Stewards", "Review Queue", "Guildhall"]) {
    assert.match(source, new RegExp(`label: "${label.replace(/[&]/g, "&")}"`), `Missing Community destination ${label}`);
  }
  assert.match(source, /data-community-section=\{item\.id\}/);
  assert.match(source, /onClick=\{\(\) => setSection\(item\.id\)\}/);
});

test("terminal provides the requested keyboard-first backdoor controls", async () => {
  const source = await read("app/community-backdoor-terminal.tsx");
  for (const command of ["W", "A", "B", "T", "R", "H", "X"]) {
    assert.match(source, new RegExp(`key: "${command}"`), `Missing terminal command ${command}`);
  }
  assert.match(source, /window\.addEventListener\("keydown"/);
  assert.match(source, /editableTarget\(event\.target\)/);
  assert.match(source, /target\.isContentEditable/);
  assert.match(source, /\["INPUT", "TEXTAREA", "SELECT"\]/);
  assert.match(source, /onExit\(\)/);
});

test("#1027 gives the centre screen a lore-driven accessible ASCII welcome while commands stay on the right", async () => {
  const source = await read("app/community-backdoor-terminal.tsx");
  assert.match(source, /const PLAYHOUSE_ASCII = String\.raw/);
  assert.match(source, /PLOTPICKLE PLAYHOUSE BBS/);
  assert.match(source, /THE GUILDHALL AFTER DARK/);
  assert.match(source, /aria-label="PlotPickle Playhouse Guildhall BBS welcome banner"/);
  assert.match(source, /THE PLAYHOUSE DOOR HAS OPENED/);
  assert.match(source, /aside className=\{styles\.commandRail\} aria-label="Terminal keyboard commands"/);
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
  assert.match(workspace, /members=\{community\?\.members \?\? \[\]\}/);
  assert.match(workspace, /readyGuildhallRooms=\{guildhall\?\.readyRooms \?\? \[\]\}/);
  assert.match(workspace, /storyRooms=\{storyRooms\}/);
  assert.match(workspace, /reviews=\{reviews\}/);
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
