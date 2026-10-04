import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { lstat, mkdir, mkdtemp, realpath, rename, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build, stop as stopEsbuild } from "esbuild";
import { ensureManagedPiDurableInstalled } from "../../pi-durable-managed-install.mjs";
import { ensureVerificationTools } from "../../run-webmcp-startup-uat.mjs";
import { createVerificationSyntheticProfile, authenticateVerificationSyntheticProfile } from "../../full-verification-auth.mjs";
import { createBrowserVerificationSession, sanitizeBrowserDiagnosticText } from "../../../lib/verification/browser-verification-broker.mjs";

// The product's configured Mastra route, protected HTTP/CSRF, encrypted project,
// native Pi scheduler and rendered Outline run against an explicitly synthetic
// loopback provider. This is never reported as a user-selected live-provider run.
const root = path.resolve(".artifacts/outline-product-2711");
await mkdir(root, { recursive: true });
// Keep the synthetic home on the checkout volume. GitHub's Windows runner checks
// the repository out on D: while os.tmpdir() is on C:; Vinext virtual RSC entries
// do not support that cross-volume dependency junction during dev startup. The
// real launcher, persistent-runtime migration, close/reopen, and recovery path
// are still exercised exactly as a normal PlotPickle launch.
const temporary = await mkdtemp(path.join(root, "runtime-"));
const home = path.join(temporary, "home");
const base = "http://127.0.0.1:4173";
let launcher, fixture, browserSession;
let launcherOutput = [];
let launcherError;
let proofError;
const selectedStage = process.env.PLOTPICKLE_OUTLINE_PROOF_STAGE || "all";
assert.ok(["authentication", "execution", "startup-auth", "recovery", "all"].includes(selectedStage), "Unknown Outline proof stage.");
let activeStage = "setup";
const completedStages = [];
async function enterStage(stage) {
  activeStage = stage;
  console.log(`Outline product proof stage: ${stage}`);
}
async function completeStage(stage) {
  completedStages.push(stage);
  await writeFile(path.join(root, "stages.json"), JSON.stringify({ status: "IN_PROGRESS", selectedStage, completedStages }, null, 2) + "\n");
}
async function reportFocusedPass() {
  const report = { issue: 2711, status: "PASS", scope: selectedStage, fullProductProof: "UNPROVEN", completedStages, platform: process.platform };
  await writeFile(path.join(root, "focused-proof.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
}
let requests = [];
let holdBlock = 2;
const assessment = { structural: { state: "unresolved", reason: "Synthetic product fixture cannot establish a structural turn.", passageIds: [] }, characters: [], miniBlocks: [1,2,3,4].map((ordinal) => ({ ordinal, state: "unsupported", reason: "No synthetic screenplay was supplied.", passageIds: [], storyboardCue: "" })) };
const env = { ...process.env, PLOTPICKLE_HOME: home, PLOTPICKLE_AUTH_STATE_PATH: path.join(home, "auth/state.json"), PLOTPICKLE_STARTUP_TESTING_MODE: "normal", PLOTPICKLE_ACCESS_MODE: "desktop-loopback", PLOTPICKLE_SERVER_NETWORK_ENABLED: "false" };
async function waitFor(check, label, timeout = 180_000, assertLive = () => {}) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) { assertLive(); try { if (await check()) return; } catch (error) { lastError = error; } await new Promise((resolve) => setTimeout(resolve, 100)); }
  throw new Error(`Product proof timed out: ${label}${lastError ? ` (${lastError.message})` : ""}`);
}
async function start({ cold = false } = {}) {
  const command = process.platform === "win32" ? "powershell.exe" : process.execPath;
  const args = process.platform === "win32" ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.resolve("PlotPickle.ps1"), "-HumanTesting"]
    : [path.resolve("node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "4173", "--strictPort"];
  launcher = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"], ...(process.platform === "win32" ? {} : { detached: true }) });
  launcherOutput = [];
  launcherError = undefined;
  launcher.on("error", (error) => { launcherError = error; });
  launcher.stdout.on("data", (chunk) => { launcherOutput.push(chunk); if (launcherOutput.length > 1000) launcherOutput.shift(); });
  launcher.stderr.on("data", (chunk) => { launcherOutput.push(chunk); if (launcherOutput.length > 1000) launcherOutput.shift(); });
  await waitFor(async () => { const response = await fetch(`${base}/api/auth/profile`, { signal: AbortSignal.timeout(1000) }); return response.ok; }, "normal launcher readiness", cold ? 480_000 : 180_000, () => {
    if (launcherError) throw launcherError;
    if (launcher.exitCode !== null) throw new Error(`Normal launcher exited before readiness (exit ${launcher.exitCode}).`);
  });
}
async function stop() {
  if (!launcher) return;
  const child = launcher;
  const pid = child.pid;
  launcher = null;
  if (process.platform === "win32") {
    if (pid && child.exitCode === null) {
      try { execFileSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" }); }
      catch (error) { if (error.status !== 128) throw error; } // Already exited between observation and cleanup.
    }
  } else if (pid) try { process.kill(-pid, "SIGKILL"); } catch (error) { if (error.code !== "ESRCH") throw error; }
  await waitFor(async () => { try { await fetch(`${base}/api/auth/profile`, { signal: AbortSignal.timeout(1000) }); return false; } catch { return true; } }, "server stop", 20_000);
}
async function api(session, pathname, body) {
  const response = await fetch(`${base}${pathname}`, { method: body ? "POST" : "GET", headers: {
    Cookie: session.environment.PLOTPICKLE_VERIFICATION_AUTH_COOKIE, Origin: base,
    "X-PlotPickle-CSRF": session.environment.PLOTPICKLE_VERIFICATION_AUTH_CSRF, "Content-Type": "application/json",
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const value = await response.json();
  assert.ok(response.ok, `${pathname}: HTTP ${response.status}, ${value.message || ""}`);
  return value;
}
async function outline(session, toolRoot) {
  browserSession = await createBrowserVerificationSession({ toolRoot, allowedOrigins: [base], runId: `outline-2711-${Date.now()}` });
  const context = await browserSession.browser.newContext({ storageState: session.storageStatePath, viewport: { width: 1440, height: 1080 } });
  const page = await context.newPage();
  await page.goto(`${base}/skin-v1`, { waitUntil: "domcontentloaded" });
  // A fresh browser session deliberately starts without a loaded story. Open
  // the exact saved fixture through Library, just as the Human does on reopen.
  await page.locator("[data-dashboard-menu-item='library']").click({ timeout: 60_000 });
  await page.locator("[data-library-load-story='synthetic-outline-product']").getByRole("button", { name: /^Resume saved story/u }).click();
  await page.getByRole("button", { name: "Open Saved Story", exact: true }).click();
  await page.locator("[data-dashboard-menu-item='plan']").click({ timeout: 60_000 });
  await page.getByRole("button", { name: "Assess Act 1 with Story Architect", exact: true }).waitFor({ timeout: 60_000 });
  return page;
}
async function runProof() {
try {
  await mkdir(root, { recursive: true });
  await mkdir(home, { recursive: true });
  const compiled = path.join(temporary, "project.mjs");
  await build({ stdin: { contents: 'export { normalizeLibraryProject } from "./core/storage/library-project.ts"; export { outlineAssessmentMaterialReceipt } from "./modules/plan/outline-agent-assessment.ts";', resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "esm", outfile: compiled, logLevel: "silent" });
  // Release the compiler executable before the native launcher moves checkout
  // dependencies into its private runtime. Windows locks a running executable.
  stopEsbuild();
  const { normalizeLibraryProject, outlineAssessmentMaterialReceipt } = await import(pathToFileURL(compiled).href);
  fixture = createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.setHeader("X-Content-Type-Options", "nosniff");
    if (request.url === "/api/tags") return response.end(JSON.stringify({ models: [{ name: "synthetic-outline-product", size: 1 }] }));
    if (request.url === "/api/version") return response.end(JSON.stringify({ version: "synthetic-fixture" }));
    if (request.url !== "/v1/chat/completions") { response.statusCode = 404; return response.end(JSON.stringify({ error: "Synthetic fixture route unavailable" })); }
    let bytes = "";
    for await (const chunk of request) { bytes += chunk; if (bytes.length > 100_000) { response.statusCode = 413; return response.end("{}"); } }
    const input = JSON.parse(bytes);
    const prompt = input.messages.map((item) => typeof item.content === "string" ? item.content : JSON.stringify(item.content)).join("\n");
    const block = Number(prompt.match(/"blockNumber":(\d+)/u)?.[1] || 0);
    requests.push(block);
    if (block === holdBlock) return; // Crash during uncommitted provider work.
    response.end(JSON.stringify({ id: "synthetic", object: "chat.completion", created: 1, model: input.model,
      choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(assessment) }, finish_reason: "stop" }],
      usage: { prompt_tokens: 37, completion_tokens: 53, total_tokens: 90 } }));
  });
  await new Promise((resolve) => fixture.listen(0, "127.0.0.1", resolve));
  await ensureManagedPiDurableInstalled({ home });
  // Cold native setup downloads and verifies required runtime/model bytes.
  // Reopen retains the shorter bound; every launch still fails immediately on exit.
  await enterStage("startup-auth");
  await start({ cold: true });
  const profile = await createVerificationSyntheticProfile({ baseUrl: base, home });
  let session = await authenticateVerificationSyntheticProfile({ baseUrl: base, ...profile });
  const project = normalizeLibraryProject({ id: "synthetic-outline-product", title: "Synthetic Outline Product" });
  await api(session, "/api/auth/profile-private", { action: "save-project", project, activate: true });
  assert.ok(Array.isArray((await api(session, "/api/outline/tasks")).tasks), "Authenticated task discovery returns a task list.");
  await completeStage("authentication");
  if (selectedStage === "authentication") { await reportFocusedPass(); return; }
  await api(session, "/api/writing-assistant/ollama", { baseUrl: `http://127.0.0.1:${fixture.address().port}`, model: "synthetic-outline-product" });
  assert.ok(Array.isArray((await api(session, "/api/outline/tasks")).tasks), "Authenticated task discovery returns a task list.");
  if (selectedStage === "execution") {
    await enterStage("execution");
    holdBlock = -1;
    const started = await api(session, "/api/outline/tasks", { action: "start", projectId: project.id, blocks: [1], materialReceipt: await outlineAssessmentMaterialReceipt(project) });
    await waitFor(async () => {
      const task = (await api(session, "/api/outline/tasks")).tasks.find((item) => item.scope.runId === started.task.scope.runId);
      if (task?.error) throw new Error(task.error);
      return task?.proposals.length === 1;
    }, "one protected Block commits", 30_000);
    await completeStage("execution"); await reportFocusedPass(); return;
  }
  const toolRoot = await ensureVerificationTools(process.env.PLOTPICKLE_BROWSER_TOOL_ROOT || path.join(temporary, "browser-tools"));
  requests = [];
  let page = await outline(session, toolRoot);
  assert.equal(requests.length, 0, "Normal startup and Outline discovery must issue no assessment inference.");
  await completeStage("startup-auth");
  if (selectedStage === "startup-auth") { await reportFocusedPass(); return; }
  await enterStage("interruption");
  const admission = page.waitForResponse((response) => response.url() === `${base}/api/outline/tasks` && response.request().method() === "POST");
  await page.getByRole("button", { name: "Assess Act 1 with Story Architect", exact: true }).click();
  const admitted = await admission;
  const admissionBody = await admitted.json();
  assert.equal(admitted.status(), 202, admissionBody.message || "Rendered Act review must be admitted.");
  let stoppedTask;
  await waitFor(async () => {
    const task = (await api(session, "/api/outline/tasks")).tasks.find((item) => item.scope.runId === admissionBody.task.scope.runId);
    if (task?.error || (task && !task.running && task.proposals.length < 2)) { stoppedTask = task; return true; }
    return requests.includes(2);
  }, "second Block starts after committed first Block");
  assert.ok(!stoppedTask, stoppedTask?.error || "Task stopped before Block 2.");
  const first = (await api(session, "/api/outline/tasks")).tasks[0];
  assert.equal(first.proposals.length, 1);
  const id = first.scope.runId;
  await page.locator(`[data-outline-recovery-task='${id}']`).getByText("1 of 6 Blocks assessed", { exact: false }).waitFor();
  await page.screenshot({ path: path.join(root, "before-reopen.png"), fullPage: true });
  await browserSession.close(); browserSession = null;
  await stop(); fixture.closeAllConnections();
  const beforeReopen = requests.length;
  holdBlock = -1;
  await completeStage("interruption");
  await enterStage("recovery");
  await start();
  session = await authenticateVerificationSyntheticProfile({ baseUrl: base, ...profile });
  page = await outline(session, toolRoot);
  const recovered = page.locator(`[data-outline-recovery-task='${id}']`);
  await recovered.getByRole("button", { name: "Resume Story Architect review", exact: true }).waitFor({ timeout: 30_000 });
  assert.equal(requests.length, beforeReopen, "Reopen, profile unlock and task discovery do not resume inference.");
  const saved = (await api(session, "/api/outline/tasks")).tasks.find((task) => task.scope.runId === id);
  assert.equal(saved.run.usage.attempts, 2, "Interrupted attempt remains spent after restart.");
  await recovered.getByRole("button", { name: "Resume Story Architect review", exact: true }).click();
  await waitFor(async () => (await api(session, "/api/outline/tasks")).tasks.find((task) => task.scope.runId === id)?.run.state === "waiting-for-writer", "remaining Blocks complete");
  assert.deepEqual(requests.slice(beforeReopen), [2,3,4,5,6], "Committed Block 1 is never recomputed.");
  await recovered.getByText("6 of 6 Blocks assessed", { exact: false }).waitFor({ timeout: 30_000 });
  await waitFor(async () => (await api(session, "/api/auth/profile-private")).project.sourceEvidence.outlineAssessmentRuns?.some((run) => run.id === id && run.status === "completed"), "encrypted advisory import");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("[data-dashboard-menu-item='plan']").click({ timeout: 60_000 });
  const final = (await api(session, "/api/auth/profile-private")).project;
  assert.equal(final.sourceEvidence.outlineAssessmentRuns.filter((run) => run.id === id).length, 1);
  assert.equal(final.sourceEvidence.outlineAssessments.length, 6);
  assert.deepEqual(final.structure, project.structure);
  await page.screenshot({ path: path.join(root, "after-reopen.png"), fullPage: true });
  await completeStage("recovery");
  if (selectedStage === "recovery") { await reportFocusedPass(); return; }
  await enterStage("cancellation");
  // Exercise the actual rendered Cancel control while a new review is in flight.
  holdBlock = 1;
  await page.getByRole("button", { name: "Assess Act 1 with Story Architect", exact: true }).click();
  await waitFor(async () => (await api(session, "/api/outline/tasks")).tasks.some((task) => task.scope.runId !== id && task.running), "new review starts");
  const cancelling = (await api(session, "/api/outline/tasks")).tasks.find((task) => task.scope.runId !== id);
  const row = page.locator(`[data-outline-recovery-task='${cancelling.scope.runId}']`);
  await row.getByRole("button", { name: "Cancel Story Architect review", exact: true }).click({ timeout: 30_000 });
  await waitFor(async () => (await api(session, "/api/outline/tasks")).tasks.find((task) => task.scope.runId === cancelling.scope.runId)?.run.state === "cancelled", "cancel persisted");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("[data-dashboard-menu-item='plan']").click({ timeout: 60_000 });
  const cancelledRow = page.locator(`[data-outline-recovery-task='${cancelling.scope.runId}']`);
  await cancelledRow.getByText("Story Architect · cancelled", { exact: true }).waitFor({ timeout: 30_000 });
  assert.equal(await cancelledRow.getByRole("button", { name: "Resume Story Architect review" }).count(), 0);
  await browserSession.checkpoint(page, { surface: "outline", phase: "recovery-and-cancel" });
  await browserSession.close(); browserSession = null;
  await completeStage("cancellation");
  const report = { issue: 2711, status: "PASS", sourceHead: process.env.PLOTPICKLE_PROOF_SOURCE_HEAD || execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), platform: process.platform,
    launcher: process.platform === "win32" ? "PlotPickle.ps1 -HumanTesting (normal startup)" : "normal-mode Vite server",
    providerEvidence: "synthetic-loopback-fixture", realUserProvider: "UNPROVEN", productResume: "PASS", authenticatedTaskDiscovery: "PASS", startupAssessmentRequests: 0,
    interruptedAttemptsRetained: true, committedBlocksSkipped: true, resumedBlocks: [2,3,4,5,6], idempotentAdvisoryImport: true, renderedCancellationPersisted: true, canonUnchanged: true };
  await writeFile(path.join(root, "proof.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
} catch (error) {
  proofError = error;
  const diagnostics = Buffer.concat(launcherOutput).toString("utf8").slice(-16_000).split(/\r?\n/u).map(sanitizeBrowserDiagnosticText).join("\n");
  await writeFile(path.join(root, "failure.json"), JSON.stringify({ issue: 2711, status: "FAIL", selectedStage, activeStage, completedStages, error: sanitizeBrowserDiagnosticText(error.message), launcherDiagnostics: diagnostics }, null, 2) + "\n");
  console.error(`Outline product proof failed at ${activeStage}: ${sanitizeBrowserDiagnosticText(error.message)}`);
  console.error(diagnostics);
  throw error;
} finally {
  const cleanupErrors = [];
  try {
    try { await browserSession?.close(); } catch (error) { cleanupErrors.push(error); }
    try { await stop(); } catch (error) { cleanupErrors.push(error); }
    fixture?.closeAllConnections();
    if (fixture) await new Promise((resolve) => fixture.close(resolve));
  }
  finally {
    // The normal Windows launcher migrates npm dependencies into its private
    // runtime and links the checkout to them. Return that owned migration before
    // deleting the synthetic home, so later Product Gate steps retain npm tools.
    try {
    const modules = path.resolve("node_modules");
    const metadata = await lstat(modules);
    if (process.platform === "win32" && metadata.isSymbolicLink()) {
      const target = await realpath(modules);
      const relative = path.relative(home, target);
      if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
        await unlink(modules);
        await rename(target, modules);
      }
    }
    } catch (error) { cleanupErrors.push(error); }
    try { await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 }); }
    catch (error) { cleanupErrors.push(error); }
    if (cleanupErrors.length) {
      if (!proofError) throw new AggregateError(cleanupErrors, "Product proof cleanup failed.");
      console.error("Product proof cleanup:", cleanupErrors.map((error) => sanitizeBrowserDiagnosticText(error.message)).join("; "));
    }
  }
}

}
await runProof();
