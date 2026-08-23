import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("#1102/#1103 Community inherits the canonical PlotPickle desktop columns instead of declaring 19/81", async () => {
  const [communityCss, continuity] = await Promise.all([
    read("app/community-navigation.module.css"),
    read("app/workspace-continuity.css"),
  ]);

  assert.match(continuity, /--pp-workspace-columns:\s*minmax\(240px, 19%\) minmax\(440px, 56%\) minmax\(300px, 25%\)/);
  assert.match(continuity, /\[data-active-workspace="community"\][\s\S]*grid-template-columns:\s*var\(--pp-workspace-columns\)\s*!important;/);
  assert.match(communityCss, /\.communityLayout\s*\{[^}]*display:\s*contents;/s);
  assert.match(communityCss, /\.communityRail\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*1 \/ 5;/s);
  assert.match(communityCss, /\.communityContent\s*\{[^}]*grid-column:\s*2 \/ 4;[^}]*grid-template-columns:\s*subgrid;/s);
  assert.doesNotMatch(communityCss, /19fr|81fr/, "Community must not own a second outer desktop ratio");
});

test("#1102/#1103 terminal screen and command rail use the inherited centre/right tracks on desktop", async () => {
  const [css, terminal] = await Promise.all([
    read("app/community-navigation.module.css"),
    read("app/community-backdoor-terminal.tsx"),
  ]);

  assert.match(css, /@media \(min-width:\s*901px\)[\s\S]*data-community-terminal="backdoor-v1"[\s\S]*grid-template-columns:\s*subgrid\s*!important;/);
  assert.match(css, /div:last-child > div:first-child\s*\{[^}]*grid-column:\s*1;/s);
  assert.match(css, /div:last-child > aside:last-child\s*\{[^}]*grid-column:\s*2;/s);
  assert.doesNotMatch(css, /56fr|25fr/, "the Community desktop shell must inherit the shared tracks instead of restating their ratio");
  assert.match(terminal, /aside className=\{styles\.commandRail\} aria-label="Terminal keyboard commands"/);
  assert.match(terminal, /const COMMANDS:/);
});

test("#1283 keeps the Community rail truthful about verified Human identity and plugin presentation", async () => {
  const workspace = await read("app/community-workspace.tsx");
  assert.match(workspace, /data-community-native-buzz="true"/);
  assert.match(workspace, /const connected = Boolean\(community\?\.identityVerified && humanCanPost\)/);
  assert.match(workspace, /const COMMUNITY_BBS_NAME = PLOTPICKLE_PLAYHOUSE_PLUGIN\.displayName/);
  assert.match(workspace, /data-community-caller="verified-human"/);
  assert.match(workspace, /You speak as yourself\. Agents use separate identities/);
});

test("#1283 replaces internal Channels and Forums with plugin rooms, Direct Messages and simple PlotPickle tools", async () => {
  const workspace = await read("app/community-workspace.tsx");
  assert.match(workspace, /aria-label="Community rooms and Direct Messages"/);
  for (const label of ["Rooms", "Direct Messages", "Private Story Room", "Connected Studios", "Agents"]) {
    assert.match(workspace, new RegExp(label), `missing Community destination ${label}`);
  }
  assert.match(workspace, /PUBLIC_ROOMS\.map/);
  assert.match(workspace, /CommunityAgentRoster/);
  assert.match(workspace, /CommunityStoryRoomAccess/);
  assert.match(workspace, /CommunityBuzzSocial/);
  assert.doesNotMatch(workspace, />Channels<|>Forums<|<CommunityBackdoorTerminal/);
});

test("#1102/#1103 preserve keyboard safety and use the shared shell collapse breakpoint", async () => {
  const [css, terminal, continuity] = await Promise.all([
    read("app/community-navigation.module.css"),
    read("app/community-backdoor-terminal.tsx"),
    read("app/workspace-continuity.css"),
  ]);
  assert.match(css, /@media \(max-width:\s*900px\)[\s\S]*\.communityContent\s*\{[^}]*display:\s*block;/);
  assert.match(continuity, /@media \(max-width: 900px\)[\s\S]*\[data-active-workspace="community"\][\s\S]*display:\s*block\s*!important;/);
  assert.match(terminal, /editableTarget\(event\.target\)/);
  assert.match(terminal, /\["INPUT", "TEXTAREA", "SELECT"\]/);
  assert.match(terminal, /target\.isContentEditable/);
  assert.match(terminal, /event\.key !== "Enter" \|\| event\.shiftKey \|\| event\.nativeEvent\.isComposing/);
});
