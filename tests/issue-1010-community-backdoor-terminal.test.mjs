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
