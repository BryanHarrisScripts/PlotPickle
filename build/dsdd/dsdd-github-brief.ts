import { spawn } from "node:child_process";
import path from "node:path";

export type DsddPublishedIssue = {
  ok: true;
  repository: "BryanHarrisScripts/PlotPickle";
  number: number;
  title: string;
  url: string;
};

const SCRIPT = path.resolve(process.cwd(), "scripts", "dsdd-publish-brief.mjs");

export function publishDsddBrief(input: { title: string; body: string }): Promise<DsddPublishedIssue> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT], {
      cwd: process.cwd(),
      env: process.env,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill(), 90_000);
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
        reject(new Error(stderr.trim() || `DSDD Publish Brief bridge exited ${code}.`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as DsddPublishedIssue;
        if (!parsed.ok || parsed.repository !== "BryanHarrisScripts/PlotPickle" || !parsed.number || !parsed.url) {
          throw new Error("DSDD Publish Brief bridge returned an invalid GitHub Issue result.");
        }
        resolve(parsed);
      } catch (error) {
        reject(error instanceof Error ? error : new Error("DSDD Publish Brief bridge returned invalid JSON."));
      }
    });
    child.stdin.end(JSON.stringify(input), "utf8");
  });
}
