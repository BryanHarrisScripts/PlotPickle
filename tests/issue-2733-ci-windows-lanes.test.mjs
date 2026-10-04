import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2733 splits Windows product proof into impact-selected sub-12-minute lanes", async () => {
  const [architecture, productGate] = await Promise.all([
    read(".github/workflows/architecture-shadow.yml"),
    read(".github/workflows/product-gate.yml"),
  ]);

  const scopeStart = architecture.indexOf("  windows-product-scope:");
  const proofStart = architecture.indexOf("  windows-product-proof:", scopeStart);
  assert.ok(scopeStart >= 0 && proofStart > scopeStart, "Architecture Verification must own one Windows product scope detector");
  const scope = architecture.slice(scopeStart, proofStart);

  for (const lane of ["command", "pi", "story", "media", "voice", "build"]) {
    assert.match(scope, new RegExp(`      ${lane}: \\\${{ steps\\.scope\\.outputs\\.${lane} }}`, "u"), `${lane} scope output`);
    assert.match(architecture, new RegExp(`${lane}: \\\${{ needs\\.windows-product-scope\\.outputs\\.${lane} == 'true' }}`, "u"), `${lane} reusable-workflow input`);
    assert.match(productGate, new RegExp(`      ${lane}:\\n[\\s\\S]*?type: boolean`, "u"), `${lane} workflow_call input`);
  }

  assert.doesNotMatch(scope, /dashboard-bbs-panel/u, "Settings taxonomy-only dashboard edits must not trigger native Windows product lanes");
  assert.match(scope, /Selected Windows lanes:/u, "scope selection must be visible in logs");
  assert.equal((architecture.match(/uses: \.\/\.github\/workflows\/product-gate\.yml/gu) || []).length, 1, "Architecture Verification should invoke Product Gate once");

  const laneJobs = [
    ["settings-command-windows", "Settings Command Windows proof"],
    ["pi-runtime-windows", "Pi runtime Windows proof"],
    ["story-architect-windows", "Story Architect Windows proof"],
    ["media-windows", "Media / FFrames Windows proof"],
    ["local-voice-windows", "Local voice Windows proof"],
    ["windows-build-installer", "Windows build / installer proof"],
  ];
  for (const [id, name] of laneJobs) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(productGate, new RegExp(`  ${id}:\\n[\\s\\S]*?name: ${escapedName}[\\s\\S]*?timeout-minutes: 12`, "u"), `${name} must be independently capped at 12 minutes`);
  }

  const command = productGate.slice(productGate.indexOf("  settings-command-windows:"), productGate.indexOf("  pi-runtime-windows:"));
  assert.match(command, /settings-command-product-proof\.mjs/u);
  assert.doesNotMatch(command, /evaluate-pi-099-compatibility|install-whisper-cpp|fframes-product-proof|npm run build/u);

  const pi = productGate.slice(productGate.indexOf("  pi-runtime-windows:"), productGate.indexOf("  story-architect-windows:"));
  assert.match(pi, /evaluate-pi-099-compatibility\.mjs/u);
  assert.match(pi, /evaluate-pi-durable-adapter\.mjs/u);
  assert.match(pi, /issue-2591-pi-native-mcp/u);
  assert.doesNotMatch(pi, /story-architect-proof|install-whisper-cpp|fframes-product-proof|npm run build/u);

  const story = productGate.slice(productGate.indexOf("  story-architect-windows:"), productGate.indexOf("  media-windows:"));
  assert.match(story, /story-architect-proof\.mjs/u);
  assert.match(story, /checkpoint-proof\.mjs/u);

  const media = productGate.slice(productGate.indexOf("  media-windows:"), productGate.indexOf("  local-voice-windows:"));
  assert.match(media, /fframes-product-proof\.mjs/u);
  assert.match(media, /ltx-bundled-default\.test\.mjs/u);

  const voice = productGate.slice(productGate.indexOf("  local-voice-windows:"), productGate.indexOf("  windows-build-installer:"));
  assert.match(voice, /install-whisper-cpp\.ps1 -Mode Smoke -Approved/u);

  const build = productGate.slice(productGate.indexOf("  windows-build-installer:"));
  assert.match(build, /npm run build/u);
  assert.match(build, /issue-1456-windows-installer\.test\.mjs/u);
});

test("#2733 manual Product Gate keeps every native proof available without serializing one monolith", async () => {
  const productGate = await read(".github/workflows/product-gate.yml");
  assert.match(productGate, /^  workflow_dispatch:/mu);
  for (const lane of ["command", "pi", "story", "media", "voice", "build"]) {
    assert.match(productGate, new RegExp(`if: github\\.event_name == 'workflow_dispatch' \\|\\| inputs\\.${lane}`, "u"));
  }
});
