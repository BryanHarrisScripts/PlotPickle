import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1837 routes every retained startup diagnostic through the shared scanner boundary", async () => {
  const [first, second, third, scanner] = await Promise.all([
    read("build/startup-agent-diagnostics-runtime.ts"),
    read("build/startup-agent-diagnostics-runtime-v2.ts"),
    read("build/startup-agent-diagnostics-runtime-v3.ts"),
    read("core/security/text-normalization.ts"),
  ]);

  for (const source of [first, second, third]) {
    assert.match(source, /import \{ stripKnownPromptScaffolding \} from "\.\.\/core\/security\/text-normalization";/u);
    assert.match(source, /return stripKnownPromptScaffolding\(value, PROMPT_SCAFFOLD_LABELS\);/u);
    for (const label of ["student_question", "conversation_memory", "project_memory", "curriculum_context"]) {
      assert.ok(source.includes(`"${label}"`), `Missing shared prompt-scaffolding label: ${label}`);
    }
    assert.equal(source.includes("&lt;\\s*"), false, "legacy partial HTML-tag regex must stay retired");
    assert.equal(source.includes("\\\\u003c\\s*"), false, "legacy partial escaped-tag regex must stay retired");
  }

  assert.match(scanner, /export function stripMarkupTags/u);
  assert.match(scanner, /stripMarkupTags\(decodeMarkupDelimitersOnce\(value\)\)/u);
  assert.doesNotMatch(scanner, /new RegExp/u);
});

test("#1837 source contracts use literal membership checks instead of constructing regexes", async () => {
  const contracts = await Promise.all([
    read("tests/issue-212-buzz-dashboard-marketing-alignment.test.mjs"),
    read("tests/issue-447-plan-studio-rail.test.mjs"),
    read("tests/issue-85-product-direction.test.mjs"),
    read("tests/issue-483-feedback-studio.test.mjs"),
    read("tests/issue-88-visual-board-navigation.test.mjs"),
  ]);

  for (const source of contracts) {
    assert.match(source, /\.includes\(/u);
    assert.doesNotMatch(source, /new RegExp/u);
    assert.doesNotMatch(source, /\.(?:replace|replaceAll)\([^\n]*\\&/u);
  }
});

test("#1837 preserves the already-landed workflow, Casebook, randomness and process boundaries", async () => {
  const [targeted, story, casebook, table, writers, releaseSmoke, issueSmoke, spawnCommand] = await Promise.all([
    read(".github/workflows/autonomous-qa-targeted-fix.yml"),
    read(".github/workflows/autonomous-story-reference.yml"),
    read("scripts/casebook-evidence.mjs"),
    read("lib/table-read.ts"),
    read("modules/creative-room/writers-room.ts"),
    read("scripts/windows-release-smoke.mjs"),
    read("scripts/windows-issue-208-smoke.mjs"),
    read("scripts/spawn-command.mjs"),
  ]);

  assert.match(targeted, /ref: \$\{\{ github\.sha \}\}/u);
  assert.doesNotMatch(targeted, /ref: \$\{\{ needs\.resolve\.outputs\.(?:fix_head|failing_head) \}\}/u);
  assert.doesNotMatch(story, /exact_head/u);
  assert.match(casebook, /SCROLL_(?:DOWN|UP)_SOURCE/u);
  assert.doesNotMatch(casebook, /window\.scrollBy\(0, \$\{/u);
  for (const source of [table, writers]) {
    assert.match(source, /globalThis\.crypto/u);
    assert.match(source, /crypto\.randomUUID\(\)/u);
    assert.doesNotMatch(source, /Math\.random\s*\(/u);
  }
  for (const source of [releaseSmoke, issueSmoke]) assert.match(source, /callCdpPageFunction/u);
  assert.match(spawnCommand, /windowsJavaScriptCliInvocation/u);
  assert.doesNotMatch(spawnCommand, /spawn\(\s*["']cmd\.exe/u);
});

test("#1837 keeps retired CodeQL workflow configurations out of the tree and runs this closeout in both gates", async () => {
  for (const path of [".github/workflows/public-security.yml", ".github/workflows/safety.yml"]) {
    await assert.rejects(access(new URL(`../${path}`, import.meta.url)), { code: "ENOENT" });
  }

  const [prGate, productGate] = await Promise.all([
    read(".github/workflows/pr-gate.yml"),
    read(".github/workflows/product-gate.yml"),
  ]);
  for (const gate of [prGate, productGate]) {
    assert.ok(gate.includes("tests/issue-1837-codeql-zero-closeout.test.mjs"));
    assert.ok(gate.includes("tests/issue-1840-codeql-casebook-text-boundary.test.mjs"));
  }
});
