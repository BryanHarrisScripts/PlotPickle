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
  assert.match(diagnostic, /Curriculum grounding/);
  assert.match(diagnostic, /Quality model/);
  assert.match(diagnostic, /Foundations Planner/);
  assert.match(diagnostic, /Structured JSON/);
  assert.match(diagnostic, /OVERALL: \$\{overall\}/);
});

test("startup diagnostics exercise the real local routes without exposing a shell", async () => {
  const diagnostic = await read("build/startup-agent-diagnostics.ts");

  assert.match(diagnostic, /\/api\/writing-assistant\/status/);
  assert.match(diagnostic, /\/api\/local-ai\/runtime\/model\/\$\{role\}\/load/);
  assert.match(diagnostic, /\/api\/writing-assistant\/chat/);
  assert.match(diagnostic, /agentId: "curriculum-guide"/);
  assert.match(diagnostic, /modelRole: "fast"/);
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

test("diagnostics are advisory and do not block the Vite server from listening", async () => {
  const diagnostic = await read("build/startup-agent-diagnostics.ts");

  assert.match(diagnostic, /server\.httpServer\?\.once\("listening"/);
  assert.match(diagnostic, /setTimeout\(\(\) =>/);
  assert.match(diagnostic, /void runStartupAgentDiagnostics/);
  assert.match(diagnostic, /NEEDS ATTENTION/);
  assert.match(diagnostic, /HEALTHY WITH OPTIONAL WARNINGS/);
  assert.match(diagnostic, /HEALTHY/);
});
