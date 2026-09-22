import { spawn } from "node:child_process";
import path from "node:path";

export type DsddPiAction = {
  action: "append-human" | "append-interpretation" | "lock-intent" | "append-developer-brief" | "record-publication" | "record-evidence";
  cwd: string;
  sessionDir: string;
  sessionId: string;
  sessionFile?: string;
  text?: string;
  context?: unknown;
  targetEntryId?: string;
  lockedText?: string;
  intent?: unknown;
  intentVersion?: number;
  requirements?: unknown[];
  publication?: unknown;
};

export type DsddPiResult = {
  ok: true;
  piVersion: string;
  sessionId: string;
  sessionFile: string;
  entryId: string;
  rawEntryCount: number;
  projectedMessageCount: number;
};

const SCRIPT = path.resolve(process.cwd(), "scripts", "dsdd-pi-session.mjs");

export function runDsddPiAction(input: DsddPiAction): Promise<DsddPiResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT], {
      cwd: input.cwd,
      env: process.env,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill(), 4 * 60_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `DSDD Pi session bridge exited ${code}.`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as DsddPiResult;
        if (!parsed.ok || parsed.piVersion !== "0.87.0") throw new Error("DSDD Pi session bridge returned an invalid result.");
        resolve(parsed);
      } catch (error) {
        reject(error instanceof Error ? error : new Error("DSDD Pi session bridge returned invalid JSON."));
      }
    });
    child.stdin.end(JSON.stringify(input), "utf8");
  });
}
