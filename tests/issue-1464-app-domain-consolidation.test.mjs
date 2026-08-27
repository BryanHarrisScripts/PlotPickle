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
    read("app/_components/community/community-workspace.tsx"),
    read("app/_components/community/community-story-room-access.tsx"),
    read("app/_components/community/community-story-room-listing.tsx"),
    read("config/repository-architecture-target.json"),
  ]);

  assert.match(workspace, /from "\.\/community-story-room-access"/);
  assert.doesNotMatch(workspace, /\.\/_components\/community\/community-story-room-access/);
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
  assert.equal(communityBatch.status, "completed");

  const appEntries = await readdir(new URL("app/", root));
  const remainingCommunityRoots = appEntries.filter((name) => name.startsWith("community-"));
  assert.deepEqual(remainingCommunityRoots.sort(), ["community-presence"], "the framework route directory remains outside the direct-file batch");
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
    read("app/_components/community/community-workspace.tsx"),
    read("app/_components/community/community-agent-roster.tsx"),
    read("config/repository-architecture-target.json"),
  ]);

  assert.match(workspace, /from "\.\/community-agent-roster"/);
  assert.doesNotMatch(workspace, /\.\/_components\/community\/community-agent-roster/);
  assert.match(roster, /from "\.\.\/\.\.\/\.\.\/core\/auth\/profile-request-browser"/);
  assert.match(roster, /from "\.\.\/\.\.\/\.\.\/lib\/buzz\/community-agent-roster"/);
  assert.match(roster, /authenticatedProfileFetch/);
  assert.match(roster, /Project sharing is off by default/);
  assert.match(roster, /The connected Human signer is never an Agent signer/);
  assert.match(roster, /PPF unchanged/);

  const architecture = JSON.parse(architectureText);
  const communityBatch = architecture.moveBatches.find((item) => item.id === "phase3-app-community-components");
  assert.ok(communityBatch, "the ratified Community batch must remain governed");
  assert.equal(communityBatch.status, "completed");

  const appEntries = await readdir(new URL("app/", root));
  const remainingCommunityRoots = appEntries.filter((name) => name.startsWith("community-"));
  assert.deepEqual(remainingCommunityRoots.sort(), ["community-presence"], "the framework route directory remains outside the direct-file batch");
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
  assert.equal(communityBatch.status, "completed");

  const appEntries = await readdir(new URL("app/", root));
  const remainingCommunityRoots = appEntries.filter((name) => name.startsWith("community-"));
  assert.deepEqual(remainingCommunityRoots.sort(), ["community-presence"], "the framework route directory remains outside the direct-file batch");
  assert.ok(!remainingCommunityRoots.includes("community-public-conversations-rail.tsx"));
});

test("#1464 gives the Community backdoor terminal one canonical UI owner", async () => {
  await assert.rejects(access(new URL("app/community-backdoor-terminal.tsx", root)));
  await assert.rejects(access(new URL("app/community-backdoor-terminal.module.css", root)));
  await access(new URL("app/_components/community/community-backdoor-terminal.tsx", root));
  await access(new URL("app/_components/community/community-backdoor-terminal.module.css", root));

  const [terminal, workflow, architectureText] = await Promise.all([
    read("app/_components/community/community-backdoor-terminal.tsx"),
    read(".github/workflows/buzz-guildhall.yml"),
    read("config/repository-architecture-target.json"),
  ]);

  assert.match(terminal, /from "\.\.\/\.\.\/\.\.\/lib\/buzz\/buzz-guildhall"/);
  assert.match(terminal, /from "\.\.\/\.\.\/\.\.\/lib\/buzz\/buzz-story-room"/);
  assert.doesNotMatch(terminal, /from "\.\.\/lib\/buzz\//);
  assert.match(terminal, /THIS TERMINAL NEVER EXECUTES OS\/SHELL COMMANDS/);
  assert.match(workflow, /app\/_components\/community\/community-backdoor-terminal\.tsx/);
  assert.doesNotMatch(workflow, /app\/community-backdoor-terminal\.tsx/);

  const architecture = JSON.parse(architectureText);
  const communityBatch = architecture.moveBatches.find((item) => item.id === "phase3-app-community-components");
  assert.ok(communityBatch, "the ratified Community batch must remain governed");
  assert.equal(communityBatch.status, "completed");

  const appEntries = await readdir(new URL("app/", root));
  const remainingCommunityRoots = appEntries.filter((name) => name.startsWith("community-"));
  assert.deepEqual(remainingCommunityRoots.sort(), ["community-presence"], "the framework route directory remains outside the direct-file batch");
  assert.ok(!remainingCommunityRoots.includes("community-backdoor-terminal.tsx"));
  assert.ok(!remainingCommunityRoots.includes("community-backdoor-terminal.module.css"));
});

test("#1464 completes the direct-root Community UI batch while preserving the framework route", async () => {
  const sourceFiles = [
    "community-workspace.tsx",
    "community-agent-roster.tsx",
    "community-backdoor-terminal.tsx",
    "community-story-room-access.tsx",
    "community-story-room-listing.tsx",
    "community-public-conversations-rail.tsx",
    "community-workspace.module.css",
    "community-navigation.module.css",
    "community-agent-roster.module.css",
    "community-backdoor-terminal.module.css",
    "community-story-room-access.module.css",
    "community-story-room-listing.module.css",
    "community-public-conversations-rail.module.css",
  ];

  for (const file of sourceFiles) {
    await assert.rejects(access(new URL(`app/${file}`, root)));
    await access(new URL(`app/_components/community/${file}`, root));
  }
  await access(new URL("app/community-presence/page.tsx", root));

  const [page, workspace, uatText, workflow, architectureText] = await Promise.all([
    read("app/page.tsx"),
    read("app/_components/community/community-workspace.tsx"),
    read("config/exhaustive-ui-uat.json"),
    read(".github/workflows/buzz-guildhall.yml"),
    read("config/repository-architecture-target.json"),
  ]);

  assert.match(page, /from "\.\/_components\/community\/community-workspace"/);
  assert.doesNotMatch(page, /from "\.\/community-workspace"/);
  assert.match(workspace, /from "\.\.\/\.\.\/\.\.\/core\/auth\/profile-request-browser"/);
  assert.match(workspace, /from "\.\/community-agent-roster"/);
  assert.match(workspace, /from "\.\/community-story-room-access"/);
  assert.match(workspace, /from "\.\.\/\.\.\/connected-studios-panel"/);

  const uat = JSON.parse(uatText);
  const communityScreen = uat.screens.find((item) => item.id === "community");
  assert.ok(communityScreen, "Community UAT surface must remain registered");
  assert.ok(communityScreen.sourceFiles.includes("app/_components/community/community-workspace.tsx"));
  assert.ok(!communityScreen.sourceFiles.includes("app/community-workspace.tsx"));
  assert.match(workflow, /app\/_components\/community\/community-workspace\.tsx/);
  assert.match(workflow, /app\/_components\/community\/community-workspace\.module\.css/);
  assert.match(workflow, /app\/_components\/community\/community-navigation\.module\.css/);
  assert.doesNotMatch(workflow, /app\/community-(?:workspace|navigation)/);

  const architecture = JSON.parse(architectureText);
  const communityBatch = architecture.moveBatches.find((item) => item.id === "phase3-app-community-components");
  assert.ok(communityBatch, "the ratified Community batch must remain governed");
  assert.equal(communityBatch.status, "completed");
  assert.deepEqual(communityBatch.completedSources, sourceFiles.map((file) => `app/${file}`));
  assert.deepEqual(communityBatch.completedTargets, sourceFiles.map((file) => `app/_components/community/${file}`));

  const appEntries = await readdir(new URL("app/", root));
  assert.deepEqual(appEntries.filter((name) => name.startsWith("community-")).sort(), ["community-presence"]);
});

test("#1464 gives direct-root Dashboard UI one canonical product-surface owner", async () => {
  const sourceFiles = [
    "dashboard-afterglow.module.css",
    "dashboard-command-centre.module.css",
    "dashboard-command-centre.tsx",
    "dashboard-story-library.module.css",
    "dashboard-story-library.tsx",
  ];

  for (const file of sourceFiles) {
    await assert.rejects(access(new URL(`app/${file}`, root)));
    await access(new URL(`app/_components/dashboard/${file}`, root));
  }

  const [commandCentre, storyLibrary, architectureText] = await Promise.all([
    read("app/_components/dashboard/dashboard-command-centre.tsx"),
    read("app/_components/dashboard/dashboard-story-library.tsx"),
    read("config/repository-architecture-target.json"),
  ]);

  assert.match(commandCentre, /from "\.\/dashboard-story-library"/);
  assert.match(storyLibrary, /from "\.\/dashboard-story-library\.module\.css"/);
  assert.match(storyLibrary, /aria-label="PlotPickle Studio Dashboard"/);

  const architecture = JSON.parse(architectureText);
  const dashboardBatch = architecture.moveBatches.find((item) => item.id === "phase3-app-dashboard-components");
  assert.ok(dashboardBatch, "the ratified Dashboard batch must remain governed");
  assert.equal(dashboardBatch.status, "completed");
  assert.deepEqual(dashboardBatch.completedSources, sourceFiles.map((file) => `app/${file}`));
  assert.deepEqual(dashboardBatch.completedTargets, sourceFiles.map((file) => `app/_components/dashboard/${file}`));

  const appEntries = await readdir(new URL("app/", root));
  assert.deepEqual(appEntries.filter((name) => name.startsWith("dashboard-")), []);
});
