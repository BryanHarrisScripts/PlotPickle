import { spawn } from "node:child_process";
import path from "node:path";

export type DsddPiBriefInput = {
  humanStatement: string;
  understoodMeaning: string;
  context: unknown;
  requirements: Array<{ id: string; text: string }>;
};

export type DsddPiBriefResult = {
  ok: true;
  reviewer: "pi";
  piVersion: string;
  model: string;
  runtime: string;
  tools: ["read", "grep", "find", "ls"];
  repositoryMutation: false;
  grounding: {
    state: "valid";
    observedPaths: string[];
    claimedPaths: string[];
    toolCallCount: number;
  };
  text: string;
};

const SCRIPT = path.resolve(process.cwd(), "scripts", "dsdd-pi-draft.mjs");

export function runDsddPiBrief(input: DsddPiBriefInput): Promise<DsddPiBriefResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT], {
      cwd: process.cwd(),
      env: process.env,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const settle = (error?: Error, value?: DsddPiBriefResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else if (value) resolve(value);
      else reject(new Error("Pi Draft bridge completed without a result."));
    };
    timer = setTimeout(() => {
      child.kill();
      settle(new Error("Pi Draft exceeded PlotPickle's bounded read-only review window."));
    }, 13 * 60_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.length > 64 * 1024) {
        child.kill();
        settle(new Error("Pi Draft returned more output than the bounded developer-brief contract allows."));
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (stderr.length > 64 * 1024) stderr = stderr.slice(-64 * 1024);
    });
    child.once("error", (error) => settle(error));
    child.once("close", (code) => {
      if (settled) return;
      if (code !== 0) {
        settle(new Error(stderr.trim() || `Pi Draft bridge exited ${code}.`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as DsddPiBriefResult;
        if (
          !parsed.ok
          || parsed.reviewer !== "pi"
          || parsed.repositoryMutation !== false
          || parsed.grounding?.state !== "valid"
          || !Array.isArray(parsed.grounding?.observedPaths)
          || !Array.isArray(parsed.grounding?.claimedPaths)
          || !parsed.text?.trim()
        ) {
          throw new Error("Pi Draft bridge returned an invalid read-only developer brief.");
        }
        settle(undefined, parsed);
      } catch (error) {
        settle(error instanceof Error ? error : new Error("Pi Draft bridge returned invalid JSON."));
      }
    });
    child.stdin.end(JSON.stringify(input), "utf8");
  });
}
