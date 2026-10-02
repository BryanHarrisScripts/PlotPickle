import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function readDocument(file) {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

export async function waitForOwnedShutdown(home, { timeoutMs = 15000 } = {}) {
  const runtime = path.join(home, "node", "runtime");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [services, browser] = await Promise.all([
      readDocument(path.join(runtime, "sidecars", "status.json")),
      readDocument(path.join(runtime, "browser-owner.json")),
    ]);
    if (services?.supervisor.state === "failed") throw new Error("A launcher-owned service did not confirm shutdown.");
    if ((!services || services.supervisor.state === "stopped") && !browser) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Launcher-owned services or browser did not confirm shutdown within 15 seconds.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  waitForOwnedShutdown(process.env.PLOTPICKLE_HOME).catch((error) => {
    console.error(`[WARNING] ${error.message}`);
    process.exitCode = 1;
  });
}
