import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("startup asks Human Testing or WebMCP Testing as the first testing choice", async () => {
  const launcher = await read("Start-PlotPickle.bat");
  const testingPrompt = launcher.indexOf("Human Testing or WebMCP Testing");
  const runtimePrompt = launcher.indexOf("Continue with this local runtime installation? [Y/N]");

  assert.ok(testingPrompt >= 0, "startup testing selector is missing");
  assert.ok(runtimePrompt < 0 || testingPrompt < runtimePrompt, "testing selector must precede later runtime consent prompts");
  assert.match(launcher, /Y = WebMCP Testing/);
  assert.match(launcher, /N = Human Testing/);
  assert.match(launcher, /choice \/C YN \/N \/M "Run WebMCP Testing\? \[Y\/N\]/);
  assert.match(launcher, /set "PLOTPICKLE_STARTUP_TESTING_MODE=webmcp"/);
  assert.match(launcher, /set "PLOTPICKLE_STARTUP_TESTING_MODE=human"/);
});

test("Human mode keeps the owned browser while WebMCP mode runs the bounded audit after readiness", async () => {
  const launcher = await read("Start-PlotPickle.bat");

  assert.match(launcher, /if \/I "!PLOTPICKLE_STARTUP_TESTING_MODE!"=="webmcp"/);
  assert.match(launcher, /call :start_webmcp_testing/);
  assert.match(launcher, /call :open_when_ready/);
  assert.match(launcher, /call :start_deferred_companion_maintenance/);
  assert.match(launcher, /WEBMCP_STARTUP_RUNNER=scripts\\run-webmcp-startup-uat\.mjs/);
  assert.match(launcher, /run --server "%PLOTPICKLE_URL%" --home "!PLOTPICKLE_HOME!" --tool-root "!PLOTPICKLE_WEBMCP_TOOL_ROOT!"/);
  assert.match(launcher, /WebMCP Testing uses an isolated synthetic Human profile/);
  assert.match(launcher, /WebMCP Testing requires an isolated PlotPickle test session/);
});

test("startup WebMCP runner keeps verification tools isolated, pinned, and on the shared safe spawn path", async () => {
  const [runner, packageJson, spawnHelper] = await Promise.all([
    read("scripts/run-webmcp-startup-uat.mjs"),
    read("package.json"),
    read("scripts/spawn-command.mjs"),
  ]);

  assert.match(runner, /@playwright\/test@1\.63\.0/);
  assert.match(runner, /@mcp-b\/webmcp-polyfill@5\.1\.0/);
  assert.match(runner, /prepareVerificationSyntheticHome/);
  assert.match(runner, /establishVerificationSyntheticHuman/);
  assert.match(runner, /runWebMcpSurfaceVisualAudit/);
  assert.match(runner, /WEBMCP_STARTUP_EVIDENCE/);
  assert.match(runner, /DASHBOARD_SCREENSHOT_PATH/);
  assert.match(runner, /import \{ spawnCommand \} from "\.\/spawn-command\.mjs"/);
  assert.match(runner, /spawnCommand\(command, args/);
  assert.match(spawnHelper, /windowsJavaScriptCliInvocation\(command, args/);
  assert.match(spawnHelper, /Unsupported Windows batch wrapper/);
  assert.doesNotMatch(spawnHelper, /process\.env\.ComSpec/);
  assert.doesNotMatch(spawnHelper, /windowsBatchInvocation|spawn\(\s*["']cmd\.exe|PLOTPICKLE_BATCH_/);
  assert.doesNotMatch(packageJson, /@mcp-b\/webmcp-polyfill/);
});

test("CodeQL-sensitive browser labels stay out of executable source", async () => {
  const [releaseSmoke, issueSmoke, casebook] = await Promise.all([
    read("scripts/windows-release-smoke.mjs"),
    read("scripts/windows-issue-208-smoke.mjs"),
    read("scripts/casebook-evidence.mjs"),
  ]);

  for (const source of [releaseSmoke, issueSmoke, casebook]) assert.doesNotMatch(source, /safeBrowserStringLiteral/);
  for (const source of [releaseSmoke, issueSmoke]) {
    assert.match(source, /callCdpPageFunction/);
    assert.match(source, /PAGE_FUNCTIONS/);
    assert.doesNotMatch(source, /=== \$\{[^}]*\b(?:text|label)\b[^}]*\}/);
  }
  assert.match(casebook, /creativeBrowser\.focusVisible\(String\(label\)\)/);
});

test("WebMCP CMD output lists every lockable surface and never auto-approves screenshots", async () => {
  const { formatPassTag, visualBaselineApprovalLines } = await import("../scripts/run-webmcp-startup-uat.mjs");
  const lines = visualBaselineApprovalLines();
  const output = lines.join("\n");

  assert.equal(lines[0], "Captured 5 surfaces:");
  assert.match(output, /\[1\] dashboard \(Dashboard\)/u);
  assert.match(output, /\[2\] community \(Community\)/u);
  assert.match(output, /\[3\] profile \(Profile\)/u);
  assert.match(output, /\[4\] local-ai \(Local AI\)/u);
  assert.match(output, /\[5\] node \(Node\)/u);
  for (const surface of ["dashboard", "community", "profile", "local-ai", "node"]) {
    assert.match(output, new RegExp(`node scripts/lock-skin-visual-baseline\\.mjs ${surface}`, "u"));
  }
  assert.match(output, /none of the screenshots are automatically declared "locked\."/u);
  assert.match(output, /prevents PlotPickle from blessing its own regressions/u);
  assert.match(output, /tests\/visual-baselines\/skin-v1\/dashboard\.png/u);
  assert.match(output, /tests\/visual-baselines\/skin-v1\/manifest\.json/u);
  assert.equal(formatPassTag({ color: false }), "[PASS]");
  assert.equal(formatPassTag({ color: true }), "\u001b[32m[PASS]\u001b[0m");
});

test("Windows WebMCP bootstrap rejects arbitrary cmd wrappers and runs npm with a spaced verification root", { skip: process.platform !== "win32" }, async () => {
  const { commandName, runCommand } = await import("../scripts/run-webmcp-startup-uat.mjs");
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "PlotPickle WebMCP "));
  const probeName = "plotpickle-webmcp-probe.cmd";
  const probe = path.join(tempRoot, probeName);

  try {
    await writeFile(probe, '@echo off\r\n> spawn-result.txt echo spawn-ok\r\n', "utf8");
    await assert.rejects(runCommand(probeName, [], { stdio: "ignore", cwd: tempRoot }), /Unsupported Windows batch wrapper/);
    await runCommand(commandName("npm"), ["--prefix", tempRoot, "--version"], { stdio: "ignore", cwd: tempRoot });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("reusable UAT skills remain bounded and independent from fixing or merging", async () => {
  const skills = await import("../lib/verification/webmcp-uat-skills.mjs");
  const names = skills.WEBMCP_UAT_SKILLS.map((skill) => skill.name);

  assert.deepEqual(names, [
    "get_current_surface",
    "list_available_surfaces",
    "open_surface",
    "go_back",
    "inspect_surface_visual_contract",
  ]);
  assert.equal(skills.WEBMCP_UAT_SKILL_POLICY.canonicalScreenshotSurface, "dashboard");
  assert.equal(skills.WEBMCP_UAT_SKILL_POLICY.mayFixCode, false);
  assert.equal(skills.WEBMCP_UAT_SKILL_POLICY.mayMergeCode, false);
  assert.equal(skills.WEBMCP_UAT_SKILL_POLICY.mayPublishToBuzz, false);
  assert.equal(skills.WEBMCP_UAT_SKILL_POLICY.mayMutateCanon, false);
  assert.equal(skills.WEBMCP_UAT_SKILL_POLICY.mayReadCredentials, false);
  assert.equal(skills.WEBMCP_UAT_SKILL_POLICY.mayInvokeProviders, false);
});
