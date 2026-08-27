from pathlib import Path
import subprocess

ROOT = Path.cwd()


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace(path: str, old: str, new: str) -> None:
    content = read(path)
    if old not in content:
        raise SystemExit(f"Expected text not found in {path}: {old}")
    write(path, content.replace(old, new))


subprocess.run([
    "git", "mv",
    "build/local-ai-gateway-base.ts",
    "build/ai/local-ai-gateway-base.ts",
], check=True)

replace(
    "build/ai/local-ai-gateway-base.ts",
    'from "./local-credentials"',
    'from "../local-credentials"',
)
replace(
    "build/local-ai-gateway.ts",
    'from "./local-ai-gateway-base"',
    'from "./ai/local-ai-gateway-base"',
)

for path in [
    "config/credential-boundary.registry.json",
    "tests/issue-177-graphic-novel-queue.test.mjs",
    "tests/issue-254-graphic-novel-asset-versions.test.mjs",
    "tests/issue-299-credential-boundary-audit.test.mjs",
]:
    replace(path, "build/local-ai-gateway-base.ts", "build/ai/local-ai-gateway-base.ts")

contract_path = "tests/issue-1462-build-domain-consolidation.test.mjs"
contract = read(contract_path)
marker = '''const ltxAiMoved = [\n  ["build/comfyui-ltx-local-gateway.ts", "build/ai/comfyui-ltx-local-gateway.ts"],\n  ["build/comfyui-ltx-local-provider.ts", "build/ai/comfyui-ltx-local-provider.ts"],\n];\n'''
addition = marker + '''\nconst localAiBaseMoved = [\n  ["build/local-ai-gateway-base.ts", "build/ai/local-ai-gateway-base.ts"],\n];\n'''
if marker not in contract:
    raise SystemExit("LTX move marker missing from #1462 contract")
contract = contract.replace(marker, addition, 1)
contract += '''\n\ntest("#1462 Local AI base retires the flat implementation while preserving credential and local-request boundaries", async () => {\n  for (const [source, target] of localAiBaseMoved) {\n    await assert.rejects(access(new URL(source, root)), `${source} must be retired after the Local AI base move`);\n    await access(new URL(target, root));\n  }\n\n  const [localAi, base, registryText] = await Promise.all([\n    read("build/local-ai-gateway.ts"),\n    read("build/ai/local-ai-gateway-base.ts"),\n    read("config/credential-boundary.registry.json"),\n  ]);\n  assert.match(localAi, /\\.\\/ai\\/local-ai-gateway-base/);\n  assert.doesNotMatch(localAi, /from "\\.\\/local-ai-gateway-base"/);\n  assert.match(base, /from "\\.\\.\\/local-credentials"/);\n  assert.match(base, /function isLocalRequest/);\n  assert.match(base, /MAX_ASSET_BYTES = 20 \\* 1024 \\* 1024/);\n  assert.match(base, /MAX_VIDEO_BYTES = 150 \\* 1024 \\* 1024/);\n  assert.match(base, /function cleanProviderError/);\n  assert.match(base, /\\[redacted\\]/);\n  assert.match(base, /let imageRequestActive = false/);\n  assert.match(registryText, /build\\/ai\\/local-ai-gateway-base\\.ts/);\n  assert.doesNotMatch(registryText, /"source": "build\\/local-ai-gateway-base\\.ts"/);\n\n  const config = JSON.parse(await read("config/repository-architecture-target.json"));\n  const batch = config.moveBatches.find((item) => item.id === "phase1-build-ai");\n  assert.notEqual(batch?.status, "completed", "the AI batch must remain open while ratified root AI files remain");\n});\n'''
write(contract_path, contract)

log_path = "docs/architecture/PHASE-1-MOVE-LOG.md"
log = read(log_path)
log += '''\n\n## #1462 — Local AI base slice\n\nStatus: **candidate; AI batch remains in progress**\n\nMove boundary:\n- `build/local-ai-gateway-base.ts` → `build/ai/local-ai-gateway-base.ts`\n\nRuntime/import consumers updated:\n- `build/local-ai-gateway.ts` imports the base implementation from the AI domain.\n- the moved implementation reaches root-owned credential storage through an explicit parent import.\n\nCredential / source-contract consumers updated:\n- `config/credential-boundary.registry.json`\n- `tests/issue-177-graphic-novel-queue.test.mjs`\n- `tests/issue-254-graphic-novel-asset-versions.test.mjs`\n- `tests/issue-299-credential-boundary-audit.test.mjs`\n- `tests/issue-1462-build-domain-consolidation.test.mjs`\n\nBehavior boundary:\n- Local-only request checks, request-size bounds, provider redaction, image serialization and asset/video persistence remain unchanged.\n- Credential ownership and encrypted storage behavior remain unchanged; only the registry source path follows the implementation move.\n- No compatibility shim remains at `build/local-ai-gateway-base.ts`.\n- `build/ai/` returns to the ratified maximum of 16 direct source files, so subsequent AI moves must create or use bounded AI subdomains rather than weaken the ceiling.\n- The larger `phase1-build-ai` batch intentionally remains incomplete until every remaining ratified root AI source is moved and exact-head green.\n'''
write(log_path, log)

allowed_old_path_files = {
    ".github/scripts/issue-1462-local-ai-base-move.py",
    "config/repository-architecture-target.json",
    "docs/architecture/PHASE-1-MOVE-LOG.md",
    "tests/issue-1462-build-domain-consolidation.test.mjs",
}
result = subprocess.run(
    ["git", "grep", "-n", "--fixed-strings", "build/local-ai-gateway-base.ts", "--", "."],
    text=True,
    capture_output=True,
)
if result.returncode not in (0, 1):
    raise SystemExit(result.stderr)
unexpected = []
for line in result.stdout.splitlines():
    path = line.split(":", 1)[0]
    if path not in allowed_old_path_files:
        unexpected.append(line)
if unexpected:
    raise SystemExit("Unexpected retired Local AI base path remains:\n" + "\n".join(unexpected))
