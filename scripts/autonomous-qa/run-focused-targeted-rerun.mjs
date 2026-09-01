import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createManagedPlotPickleLifecycle } from "../creative-uat/autonomous/application-lifecycle.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const baseUrl = process.env.PLOTPICKLE_ACCEPTANCE_URL || "http://127.0.0.1:4173";
const artifactRoot = process.argv[2] ? path.resolve(process.argv[2]) : path.join(repoRoot, ".artifacts", "autonomous-qa-targeted-focused");

function runFocusedUat() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      path.join(repoRoot, "scripts", "run-uat-autopilot.mjs"),
      "--base-url", baseUrl,
      "--artifact-root", artifactRoot,
    ], {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", (error) => resolve({ code: 1, error: error.message }));
    child.once("exit", (code) => resolve({ code: Number(code ?? 1), error: "" }));
  });
}

async function main() {
  const lifecycle = createManagedPlotPickleLifecycle({ repoRoot, baseUrl });
  let started = false;
  try {
    await lifecycle.start();
    started = true;
    const result = await runFocusedUat();
    if (result.code !== 0) throw new Error(result.error || `Focused UAT targeted rerun exited with code ${result.code}.`);
    process.stdout.write(`Autonomous QA focused targeted rerun PASS: ${artifactRoot}\n`);
  } finally {
    if (started) {
      const stopped = await lifecycle.stop();
      if (!stopped.stopped || !stopped.endpointUnavailable) {
        process.stderr.write("Autonomous QA focused targeted rerun cleanup warning: PlotPickle did not fully stop.\n");
      }
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
