import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("startup uses the resilient v2 Sage health probe", async () => {
  const [entrypoint, diagnostic, guide] = await Promise.all([
    read("build/startup-agent-diagnostics.ts"),
    read("build/startup-agent-diagnostics-runtime-v2.ts"),
    read("modules/creative-room/curriculum-guide.ts"),
  ]);

  assert.match(entrypoint, /startup-agent-diagnostics-runtime-v2/);
  assert.match(diagnostic, /CONVERSATION MODE: PlotPickle\/story craft/);
  assert.match(diagnostic, /cleanDiagnosticSageAnswer/);
  assert.match(diagnostic, /function antiEchoPass/);
  assert.match(diagnostic, /function groundingPass/);
  assert.match(diagnostic, /"outcome"/);
  assert.match(diagnostic, /"decision"/);
  assert.match(diagnostic, /antiEchoState = sage\.antiEcho \? "PASS" : responsePass && sage\.repetitionSafe \? "WARN" : "FAIL"/);
  assert.match(diagnostic, /groundingState = sage\.grounded \? "PASS" : responsePass && sage\.repetitionSafe \? "WARN" : "FAIL"/);
  assert.match(diagnostic, /failed \|\|= !responsePass \|\| !sage\.repetitionSafe/);
  assert.match(diagnostic, /warned \|\|= !sage\.antiEcho \|\| !sage\.grounded/);
  assert.match(diagnostic, /raw startup probe; visible Sage still applies its response repair guard/);
  assert.match(diagnostic, /visible Sage still validates before display/);

  // Runtime advisory softening must not weaken the actual visible Sage guard.
  assert.match(guide, /guideAnswerNeedsRepair/);
  assert.match(guide, /shortSemanticEcho/);
  assert.match(guide, /SAGE_QUALITY_ESCALATION_INSTRUCTION/);
  assert.match(guide, /could not produce a coherent answer after repair/);
});

test("runaway Sage repetition remains a hard startup failure", async () => {
  const diagnostic = await read("build/startup-agent-diagnostics-runtime-v2.ts");

  assert.match(diagnostic, /if \(count >= 3\) return false/);
  assert.match(diagnostic, /Sage repetition guard/);
  assert.match(diagnostic, /sage\.repetitionSafe \? "PASS" : "FAIL"/);
  assert.doesNotMatch(diagnostic, /warned \|\|= !sage\.repetitionSafe/);
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
