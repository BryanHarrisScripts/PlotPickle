import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("startup uses the v4 grounding adapter around the resilient v3 Sage and PLAN health probe", async () => {
  const [entrypoint, adapter, diagnostic, guide] = await Promise.all([
    read("build/startup-agent-diagnostics.ts"),
    read("build/startup-agent-diagnostics-runtime-v4.ts"),
    read("build/startup-agent-diagnostics-runtime-v3.ts"),
    read("modules/creative-room/curriculum-guide.ts"),
  ]);

  assert.match(entrypoint, /startup-agent-diagnostics-runtime-v4/);
  assert.match(adapter, /runStartupAgentDiagnostics as runV3/);
  assert.match(adapter, /onlyGroundingFailed/);
  assert.match(adapter, /verifyCurrentSageGrounding/);
  assert.match(adapter, /essentials-theme/);

  assert.match(diagnostic, /CONVERSATION MODE: PlotPickle\/story craft/);
  assert.match(diagnostic, /cleanDiagnosticSageAnswer/);
  assert.match(diagnostic, /function antiEchoPass/);
  assert.match(diagnostic, /function groundingPass/);
  assert.match(diagnostic, /"outcome"/);
  assert.match(diagnostic, /"decision"/);
  assert.match(diagnostic, /printResult\("Sage anti-echo check", sage\.antiEcho \? "PASS" : "FAIL"/);
  assert.match(diagnostic, /printResult\("Curriculum grounding", sage\.grounded \? "PASS" : "FAIL"/);
  assert.match(diagnostic, /failed \|\|= !responsePass \|\| !sage\.antiEcho \|\| !sage\.repetitionSafe \|\| !sage\.grounded/);

  // v3 still closes the PLAN startup false-negative gap by retrying structured output before failing.
  assert.match(diagnostic, /FOUNDATION_REPAIR_INSTRUCTION/);
  assert.match(diagnostic, /route: "Quality retry"/);
  assert.match(diagnostic, /route: "per-field recovery"/);
  assert.match(diagnostic, /plan\.structured-output-failure/);
  assert.match(diagnostic, /reportStartupFinding/);

  // Startup validation must not weaken the actual visible Sage guard.
  assert.match(guide, /guideAnswerNeedsRepair/);
  assert.match(guide, /shortSemanticEcho/);
  assert.match(guide, /SAGE_QUALITY_ESCALATION_INSTRUCTION/);
  assert.match(guide, /could not produce a coherent answer after repair/);
});

test("runaway Sage repetition remains a hard startup failure", async () => {
  const [adapter, diagnostic] = await Promise.all([
    read("build/startup-agent-diagnostics-runtime-v4.ts"),
    read("build/startup-agent-diagnostics-runtime-v3.ts"),
  ]);

  assert.match(diagnostic, /if \(count >= 3\) return false/);
  assert.match(diagnostic, /Sage repetition guard/);
  assert.match(diagnostic, /sage\.repetitionSafe \? "PASS" : "FAIL"/);
  assert.match(diagnostic, /failed \|\|= !responsePass \|\| !sage\.antiEcho \|\| !sage\.repetitionSafe \|\| !sage\.grounded/);
  assert.match(adapter, /failedChecks\.length === 1 && failedChecks\[0\]\.includes\("Curriculum grounding"\)/);
});

test("Next startup uses proxy instead of the deprecated middleware convention", async () => {
  const proxy = await read("proxy.ts");
  assert.equal(existsSync(new URL("../middleware.ts", import.meta.url)), false);
  assert.match(proxy, /export function proxy\(request: NextRequest\)/);
  assert.match(proxy, /matcher: \["\/"\]/);
  assert.doesNotMatch(proxy, /export function middleware/);
});

test("Vite excludes the vinext RSC shim that produced the inconsistent optimization warning", async () => {
  const config = await read("vite.config.ts");
  assert.match(config, /optimizeDeps/);
  assert.match(config, /exclude: \["vinext\/dist\/shims\/internal\/app-prefetch-fetch-queue\.js"\]/);
});
