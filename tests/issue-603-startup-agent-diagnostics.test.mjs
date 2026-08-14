import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("normal local startup registers the read-only Mastra and agent health console", async () => {
  const [config, diagnostic] = await Promise.all([
    read("vite.config.ts"),
    read("build/startup-agent-diagnostics.ts"),
  ]);

  assert.match(config, /startupAgentDiagnosticsPlugin/);
  assert.match(config, /startupAgentDiagnosticsPlugin\(\)/);
  assert.match(config, /VITE_CONFIG_NATIVE_IGNORE_WARNING/);

  assert.match(diagnostic, /PlotPickle - Mastra and Agent Health Check/);
  assert.match(diagnostic, /Mastra runtime/);
  assert.match(diagnostic, /Embedded runtime/);
  assert.match(diagnostic, /Fast model/);
  assert.match(diagnostic, /Sage Brinewick registered/);
  assert.match(diagnostic, /Sage response/);
  assert.match(diagnostic, /Sage anti-echo check/);
  assert.match(diagnostic, /Sage repetition guard/);
  assert.match(diagnostic, /Curriculum grounding/);
  assert.match(diagnostic, /Quality model/);
  assert.match(diagnostic, /Foundations Planner/);
  assert.match(diagnostic, /Structured JSON/);
  assert.match(diagnostic, /overallColor/);
  assert.match(diagnostic, /OVERALL: \$\{overall\}/);
});

test("startup diagnostics color PASS green, warnings yellow, and failures red", async () => {
  const diagnostic = await read("build/startup-agent-diagnostics.ts");

  assert.match(diagnostic, /green: "\\u001b\[92m"/);
  assert.match(diagnostic, /yellow: "\\u001b\[93m"/);
  assert.match(diagnostic, /red: "\\u001b\[91m"/);
  assert.match(diagnostic, /if \(state === "PASS"\) return ANSI\.green/);
  assert.match(diagnostic, /if \(state === "FAIL"\) return ANSI\.red/);
});

test("startup diagnostics exercise the real local routes without exposing a shell", async () => {
  const diagnostic = await read("build/startup-agent-diagnostics.ts");

  assert.match(diagnostic, /\/api\/writing-assistant\/status/);
  assert.match(diagnostic, /\/api\/local-ai\/runtime\/model\/\$\{role\}\/load/);
  assert.match(diagnostic, /\/api\/writing-assistant\/chat/);
  assert.match(diagnostic, /agentId: "curriculum-guide"/);
  assert.match(diagnostic, /modelRole,/);
  assert.match(diagnostic, /agentId: "foundations-planner"/);
  assert.match(diagnostic, /modelRole: "quality"/);
  assert.match(diagnostic, /foundationFieldIds: \["output-1", "output-2"\]/);
  assert.match(diagnostic, /structuredFoundationPass/);
  assert.match(diagnostic, /root\.values/);
  assert.match(diagnostic, /candidate\[fieldId\]/);
  assert.match(diagnostic, /antiEchoPass/);
  assert.match(diagnostic, /groundingPass/);
  assert.match(diagnostic, /GROUNDING_PROBE_PHRASE = "copper lighthouse"/);
  assert.match(diagnostic, /Startup health example motif/);
  assert.match(diagnostic, /learn\/theme\.json/);

  assert.doesNotMatch(diagnostic, /child_process|execSync|spawn\(|powershell|cmd\.exe/i);
});

test("Sage startup health mirrors the real Fast retry and optional Quality recovery path", async () => {
  const diagnostic = await read("build/startup-agent-diagnostics.ts");

  assert.match(diagnostic, /SAGE_DIAGNOSTIC_REPAIR_INSTRUCTION/);
  assert.match(diagnostic, /SAGE_DIAGNOSTIC_QUALITY_INSTRUCTION/);
  assert.match(diagnostic, /requestSageProbeAttempt\(baseUrl, message, question, "fast", 60_000\)/);
  assert.match(diagnostic, /SAGE_DIAGNOSTIC_REPAIR_INSTRUCTION[\s\S]*"fast"[\s\S]*45_000/);
  assert.match(diagnostic, /await loadRole\(baseUrl, "quality"\)/);
  assert.match(diagnostic, /SAGE_DIAGNOSTIC_QUALITY_INSTRUCTION[\s\S]*"quality"[\s\S]*75_000/);
  assert.match(diagnostic, /route: "Fast retry"/);
  assert.match(diagnostic, /route: "Quality fallback"/);
  assert.match(diagnostic, /recovered via \$\{sage\.route\}/);
  assert.match(diagnostic, /failed \|\|= !responsePass \|\| !sage\.antiEcho \|\| !sage\.repetitionSafe \|\| !sage\.grounded/);
});

test("diagnostic JSON validation mirrors PLAN's accepted wrapped-or-direct field shapes", async () => {
  const [diagnostic, drafter] = await Promise.all([
    read("build/startup-agent-diagnostics.ts"),
    read("modules/plan/foundations-plan-drafter.ts"),
  ]);

  assert.match(diagnostic, /const candidate = root\.values && typeof root\.values === "object"/);
  assert.match(diagnostic, /: root;/);
  assert.match(drafter, /const candidate = root\.values && typeof root\.values === "object"/);
  assert.match(drafter, /: root;/);
  assert.match(diagnostic, /response did not contain both requested fields/);
});

test("Vite native-loader advisories are saved locally instead of flooding the startup window", async () => {
  const [launcher, report] = await Promise.all([
    read("Start-PlotPickle.bat"),
    read("scripts/vite-native-config-report.mjs"),
  ]);

  assert.match(launcher, /set "VITE_CONFIG_NATIVE_IGNORE_WARNING=true"/);
  assert.match(launcher, /VITE_NATIVE_REPORT=scripts\\vite-native-config-report\.mjs/);
  assert.match(launcher, /node "%VITE_NATIVE_REPORT%"/);
  assert.match(report, /vite-native-config-warnings\.log/);
  assert.match(report, /without a file extension/);
  assert.match(report, /JSON import/);
  assert.match(report, /kept out of the normal PlotPickle command window/);
});

test("diagnostics are advisory and do not block the Vite server from listening", async () => {
  const diagnostic = await read("build/startup-agent-diagnostics.ts");

  assert.match(diagnostic, /server\.httpServer\?\.once\("listening"/);
  assert.match(diagnostic, /setTimeout\(\(\) =>/);
  assert.match(diagnostic, /void runStartupAgentDiagnostics/);
  assert.match(diagnostic, /NEEDS ATTENTION/);
  assert.match(diagnostic, /HEALTHY WITH OPTIONAL WARNINGS/);
  assert.match(diagnostic, /HEALTHY/);
});
