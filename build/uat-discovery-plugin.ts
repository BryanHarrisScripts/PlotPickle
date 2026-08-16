import { execFile } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { promisify } from "node:util";
import type { Plugin } from "vite";

const exec = promisify(execFile);

type RepairPreflight = {
  readonly ready?: boolean;
  readonly worker?: string;
  readonly workerLabel?: string;
  readonly workerAvailable?: boolean;
  readonly message?: string;
  readonly runtime?: { readonly label?: string; readonly model?: string };
};

function clock() {
  return new Date().toTimeString().slice(0, 8);
}

async function developerRepairPreflight(): Promise<RepairPreflight> {
  const script = path.resolve(process.cwd(), "scripts", "run-uat-repair-agent.mjs");
  try {
    const result = await exec(process.execPath, [script, "--preflight", "--json"], {
      cwd: process.cwd(),
      env: process.env,
      windowsHide: true,
      timeout: 12_000,
      maxBuffer: 1024 * 1024,
    });
    return JSON.parse(result.stdout.trim()) as RepairPreflight;
  } catch (error) {
    return {
      ready: false,
      worker: process.env.PLOTPICKLE_REPAIR_WORKER || "pi",
      workerLabel: (process.env.PLOTPICKLE_REPAIR_WORKER || "pi") === "cline" ? "Cline" : "Pi",
      message: error instanceof Error ? error.message : "developer repair preflight failed",
    };
  }
}

async function ensureDeveloperRepairModel(worker: string) {
  const script = path.resolve(process.cwd(), "scripts", "ensure-local-repair-model.mjs");
  try {
    const result = await exec(process.execPath, [script, "--worker", worker], {
      cwd: process.cwd(),
      env: process.env,
      windowsHide: true,
      timeout: 205_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return { ok: true, detail: result.stdout.trim().split(/\r?\n/).filter(Boolean).slice(-1)[0] || "local repair model check completed" };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "local repair model autoload failed" };
  }
}

export function uatDiscoveryPlugin(): Plugin {
  return {
    name: "plotpickle-uat-discovery",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        setTimeout(() => {
          void (async () => {
            const localRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
            const reportRoot = path.join(localRoot, "PlotPickle", "uat-focused");
            const writerRoot = path.join(localRoot, "PlotPickle", "writer-in-residence");
            console.log(`[${clock()}] Focused UAT runner ................. READY  node scripts/run-uat-closed-loop.mjs --github-report --repair`);
            console.log(`[${clock()}] Focused UAT evidence ............... READY  ${reportRoot}`);
            console.log(`[${clock()}] Startup blocker reporting .......... ACTIVE  hard startup findings -> same UAT evidence + GitHub reporter`);

            let repair = await developerRepairPreflight();
            if (!repair.ready && repair.workerAvailable !== false && process.env.PLOTPICKLE_REPAIR_AUTOLOAD !== "0") {
              const worker = repair.worker || process.env.PLOTPICKLE_REPAIR_WORKER || "pi";
              console.log(`[${clock()}] Developer repair model ............ LOADING  looking for an already-installed approved local coding model for ${repair.workerLabel || worker}`);
              const ensured = await ensureDeveloperRepairModel(worker);
              console.log(`[${clock()}] Developer repair model ............ ${ensured.ok ? "CHECKED" : "WARN"}  ${ensured.detail}`);
              repair = await developerRepairPreflight();
            }

            if (repair.ready) {
              console.log(`[${clock()}] Developer repair worker ............ READY  ${repair.workerLabel} -> ${repair.runtime?.model || "local coding model"} via ${repair.runtime?.label || "local runtime"}`);
            } else {
              const reason = String(repair.message || "no approved local coding model is currently available").split("\n")[0];
              console.log(`[${clock()}] Developer repair worker ........ NOT READY  ${repair.workerLabel || repair.worker || "Pi"}; ${reason}`);
            }
            console.log(`[${clock()}] Repair policy ...................... LOCAL  Pi default / Cline selectable / no cloud fallback`);
            console.log(`[${clock()}] Repair model helper ................ READY  node scripts/ensure-local-repair-model.mjs --worker pi`);
            console.log(`[${clock()}] Writer-in-Residence ................. READY  node scripts/run-writer-in-residence.mjs --github-report`);
            console.log(`[${clock()}] Writer experience evidence .......... READY  ${writerRoot}`);
            console.log(`[${clock()}] Synthetic feedback policy ........... LOCAL  writer diary + code-aware exhaustive UI/UX control audit -> medium/high actionable -> GitHub/Modem as synthetic`);
            console.log(`[${clock()}] Manual repair command .............. READY  node scripts/run-uat-repair-agent.mjs --worker pi --issue <number>`);
            console.log(`[${clock()}] Legacy Mastra repair ........... OPTIONAL  node scripts/run-uat-repair-agent.mjs --worker mastra-qwen --issue <number>`);
          })().catch(() => {});
        }, 1_250);
      });
    },
  };
}
