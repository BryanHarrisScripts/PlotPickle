import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1323 Community rail uses the Community name and concise room purposes", async () => {
  const workspace = await read("app/community-workspace.tsx");
  assert.match(workspace, /const COMMUNITY_BBS_NAME = PLOTPICKLE_BUZZ_COMMUNITY\.name/);
  assert.match(workspace, /community\?\.community \|\| COMMUNITY_BBS_NAME/);
  assert.match(workspace, /"great-hall": "Welcome, questions & general chat"/);
  assert.match(workspace, /"story-council": "Story planning, structure & critique"/);
  assert.match(workspace, /"wyrmwood-ring": "Challenges, lessons & game discussion"/);
  assert.match(workspace, /marquee: "Posters, key art & promotion"/);
  assert.doesNotMatch(workspace, /agentsForCommunityRoom|definition\.helpers/);
});

test("#1323 global workflow uses the approved newest compact order", async () => {
  const [shell, css] = await Promise.all([
    read("app/plotpickle-workspace-shell.tsx"),
    read("app/plotpickle-workspace-shell.module.css"),
  ]);
  const ids = [...shell.matchAll(/\{ id: "([^"]+)", relic:/g)].map((match) => match[1]);
  assert.deepEqual(ids, [
    "community", "library", "learn", "wyrmwood", "plan", "build", "storyboard", "graphic-novel",
    "write", "edit", "feedback", "refine", "reports", "dashboard", "settings",
  ]);
  assert.match(css, /\.list\s*\{[^}]*width:\s*max-content;[^}]*margin:\s*0 auto;/s);
  assert.match(css, /\.list li\s*\{[^}]*width:\s*64px;[^}]*flex:\s*0 0 64px;/s);
  assert.doesNotMatch(shell, /data-navigation-gap-after|navigationBreakAfter/);
});

test("#1323 Library aligns header, Avery history, filters and shelves to one centered column", async () => {
  const [workspace, css, averyCss] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("modules/library/ui/library-workspace.module.css"),
    read("modules/library/ui/avery-session-history/avery-session-history.module.css"),
  ]);
  assert.match(workspace, /<div className=\{styles\.libraryColumn\}>\s*<AverySessionHistory \/>/s);
  assert.match(css, /\.hero,\s*\.libraryColumn\s*\{[^}]*width:\s*min\(100%, 980px\);[^}]*margin-right:\s*auto;[^}]*margin-left:\s*auto;/s);
  assert.match(averyCss, /\.slotGrid\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/s);
  assert.match(averyCss, /\.slotWrap\s*\{[^}]*min-width:\s*0;/s);
});
