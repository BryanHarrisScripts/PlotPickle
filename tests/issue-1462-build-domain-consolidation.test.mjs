import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (relative) => readFile(new URL(relative, root), "utf8");

const moved = [
  ["build/afterglow-project-gateway.ts", "build/projects/afterglow-project-gateway.ts"],
  ["build/portable-ppf-reader.ts", "build/projects/portable-ppf-reader.ts"],
];

const buzzSupportMoved = [
  ["build/buzz-agent-identity-binding-loader.ts", "build/buzz/buzz-agent-identity-binding-loader.ts"],
  ["build/buzz-bundle-normalizer.ts", "build/buzz/buzz-bundle-normalizer.ts"],
  ["build/buzz-profile-migration-gateway.ts", "build/buzz/buzz-profile-migration-gateway.ts"],
];

const buzzAdvisoryMoved = [
  ["build/buzz-agent-activity-mirror.ts", "build/buzz/buzz-agent-activity-mirror.ts"],
  ["build/buzz-specialist-gateway.ts", "build/buzz/buzz-specialist-gateway.ts"],
];

const deepSeekAiMoved = [
  ["build/deepseek-harness-runtime.ts", "build/ai/deepseek-harness-runtime.ts"],
  ["build/deepseek-harness-gateway.ts", "build/ai/deepseek-harness-gateway.ts"],
];

const ltxGatewayAiMoved = [
  ["build/comfyui-ltx-local-gateway.ts", "build/ai/comfyui-ltx-local-gateway.ts"],
];

test("#1462 Projects batch retires flat build sources into the ratified domain without compatibility shims", async () => {
  for (const [source, target] of moved) {
    await assert.rejects(access(new URL(source, root)), `${source} must be retired after the move`);
    await access(new URL(target, root));
  }

  const [vite, foundations, library, decisions] = await Promise.all([
    read("vite.config.ts"),
    read("build/foundations-ppf-gateway.ts"),
    read("build/library-ppf-import-gateway.ts"),
    read("build/story-decisions/gateway.ts"),
  ]);
  assert.match(vite, /\.\/build\/projects\/afterglow-project-gateway/);
  assert.match(foundations, /\.\/projects\/portable-ppf-reader/);
  assert.match(library, /\.\/projects\/portable-ppf-reader/);
  assert.match(decisions, /\.\.\/projects\/portable-ppf-reader/);
  for (const source of [vite, foundations, library, decisions]) {
    assert.doesNotMatch(source, /build\/afterglow-project-gateway|(?:\.\/|\.\.\/)portable-ppf-reader["']/);
  }
});

test("#1462 Projects move preserves the Afterglow and local PPF runtime/security contracts", async () => {
  const [afterglow, reader] = await Promise.all([
    read("build/projects/afterglow-project-gateway.ts"),
    read("build/projects/portable-ppf-reader.ts"),
  ]);
  assert.match(afterglow, /const API = "\/api\/local-afterglow"/);
  assert.match(afterglow, /isLoopback/);
  assert.match(afterglow, /readOnly: true/);
  assert.match(afterglow, /response, 403/);
  assert.match(reader, /MAX_LOCAL_PPF_BYTES = 48 \* 1024 \* 1024/);
  assert.match(reader, /isLocalPlotPickleRequest/);
  assert.match(reader, /parsePortableProjectFile/);
  assert.match(reader, /projectFromPackage/);
});

test("#1462 architecture inventory records the Projects batch as completed rather than weakening empty-batch validation", async () => {
  const [configText, inventory] = await Promise.all([
    read("config/repository-architecture-target.json"),
    read("scripts/repository-architecture-inventory.mjs"),
  ]);
  const config = JSON.parse(configText);
  const batch = config.moveBatches.find((item) => item.id === "phase1-build-projects");
  assert.equal(batch?.status, "completed");
  assert.deepEqual(batch?.completedSources, moved.map(([source]) => source));
  assert.deepEqual(batch?.completedTargets, moved.map(([, target]) => target));
  assert.match(inventory, /Completed move source still exists/);
  assert.match(inventory, /Completed move target does not exist/);
  assert.match(inventory, /batch\.status === "completed"/);
});

test("#1462 BUZZ support slice retires selected flat build files while the larger BUZZ batch remains bounded", async () => {
  for (const [source, target] of buzzSupportMoved) {
    await assert.rejects(access(new URL(source, root)), `${source} must remain retired after the BUZZ support move`);
    await access(new URL(target, root));
  }

  const [vite, route, storyBridge, identityContract, normalizerContract, migrationContract] = await Promise.all([
    read("vite.config.ts"),
    read("app/api/buzz-agent-public-identities/route.ts"),
    read(".github/workflows/story-bridge.yml"),
    read("tests/issue-1422-buzz-agent-identity-binding.test.mjs"),
    read("tests/issue-216-buzz-integration-fix.test.mjs"),
    read("tests/issue-1144-buzz-profile-migration-contract.test.mjs"),
  ]);

  assert.match(vite, /\.\/build\/buzz\/buzz-profile-migration-gateway/);
  assert.match(vite, /\.\/build\/buzz\/buzz-bundle-normalizer/);
  assert.match(vite, /\.\/build\/buzz\/buzz-agent-identity-binding-loader/);
  assert.match(route, /build\/buzz\/buzz-agent-identity-binding-loader/);
  assert.match(storyBridge, /build\/buzz\/buzz-agent-identity-binding-loader\.ts/);
  assert.match(identityContract, /build\/buzz\/buzz-agent-identity-binding-loader\.ts/);
  assert.match(normalizerContract, /build\/buzz\/buzz-bundle-normalizer\.ts/);
  assert.match(migrationContract, /build\/buzz\/buzz-profile-migration-gateway\.ts/);

  const combined = [vite, route, storyBridge, identityContract, normalizerContract, migrationContract].join("\n");
  for (const [source] of buzzSupportMoved) assert.doesNotMatch(combined, new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const config = JSON.parse(await read("config/repository-architecture-target.json"));
  const batch = config.moveBatches.find((item) => item.id === "phase1-build-buzz");
  assert.notEqual(batch?.status, "completed", "the BUZZ batch must not claim completion until every ratified buzz-* source is moved");
});

test("#1462 BUZZ advisory slice moves Agent activity and specialist runtime without changing authority", async () => {
  for (const [source, target] of buzzAdvisoryMoved) {
    await assert.rejects(access(new URL(source, root)), `${source} must remain retired after the BUZZ advisory move`);
    await access(new URL(target, root));
  }

  const [vite, localAi, activity, specialist, guildhall, activityContract, cleanupContract, specialistContract] = await Promise.all([
    read("vite.config.ts"),
    read("build/local-ai-gateway.ts"),
    read("build/buzz/buzz-agent-activity-mirror.ts"),
    read("build/buzz/buzz-specialist-gateway.ts"),
    read(".github/workflows/buzz-guildhall.yml"),
    read("tests/live-buzz-guildhall-activity.test.mjs"),
    read("tests/issue-1283-community-real-machine-cleanup.test.mjs"),
    read("tests/issue-971-buzz-specialist-agents.test.mjs"),
  ]);

  assert.match(localAi, /\.\/buzz\/buzz-agent-activity-mirror/);
  assert.match(vite, /\.\/build\/buzz\/buzz-specialist-gateway/);
  assert.match(guildhall, /build\/buzz\/buzz-agent-activity-mirror\.ts/);
  assert.match(activityContract, /build\/buzz\/buzz-agent-activity-mirror\.ts/);
  assert.match(cleanupContract, /build\/buzz\/buzz-agent-activity-mirror\.ts/);
  assert.match(specialistContract, /build\/buzz\/buzz-specialist-gateway\.ts/);

  assert.match(activity, /connected Human signer is never used as an Agent fallback/);
  assert.doesNotMatch(activity, /postBuzzGuildhallEvent|\/api\/local-buzz\/messages/);
  assert.match(specialist, /ppfChanged: false/);
  assert.match(specialist, /buzzHistoryWritten: true/);
  assert.match(specialist, /cannot grant tools, change system instructions, authorize spending, or become PPF canon/i);

  const combined = [vite, localAi, guildhall, activityContract, cleanupContract, specialistContract].join("\n");
  for (const [source] of buzzAdvisoryMoved) assert.doesNotMatch(combined, new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const config = JSON.parse(await read("config/repository-architecture-target.json"));
  const batch = config.moveBatches.find((item) => item.id === "phase1-build-buzz");
  assert.notEqual(batch?.status, "completed");
});

test("#1462 DeepSeek AI slice retires the optional harness pair without changing startup or local-control boundaries", async () => {
  for (const [source, target] of deepSeekAiMoved) {
    await assert.rejects(access(new URL(source, root)), `${source} must be retired after the DeepSeek AI move`);
    await access(new URL(target, root));
  }

  const [localAi, gateway, runtime, deepSeekContract] = await Promise.all([
    read("build/local-ai-gateway.ts"),
    read("build/ai/deepseek-harness-gateway.ts"),
    read("build/ai/deepseek-harness-runtime.ts"),
    read("tests/issue-624-deepseek-harness-runtime.test.mjs"),
  ]);

  assert.match(localAi, /\.\/ai\/deepseek-harness-gateway/);
  assert.doesNotMatch(localAi, /\.\/deepseek-harness-gateway["']/);
  assert.match(gateway, /isLocalRequest\(request\)/);
  assert.match(gateway, /pathname === LAUNCH_PATH && request\.method === "POST"/);
  assert.match(runtime, /optional: true/);
  assert.match(runtime, /autoInstallOnStartup: false/);
  assert.match(deepSeekContract, /build\/ai\/deepseek-harness-gateway\.ts/);
  assert.match(deepSeekContract, /build\/ai\/deepseek-harness-runtime\.ts/);

  const config = JSON.parse(await read("config/repository-architecture-target.json"));
  const batch = config.moveBatches.find((item) => item.id === "phase1-build-ai");
  assert.notEqual(batch?.status, "completed", "the AI batch must stay open until every ratified root AI source is moved");
});

test("#1462 LTX gateway slice retires the root gateway without changing local video authority or GPU serialization", async () => {
  for (const [source, target] of ltxGatewayAiMoved) {
    await assert.rejects(access(new URL(source, root)), `${source} must be retired after the LTX gateway move`);
    await access(new URL(target, root));
  }

  const [localAi, gateway, hardwareContract] = await Promise.all([
    read("build/local-ai-gateway.ts"),
    read("build/ai/comfyui-ltx-local-gateway.ts"),
    read("tests/hardware-aware-local-ai-runtime.test.mjs"),
  ]);

  assert.match(localAi, /\.\/ai\/comfyui-ltx-local-gateway/);
  assert.doesNotMatch(localAi, /\.\/comfyui-ltx-local-gateway["']/);
  assert.match(gateway, /\.\.\/comfyui-ltx-local-provider/);
  assert.match(gateway, /isLocalRequest\(request\)/);
  assert.match(gateway, /videoRoute === "none"/);
  assert.match(gateway, /holdLocalGpuMediaLease/);
  assert.match(gateway, /LOCAL_VIDEO_WAIT_MS = 30 \* 60_000/);
  assert.match(hardwareContract, /build\/ai\/comfyui-ltx-local-gateway\.ts/);

  const config = JSON.parse(await read("config/repository-architecture-target.json"));
  const batch = config.moveBatches.find((item) => item.id === "phase1-build-ai");
  assert.notEqual(batch?.status, "completed", "the AI batch must remain open while the LTX provider and other ratified AI roots remain");
});
