import { spawn } from "node:child_process";
import process from "node:process";

export type DeepSeekHarnessState = "running" | "installed" | "available" | "not-installed";

export type DeepSeekHarnessStatus = {
  checkedAt: string;
  state: DeepSeekHarnessState;
  command: "ollama launch dsh";
  optional: true;
  autoInstallOnStartup: false;
  ollama: {
    installed: boolean;
    version: string;
    launchSupported: boolean;
  };
  dsh: {
    installed: boolean;
    running: boolean;
  };
  message: string;
};

type CommandResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  error: string;
};

let lastLaunchRequestedAt = "";

function clip(value: string, max = 1000) {
  return value.replace(/\u001b\[[0-9;]*m/g, "").trim().slice(0, max);
}

function runCommand(command: string, args: string[], timeoutMs = 3_000): Promise<CommandResult> {
  return new Promise((resolve) => {
    let settled = false;
    let stdout = "";
    let stderr = "";
    let child;
    try {
      child = spawn(command, args, {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      resolve({ ok: false, stdout: "", stderr: "", error: error instanceof Error ? error.message : "Command failed to start." });
      return;
    }

    const finish = (result: CommandResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, stdout: clip(stdout), stderr: clip(stderr), error: `Command timed out after ${timeoutMs} ms.` });
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("error", (error) => finish({ ok: false, stdout: clip(stdout), stderr: clip(stderr), error: error.message }));
    child.once("close", (code) => finish({
      ok: code === 0,
      stdout: clip(stdout),
      stderr: clip(stderr),
      error: code === 0 ? "" : clip(stderr || stdout || `Command exited with code ${code}.`, 240),
    }));
  });
}

async function commandExists(command: string) {
  const probe = process.platform === "win32"
    ? await runCommand("where.exe", [command], 1_500)
    : await runCommand("which", [command], 1_500);
  return probe.ok;
}

async function dshProcessRunning() {
  if (process.platform === "win32") {
    const result = await runCommand("tasklist.exe", ["/FI", "IMAGENAME eq dsh.exe", "/NH"], 1_500);
    return result.ok && /\bdsh\.exe\b/i.test(`${result.stdout}\n${result.stderr}`);
  }
  const result = await runCommand("pgrep", ["-f", "(^|/)dsh(\\s|$)"], 1_500);
  return result.ok && Boolean(result.stdout.trim());
}

function versionFrom(output: string) {
  return output.split(/\r?\n/).map((line) => line.trim()).find(Boolean)?.slice(0, 160) || "Installed";
}

export async function deepSeekHarnessStatus(): Promise<DeepSeekHarnessStatus> {
  const [ollamaVersion, dshInstalled, dshRunning] = await Promise.all([
    runCommand("ollama", ["--version"], 2_000),
    commandExists("dsh"),
    dshProcessRunning(),
  ]);
  const ollamaInstalled = ollamaVersion.ok;
  const launchHelp = ollamaInstalled
    ? await runCommand("ollama", ["launch", "--help"], 2_500)
    : { ok: false, stdout: "", stderr: "", error: "Ollama is not installed." };
  const launchSupported = launchHelp.ok;

  const state: DeepSeekHarnessState = dshRunning
    ? "running"
    : dshInstalled
      ? "installed"
      : ollamaInstalled && launchSupported
        ? "available"
        : "not-installed";

  const message = state === "running"
    ? "DeepSeek Harness is running on this machine."
    : state === "installed"
      ? "DeepSeek Harness is installed and ready to launch."
      : state === "available"
        ? "Ollama can launch DeepSeek Harness. PlotPickle will only install or launch it when you explicitly choose to."
        : ollamaInstalled
          ? "Update Ollama to a release that supports `ollama launch`, then refresh this status."
          : "Install Ollama first, then refresh this status.";

  return {
    checkedAt: new Date().toISOString(),
    state,
    command: "ollama launch dsh",
    optional: true,
    autoInstallOnStartup: false,
    ollama: {
      installed: ollamaInstalled,
      version: ollamaInstalled ? versionFrom(`${ollamaVersion.stdout}\n${ollamaVersion.stderr}`) : "Not installed",
      launchSupported,
    },
    dsh: {
      installed: dshInstalled,
      running: dshRunning,
    },
    message: lastLaunchRequestedAt && state !== "running"
      ? `${message} Launch was requested at ${lastLaunchRequestedAt}.`
      : message,
  };
}

function launchDetached() {
  if (process.platform === "win32") {
    return spawn("cmd.exe", ["/d", "/s", "/c", "start \"DeepSeek Harness\" cmd /k ollama launch dsh"], {
      detached: true,
      windowsHide: false,
      stdio: "ignore",
    });
  }
  if (process.platform === "darwin") {
    return spawn("osascript", ["-e", "tell application \"Terminal\" to do script \"ollama launch dsh\""], {
      detached: true,
      stdio: "ignore",
    });
  }
  return spawn("ollama", ["launch", "dsh"], {
    detached: true,
    stdio: "ignore",
  });
}

export async function launchDeepSeekHarness() {
  const status = await deepSeekHarnessStatus();
  if (!status.ollama.installed) {
    throw new Error("Ollama is not installed. Install Ollama before launching DeepSeek Harness.");
  }
  if (!status.ollama.launchSupported) {
    throw new Error("This Ollama installation does not expose `ollama launch`. Update Ollama and try again.");
  }
  if (status.dsh.running) {
    return { launched: false, alreadyRunning: true, command: status.command, status };
  }

  const child = launchDetached();
  child.unref();
  lastLaunchRequestedAt = new Date().toISOString();
  return {
    launched: true,
    alreadyRunning: false,
    command: status.command,
    requestedAt: lastLaunchRequestedAt,
    status: await deepSeekHarnessStatus(),
  };
}
