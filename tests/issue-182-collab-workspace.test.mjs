import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #182 adds Collab after the ten creative workspaces without changing their order", async () => {
  const [direction, header] = await Promise.all([
    source("lib/product-direction.ts"),
    source("app/application-shell-header.tsx"),
  ]);
  const primary = direction.slice(
    direction.indexOf("export const PRIMARY_WORKFLOW_NAVIGATION"),
    direction.indexOf("export const COLLABORATION_NAVIGATION"),
  );
  const labels = ["Dashboard", "Learn", "Plan", "Storyboard", "Write", "Pitch", "Build", "Feedback", "Refine", "Reports"];
  assert.equal([...primary.matchAll(/label: "/g)].length, labels.length);
  let previous = -1;
  for (const label of labels) {
    const index = primary.indexOf(`label: "${label}"`);
    assert.ok(index > previous, `Creative workflow changed or lost ${label}`);
    previous = index;
  }
  assert.match(direction, /COLLABORATION_NAVIGATION[\s\S]*id: "collab", label: "Collab"/);
  assert.ok(direction.indexOf("...PRIMARY_WORKFLOW_NAVIGATION") < direction.indexOf("...COLLABORATION_NAVIGATION"));
  assert.ok(direction.indexOf("...COLLABORATION_NAVIGATION") < direction.indexOf('id: "settings"'));
  assert.match(header, /shell-zone-production[\s\S]*shell-zone-collaboration[\s\S]*shell-zone-project-actions[\s\S]*shell-zone-configuration/);
});

test("issue #182 renders one provider-neutral Collab workspace with the approved section names", async () => {
  const [page, workspace, calendarUi, css, router] = await Promise.all([
    source("app/page.tsx"),
    source("app/collab-workspace.tsx"),
    source("app/google-calendar-workspace.tsx"),
    source("app/collab-workspace.module.css"),
    source("app/collaboration-workspace-router.tsx"),
  ]);
  assert.match(page, /import CollabWorkspace/);
  assert.match(page, /collab: "collab"/);
  assert.match(page, /activeTab === "collab"[\s\S]*<CollabWorkspace/);
  for (const label of ["Overview", "Approvals", "Meetings", "Calendar", "Connections"]) {
    assert.match(workspace, new RegExp(`label: "${label}"`));
  }
  assert.match(workspace, /Settings configures services\. Collab uses services\./);
  assert.match(workspace, /GitHub Story Proposals and Project Lead decisions/);
  assert.match(calendarUi, /Project dates only/);
  assert.match(router, /"\/collab": "collab"/);
  for (const selector of [".hero", ".tabs", ".summaryGrid", ".providerGrid", ".emptyState"]) {
    assert.ok(css.includes(selector), `Collab styling is missing ${selector}`);
  }
});

test("issue #182 keeps provider setup in Settings and uses split GitHub surfaces", async () => {
  const [settings, workspace, collaboration, base] = await Promise.all([
    source("app/settings-panel.tsx"),
    source("app/collab-workspace.tsx"),
    source("app/github-collaboration.tsx"),
    source("app/github-collaboration-base.tsx"),
  ]);
  assert.match(settings, /surface="configuration"/);
  assert.match(workspace, /surface="approvals"/);
  assert.match(settings, /Account, repository, permissions and recovery configuration/);
  assert.match(settings, /Sign in with Google/);
  assert.match(settings, /Disconnect and revoke/);
  assert.match(workspace, /Open \{status\.label\} settings/);
  assert.match(workspace, /Settings → GitHub/);
  assert.match(workspace, /Settings → Google Services/);
  assert.doesNotMatch(workspace, /Sign in with Google|Connect GitHub Account|fine-grained GitHub token/);
  assert.match(collaboration, /"configuration" \| "approvals"/);
  assert.match(base, /showConfiguration/);
  assert.match(base, /showApprovals/);
  assert.ok(base.indexOf("GitHubRecoveryCentre") < base.indexOf("showApprovals ?"), "Recovery must remain with Settings configuration");
});

test("issue #182 keeps Google setup in Settings while later phases isolate Calendar execution", async () => {
  const [workspace, calendarUi, status] = await Promise.all([
    source("app/collab-workspace.tsx"),
    source("app/google-calendar-workspace.tsx"),
    source("lib/connection-status.ts"),
  ]);
  assert.doesNotMatch(workspace, /\/api\/local-google|googleapis\.com|accounts\.google\.com/);
  assert.match(workspace, /<GoogleCalendarWorkspace/);
  assert.match(workspace, /Google Meet is the next isolated step/);
  assert.match(calendarUi, /\/api\/local-google\/calendar/);
  assert.doesNotMatch(calendarUi, /googleapis\.com|accounts\.google\.com/);
  assert.match(status, /Google sign-in, Calendar and Meet are optional and disconnected/);
  assert.match(status, /NonSensitiveMeetingMetadata/);
});

test("issue #182 test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-182-collab-workspace\.test\.mjs/);
  assert.equal(packageJson.scripts["test:collab-workspace"], "node --test tests/issue-182-collab-workspace.test.mjs");
});
