import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const FILE_NAME = "sd_xl_base_1.0.safetensors";
const SHA256 = "31e35c80fc4829d14f90153f4c74cd59c90b779f6afe05a74cd6120b893f7e5b";
const SIZE = "6938078334";

test("issue #1022 pins one reviewed official SDXL 1.0 starter", async () => {
  const [installer, gateway] = await Promise.all([
    source("scripts/install-comfyui-sdxl-starter.ps1"),
    source("build/ai/comfyui-sdxl-starter-gateway.ts"),
  ]);

  for (const value of [FILE_NAME, SHA256, SIZE, "OpenRAIL++", "stabilityai/stable-diffusion-xl-base-1.0"]) {
    assert.ok(installer.includes(value), `Installer is missing reviewed SDXL metadata: ${value}`);
  }
  assert.match(installer, /https:\/\/huggingface\.co\/stabilityai\/stable-diffusion-xl-base-1\.0\/resolve\/main\/sd_xl_base_1\.0\.safetensors\?download=true/);
  assert.ok(gateway.includes(FILE_NAME));
  assert.ok(gateway.includes(SHA256));
  assert.match(gateway, /6_938_078_334/);
});

test("issue #1022 resolves the checkpoint destination from Comfy Desktop configuration before bounded managed fallback", async () => {
  const installer = await source("scripts/install-comfyui-sdxl-starter.ps1");
  const sharedIndex = installer.indexOf("shared_model_paths.yaml");
  const managedIndex = installer.indexOf("Resolve-ManagedCheckpointDirectory");

  assert.ok(sharedIndex >= 0, "Comfy Desktop shared-model configuration must be consulted");
  assert.ok(managedIndex > sharedIndex, "managed instance fallback must remain secondary to Desktop's active shared model config");
  assert.match(installer, /base_path/);
  assert.match(installer, /checkpoints/);
  assert.match(installer, /Get-ComfyManagedInstances/);
  assert.match(installer, /\$installed\.Count -ne 1/);
  assert.match(installer, /models\\checkpoints/);
  assert.doesNotMatch(installer, /Get-ChildItem\s+-Path\s+[A-Z]:\\.*-Recurse/i);
});

test("issue #1022 requires explicit approval and only activates a size/hash verified file", async () => {
  const [installer, gateway] = await Promise.all([
    source("scripts/install-comfyui-sdxl-starter.ps1"),
    source("build/ai/comfyui-sdxl-starter-gateway.ts"),
  ]);

  assert.match(installer, /\[switch\]\$Approved/);
  assert.match(installer, /if \(-not \$Approved\)/);
  assert.match(installer, /\.partial/);
  assert.match(installer, /Get-FileHash[^\n]+SHA256/);
  assert.match(installer, /Length -ne \$Starter\.SizeBytes/);
  assert.match(installer, /Move-Item -LiteralPath \$partial -Destination \$DestinationFile/);
  assert.match(installer, /does not match its reviewed size and SHA-256/);
  assert.match(gateway, /async function readApprovalFlag\(request: IncomingMessage\)/);
  assert.match(gateway, /\.approved === true/);
  assert.match(gateway, /if \(!\(await readApprovalFlag\(request\)\)\)/);
  assert.match(gateway, /shell: false/);
  assert.match(gateway, /spawn\("powershell\.exe"/);
  assert.doesNotMatch(gateway, /body\.(url|source|destination|command|path)/);
});

test("issue #1022 makes the reviewed starter discoverable in Settings and verifies locally after install", async () => {
  const [panel, composition] = await Promise.all([
    source("app/media-routing-panel.tsx"),
    source("build/local-ai-gateway.ts"),
  ]);

  assert.ok(panel.includes('const API = "/api/media-routing";'));
  assert.ok(panel.includes('const SDXL_STARTER_API = `${API}/comfyui/sdxl-starter`;'));
  assert.match(panel, /Source: \$\{starter\.sourceLabel\}/);
  assert.match(panel, /Size: \$\{starter\.sizeLabel\}/);
  assert.match(panel, /License: \$\{starter\.license\}/);
  assert.match(panel, /Destination: \$\{starter\.destination\}/);
  assert.match(panel, /SHA-256: \$\{starter\.sha256\}/);
  assert.match(panel, /approved: true/);
  assert.ok(panel.includes('`${API}/test/image`'));
  assert.match(panel, /route: "comfyui"/);
  assert.match(composition, /registerComfyUiSdxlStarterGateway/);
});

test("issue #1022 keeps passive focused verification model-download free", async () => {
  const verifier = await source("scripts/verify-comfyui-live.mjs");
  assert.doesNotMatch(verifier, /comfyui\/sdxl-starter/);
  assert.doesNotMatch(verifier, /install-comfyui-sdxl-starter/);
  assert.match(verifier, /ComfyUI is running but no image checkpoint is available/);
});
