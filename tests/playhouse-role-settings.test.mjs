import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Settings starts with one aligned comparison table for the three Playhouse modes", async () => {
  const panel = await source("app/settings-panel.tsx");

  assert.match(panel, /<table className=\{styles\.modeTable\}>/);
  assert.match(panel, /Local Story Mode/);
  assert.match(panel, /Writers’ Room Mode/);
  assert.match(panel, /Cloud Collab Mode/);
  assert.equal((panel.match(/PlotPickle installed locally/g) ?? []).length, 3);
  assert.match(panel, /Afterglow: Reflections of Sentience/);
  assert.match(panel, /81 self-paced modules/);
  assert.match(panel, /Buzz Desktop/);
  assert.match(panel, /wss:\/\/ community address/);
  assert.match(panel, /GitHub sign-in/);
  for (const row of ["Status", "Primary role", "User experience", "Default storyline", "Learning", "AI &amp; agents", "Runtime", "Compute", "Data &amp; storage", "Collaboration", "Authentication &amp; API keys", "Connections", "Security &amp; control", "Cost profile", "Best for"]) {
    assert.ok(panel.includes(`<strong>${row}</strong>`), `Missing comparison row: ${row}`);
  }
});

test("each role opens a separate configuration surface", async () => {
  const [panel, github] = await Promise.all([
    source("app/settings-panel.tsx"),
    source("app/github-collaboration.tsx"),
  ]);

  assert.match(panel, /playhouseView === "local"/);
  assert.match(panel, /playhouseView === "writers-room"/);
  assert.match(panel, /playhouseView === "repository"/);
  assert.match(panel, /playhouseView === "writers-room"[\s\S]*?<BuzzSettingsPanel \/>/);
  assert.match(panel, /surface="repository-setup"/);
  assert.match(panel, /playhouseView === "advanced"/);
  assert.match(github, /surface === "repository-setup" \? "configuration" : surface/);
  assert.match(github, /surface === "configuration" \? <ProjectModeSettings/);
  assert.match(github, /surface === "configuration" \? <BuzzSettingsPanel/);
});

test("the role selector is responsive and keeps advanced systems secondary", async () => {
  const [panel, css] = await Promise.all([
    source("app/settings-panel.tsx"),
    source("app/settings-system-navigation.module.css"),
  ]);

  assert.match(panel, />Other settings<\/button>/);
  assert.match(css, /\.modeTableWrap\s*\{[^}]*overflow-x: auto/s);
  assert.match(css, /\.requirementGrid\s*\{[^}]*grid-template-columns: repeat\(3/s);
  assert.match(css, /@media \(max-width: 660px\)[\s\S]*\.modeNav\s*\{[^}]*grid-template-columns: repeat\(2/s);
});

test("Community is a first-class workspace with account, hosted and desktop Buzz paths", async () => {
  const [page, direction, community, css] = await Promise.all([
    source("app/page.tsx"),
    source("lib/product-direction.ts"),
    source("app/buzz-community-workspace.tsx"),
    source("app/buzz-community-workspace.module.css"),
  ]);

  assert.match(direction, /id: "community", label: "Community"/);
  assert.match(page, /community: "community"/);
  assert.match(page, /activeTab === "community"[\s\S]*<BuzzCommunityWorkspace/);
  assert.match(community, /https:\/\/app\.builderlab\.xyz\/buzz/);
  assert.match(community, /https:\/\/plotpickleplayhouse\.communities\.buzz\.xyz\/invite\/v2\.tdZwBnmvMuZ_E3lh_cEjbo4qeJHdTvFogatjMfVgB-k/);
  assert.match(community, />Join PlotPickleServer<\/a>/);
  assert.match(community, /New Buzz account or community/);
  assert.match(community, /Use BuilderLab to set up or sign in to your account/);
  assert.match(community, />Set up account &amp; communities<\/a>/);
  assert.match(community, />Be your own RELAY<\/h2>/);
  assert.match(community, /onClick=\{onOpenSettings\}>Configure local relay<\/button>/);
  assert.doesNotMatch(community, /mfa-email-challenge|[?&]state=/);
  assert.match(community, /buzz:\/\/add-community/);
  assert.match(community, />Open in Buzz Desktop<\/a>/);
  assert.match(community, /const desktopReady = Boolean\(desktopUrl && status\?\.cli\?\.available\)/);
  assert.match(community, /disabled>Buzz Desktop needs setup<\/button>/);
  assert.match(community, /title="Buzz Communities"/);
  assert.match(community, /Writers’ Room setup/);
  assert.match(css, /\.communityChoices\s*\{[^}]*grid-template-columns: repeat\(3/s);
  assert.match(css, /\.portal iframe\s*\{[^}]*height: max\(680px/s);
});
