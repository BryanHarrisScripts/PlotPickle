import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import "./issue-212-buzz-dashboard-marketing-alignment.test.mjs";
import "./issue-214-buzz-story-room.test.mjs";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #210 defines a dormant PlotPickle-managed Buzz runtime", async () => {
  const runtime = await source("lib/buzz-runtime.ts");

  for (const component of ["buzz-relay", "buzz-cli", "buzz-agent", "buzz-dev-mcp"]) {
    assert.match(runtime, new RegExp(`"${component}"`));
  }

  for (const platform of ["windows-x64", "macos-x64", "macos-arm64", "linux-x64"]) {
    assert.match(runtime, new RegExp(`"${platform}"`));
  }

  assert.match(runtime, /lifecycle: "unconfigured"/);
  assert.match(runtime, /configured: false/);
  assert.match(runtime, /packaged: false/);
  assert.match(runtime, /processRunning: false/);
  assert.match(runtime, /relayListening: false/);
  assert.match(runtime, /identityCreated: false/);
  assert.match(runtime, /dataCreated: false/);
  assert.match(runtime, /paths: null/);
  assert.match(runtime, /An unconfigured runtime creates no process, listening port, identity, credential or Buzz project data/);
});

test("issue #210 places Buzz beside Collab without changing the creative workflow", async () => {
  const [direction, header, route] = await Promise.all([
    source("lib/product-direction.ts"),
    source("app/application-shell-header.tsx"),
    source("app/buzz/page.tsx"),
  ]);

  const primary = direction.slice(direction.indexOf("export const PRIMARY_WORKFLOW_NAVIGATION"), direction.indexOf("export const COLLABORATION_NAVIGATION"));
  const labels = ["Dashboard", "Learn", "Plan", "Storyboard", "Write", "Graphic Novel", "Build", "Feedback", "Refine", "Reports"];
  assert.equal([...primary.matchAll(/label: "/g)].length, labels.length);
  let previous = -1;
  for (const label of labels) {
    const index = primary.indexOf(`label: "${label}"`);
    assert.ok(index > previous, `Creative workflow changed or lost ${label}`);
    previous = index;
  }

  assert.match(direction, /id: "collab", label: "Collab"[\s\S]*id: "buzz", label: "Buzz"/);
  assert.match(header, /id === "buzz"[\s\S]*window\.location\.assign\("\/buzz"\)/);
  assert.match(header, /Buzz Setup/);
  assert.match(route, /activeTab="buzz"/);
  assert.match(route, /<BuzzWorkspace/);
});

test("issue #210 keeps Settings, PPF and GitHub authority boundaries explicit", async () => {
  const [runtime, brief, settings] = await Promise.all([
    source("lib/buzz-runtime.ts"),
    source("docs/issue-210-managed-buzz-runtime.md"),
    source("app/settings/buzz/page.tsx"),
  ]);

  assert.match(runtime, /Settings → Integrations → Buzz/);
  assert.match(runtime, /PPF remains the canonical creative record/);
  assert.match(runtime, /GitHub remains the canonical code repository and pull-request authority/);
  assert.match(runtime, /private keys and service secrets never enter PPF projects/);
  assert.match(brief, /Reports \| Collab · Buzz \| Settings/);
  assert.match(brief, /Collab.*Story Proposals/s);
  assert.match(brief, /Buzz.*rooms, conversations, agents/s);
  assert.match(brief, /Feedback.*permanent structured review/s);
  assert.match(settings, /Settings · Integrations · Buzz/);
  assert.match(settings, /Existing Buzz relay/);
  assert.match(settings, /Managed local Buzz/);
  assert.match(settings, /Save encrypted connection/);
});

test("issue #210 does not pretend unverified native Buzz binaries are packaged", async () => {
  const [runtime, workspace, settings, packagingReadme] = await Promise.all([
    source("lib/buzz-runtime.ts"),
    source("app/buzz-workspace.tsx"),
    source("app/settings/buzz/page.tsx"),
    source("runtime/buzz/README.md"),
  ]);

  assert.match(runtime, /packaged: false/);
  assert.match(workspace, /managed runtime/i);
  assert.match(settings, /pinned verified bundle/i);
  assert.match(packagingReadme, /pinned/i);
  assert.match(packagingReadme, /clean-machine/i);
});

test("issue #210 locks coding agents behind isolated worktrees and human-controlled publishing", async () => {
  const brief = await source("docs/issue-210-managed-buzz-runtime.md");
  assert.match(brief, /explicit Developer Mode/);
  assert.match(brief, /isolated worktree/);
  assert.match(brief, /cannot read the PlotPickle credential vault/);
  assert.match(brief, /Changes are branch-only/);
  assert.match(brief, /Tests run before publishing/);
  assert.match(brief, /Collab remains the human approval and merge surface/);
});
