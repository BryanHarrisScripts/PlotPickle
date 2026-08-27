from pathlib import Path
import subprocess

ROOT = Path.cwd()


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace(path: str, old: str, new: str, *, required: bool = True) -> None:
    content = read(path)
    if required and old not in content:
        raise SystemExit(f"Expected text not found in {path}: {old}")
    write(path, content.replace(old, new))


(ROOT / "build/ai/h3").mkdir(parents=True, exist_ok=True)
subprocess.run([
    "git", "mv",
    "build/ai/comfyui-h3-native-gateway.ts",
    "build/ai/h3/comfyui-h3-native-gateway.ts",
], check=True)
subprocess.run([
    "git", "mv",
    "build/comfyui-h3-native-provider.ts",
    "build/ai/h3/comfyui-h3-native-provider.ts",
], check=True)

replace(
    "build/ai/h3/comfyui-h3-native-gateway.ts",
    'from "../comfyui-h3-native-provider"',
    'from "./comfyui-h3-native-provider"',
)
replace(
    "build/ai/h3/comfyui-h3-native-provider.ts",
    'from "./local-credentials"',
    'from "../../local-credentials"',
)
replace(
    "build/ai/h3/comfyui-h3-native-provider.ts",
    'from "./media-provider-common"',
    'from "../../media-provider-common"',
)
replace(
    "build/local-ai-gateway.ts",
    'from "./ai/comfyui-h3-native-gateway"',
    'from "./ai/h3/comfyui-h3-native-gateway"',
)
replace(
    "build/ai-routing-gateway.ts",
    'from "./comfyui-h3-native-provider"',
    'from "./ai/h3/comfyui-h3-native-provider"',
)

for path in [
    "config/credential-boundary.registry.json",
    "tests/comfyui-live-verification.test.mjs",
    "tests/issue-258-creative-compute-paths.test.mjs",
    "tests/issue-973-comfyui-api-readiness.test.mjs",
    "tests/issue-300-native-h3-credential-registry.test.mjs",
]:
    content = read(path)
    content = content.replace(
        "build/ai/comfyui-h3-native-gateway.ts",
        "build/ai/h3/comfyui-h3-native-gateway.ts",
    )
    content = content.replace(
        "build/comfyui-h3-native-provider.ts",
        "build/ai/h3/comfyui-h3-native-provider.ts",
    )
    write(path, content)

write(
    "tests/issue-1462-h3-native-gateway-move.test.mjs",
    '''import assert from "node:assert/strict";\nimport { access, readFile, readdir } from "node:fs/promises";\nimport test from "node:test";\n\nconst root = new URL("..", import.meta.url);\nconst source = (path) => readFile(new URL(path, root), "utf8");\n\ntest("#1462 gives the native H3 gateway and provider one bounded AI subdomain owner", async () => {\n  await assert.rejects(access(new URL("build/comfyui-h3-native-gateway.ts", root)));\n  await assert.rejects(access(new URL("build/comfyui-h3-native-provider.ts", root)));\n  await assert.rejects(access(new URL("build/ai/comfyui-h3-native-gateway.ts", root)));\n  await access(new URL("build/ai/h3/comfyui-h3-native-gateway.ts", root));\n  await access(new URL("build/ai/h3/comfyui-h3-native-provider.ts", root));\n\n  const [gateway, provider, localGateway, routingGateway] = await Promise.all([\n    source("build/ai/h3/comfyui-h3-native-gateway.ts"),\n    source("build/ai/h3/comfyui-h3-native-provider.ts"),\n    source("build/local-ai-gateway.ts"),\n    source("build/ai-routing-gateway.ts"),\n  ]);\n  assert.match(gateway, /from "\\.\\/comfyui-h3-native-provider"/);\n  assert.match(provider, /from "\\.\\.\\/\\.\\.\\/local-credentials"/);\n  assert.match(provider, /from "\\.\\.\\/\\.\\.\\/media-provider-common"/);\n  assert.match(localGateway, /from "\\.\\/ai\\/h3\\/comfyui-h3-native-gateway"/);\n  assert.match(routingGateway, /from "\\.\\/ai\\/h3\\/comfyui-h3-native-provider"/);\n});\n\ntest("#1462 preserves native H3 local-only authority and reviewed request bounds", async () => {\n  const gateway = await source("build/ai/h3/comfyui-h3-native-gateway.ts");\n  assert.match(gateway, /const API = "\\/api\\/media-routing\\/comfyui\\/h3\\/native"/);\n  assert.match(gateway, /const MAX_REQUEST_BYTES = 4 \\* 1024 \\* 1024/);\n  assert.match(gateway, /value === "127\\.0\\.0\\.1"/);\n  assert.match(gateway, /http:\\/\\/127\\.0\\.0\\.1:8188/);\n  assert.match(gateway, /installsWeights: false/);\n  assert.match(gateway, /installsCustomNodes: false/);\n  assert.match(gateway, /executesDownloadedCode: false/);\n  assert.doesNotMatch(gateway, /child_process|spawn\\(|exec\\(|git clone|pip install/i);\n});\n\ntest("#1462 creates AI subdomain capacity without exceeding the ratified direct-source ceiling", async () => {\n  const target = await source("docs/architecture/REPOSITORY-ARCHITECTURE-TARGET.md");\n  assert.match(target, /no more than \\*\\*16 direct source files\\*\\*/);\n  const entries = await readdir(new URL("build/ai/", root), { withFileTypes: true });\n  const directSourceCount = entries.filter((entry) => entry.isFile() && /\\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)).length;\n  assert.ok(directSourceCount <= 16, `build/ai has ${directSourceCount} direct source files`);\n  assert.ok(directSourceCount <= 15, `H3 subdomain should create at least one direct-source slot; found ${directSourceCount}`);\n\n  const provider = await source("build/ai/h3/comfyui-h3-native-provider.ts");\n  assert.match(provider, /minimax-h3-native/);\n});\n''',
)

log_path = "docs/architecture/PHASE-1-MOVE-LOG.md"
log = read(log_path)
heading = "## #1462 — Native H3 gateway slice"
if heading not in log:
    raise SystemExit("Native H3 move-log section not found")
start = log.index(heading)
new_section = '''## #1462 — Native H3 subdomain capacity slice\n\nStatus: **candidate; AI batch remains in progress**\n\nMove boundary:\n- `build/ai/comfyui-h3-native-gateway.ts` → `build/ai/h3/comfyui-h3-native-gateway.ts`\n- `build/comfyui-h3-native-provider.ts` → `build/ai/h3/comfyui-h3-native-provider.ts`\n\nRuntime/import consumers updated:\n- `build/local-ai-gateway.ts` imports the H3 gateway from its bounded AI subdomain without changing registration order.\n- `build/ai-routing-gateway.ts` imports the H3 provider from the same bounded AI subdomain.\n- the H3 gateway imports its colocated provider directly.\n- the H3 provider reaches root-owned credential and media helpers through explicit two-level parent imports.\n\nSource-contract / registry consumers updated:\n- `config/credential-boundary.registry.json`\n- `tests/comfyui-live-verification.test.mjs`\n- `tests/issue-258-creative-compute-paths.test.mjs`\n- `tests/issue-973-comfyui-api-readiness.test.mjs`\n- `tests/issue-300-native-h3-credential-registry.test.mjs`\n- `tests/issue-1462-h3-native-gateway-move.test.mjs`\n\nBehavior boundary:\n- Native H3 remains loopback/same-origin only and keeps the existing 4 MB request bound.\n- ComfyUI remains fixed to `http://127.0.0.1:8188`; activation still requires the reviewed local readiness prerequisites.\n- H3 setup still installs no weights or custom nodes and executes no downloaded code.\n- `/api/local-ai/generate/video` and native H3 job polling behavior remain unchanged.\n- Credential ownership, redaction, local job persistence and media output rules remain unchanged.\n- No compatibility shim remains at the retired root or direct-AI H3 paths.\n- Moving the H3 pair under `build/ai/h3/` reduces direct `build/ai` pressure below the ratified 16-source ceiling and creates capacity for the remaining Phase 1 AI moves.\n- The larger `phase1-build-ai` batch intentionally remains incomplete until every remaining ratified direct AI source is moved and exact-head green.\n'''
write(log_path, log[:start] + new_section)

# Fail closed if any retired exact path survives in tracked text files.
for retired in [
    "build/ai/comfyui-h3-native-gateway.ts",
    "build/comfyui-h3-native-provider.ts",
]:
    result = subprocess.run(
        ["git", "grep", "-n", "--fixed-strings", retired, "--", "."],
        text=True,
        capture_output=True,
    )
    if result.returncode == 0:
        raise SystemExit(f"Retired H3 path remains:\n{result.stdout}")
    if result.returncode not in (0, 1):
        raise SystemExit(result.stderr)
