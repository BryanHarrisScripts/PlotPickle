import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1323 Community rail uses the Community name and concise room purposes", async () => {
  const workspace = await read("app/_components/community/community-workspace.tsx");
  assert.match(workspace, /const COMMUNITY_BBS_NAME = PLOTPICKLE_BUZZ_COMMUNITY\.name/);
  assert.match(workspace, /community\?\.community \|\| COMMUNITY_BBS_NAME/);
  assert.match(workspace, /"great-hall": "Welcome, questions & general chat"/);
  assert.match(workspace, /"story-council": "Story planning, structure & critique"/);
  assert.match(workspace, /"wyrmwood-ring": "Challenges, lessons & game discussion"/);
  assert.match(workspace, /marquee: "Posters, key art & promotion"/);
  assert.doesNotMatch(workspace, /agentsForCommunityRoom|definition\.helpers/);
});

test("#1323 global workflow delegates grouped destinations to the canonical navigation owner", async () => {
  const shell = await read("app/plotpickle-workspace-shell.tsx");
  assert.match(shell, /NAVIGATION_AREAS\.map/);
  assert.match(shell, /shortcutsForArea\(navigationAreaOption.id\)/);
  assert.match(shell, /data-navigation-area-panel=\{navigationAreaOption.id\}/);
  assert.match(shell, /hidden=\{navigationAreaOption.id !== activeArea\}/);
});

test("#1323 Library aligns Human stories and disclosed Avery history to one centered column", async () => {
  const [workspace, css, averyCss, polish] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("modules/library/ui/library-workspace.module.css"),
    read("modules/library/ui/avery-session-history/avery-session-history.module.css"),
    read("app/issue-1725-polish.css"),
  ]);
  assert.match(workspace, /useState<LibraryTab>\("stories"\)/);
  assert.match(workspace, /<details className=\{styles\.averyDisclosure\}>[\s\S]*<AverySessionHistory \/>[\s\S]*<\/details>/s);
  assert.match(css, /\.hero,\s*\.libraryColumn\s*\{[^}]*width:\s*min\(100%, 980px\);[^}]*margin-right:\s*auto;[^}]*margin-left:\s*auto;/s);
  assert.match(polish, /main\[data-library-workspace="v1"\] > div > details:last-child > summary,[\s\S]*?min-height:\s*var\(--pp-touch-target\)/s);
  assert.match(averyCss, /\.slotGrid\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/s);
  assert.match(averyCss, /\.slotWrap\s*\{[^}]*min-width:\s*0;/s);
});
