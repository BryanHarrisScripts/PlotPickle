import { spawn } from "node:child_process";
import path from "node:path";
import { createInterface } from "node:readline/promises";

let startupUatPromptShown = false;

function startupPromptAllowed() {
  return Boolean(process.env.PLOTPICKLE_STARTUP_CONTRACT)
    && process.stdin.isTTY === true
    && process.stdout.isTTY === true;
}

function launchClosedLoop(baseUrl: string) {
  const runner = path.resolve(process.cwd(), "scripts", "run-uat-closed-loop.mjs");
  const child = spawn(process.execPath, [
    runner,
    "--base-url",
    baseUrl,
    "--github-report",
    "--repair",
  ], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    windowsHide: false,
  });

  child.once("error", (error) => {
    console.error(`[UAT] Could not start the PlotPickle UAT Agent: ${error.message}`);
  });
  child.once("exit", (code) => {
    if (code === 0) {
      console.log("[UAT] PlotPickle UAT Agent finished without blockers.");
      return;
    }
    console.log(`[UAT] PlotPickle UAT Agent finished with exit code ${code ?? 1}. Review blockers, repair output, and any draft PR above.`);
  });
}

export async function offerStartupUatDecision(baseUrl: string) {
  if (startupUatPromptShown || !startupPromptAllowed()) {
    return { offered: false, started: false } as const;
  }
  startupUatPromptShown = true;

  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    while (true) {
      const answer = (await prompt.question("Start the PlotPickle UAT Agent now? [Y/N]: ")).trim().toLowerCase();
      if (answer === "n" || answer === "no") {
        console.log("[UAT] Not started. PlotPickle will continue running normally.");
        return { offered: true, started: false } as const;
      }
      if (answer === "y" || answer === "yes") {
        console.log("[UAT] Starting focused UAT, GitHub reporting, and the local Repair Agent...");
        launchClosedLoop(baseUrl);
        return { offered: true, started: true } as const;
      }
      console.log("Please enter Y or N.");
    }
  } finally {
    prompt.close();
  }
}
