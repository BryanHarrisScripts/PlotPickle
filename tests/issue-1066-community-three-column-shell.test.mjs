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

test("#1102/#1103 preserve BBS default entry and truthful BUZZ identity", async () => {
  const workspace = await read("app/community-workspace.tsx");
  assert.match(workspace, /useState<CommunitySection>\("terminal"\)/);
  assert.match(workspace, /const nodeName = community\?\.community\.trim\(\) \|\| ""/);
  assert.match(workspace, /nodeName=\{nodeName\}/);
  assert.match(workspace, /BUZZ NODE UNAVAILABLE/);
  assert.doesNotMatch(workspace, /const\s+[^=]*NODE[^=]*=\s*["']plotpickle-community["']/i);
});

test("#1102/#1103 preserve all Community destinations and existing message/composer controls", async () => {
  const workspace = await read("app/community-workspace.tsx");
  for (const id of ["overview", "terminal", "great-hall", "story-rooms", "connected-studios", "people", "agents", "reviews", "guildhall"]) {
    assert.match(workspace, new RegExp(`id: ["']${id}["']`), `missing Community destination ${id}`);
  }
  assert.match(workspace, /Write to the Great Hall…/);
  assert.match(workspace, /Send signed message/);
  assert.match(workspace, /Discuss this story without changing canon…/);
  assert.match(workspace, /CommunityAgentRoster/);
  assert.match(workspace, /CommunityStoryRoomAccess/);
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
});
