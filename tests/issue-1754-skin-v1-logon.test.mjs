import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { stripTypeScriptTypes } from "node:module";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

async function missing(relative) {
  await assert.rejects(access(path.join(root, relative)));
}

test("#1754 names the existing UI Legacy Skin and starts the new architecture at Skin V1", async () => {
  const [runtime, layout, css] = await Promise.all([
    read("app/skin-v1-runtime.tsx"),
    read("app/layout.tsx"),
    read("app/skin-v1.css"),
  ]);

  assert.match(runtime, /SKIN_V1 = "skin-v1"/u);
  assert.match(runtime, /LEGACY_SKIN = "legacy"/u);
  assert.match(runtime, /pathname === "\/skin-v1"/u);
  assert.match(runtime, /explicit === LEGACY_SKIN/u);
  assert.match(runtime, /localStorage\.setItem\(SKIN_STORAGE_KEY, LEGACY_SKIN\)/u);
  assert.match(runtime, /if \(url\.pathname === "\/"\)[\s\S]*stored === LEGACY_SKIN[\s\S]*window\.location\.replace\("\/skin-v1"\)/u);
  assert.match(layout, /<SkinV1Runtime \/>/u);
  assert.match(layout, /<LegacyDemoBoundary>/u);
  assert.match(layout, /<ProfileAccessRouter>/u);
  assert.match(layout, /<LegacySkinOnly>/u);
  assert.match(css, /data-plotpickle-skin="skin-v1"/u);
  assert.match(css, /#000/u);
  assert.match(css, /#fff/u);
  await missing("app/v2/page.tsx");
  await missing("app/barebones-skin-runtime.tsx");
});

test("#1754 LOGON is a headless Business Use Case with ephemeral credentials", async () => {
  const [contract, useCase, gateway, registry] = await Promise.all([
    read("core/contracts/experience.ts"),
    read("lib/experience/logon-use-case.ts"),
    read("adapters/experience/browser-profile-auth-gateway.ts"),
    read("lib/experience/surface-registry.ts"),
  ]);

  for (const intent of ["AuthenticateHuman", "CreateFirstHumanProfile", "CompleteFirstHumanProfileSetup"]) {
    assert.match(contract, new RegExp(`type: "${intent}"`, "u"));
  }
  assert.match(contract, /locator: string/u);
  assert.match(contract, /displayName: string/u);
  assert.doesNotMatch(contract, /password|passphrase|credential|recoverySecret|bootstrapProof/u);

  assert.match(useCase, /ExperienceAuthGateway/u);
  assert.match(useCase, /executeAuthenticateHumanIntent/u);
  assert.match(useCase, /executeCreateFirstHumanProfileIntent/u);
  assert.match(useCase, /executeCompleteFirstHumanProfileSetupIntent/u);
  assert.match(useCase, /projectLogonViewModel/u);
  assert.match(useCase, /PROFILE_LOCATOR_REQUIRED/u);
  assert.match(useCase, /PROFILE_CREDENTIAL_TOO_WEAK/u);
  assert.match(useCase, /SERVER_BOOTSTRAP_PROOF_REQUIRED/u);
  assert.match(useCase, /RECOVERY_ACKNOWLEDGEMENT_REQUIRED/u);
  assert.doesNotMatch(useCase, /fetch\(|window\.|document\.|react/u);

  assert.match(gateway, /fetch\("\/api\/auth\/profile"/u);
  assert.match(gateway, /action: "create-first-profile"/u);
  assert.match(gateway, /hydrateProfilePrivateBrowser/u);
  assert.match(gateway, /migrateLegacyBrowserProjects/u);
  assert.match(gateway, /password: input\.credential/u);
  assert.match(gateway, /password: credential/u);

  assert.match(contract, /\| "DASHBOARD"/u);
  assert.doesNotMatch(contract, /\| "HOME"/u);
  assert.match(registry, /authenticated \? "DASHBOARD" : "LOGON"/u);
  assert.match(registry, /NOT_MIGRATED_TO_HEADLESS_EXPERIENCE/u);
  assert.doesNotMatch(registry, /react|window\.|document\.|fetch\(/i);
});

test("#1754 Skin V1 owns fresh setup, LOGON and a keyboard-selectable BBS Dashboard with Community access", async () => {
  const [skin, css, router, legacyOnly] = await Promise.all([
    read("app/skin-v1/skin-v1-client.tsx"),
    read("app/skin-v1.css"),
    read("app/profile-access/profile-access-router.tsx"),
    read("app/legacy-skin-only.tsx"),
  ]);

  assert.match(skin, /type: "AuthenticateHuman"/u);
  assert.match(skin, /type: "CreateFirstHumanProfile"/u);
  assert.match(skin, /type: "CompleteFirstHumanProfileSetup"/u);
  assert.match(skin, /executeAuthenticateHumanIntent/u);
  assert.match(skin, /executeCreateFirstHumanProfileIntent/u);
  assert.match(skin, /executeCompleteFirstHumanProfileSetupIntent/u);
  assert.match(skin, /RECOVERY SECRET \/ SAVE THIS NOW/u);
  assert.match(skin, /deriveExperienceSurfaceTopology/u);
  assert.match(skin, /data-experience-surface="LOGON"/u);
  assert.match(skin, /aria-label="PlotPickle Dashboard"/u);
  assert.match(skin, /role="listbox"/u);
  assert.match(skin, /role="option"/u);
  assert.match(skin, /event\.key === "ArrowDown"/u);
  assert.match(skin, /event\.key === "ArrowUp"/u);
  assert.match(skin, /MENU ITEMS ARE NOT CONNECTED YET/u);

  const expectedMenu = [
    "Dashboard",
    "Community",
    "Library",
    "Plan",
    "Storyboard",
    "Previs",
    "Write",
    "Edit",
    "Feedback",
    "Refine",
    "Reports",
    "Settings",
    "Profile",
    "Learn - Education",
    "Wyrmwood - Learning Game",
    "Story - The Unwritten",
  ];
  let previousIndex = -1;
  for (const label of expectedMenu) {
    const index = skin.indexOf(`label: "${label}"`);
    assert.ok(index > previousIndex, `${label} must appear in the canonical Dashboard menu order`);
    previousIndex = index;
  }

  assert.match(css, /\.pp-skin-v1-menu-item\.is-selected[\s\S]*background: #fff;[\s\S]*color: #000;/u);
  assert.match(css, /\.pp-skin-v1-menu-item\.is-group-start/u);
  assert.doesNotMatch(skin, /href=|<Link|router\.|window\.location/u);
  assert.doesNotMatch(skin, /fetch\(|\/api\/auth\/profile|hydrateProfilePrivateBrowser|saveFoundationProject|skin=legacy/u);

  assert.match(router, /isSkinV1Path/u);
  assert.match(router, /return <>\{children\}<\/>/u);
  assert.match(legacyOnly, /if \(skinV1\(pathname\)\) return null/u);
});

test("#1754 headless authentication returns the registered surface and keeps credentials ephemeral", async () => {
  const load = async (file) => import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(await read(file))).toString("base64")}`);
  const logon = await load("lib/experience/logon-use-case.ts");
  const registry = await load("lib/experience/surface-registry.ts");
  const profile = { profileId: "human-1", displayName: "Test Human", avatarRef: null, status: "active" };
  const locked = { configured: true, authenticated: false, accessMode: "desktop-loopback", profiles: [profile], profile: null, serverReady: true, readinessReasons: [] };
  const authenticated = { ...locked, authenticated: true, profile };
  let calls = 0;
  const gateway = {
    read: async () => locked,
    authenticate: async (locator, credential) => {
      calls += 1;
      assert.equal(locator, profile.profileId);
      assert.equal(credential, "ephemeral-test-credential");
      return authenticated;
    },
  };
  const intent = { type: "AuthenticateHuman", intentId: "auth-1", locator: profile.profileId, baseRevision: null };
  const denied = await logon.executeAuthenticateHumanIntent({ intent, credential: "", gateway });
  assert.equal(denied.result.reason, "PROFILE_CREDENTIAL_REQUIRED");
  assert.equal(calls, 0);
  assert.equal(denied.view.surface, registry.deriveExperienceSurfaceTopology(locked).defaultSurface);
  const accepted = await logon.executeAuthenticateHumanIntent({ intent, credential: "ephemeral-test-credential", gateway });
  assert.equal(accepted.result.outcome, "accepted");
  assert.equal(accepted.view.surface, registry.deriveExperienceSurfaceTopology(authenticated).defaultSurface);
  assert.equal(accepted.view.surface, "DASHBOARD");
  assert.deepEqual(JSON.parse(JSON.stringify(accepted)), accepted);
  assert.ok(!JSON.stringify(accepted).includes("ephemeral-test-credential"));

  const completion = { type: "CompleteFirstHumanProfileSetup", intentId: "setup-1", profileId: profile.profileId, baseRevision: null };
  const unacknowledged = await logon.executeCompleteFirstHumanProfileSetupIntent({ intent: completion, credential: "ephemeral-test-credential", recoverySaved: false, gateway });
  assert.equal(unacknowledged.result.reason, "RECOVERY_ACKNOWLEDGEMENT_REQUIRED");
  assert.equal(calls, 1);
  const completed = await logon.executeCompleteFirstHumanProfileSetupIntent({ intent: completion, credential: "ephemeral-test-credential", recoverySaved: true, gateway });
  assert.equal(completed.view.surface, "DASHBOARD");
  assert.equal(calls, 2);

  const fresh = { ...locked, configured: false, profiles: [], accessMode: "server-network" };
  let creations = 0;
  const setupGateway = {
    ...gateway,
    read: async () => fresh,
    createFirstProfile: async (input) => {
      creations += 1;
      assert.equal(input.bootstrapProof, "ephemeral-bootstrap-proof");
      return { profile, recoverySecret: "one-time-recovery", snapshot: locked };
    },
  };
  const setupInput = {
    intent: { type: "CreateFirstHumanProfile", intentId: "create-1", displayName: profile.displayName, baseRevision: null },
    credential: "ephemeral-test-credential", confirmation: "ephemeral-test-credential",
    bootstrapProof: "", gateway: setupGateway,
  };
  const blocked = await logon.executeCreateFirstHumanProfileIntent(setupInput);
  assert.equal(blocked.result.reason, "SERVER_BOOTSTRAP_PROOF_REQUIRED");
  assert.equal(creations, 0);
  const created = await logon.executeCreateFirstHumanProfileIntent({ ...setupInput, bootstrapProof: "ephemeral-bootstrap-proof" });
  assert.equal(creations, 1);
  assert.equal(created.result.outcome, "accepted");
  assert.equal(created.view.surface, "LOGON");
  assert.equal(created.recovery.recoverySecret, "one-time-recovery");
  const projection = JSON.stringify({ result: created.result, view: created.view });
  for (const secret of ["ephemeral-test-credential", "ephemeral-bootstrap-proof", "one-time-recovery"]) assert.ok(!projection.includes(secret));
});

test("Profile keeps three entries and Local AI opens a default-first task and engine submenu", async () => {
  const [skin, host, comfy, css, runtimeManager, mediaStore, ltxGateway] = await Promise.all([
    read("app/skin-v1/skin-v1-client.tsx"),
    read("app/skin-v1/local-ai-skin-host.tsx"),
    read("app/skin-v1/local-comfyui-panel.tsx"),
    read("app/skin-v1.css"),
    read("build/local-runtime-manager.ts"),
    read("build/media-routing-store.ts"),
    read("build/ai/comfyui-ltx-local-gateway.ts"),
  ]);
  assert.match(skin, /id === "profile"[\s\S]*setProfileMenuOpen\(true\)/u);
  const entries = skin.slice(skin.indexOf("const PROFILE_MENU ="), skin.indexOf("const LOADING_VIEW"));
  for (const [id, label, description, enabled] of [
    ["profile", "PROFILE", "YOUR PROFILE", "false"],
    ["local-ai", "LOCAL AI", "LOCAL CONFIGURATIONS", "true"],
    ["node", "NODE", "NODE INFO", "false"],
  ]) {
    assert.ok(entries.includes(`id: "${id}", label: "${label}", description: "${description}", enabled: ${enabled}`));
  }
  const options = skin.slice(skin.indexOf("{PROFILE_MENU.map"), skin.indexOf('id="profile-menu-status"'));
  assert.match(options, /disabled=!\{item\.enabled\}|disabled=\{!item\.enabled\}/u);
  assert.match(options, /item\.id === "local-ai"[\s\S]*setLocalAiOpen\(true\)/u);
  assert.match(skin, /LocalAiSkinHost/u);
  assert.match(skin, /aria-label="Local AI setup"/u);
  assert.match(skin, /Back to Profile/u);
  assert.match(skin, /LOCAL AI CONNECTED — PROFILE \/ NODE ARE NOT WIRED YET/u);
  assert.match(skin, /localAiHeadingRef\.current\?\.focus\(\)/u);

  assert.match(host, /PLOTPICKLE DEFAULT/u);
  assert.match(host, /AUTOMATIC \/ HARDWARE OPTIMIZED/u);
  assert.match(host, /title="TASKS"/u);
  assert.match(host, /title="ENGINES"/u);
  for (const label of ["WRITING", "IMAGES", "VIDEO", "OLLAMA", "COMFYUI", "MINIMAX H3"]) assert.match(host, new RegExp(`label: "${label}"`, "u"));
  assert.match(host, /function StatusLight/u);
  assert.match(host, /local default ready/u);
  assert.match(host, /data-local-ai-view="menu"/u);
  assert.match(host, /BACK TO LOCAL AI/u);
  assert.match(host, /<AiRoutingPanel capability="text" locality="local" onManage=\{manageRoute\} \/>/u);
  assert.match(host, /<AiRoutingPanel capability="image" locality="local" onManage=\{manageRoute\} \/>/u);
  assert.match(host, /<AiRoutingPanel capability="video" locality="local" onManage=\{manageRoute\} \/>/u);
  assert.match(host, /<LocalRuntimePanel \/>/u);
  assert.match(host, /<LocalComfyUiPanel \/>/u);
  assert.match(host, /<H3NativePanel \/>/u);
  assert.doesNotMatch(host, /AiComputeWorkspace/u);
  assert.match(host, /Opening Local AI does not change an existing route/u);
  assert.match(host, /does not silently fall back to a paid cloud provider/u);
  assert.doesNotMatch(host, /AiProviderSetupPanel|GeminiProviderSetupPanel/u);

  assert.match(runtimeManager, /preferredRuntime: "auto"/u);
  assert.match(runtimeManager, /modelPreference: "balanced"/u);
  assert.match(runtimeManager, /contextTokens: 16384/u);
  assert.match(mediaStore, /imageRoute: "comfyui"/u);
  assert.match(mediaStore, /videoRoute: "none"/u);
  assert.match(ltxGateway, /return media\.videoRoute === "none"/u);

  assert.match(comfy, /\/api\/provider-diagnostics\/comfyui/u);
  assert.match(comfy, /\/api\/media-routing/u);
  assert.match(comfy, /imageRoute: "comfyui"/u);
  assert.match(comfy, /route: "comfyui"/u);
  assert.match(comfy, /does not enable or contact a cloud AI provider/u);
  assert.doesNotMatch(comfy, /api\.openai\.com|generativelanguage\.googleapis\.com|api\.minimax/u);

  assert.match(css, /--pp-matrix-deep: #123524/u);
  assert.match(css, /--pp-matrix-mid: #287a4b/u);
  assert.match(css, /--pp-matrix-light: #79bd92/u);
});
