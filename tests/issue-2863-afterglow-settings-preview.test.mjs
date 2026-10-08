import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = file => readFile(new URL("../" + file, import.meta.url), "utf8");

test("#2863 Phase 2 Settings owns Afterglow Management directly, not nested inside Library", async () => {
  const settings = await read("app/sage-settings-workspace.tsx");
  assert.match(settings, /"afterglow-management"/u);
  assert.match(settings, /label: "Afterglow Management"/u);
  assert.match(settings, /case "afterglow-management":/u);
  assert.match(settings, /<AfterglowManagementPanel \/>/u);
  assert.match(settings, /Settings · Afterglow Management/u);
  const start = settings.indexOf('label: "AFTERGLOW"');
  const section = settings.slice(start,start+215);
  assert.match(section, /label: "Afterglow Management"/u);
  assert.doesNotMatch(section,/label: "Library"/iu);
});

test("#2863 Phase 2 read-only preview requires hydrated profile and includes all saved working copies", async () => {
  const panel = await read("modules/library/ui/afterglow-management-panel.tsx");
  const authority = await read("core/storage/profile-private-browser.ts");
  assert.match(authority, /export function profilePrivateBrowserReadyFor\(profileId: string\)/u);
  assert.match(authority, /hydratedProfileId === profileId\.trim\(\) && csrfToken/u);
  assert.match(panel, /profilePrivateBrowserReadyFor\(profileId\)/u);
  assert.match(panel, /PROJECT_LIBRARY_ACTIVE_PROFILE_KEY/u);
  assert.match(panel, /listAfterglowExampleProjects\(\)/u);
  assert.match(panel, /start\.map\(summary =>/u);
  assert.match(panel, /loadLibraryProjectSnapshot\(summary\.id\)/u);
  assert.match(panel, /sources: complete/u);
  assert.match(panel, /planAfterglowConsolidation\(/u);
  assert.match(panel, /inventoryFingerprint\(start\) !== inventoryFingerprint\(listAfterglowExampleProjects\(\)\)/u);
  assert.match(panel, /No project, approval, image, or provided example was changed/u);
  assert.match(panel, /mergeShapeConsistent/u);
  assert.match(panel, /conflictCount: result\.conflicts\.length/u);
  assert.match(panel, /reviewCount: result\.needsReview\.length/u);
  assert.match(panel, /localAssetCount: result\.localAssetsToVerify\.length/u);
  assert.doesNotMatch(panel, /createLibraryWorkingCopy|saveActiveLibraryProject|archiveLibraryProject|deleteArchivedLibraryProject|createProfileRecoveryPoint|persistActiveProfileProject|git push|updateGitHub/u);
  assert.doesNotMatch(panel, /onClick=\{[^}]*?Save Master/u);
  assert.match(panel, /Return to Provided Baseline/u);
  assert.match(panel, /The reset action is not yet enabled/u);
  assert.match(panel, /Publish Official Example/u);
  assert.match(panel, /No public publishing action is available on this screen/u);
});

test("#2863 Phase 2 selected story evidence is still protected by read-only preview", async () => {
  const [panel, planner, packed] = await Promise.all([
    read("modules/library/ui/afterglow-management-panel.tsx"),
    read("modules/library/afterglow-consolidation.mjs"),
    read("modules/library/reference/afterglow-packaged-current.ts"),
  ]);
  assert.match(panel, /createAfterglowPackagedCurrentReference\(\)/u);
  assert.match(packed, /hasPromotedAfterglowPackagedSnapshot/u);
  assert.match(planner, /readyForHumanCommit:false,packageModified:false/u);
  assert.match(panel, /without|can't|No project|Review only/iu);
  assert.match(panel, /profileReady\(\)/u);
});

test("#2863 Matrix Settings actually navigates to dedicated Afterglow Management, not Data Recovery", async () => {
  const [dashboard,workspace,menuAudit,webmcpAudit] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/settings-workspace-panel.tsx"),
    read("lib/verification/skin-v1-menu-contract-audit.mjs"),
    read("lib/verification/webmcp-surface-visual-audit.mjs"),
  ]);
  assert.match(dashboard, /id: "afterglow-management"[^\n]*label: "Afterglow Management"/u);
  assert.match(dashboard, /"afterglow-management": "V"/u);
  assert.match(dashboard, /isWorkspaceSettingsId\(item\.id\)/u);
  assert.match(dashboard, /<SettingsWorkspacePanel section=\{settingsWorkspace\} \/>/u);
  assert.match(workspace, /"afterglow-management" \| "afterglow-management"|\| "afterglow-management"/u);
  assert.match(workspace, /value === "afterglow-management"/u);
  assert.match(workspace, /if \(section === "afterglow-management"\) \{/u);
  assert.match(workspace, /data-settings-workspace-surface="afterglow-management"/u);
  assert.match(workspace, /<AfterglowManagementPanel \/>/u);
  assert.doesNotMatch(workspace, /section === "afterglow-management" \? <SettingsReviewSystemPanel/u);
  assert.match(menuAudit, /afterglow-management'\]\\"\)\.focus|afterglow-management/u);
  assert.match(menuAudit, /data-afterglow-management='phase2-preview'/u);
  assert.match(webmcpAudit, /settingsRows\.length === 11/u);
  assert.match(webmcpAudit, /data-recovery,afterglow-management,agents/u);
});
