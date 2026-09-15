import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2071 Generate Lore Avatar starts active and unlocks the grayed prompt before generation", async () => {
  const [panel, skinCss] = await Promise.all([
    read("app/profile-access/profile-identity-panel.tsx"),
    read("app/skin-v1-settings-directory.css"),
  ]);

  assert.match(panel, /const \[avatarPromptEnabled, setAvatarPromptEnabled\] = useState\(false\)/u);
  assert.match(panel, /function beginOrGenerateLoreAvatar\(\)[\s\S]*if \(!avatarPromptEnabled\)[\s\S]*setAvatarPromptEnabled\(true\)[\s\S]*avatarPromptRef\.current\?\.focus\(\)/u);
  assert.match(panel, /aria-expanded=\{avatarPromptEnabled\}/u);
  assert.match(panel, /disabled=\{Boolean\(busy\) \|\| \(avatarPromptEnabled && !avatarDescription\.trim\(\)\)\}/u);
  assert.match(panel, /data-lore-avatar-prompt-state=\{avatarPromptEnabled \? "active" : "inactive"\}/u);
  assert.match(panel, /disabled=\{!avatarPromptEnabled \|\| Boolean\(busy\)\}/u);
  assert.match(skinCss, /\[data-lore-avatar-prompt-state="inactive"\]\s*\{[\s\S]*opacity: 0\.52 !important;/u);
});

test("#2071 generated avatar stays staged until Save Profile persists the whole presentation", async () => {
  const panel = await read("app/profile-access/profile-identity-panel.tsx");
  const generationStart = panel.indexOf("async function generateLoreAvatar");
  const generationEnd = panel.indexOf("async function finishBuzzSetup", generationStart);
  const generation = panel.slice(generationStart, generationEnd);
  const saveStart = panel.indexOf("async function savePresentation");
  const saveEnd = panel.indexOf("function beginOrGenerateLoreAvatar", saveStart);
  const save = panel.slice(saveStart, saveEnd);

  assert.match(generation, /setPresentation\(next\)/u);
  assert.doesNotMatch(generation, /saveLocalPresentation/u);
  assert.doesNotMatch(generation, /onProfileChanged/u);
  assert.match(generation, /Select Save Profile to keep it with this Human profile and the current Display Description/u);
  assert.match(save, /saveLocalPresentation\(presentation\)/u);
  assert.match(save, /await onProfileChanged\(\)/u);
});

test("#2071 Identity readiness mirrors Dashboard visible order while keeping live authorities", async () => {
  const [panel, dashboard, skinCss] = await Promise.all([
    read("app/profile-access/profile-identity-panel.tsx"),
    read("app/skin-v1/dashboard-readiness-rail.tsx"),
    read("app/skin-v1-settings-directory.css"),
  ]);
  const labels = ["BUZZ", "COMMUNITY", "MODELS", "COMFY", "LOCAL", "CLOUD"];

  let profileCursor = -1;
  let dashboardCursor = -1;
  for (const label of labels) {
    const profileIndex = panel.indexOf(`ReadinessIndicator label="${label}"`);
    const dashboardIndex = dashboard.indexOf(`shortLabel: "${label}"`);
    assert.ok(profileIndex > profileCursor, `${label} must stay ordered on Identity`);
    assert.ok(dashboardIndex > dashboardCursor, `${label} must stay ordered on Dashboard`);
    profileCursor = profileIndex;
    dashboardCursor = dashboardIndex;
  }

  assert.match(panel, /const modelsReady = readinessLoaded \? Boolean\(activeProvider/u);
  assert.match(panel, /const localModelReady = readinessLoaded \? Boolean\(localProvider/u);
  assert.match(panel, /const cloudComputeReady = readinessLoaded \? Boolean\(cloudProvider/u);
  assert.match(skinCss, /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\) !important;/u);
  assert.match(skinCss, /font-size: var\(--pp-skin-font-xs\) !important;/u);
});
