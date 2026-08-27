from pathlib import Path
import subprocess

root = Path('.')

routing = root / 'build/ai-routing-gateway.ts'
text = routing.read_text()
old = 'from "./comfyui-connection-diagnostics"'
new = 'from "./ai/comfyui-connection-diagnostics"'
if old not in text:
    raise SystemExit('Expected root ComfyUI diagnostics import was not found in ai-routing-gateway.ts')
routing.write_text(text.replace(old, new, 1))

bridge = root / 'build/comfyui-connection-diagnostics.ts'
if not bridge.exists():
    raise SystemExit('Expected temporary ComfyUI diagnostics bridge is already absent')
subprocess.run(['git', 'rm', str(bridge)], check=True)

doc = root / 'docs/architecture/PHASE-1-COMFYUI-DIAGNOSTICS-MOVE.md'
doc.write_text('''# Architecture Phase 1 — ComfyUI diagnostics kernel\n\nIssue: #1462\n\nStatus: implementation moved and root compatibility bridge retired; the larger AI batch remains in progress.\n\nMove boundary:\n- implementation: `build/comfyui-connection-diagnostics.ts` → `build/ai/comfyui-connection-diagnostics.ts`\n- `build/ai/provider-diagnostics-gateway.ts` imports the AI-owned implementation directly.\n- `build/ai/comfyui-onboarding-gateway.ts` imports the AI-owned implementation directly.\n- `build/ai-routing-gateway.ts` now imports the AI-owned implementation directly even though that broader routing gateway remains a separate Phase 1 move.\n\nCompatibility retirement:\n- the temporary root `export *` bridge has been removed.\n- no consumer requires `build/comfyui-connection-diagnostics.ts`.\n- source-contract tests read the canonical AI-owned implementation and assert the retired root path stays absent.\n- this retirement does not claim the larger `phase1-build-ai` batch is complete.\n\nPreserved behavior and security:\n- ComfyUI remains restricted to HTTP loopback hosts and defaults to `http://127.0.0.1:8188`.\n- management probing and launch remain shell-free and bounded by the existing time/output limits.\n- Comfy MCP remains optional management only; PlotPickle retains provider choice, consent and generation-routing authority.\n- missing checkpoints, image nodes and workflow nodes remain explicit setup blockers requiring Human confirmation where installation or setup is needed.\n- no paid/cloud fallback is introduced and creative agents receive no arbitrary node-install, model-download, authentication or workflow-execution authority.\n\nStructural evidence:\n- the canonical implementation remains in `build/ai/`; this slice removes one root compatibility file rather than adding another source.\n- `build/ai-routing-gateway.ts` remains at the root until its own bounded Phase 1 move because it has materially broader fan-out.\n\nAcceptance before merge:\n- focused #353, #374, #1083 and #1462 regressions pass.\n- BEN, production build, Repository Architecture Inventory and required exact-head GitHub checks are green.\n- security/review findings are resolved or explicitly non-blocking.\n''')

test = root / 'tests/issue-1462-comfyui-diagnostics-kernel-move.test.mjs'
test.write_text(r'''import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (relative) => readFile(new URL(relative, root), "utf8");

test("#1462 gives the ComfyUI diagnostics implementation one AI-domain owner and retires the root bridge", async () => {
  await access(new URL("build/ai/comfyui-connection-diagnostics.ts", root));
  await assert.rejects(access(new URL("build/comfyui-connection-diagnostics.ts", root)));
  const [diagnostics, provider, onboarding, routing] = await Promise.all([
    read("build/ai/comfyui-connection-diagnostics.ts"),
    read("build/ai/provider-diagnostics-gateway.ts"),
    read("build/ai/comfyui-onboarding-gateway.ts"),
    read("build/ai-routing-gateway.ts"),
  ]);

  assert.match(provider, /from "\.\/comfyui-connection-diagnostics"/);
  assert.match(onboarding, /from "\.\/comfyui-connection-diagnostics"/);
  assert.match(routing, /from "\.\/ai\/comfyui-connection-diagnostics"/);
  assert.doesNotMatch(routing, /from "\.\/comfyui-connection-diagnostics"/);
  assert.match(diagnostics, /import type \{ ComfyWorkflow \} from "\.\.\/media-routing-store"/);
});

test("#1462 preserves local-only ComfyUI trust and explicit setup authority", async () => {
  const diagnostics = await read("build/ai/comfyui-connection-diagnostics.ts");

  for (const contract of [
    'const DEFAULT_BASE_URL = "http://127.0.0.1:8188"',
    'new Set(["127.0.0.1", "localhost", "[::1]", "::1"])',
    "ComfyUI must use a local loopback address",
    "requiresUserConfirmation: true",
    "PlotPickle still owns provider choice, consent and generation routing",
    "never turn a generation request into an automatic third-party node installation",
  ]) assert.ok(diagnostics.includes(contract), `Missing ComfyUI trust contract: ${contract}`);

  assert.doesNotMatch(diagnostics, /shell:\s*true|partner_generate|auth_login|download_model|run_template/i);
});

test("#1462 keeps the AI target within the ratified direct-source ceiling", async () => {
  const config = JSON.parse(await read("config/repository-architecture-target.json"));
  assert.equal(config.structuralCeilings.maxDirectSourceFiles, 16);
  const aiEntries = await import("node:fs/promises").then(({ readdir }) => readdir(new URL("build/ai/", root), { withFileTypes: true }));
  const directSourceCount = aiEntries.filter((entry) => entry.isFile() && /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)).length;
  assert.ok(directSourceCount <= config.structuralCeilings.maxDirectSourceFiles, `build/ai has ${directSourceCount} direct source files, above the ratified ceiling`);
});
''')
