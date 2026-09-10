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

test("startup WebMCP runner keeps verification tools isolated and pinned", async () => {
  const [runner, packageJson] = await Promise.all([
    read("scripts/run-webmcp-startup-uat.mjs"),
    read("package.json"),
  ]);

  assert.match(runner, /@playwright\/test@1\.63\.0/);
  assert.match(runner, /@mcp-b\/webmcp-polyfill@5\.1\.0/);
  assert.match(runner, /prepareVerificationSyntheticHome/);
  assert.match(runner, /establishVerificationSyntheticHuman/);
  assert.match(runner, /runWebMcpSurfaceVisualAudit/);
  assert.match(runner, /WEBMCP_STARTUP_EVIDENCE/);
  assert.match(runner, /DASHBOARD_SCREENSHOT_PATH/);
  assert.match(runner, /process\.env\.ComSpec \|\| "cmd\.exe"/);
  assert.match(runner, /map\(quoteWindowsShellToken\)\.join\(" "\)/);
  assert.match(runner, /shell: process\.env\.ComSpec \|\| "cmd\.exe"/);
  assert.doesNotMatch(packageJson, /@mcp-b\/webmcp-polyfill/);
});

test("Windows WebMCP bootstrap executes command wrappers without spawn EINVAL", { skip: process.platform !== "win32" }, async () => {
  const { commandName, runCommand } = await import("../scripts/run-webmcp-startup-uat.mjs");
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "PlotPickle WebMCP "));
  const probe = path.join(tempRoot, "wrapper probe.cmd");
  const marker = path.join(tempRoot, "spawn result.txt");

  try {
    await writeFile(probe, '@echo off\r\n> "%~1" echo spawn-ok\r\n', "utf8");
    await runCommand(probe, [marker], { stdio: "ignore" });
    assert.equal((await readFile(marker, "utf8")).trim(), "spawn-ok");
    await runCommand(commandName("npm"), ["--version"], { stdio: "ignore" });
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
