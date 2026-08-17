import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#925 Community navigation progressively discloses real room-first destinations", async () => {
  const rail = await source("app/community-navigation-rail.tsx");
  for (const contract of ['aria-label="Community sections"','aria-expanded={expanded.community}','aria-expanded={expanded.storyRooms}','aria-expanded={expanded.guildhall}','>Great Hall</button>',"storyRooms.map","data-community-story-room-nav","guildhallReadyRooms.map","data-community-guildhall-room-nav",'aria-selected={section === "great-hall"}','aria-selected={section === "story-rooms"}']) assert.ok(rail.includes(contract), `Missing room-first Community navigation contract: ${contract}`);
  assert.doesNotMatch(rail, /role="tablist"/);
});

test("#925 keeps human conversation primary and operational destinations secondary", async () => {
  const rail = await source("app/community-navigation-rail.tsx");
  assert.ok(rail.indexOf("Great Hall") < rail.indexOf("Guildhall"));
  assert.ok(rail.indexOf("Story Rooms") < rail.indexOf("Guildhall"));
  assert.ok(rail.includes("Community tools"));
  assert.ok(rail.includes("Internal coordination"));
});

test("#925 Guildhall main pane shows one selected room rather than a flat room-card wall", async () => {
  const workspace = await source("app/community-workspace.tsx");
  for (const contract of ["selectedGuildhallRoomId","selectedGuildhallDefinition","onOpenGuildhallRoom","data-guildhall-room-detail","CommunityNavigationRail"]) assert.ok(workspace.includes(contract), `Missing selected Guildhall room contract: ${contract}`);
  assert.doesNotMatch(workspace, /<section className=\{styles\.guildGrid\}>/);
});

test("#925 Great Hall exposes a lightweight public reply affordance without inventing a parallel thread store", async () => {
  const workspace = await source("app/community-workspace.tsx");
  for (const contract of ["replyToHallMessage","data-community-reply-action","Reply to","hallComposerRef","focus()"] ) assert.ok(workspace.includes(contract), `Missing Great Hall reply affordance: ${contract}`);
});

test("#925 Community rail is sticky on desktop and collapses into normal flow on narrow screens", async () => {
  const css = await source("app/community-navigation-rail.module.css");
  for (const contract of [".communityBody",".communityRail","position: sticky",".communityRailGroup",".communityRailChildren","grid-template-columns: minmax(220px, 270px) minmax(0, 1fr)","@media (max-width: 900px)","position: static"]) assert.ok(css.includes(contract), `Missing responsive Community rail contract: ${contract}`);
});

test("#925 is registered in focused Community UAT for room-first navigation coverage", async () => {
  const registry = JSON.parse(await source("config/uat-autopilot-registry.json"));
  const community = registry.areas.find((area) => area.id === "community");
  assert.ok(community, "Community UAT area is missing");
  assert.ok(community.tests.includes("tests/issue-925-community-room-first-navigation.test.mjs"));
  assert.ok(community.requiredTerms.includes("Community navigation"));
});
