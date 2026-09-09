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

test("#1754 Skin V1 owns fresh setup, LOGON and the approved keyboard-selectable BBS Dashboard", async () => {
  const [skin, dashboard, css, bbsCss, artRoute, router, legacyOnly] = await Promise.all([
    read("app/skin-v1/skin-v1-client.tsx"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1.css"),
    read("app/skin-v1-bbs-surfaces.css"),
    read("app/api/skin-v1/dashboard-art/route.ts"),
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
  assert.match(skin, /DashboardBbsPanel/u);
  assert.match(skin, /event\.key === "ArrowDown"/u);
  assert.match(skin, /event\.key === "ArrowUp"/u);

  assert.match(dashboard, /aria-label="PlotPickle Dashboard"/u);
  assert.match(dashboard, /pp-skin-v1-dashboard-bbs/u);
  assert.match(dashboard, /role="listbox"/u);
  assert.match(dashboard, /role="option"/u);
  assert.match(dashboard, /\/api\/skin-v1\/dashboard-art/u);
  assert.match(dashboard, /PLOTPICKLE BBS/u);
  assert.match(dashboard, /AI-NATIVE AGENTIC STORY OPERATING SYSTEM/u);
  assert.match(dashboard, /\*\*\* DASHBOARD \*\*\*/u);
  assert.match(dashboard, /Remember: Write dirty, edit clean\. 1 page = 1 minute\./u);
  assert.match(dashboard, /OTHER MENU ITEMS ARE NOT CONNECTED YET/u);

  const expectedMenu = [
    "Community",
    "Story Library",
    "Outline",
    "Storyboard",
    "Previs",
    "Script Writer",
    "Editorial",
    "Script Feedback",
    "Refine & Polish",
    "Script Analytics",
    "Options & Settings",
    "User Profile",
    "Writer's Craft",
    "Wyrmwood Game",
    "Story",
  ];
  let previousIndex = -1;
  for (const label of expectedMenu) {
    const index = skin.indexOf(`label: "${label}"`);
    assert.ok(index > previousIndex, `${label} must appear in the approved Dashboard menu order`);
    previousIndex = index;
  }

  for (const group of ["PLANNING & STRUCTURING", "PRODUCTION & DRAFTING", "PROJECT MANAGEMENT", "INTERACTIVE & LEARNING"]) {
    assert.match(skin, new RegExp(`group: "${group.replace(/[&]/g, "\\&")}"`, "u"));
  }

  assert.match(css, /\.pp-skin-v1-menu-item\.is-selected[\s\S]*background: #fff;[\s\S]*color: #000;/u);
  assert.match(bbsCss, /width: min\(760px, 100%\)/u);
  assert.match(bbsCss, /aspect-ratio: 3 \/ 1/u);
  assert.match(bbsCss, /grid-template-columns: 14px 34px minmax\(150px, 180px\) 12px minmax\(0, 1fr\)/u);
  assert.doesNotMatch(bbsCss, /repeat\(4, minmax\(0, 1fr\)\)/u);
  assert.match(artRoute, /plotpickle-banner-dragon-logo\.jpg/u);
  assert.match(artRoute, /process\.cwd\(\)/u);
  assert.doesNotMatch(artRoute, /https?:\/\//u);
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

test("Profile keeps three entries, enables User Profile, activates Node, and Local AI exposes the LTX engine", async () => {
  const [skin, profilePanel, host, comfy, ltxPanel, nodePanel, css, bbsCss, layout, runtimeManager, mediaStore, ltxGateway, sdxlGateway, starterScript] = await Promise.all([
    read("app/skin-v1/skin-v1-client.tsx"),
    read("app/skin-v1/profile-skin-panel.tsx"),
    read("app/skin-v1/local-ai-skin-host.tsx"),
    read("app/skin-v1/local-comfyui-panel.tsx"),
    read("app/skin-v1/local-ltx-setup-panel.tsx"),
    read("app/skin-v1/node-skin-panel.tsx"),
    read("app/skin-v1.css"),
    read("app/skin-v1-bbs-surfaces.css"),
    read("app/layout.tsx"),
    read("build/local-runtime-manager.ts"),
    read("build/media-routing-store.ts"),
    read("build/ai/comfyui-ltx-local-gateway.ts"),
    read("build/ai/comfyui-sdxl-local-gateway.ts"),
    read("scripts/install-comfyui-sdxl-starter.ps1"),
  ]);
  assert.match(skin, /id === "profile"[\s\S]*setProfileMenuOpen\(true\)/u);
  const entries = skin.slice(skin.indexOf("const PROFILE_MENU ="), skin.indexOf("const LOADING_VIEW"));
  for (const [id, label, description, enabled] of [
    ["profile", "PROFILE", "YOUR PROFILE", "true"],
    ["local-ai", "LOCAL AI", "LOCAL CONFIGURATIONS", "true"],
    ["node", "NODE", "NODE INFO", "true"],
  ]) {
    assert.ok(entries.includes(`id: "${id}", label: "${label}", description: "${description}", enabled: ${enabled}`));
  }
  const options = skin.slice(skin.indexOf("{PROFILE_MENU.map"), skin.indexOf('id="profile-menu-status"'));
  assert.match(options, /item\.id === "profile"[\s\S]*setUserProfileOpen\(true\)/u);
  assert.match(options, /item\.id === "local-ai"[\s\S]*setLocalAiOpen\(true\)/u);
  assert.match(options, /item\.id === "node"[\s\S]*setNodeOpen\(true\)/u);
  assert.match(skin, /ProfileSkinPanel/u);
  assert.match(skin, /LocalAiSkinHost/u);
  assert.match(skin, /NodeSkinPanel/u);
  assert.match(skin, /USER PROFILE/u);
  assert.match(skin, /PROFILE \/ LOCAL AI \/ NODE CONNECTED/u);
  assert.match(skin, /localAiHeadingRef\.current\?\.focus\(\)/u);

  assert.match(profilePanel, /ProfileIdentityPanel/u);
  assert.match(profilePanel, /aria-label="User Profile"/u);
  assert.match(profilePanel, /\/api\/auth\/profile/u);
  assert.match(profilePanel, /X-PlotPickle-CSRF/u);
  for (const action of ["lock", "switch-profile", "logout"]) assert.ok(profilePanel.includes(`leave("${action}")`));
  assert.match(profilePanel, /clearProfilePrivateBrowser/u);
  assert.match(profilePanel, /persistActiveProfileProject/u);
  assert.match(profilePanel, /ADD PROFILE REMAINS A LOGON-GATE ACTION/u);

  assert.match(layout, /import "\.\/skin-v1-bbs-surfaces\.css"/u);
  assert.match(bbsCss, /pp-skin-v1-dashboard-bbs/u);
  assert.match(bbsCss, /width: min\(760px, 100%\)/u);
  assert.match(bbsCss, /background: #000 !important/u);
  assert.match(bbsCss, /pp-skin-v1-profile-surface/u);
  assert.match(bbsCss, /data-profile-identity-surface="v2"/u);

  assert.match(host, /PLOTPICKLE DEFAULT/u);
  assert.match(host, /AUTOMATIC \/ HARDWARE OPTIMIZED/u);
  assert.match(host, /title="TASKS"/u);
  assert.match(host, /title="ENGINES"/u);
  for (const label of ["WRITING", "IMAGES", "VIDEO", "OLLAMA", "COMFYUI", "LTX-VIDEO", "MINIMAX H3"]) assert.match(host, new RegExp(`label: "${label}"`, "u"));
  assert.match(host, /function StatusLight/u);
  assert.match(host, /function fixedLocalImagesReady/u);
  assert.match(host, /function automaticLocalVideoReady/u);
  assert.match(host, /\/api\/media-routing\/status/u);
  assert.match(host, /\/api\/local-ai\/plugins\/video/u);
  assert.doesNotMatch(host, /\/api\/media-routing\/comfyui\/h3\/native\/status/u);
  assert.match(host, /sd_xl_base_1\.0\.safetensors/u);
  assert.match(host, /local default ready/u);
  assert.match(host, /data-local-ai-view="menu"/u);
  assert.match(host, /BACK TO LOCAL AI/u);
  assert.match(host, /<AiRoutingPanel capability="text" locality="local" onManage=\{manageRoute\} \/>/u);
  assert.doesNotMatch(host, /<AiRoutingPanel capability="image"/u);
  assert.match(host, /view === "images" \? <LocalComfyUiPanel \/>/u);
  assert.doesNotMatch(host, /<AiRoutingPanel capability="video"/u);
  assert.match(host, /view === "video" \? <LocalVideoPanel \/>/u);
  assert.match(host, /<LocalRuntimePanel \/>/u);
  assert.match(host, /<LocalComfyUiPanel \/>/u);
  assert.match(host, /view === "ltx" \? <LocalLtxSetupPanel \/>/u);
  assert.match(host, /<LocalH3SetupPanel \/>/u);
  assert.doesNotMatch(host, /AiComputeWorkspace/u);
  assert.match(host, /Opening Local AI does not change an existing route/u);
  assert.match(host, /does not silently fall back to a paid cloud provider/u);
  assert.doesNotMatch(host, /AiProviderSetupPanel|GeminiProviderSetupPanel/u);

  assert.match(ltxPanel, /\/api\/local-ai\/ltx-video/u);
  assert.match(ltxPanel, /\/api\/local-ai\/ltx-video\/manifest/u);
  assert.match(ltxPanel, /\/api\/local-ai\/ltx-video\/test/u);
  assert.match(ltxPanel, /SET UP LTX/u);
  assert.match(ltxPanel, /CHECK AGAIN/u);
  assert.match(ltxPanel, /TEST LOCAL VIDEO/u);
  assert.match(ltxPanel, /LTX (?:CORE )?NODES MISSING/u);
  assert.match(ltxPanel, /LTX MODELS MISSING/u);
  assert.match(ltxPanel, /IMPORT REVIEWED MANIFEST/u);
  assert.doesNotMatch(ltxPanel, /api\.openai\.com|api\.minimax|huggingface\.co/u);

  assert.match(nodePanel, /\/api\/system\/node-control/u);
  assert.match(nodePanel, /\/api\/system\/node-topology/u);
  assert.match(nodePanel, /\/api\/auth\/profile/u);
  assert.match(nodePanel, /PLOTPICKLE_VERSION/u);
  assert.match(nodePanel, /FULL NODE ID/u);
  assert.match(nodePanel, /LIFECYCLE/u);
  assert.match(nodePanel, /CURRENT PROJECT/u);
  assert.match(nodePanel, /READINESS/u);
  assert.match(nodePanel, /background: "#050505"/u);
  assert.match(nodePanel, /border: "1px solid #d8d8d8"/u);
  assert.doesNotMatch(nodePanel, /begin-shutdown|complete-shutdown|block-shutdown/u);

  assert.match(runtimeManager, /preferredRuntime: "auto"/u);
  assert.match(runtimeManager, /modelPreference: "balanced"/u);
  assert.match(runtimeManager, /contextTokens: 16384/u);
  assert.match(mediaStore, /LOCAL_COMFYUI_URL = "http:\/\/127\.0\.0\.1:8188"/u);
  assert.match(mediaStore, /LOCAL_SDXL_CHECKPOINT = "sd_xl_base_1\.0\.safetensors"/u);
  assert.match(mediaStore, /imageRoute: "comfyui"/u);
  assert.match(mediaStore, /checkpoint: LOCAL_SDXL_CHECKPOINT/u);
  assert.match(mediaStore, /value\.comfyui\.checkpoint = LOCAL_SDXL_CHECKPOINT/u);
  assert.match(mediaStore, /videoRoute: "none"/u);
  assert.match(ltxGateway, /return media\.videoRoute === "none"/u);

  assert.match(comfy, /PLOTPICKLE IMAGE DEFAULT/u);
  assert.match(comfy, /COMFYUI \+ SDXL 1\.0/u);
  assert.match(comfy, /activeReady \? "READY" : working === "ready" \? "RUNNING\.\.\." : "RUN"/u);
  assert.match(comfy, /exactSdxlAvailable/u);
  assert.match(comfy, /LOCAL_COMFY_URL = "http:\/\/127\.0\.0\.1:8188"/u);
  assert.match(comfy, /LOCAL_SDXL_CHECKPOINT = "sd_xl_base_1\.0\.safetensors"/u);
  assert.match(comfy, /activeReady = Boolean\(serverReady && nodesReady && modelReady && status\?\.imageRoute === "comfyui"\)/u);
  assert.match(comfy, /not required for READY/u);
  assert.match(comfy, /LOCAL IMAGE DIAGNOSTICS/u);
  assert.doesNotMatch(comfy, /Advanced checkpoint override|chooseCheckpoint|preferredSdxlCheckpoint|SDXL_COMPATIBLE/u);
  assert.doesNotMatch(comfy, /<select|setBaseUrl|onChange=\{\(event\) => setBaseUrl/u);
  assert.doesNotMatch(comfy, /H3NativePanel|api\.openai\.com|generativelanguage\.googleapis\.com|api\.minimax/u);

  assert.match(sdxlGateway, /LOCAL_SDXL_CHECKPOINT/u);
  assert.match(sdxlGateway, /function exactSdxlCheckpoint/u);
  assert.doesNotMatch(sdxlGateway, /SDXL_PATTERN|defaultSdxlCheckpoint/u);
  assert.match(starterScript, /FileName = "sd_xl_base_1\.0\.safetensors"/u);
  assert.doesNotMatch(starterScript, /Find-CompatibleCheckpoint|existing-compatible/u);

  assert.match(css, /--pp-matrix-deep: #123524/u);
  assert.match(css, /--pp-matrix-mid: #287a4b/u);
  assert.match(css, /--pp-matrix-light: #79bd92/u);
});
