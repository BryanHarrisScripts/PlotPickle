import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureManagedPiDurableInstalled } from "../scripts/pi-durable-managed-install.mjs";

if (process.platform !== "win32") throw new Error("#2698 requires a real Windows launcher host.");
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = await mkdtemp(path.join(process.env.RUNNER_TEMP || os.tmpdir(), "plotpickle-2698-"));
const home = path.join(root, "home");
const runtime = path.join(home, "node", "runtime");
const auditRoot = path.join(root, "fetch-audit");
const output = path.join(repo, ".artifacts", "runtime-2698", "windows-startup.json");
const base = "http://127.0.0.1:4173";
const services = ["dsdd", "browser-verification", "pi-durable", "craft-runtime", "media-runtime", "chatgpt-mcp-gateway"];
await mkdir(auditRoot, { recursive: true });
const env = { ...process.env, PLOTPICKLE_HOME: home, PLOTPICKLE_STARTUP_TESTING_MODE: "normal", WRANGLER_SEND_METRICS: "false", PLOTPICKLE_BUZZ_MODE: "disabled" };
for (const key of Object.keys(env)) if (/TOKEN|API_KEY|PASSWORD|SECRET/.test(key)) delete env[key];
delete env.PLOTPICKLE_PERFORMANCE_BENCHMARK;
delete env.PLOTPICKLE_ACCEPTANCE_MODE;
const report = { schemaVersion: 1, issue: 2698, platform: process.platform, node: process.versions.node, provisioning: {}, runs: [], result: "UNPROVEN" };
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function document(file) {
  try { return JSON.parse((await readFile(file, "utf8")).replace(/^\uFEFF/, "")); }
  catch (error) { if (error.code === "ENOENT" || error instanceof SyntaxError) return null; throw error; }
}
async function wait(label, observe, timeout = 240000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const result = await observe();
    if (result) return result;
    await delay(200);
  }
  throw new Error(`${label} did not converge within ${timeout} ms.`);
}
async function command(executable, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: repo, env, windowsHide: true, ...options });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (data) => { stdout += data; });
    child.stderr?.on("data", (data) => { stderr += data; });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve(stdout) : reject(new Error(`${path.basename(executable)} exited ${code}: ${stderr.slice(-1500)} ${stdout.slice(-1500)}`)));
  });
}
function alive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }
async function coreAvailable() {
  try {
    const response = await fetch(`${base}/skin-v1`, { headers: { "X-PlotPickle-Startup-Probe": "warmup" }, signal: AbortSignal.timeout(5000) });
    const html = await response.text();
    return response.ok && html.includes("plotpickle-startup-v4") && /PlotPickle/i.test(html);
  } catch { return false; }
}
async function stopCore() {
  const action = async (body) => {
    const response = await fetch(`${base}/api/system/node-control`, { method: "POST", headers: { "Content-Type": "application/json", "X-PlotPickle-Node-Control": "confirmed", Origin: base }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    assert.ok(response.ok, `Shutdown HTTP ${response.status}`);
    return response.json();
  };
  const begun = await action({ action: "begin-shutdown" });
  assert.ok(begun.shutdownToken);
  await action({ action: "complete-shutdown", shutdownToken: begun.shutdownToken });
}
let launcher;
let tail = "";
try {
  report.provisioning.pi = await ensureManagedPiDurableInstalled({ home, env });
  await command("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/install-whisper-cpp.ps1", "-Mode", "Install", "-Approved"]);
  report.provisioning.voice = "reviewed installer completed before measured startup";
  env.PLOTPICKLE_PI_DURABLE_AUTO_INSTALL = "0";
  env.PLOTPICKLE_2698_AUDIT_ROOT = auditRoot;
  env.NODE_OPTIONS = `--import="${path.join(repo, "tests", "issue-2698-fetch-audit.mjs")}"`;
  let durableRoot;
  for (let attempt = 0; attempt < 2; attempt++) {
    const started = Date.now();
    const run = { mode: attempt ? "warm-persistent-restart" : "prepared-runtime", startedAt: new Date(started).toISOString(), failureIsolation: [] };
    report.runs.push(run);
    tail = "";
    launcher = spawn("cmd.exe", ["/d", "/s", "/c", "Start-PlotPickle.bat"], { cwd: repo, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    launcher.stdout.on("data", (data) => { tail = (tail + data).slice(-10000); });
    launcher.stderr.on("data", (data) => { tail = (tail + data).slice(-10000); });
    await wait("normal core startup", async () => {
      if (launcher.exitCode !== null) throw new Error(`Launcher exited ${launcher.exitCode}: ${tail}`);
      return coreAvailable();
    });
    run.coreHtmlReadyMs = Date.now() - started;
    const browser = await wait("managed Edge ownership", async () => {
      const value = await document(path.join(runtime, "browser-owner.json"));
      return value?.format === "plotpickle-owned-browser" && alive(value.pid) ? value : null;
    });
    run.managedBrowserOpenedMs = Date.parse(browser.startedAt) - started;
    const status = await wait("all registered runtime services", async () => {
      const value = await document(path.join(runtime, "sidecars", "status.json"));
      return value?.services.length === 6 && value.services.every((service) => service.state === "ready" || (service.id === "media-runtime" && service.state === "degraded")) ? value : null;
    });
    run.status = status;
    assert.ok(Date.parse(status.timing.coreReadyAt) <= Date.parse(status.timing.servicesStartedAt));
    assert.ok(status.services.every((service) => Number.isInteger(service.pid) && alive(service.pid)));
    run.coreToServiceConvergenceMs = Date.parse(status.timing.servicesConvergedAt) - Date.parse(status.timing.coreReadyAt);
    const pi = await document(path.join(runtime, "sidecars", "services", "pi-durable", "status.json"));
    assert.ok(pi.rootConversationId, "Actual Pi Durable root was not persisted");
    if (durableRoot) assert.equal(pi.rootConversationId, durableRoot, "Pi Durable root changed across launcher restart");
    durableRoot = pi.rootConversationId;
    run.durableRootId = durableRoot;
    const mcp = status.services.find((service) => service.id === "chatgpt-mcp-gateway");
    assert.ok(mcp.evidence.some((item) => /External transport disconnected/.test(item.summary)));
    // A separate disposable Edge renderer verifies the real normal profile gate.
    const rendered = await command(browser.executable, ["--headless", "--disable-gpu", "--no-first-run", "--disable-background-networking", `--user-data-dir=${path.join(root, `render-${attempt}`)}`, "--dump-dom", "--virtual-time-budget=15000", `${base}/skin-v1`]);
    assert.match(rendered, /<button/i, "Normal startup must render usable controls");
    assert.match(rendered, /Shut Down|LOGON|Log On|Create.*Profile/i, "Normal profile gate did not become usable");
    run.firstUsefulProfileGateMs = Date.now() - started;
    await wait("deferred read-only AI inventory", async () => {
      const readiness = await document(path.join(home, "runtime", "local-ai-readiness.json"));
      if (!readiness) return false;
      assert.equal(readiness.inference.attempted, false);
      assert.equal(readiness.managedStart.attempted, false);
      return readiness;
    }, 90000);
    if (!attempt) {
      for (const id of services) {
        const service = status.services.find((item) => item.id === id);
        process.kill(service.pid);
        await wait(`${id} failure observed`, async () => {
          const value = await document(path.join(runtime, "sidecars", "status.json"));
          return ["degraded", "failed", "stopped"].includes(value?.services.find((item) => item.id === id)?.state);
        }, 15000);
        assert.ok(await coreAvailable(), `${id} failure blocked the core app`);
        const control = await fetch(`${base}/api/system/node-control`, { signal: AbortSignal.timeout(5000) });
        assert.equal(control.status, 200);
        run.failureIsolation.push({ id, coreAvailable: true });
      }
    }
    await stopCore();
    await wait("launcher-owned service shutdown", async () => {
      const value = await document(path.join(runtime, "sidecars", "status.json"));
      return value?.supervisor.state === "stopped" && value.services.every((service) => service.state === "stopped");
    }, 20000);
    await wait("owned Edge shutdown", async () => !await document(path.join(runtime, "browser-owner.json")) && !alive(browser.pid), 20000);
    for (const service of status.services) assert.equal(alive(service.pid), false, `${service.id} survived shutdown`);
    await wait("launcher exit", async () => launcher.exitCode !== null, 20000);
    assert.equal(launcher.exitCode, 0, tail);
    run.stoppedMs = Date.now() - started;
    launcher = null;
  }
  const audit = (await Promise.all((await readdir(auditRoot)).map(async (file) => (await readFile(path.join(auditRoot, file), "utf8")).trim().split("\n").filter(Boolean).map(JSON.parse)))).flat();
  assert.ok(audit.length > 0, "Startup fetch auditing captured no observations");
  assert.ok(audit.every((event) => event.loopback && !event.inference), "Unexpected remote or inference startup request");
  report.fetchAudit = { observations: audit.length, remoteRequests: 0, inferenceRequests: 0, scope: "launcher-owned Node processes; reviewed provisioning occurred before measurement" };
  report.result = "PASS";
} catch (error) {
  report.result = "FAIL";
  report.error = error.message;
  console.error(error.message);
  console.error(tail);
  process.exitCode = 1;
} finally {
  if (launcher?.pid && launcher.exitCode === null) {
    await command("taskkill.exe", ["/PID", String(launcher.pid), "/T", "/F"]).catch(() => {});
  }
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(`Windows runtime proof: ${report.result}; ${report.runs.length} launcher runs. Evidence: ${output}`);
  await rm(root, { recursive: true, force: true }).catch(() => {});
}
