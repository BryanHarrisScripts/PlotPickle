import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1102 makes left navigation, centre room and right context first-class desktop columns", async () => {
  const css = await read("app/community-navigation.module.css");
  const shell = css.match(/\.communityLayout\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  assert.match(shell, /grid-template-columns:\s*minmax\(220px,\s*19fr\)\s+minmax\(0,\s*56fr\)\s+minmax\(240px,\s*25fr\)/);
  assert.match(shell, /min-width:\s*0/);
  assert.match(shell, /overflow:\s*hidden/);
  assert.doesNotMatch(shell, /81fr/);
});

test("#1102 keeps Community content spanning canonical centre and right columns without squeezing the room", async () => {
  const css = await read("app/community-navigation.module.css");
  const content = css.match(/\.communityContent\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  assert.match(content, /grid-column:\s*2\s*\/\s*4/);
  assert.match(content, /grid-template-columns:\s*minmax\(0,\s*56fr\)\s+minmax\(240px,\s*25fr\)/);
  assert.match(content, /min-width:\s*0/);
  assert.match(content, /overflow:\s*hidden/);
});

test("#1102 terminal conversation remains dominant while its command/context rail stays bounded", async () => {
  const [navigationCss, terminalCss, terminal] = await Promise.all([
    read("app/community-navigation.module.css"),
    read("app/community-backdoor-terminal.module.css"),
    read("app/community-backdoor-terminal.tsx"),
  ]);
  assert.match(navigationCss, /data-community-terminal="backdoor-v1"[^\n]*PlotPickle Community BBS terminal[^\n]*> div:last-child\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*56fr\)\s+minmax\(240px,\s*25fr\)/s);
  assert.match(terminalCss, /\.screen\s*\{[^}]*min-width:\s*0;/s);
  assert.match(terminal, /className=\{styles\.screen\}/);
  assert.match(terminal, /aside className=\{styles\.commandRail\}/);
});

test("#1102 responsive shell collapses progressively rather than using stacked desktop layout", async () => {
  const css = await read("app/community-navigation.module.css");
  assert.match(css, /@media \(max-width:\s*980px\)[\s\S]*grid-template-columns:\s*minmax\(200px,\s*28fr\)\s+minmax\(0,\s*72fr\)/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*\.communityLayout\s*\{[^}]*grid-template-columns:\s*1fr;/);
});

test("#1102 layout-only change preserves BUZZ, room, moderation and agent surfaces", async () => {
  const workspace = await read("app/community-workspace.tsx");
  assert.match(workspace, /const BUZZ_API = "\/api\/local-buzz"/);
  assert.match(workspace, /<CommunityBackdoorTerminal/);
  assert.match(workspace, /<CommunityAgentRoster/);
  assert.match(workspace, /BUZZ_STORY_ROOMS/);
  assert.match(workspace, /BUZZ_GUILDHALL_ACTORS/);
  assert.match(workspace, /greatHallChannelId=\{community\?\.greatHall\?\.id \|\| ""\}/);
});
