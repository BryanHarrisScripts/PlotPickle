import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("startup validates profiles before the v5 health adapter, v4 grounding and resilient v3 probes", async () => {
  const [entrypoint, profileAdapter, contractAdapter, groundingAdapter, diagnostic, guide] = await Promise.all([
    read("build/startup-agent-diagnostics.ts"),
    read("build/startup-agent-diagnostics-runtime-v6.ts"),
    read("build/startup-agent-diagnostics-runtime-v5.ts"),
    read("build/startup-agent-diagnostics-runtime-v4.ts"),
    read("build/startup-agent-diagnostics-runtime-v3.ts"),
    read("modules/creative-room/curriculum-guide.ts"),
  ]);

  assert.match(entrypoint, /startup-agent-diagnostics-runtime-v6/);
  assert.match(profileAdapter, /assertAgentProfilesValid/);
  assert.match(profileAdapter, /runStartupAgentDiagnostics as runV5/);
  assert.match(contractAdapter, /runStartupAgentDiagnostics as runV4/);
  assert.match(contractAdapter, /onlyAntiEchoFailed/);
  assert.match(contractAdapter, /verifySageAntiEcho/);
  assert.match(contractAdapter, /strictAntiEchoPass/);
  assert.match(contractAdapter, /node_modules\/@mastra\/core\/package\.json/);
  assert.match(contractAdapter, /patchMastraVersion/);
  assert.match(contractAdapter, /verified by strict no-restatement probe/);

  assert.match(groundingAdapter, /runStartupAgentDiagnostics as runV3/);
  assert.match(groundingAdapter, /onlyGroundingFailed/);
  assert.match(groundingAdapter, /verifyCurrentSageGrounding/);
  assert.match(groundingAdapter, /essentials-theme/);

  assert.match(diagnostic, /CONVERSATION MODE: PlotPickle\/story craft/);
  assert.match(diagnostic, /cleanDiagnosticSageAnswer/);
  assert.match(diagnostic, /function antiEchoPass/);
  assert.match(diagnostic, /function groundingPass/);
  assert.match(diagnostic, /"outcome"/);
  assert.match(diagnostic, /"decision"/);
  assert.match(diagnostic, /printResult\("Sage anti-echo check", sage\.antiEcho \? "PASS" : "FAIL"/);
  assert.match(diagnostic, /printResult\("Curriculum grounding", sage\.grounded \? "PASS" : "FAIL"/);
  assert.match(diagnostic, /failed \|\|= !responsePass \|\| !sage\.antiEcho \|\| !sage\.repetitionSafe \|\| !sage\.grounded/);

  assert.match(diagnostic, /FOUNDATION_REPAIR_INSTRUCTION/);
  assert.match(diagnostic, /route: "Quality retry"/);
  assert.match(diagnostic, /route: "per-field recovery"/);
  assert.match(diagnostic, /plan\.structured-output-failure/);
  assert.match(diagnostic, /reportStartupFinding/);

  assert.match(guide, /guideAnswerNeedsRepair/);
  assert.match(guide, /shortSemanticEcho/);
  assert.match(guide, /SAGE_QUALITY_ESCALATION_INSTRUCTION/);
  assert.match(guide, /could not produce a coherent answer after repair/);
});

test("runaway Sage repetition remains a hard startup failure", async () => {
  const [contractAdapter, groundingAdapter, diagnostic] = await Promise.all([
    read("build/startup-agent-diagnostics-runtime-v5.ts"),
    read("build/startup-agent-diagnostics-runtime-v4.ts"),
    read("build/startup-agent-diagnostics-runtime-v3.ts"),
  ]);

  assert.match(diagnostic, /if \(count >= 3\) return false/);
  assert.match(diagnostic, /Sage repetition guard/);
  assert.match(diagnostic, /sage\.repetitionSafe \? "PASS" : "FAIL"/);
  assert.match(diagnostic, /failed \|\|= !responsePass \|\| !sage\.antiEcho \|\| !sage\.repetitionSafe \|\| !sage\.grounded/);
  assert.match(groundingAdapter, /failedChecks\.length === 1 && failedChecks\[0\]\.includes\("Curriculum grounding"\)/);
  assert.match(contractAdapter, /failedChecks\.length === 1 && failedChecks\[0\]\.includes\("Sage anti-echo check"\)/);
});

test("Next startup uses proxy instead of the deprecated middleware convention", async () => {
  const proxy = await read("proxy.ts");
  assert.equal(existsSync(new URL("../middleware.ts", import.meta.url)), false);
  assert.match(proxy, /export function proxy\(request: NextRequest\)/);
  assert.match(proxy, /matcher: \["\/"\]/);
  assert.doesNotMatch(proxy, /export function middleware/);
});

test("issue #1404 reconciles root, client, RSC and SSR Vinext optimization", async () => {
  const [config, compatibility] = await Promise.all([
    read("vite.config.ts"),
    read("build/startup/vite-compatibility.ts"),
  ]);

  assert.match(config, /VINEXT_PACKAGE/);
  assert.match(config, /VINEXT_LINK_SHIM/);
  assert.match(config, /VINEXT_PREFETCH_QUEUE_SHIM/);
  assert.match(config, /exclude: \[VINEXT_PACKAGE, VINEXT_LINK_SHIM, VINEXT_PREFETCH_QUEUE_SHIM\]/);
  assert.match(config, /vinextRscOptimizationCompatibilityPlugin\(\)/);

  assert.match(compatibility, /export const VINEXT_PACKAGE = "vinext"/);
  assert.match(compatibility, /export const VINEXT_LINK_SHIM = "vinext\/shims\/link"/);
  assert.match(compatibility, /vinext\/dist\/shims\/internal\/app-prefetch-fetch-queue\.js/);
  assert.match(compatibility, /react-server-dom-webpack\/static\.edge/);
  assert.match(compatibility, /new Set\(\["client", "rsc", "ssr"\]\)/);
  assert.match(compatibility, /configEnvironment\(name, config\)/);
  assert.match(compatibility, /config\.optimizeDeps \?\?= \{\}/);
  assert.match(compatibility, /VINEXT_PACKAGE,[\s\S]*VINEXT_LINK_SHIM,[\s\S]*VINEXT_PREFETCH_QUEUE_SHIM/);
  assert.match(compatibility, /Vinext aliases[\s\S]*next\/link[\s\S]*vinext\/shims\/link/);
  assert.match(compatibility, /name === "rsc"/);
  assert.match(compatibility, /optimizeDeps\.include = optimizeDeps\.include\.filter/);
  assert.match(compatibility, /entry !== VINEXT_OPTIONAL_RSC_STATIC_ENTRY/);
});

test("issue #1404 removes only impossible cross-runtime compile timings from dev request output", async () => {
  const [config, compatibility] = await Promise.all([
    read("vite.config.ts"),
    read("build/startup/vite-compatibility.ts"),
  ]);

  assert.match(config, /if \(command === "serve"\) installVinextRequestTimingOutputGuard\(\)/);
  assert.match(compatibility, /sanitizeVinextRequestTimingOutput/);
  assert.match(compatibility, /MAX_CROSS_RUNTIME_CLOCK_DRIFT_MS = 60_000/);
  assert.match(compatibility, /compileMs <= totalMs \+ MAX_CROSS_RUNTIME_CLOCK_DRIFT_MS/);
  assert.match(compatibility, /replace\(\/compile:/);
  assert.match(compatibility, /typeof chunk === "string" \? sanitizeVinextRequestTimingOutput\(chunk\) : chunk/);
  assert.doesNotMatch(compatibility, /console\.warn\s*=|console\.error\s*=|process\.stderr\.write\s*=/);
});

test("issue #1404 launcher liveness probes do not render or log the application root after the browser is owned", async () => {
  const [config, liveness] = await Promise.all([
    read("vite.config.ts"),
    read("build/startup/launcher-liveness-gateway.ts"),
  ]);

  assert.match(config, /launcherLivenessGateway\(\)[\s\S]*vinext\(\)/);
  assert.match(liveness, /PLOTPICKLE_BROWSER_STATE/);
  assert.match(liveness, /existsSync\(browserState\)/);
  assert.match(liveness, /request\.method === "GET"/);
  assert.match(liveness, /request\.url === "\/"/);
  assert.match(liveness, /powershell/i);
  assert.match(liveness, /response\.statusCode = 204/);
  assert.match(liveness, /Cache-Control/);
  assert.doesNotMatch(liveness, /console\.|logger\.|fetch\(|render/);
});
