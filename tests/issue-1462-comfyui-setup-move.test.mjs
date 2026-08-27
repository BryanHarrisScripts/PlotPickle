import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (relative) => readFile(new URL(relative, root), "utf8");

const moved = [
  ["build/comfyui-onboarding-gateway.ts", "build/ai/comfyui-onboarding-gateway.ts"],
  ["build/comfyui-sdxl-starter-gateway.ts", "build/ai/comfyui-sdxl-starter-gateway.ts"],
];

test("#1462 retires the flat ComfyUI setup gateways without compatibility shims", async () => {
  for (const [source, target] of moved) {
    await assert.rejects(access(new URL(source, root)), `${source} must be retired after the move`);
    await access(new URL(target, root));
  }

  const composition = await read("build/local-ai-gateway.ts");
  assert.match(composition, /\.\/ai\/comfyui-onboarding-gateway/);
  assert.match(composition, /\.\/ai\/comfyui-sdxl-starter-gateway/);
  assert.doesNotMatch(composition, /from "\.\/comfyui-onboarding-gateway"/);
  assert.doesNotMatch(composition, /from "\.\/comfyui-sdxl-starter-gateway"/);
});

test("#1462 preserves explicit local ComfyUI onboarding and managed-first fallback", async () => {
  const onboarding = await read("build/ai/comfyui-onboarding-gateway.ts");

  for (const contract of [
    'const START_PATH = "/api/media-routing/comfyui/start"',
    'const LOCAL_COMFY_URL = "http://127.0.0.1:8188"',
    "isLocalRequest(request)",
    'request.method === "GET"',
    "body.approved !== true",
    "launchComfyWithManagedCli()",
    "return startWithDesktopFallback()",
    "install-local-ai-tool.ps1",
    '"-CheckOnly"',
    "start-comfyui-background.ps1",
    '"-AllowDesktopLaunch"',
  ]) assert.ok(onboarding.includes(contract), `Missing onboarding contract: ${contract}`);

  assert.ok(onboarding.indexOf("launchComfyWithManagedCli()") < onboarding.indexOf("return startWithDesktopFallback()"));
  assert.match(onboarding, /from "\.\.\/comfyui-connection-diagnostics"/);
  assert.doesNotMatch(onboarding, /shell\s*:\s*true|winget\s+install|git\s+clone/i);
});

test("#1462 preserves reviewed SDXL metadata, local-only approval and shell-free install", async () => {
  const starter = await read("build/ai/comfyui-sdxl-starter-gateway.ts");

  for (const contract of [
    'const STARTER_PATH = "/api/media-routing/comfyui/sdxl-starter"',
    'fileName: "sd_xl_base_1.0.safetensors"',
    "sizeBytes: 6_938_078_334",
    'sha256: "31e35c80fc4829d14f90153f4c74cd59c90b779f6afe05a74cd6120b893f7e5b"',
    'license: "OpenRAIL++"',
    "received > 4 * 1024",
    ".approved === true",
    'spawn("powershell.exe"',
    "shell: false",
    '"-Approved"',
  ]) assert.ok(starter.includes(contract), `Missing reviewed SDXL starter contract: ${contract}`);

  assert.match(starter, /remoteAddress === "127\.0\.0\.1"/);
  assert.match(starter, /new URL\(origin\)\.host === hostUrl\.host/);
  assert.doesNotMatch(starter, /body\.(url|source|destination|command|path)/);
});

test("#1462 keeps the larger AI move batch open after the ComfyUI setup slice", async () => {
  const config = JSON.parse(await read("config/repository-architecture-target.json"));
  const batch = config.moveBatches.find((item) => item.id === "phase1-build-ai");
  assert.notEqual(batch?.status, "completed", "the AI batch must remain open until every ratified AI root is moved");
});
