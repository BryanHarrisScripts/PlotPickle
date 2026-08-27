import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("#1509 gives Story Room Community UI one canonical owner without changing authority", async () => {
  await assert.rejects(access(new URL("app/community-story-room-access.tsx", root)));
  await assert.rejects(access(new URL("app/community-story-room-access.module.css", root)));
  await assert.rejects(access(new URL("app/community-story-room-listing.tsx", root)));

  await access(new URL("app/_components/community/community-story-room-access.tsx", root));
  await access(new URL("app/_components/community/community-story-room-access.module.css", root));
  await access(new URL("app/_components/community/community-story-room-listing.tsx", root));

  const [workspace, accessUi, listing, architectureText] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("app/_components/community/community-story-room-access.tsx"),
    read("app/_components/community/community-story-room-listing.tsx"),
    read("config/repository-architecture-target.json"),
  ]);

  assert.match(workspace, /\.\/_components\/community\/community-story-room-access/);
  assert.doesNotMatch(workspace, /from "\.\/community-story-room-access"/);
  assert.match(accessUi, /from "\.\.\/\.\.\/\.\.\/core\/auth\/profile-request-browser"/);
  assert.match(accessUi, /from "\.\.\/\.\.\/\.\.\/modules\/community\/story-room-directory"/);
  assert.match(accessUi, /from "\.\/community-story-room-listing"/);
  assert.match(accessUi, /authenticatedProfileFetch/);
  assert.match(accessUi, /CommunityStoryRoomOwnerRequests/);
  assert.match(accessUi, /aria-label="Story Room access"/);
  assert.match(accessUi, /BUZZ enforces the actual channel permissions/);
  assert.match(listing, /Story Room/);

  const architecture = JSON.parse(architectureText);
  const communityBatch = architecture.moveBatches.find((item) => item.id === "phase3-app-community-components");
  assert.ok(communityBatch, "the ratified Community batch must remain governed");
  assert.notEqual(communityBatch.status, "completed", "Community phase must remain open while other root Community UI remains");

  const appEntries = await readdir(new URL("app/", root));
  const remainingCommunityRoots = appEntries.filter((name) => name.startsWith("community-"));
  assert.ok(remainingCommunityRoots.length > 0, "this bounded slice must not pretend the whole Community batch is finished");
  assert.ok(!remainingCommunityRoots.includes("community-story-room-access.tsx"));
  assert.ok(!remainingCommunityRoots.includes("community-story-room-access.module.css"));
  assert.ok(!remainingCommunityRoots.includes("community-story-room-listing.tsx"));
});

test("#1511 gives the Community Agent roster one canonical UI owner without changing Agent authority", async () => {
  await assert.rejects(access(new URL("app/community-agent-roster.tsx", root)));
  await assert.rejects(access(new URL("app/community-agent-roster.module.css", root)));
  await access(new URL("app/_components/community/community-agent-roster.tsx", root));
  await access(new URL("app/_components/community/community-agent-roster.module.css", root));

  const [workspace, roster, architectureText] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("app/_components/community/community-agent-roster.tsx"),
    read("config/repository-architecture-target.json"),
  ]);

  assert.match(workspace, /\.\/_components\/community\/community-agent-roster/);
  assert.doesNotMatch(workspace, /from "\.\/community-agent-roster"/);
  assert.match(roster, /from "\.\.\/\.\.\/\.\.\/core\/auth\/profile-request-browser"/);
  assert.match(roster, /from "\.\.\/\.\.\/\.\.\/lib\/buzz\/community-agent-roster"/);
  assert.match(roster, /authenticatedProfileFetch/);
  assert.match(roster, /Project sharing is off by default/);
  assert.match(roster, /The connected Human signer is never an Agent signer/);
  assert.match(roster, /PPF unchanged/);

  const architecture = JSON.parse(architectureText);
  const communityBatch = architecture.moveBatches.find((item) => item.id === "phase3-app-community-components");
  assert.ok(communityBatch, "the ratified Community batch must remain governed");
  assert.notEqual(communityBatch.status, "completed", "Community phase must remain open while other root Community UI remains");

  const appEntries = await readdir(new URL("app/", root));
  const remainingCommunityRoots = appEntries.filter((name) => name.startsWith("community-"));
  assert.ok(remainingCommunityRoots.length > 0, "the roster leaf move must not pretend the wider Community batch is complete");
  assert.ok(!remainingCommunityRoots.includes("community-agent-roster.tsx"));
  assert.ok(!remainingCommunityRoots.includes("community-agent-roster.module.css"));
});

test("#1464 retires the Community public-conversations root bridge without changing the rendered rail owner", async () => {
  await assert.rejects(access(new URL("app/community-public-conversations-rail.tsx", root)));
  await access(new URL("app/_components/community/community-public-conversations-rail.tsx", root));
  await access(new URL("app/_components/community/community-public-conversations-rail.module.css", root));

  const [shell, rail, uatText, architectureText] = await Promise.all([
    read("app/plotpickle-workspace-shell.tsx"),
    read("app/_components/community/community-public-conversations-rail.tsx"),
    read("config/exhaustive-ui-uat.json"),
    read("config/repository-architecture-target.json"),
  ]);

  assert.match(shell, /\.\/_components\/community\/community-public-conversations-rail/);
  assert.doesNotMatch(shell, /from "\.\/community-public-conversations-rail"/);
  assert.match(rail, /View all Great Hall conversations/);
  assert.match(rail, /data-community-public-action-status/);

  const uat = JSON.parse(uatText);
  const communityScreen = uat.screens.find((item) => item.id === "community");
  assert.ok(communityScreen, "Community UAT surface must remain registered");
  assert.ok(communityScreen.sourceFiles.includes("app/_components/community/community-public-conversations-rail.tsx"));
  assert.ok(communityScreen.sourceFiles.includes("app/_components/community/community-public-conversations-rail.module.css"));
  assert.ok(!communityScreen.sourceFiles.includes("app/community-public-conversations-rail.tsx"));
  assert.ok(!communityScreen.sourceFiles.includes("app/community-public-conversations-rail.module.css"));

  const architecture = JSON.parse(architectureText);
  const communityBatch = architecture.moveBatches.find((item) => item.id === "phase3-app-community-components");
  assert.ok(communityBatch, "the ratified Community batch must remain governed");
  assert.notEqual(communityBatch.status, "completed", "Community phase must remain open while other root Community UI remains");

  const appEntries = await readdir(new URL("app/", root));
  const remainingCommunityRoots = appEntries.filter((name) => name.startsWith("community-"));
  assert.ok(remainingCommunityRoots.length > 0, "retiring one bridge must not pretend the wider Community batch is complete");
  assert.ok(!remainingCommunityRoots.includes("community-public-conversations-rail.tsx"));
});
