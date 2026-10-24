import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
export function privateGatewayRoot(env = process.env) {
  const base = env.LOCALAPPDATA || (process.platform === "win32"
    ? path.join(os.homedir(), "AppData", "Local") : path.join(os.homedir(), ".local", "share"));
  return path.join(base, "PlotPickle", "engineering-team", "conversation-gateway");
}

// Host identity is read from Git and checked against launcher provenance.
// Neither the browser nor an AI answer can supply source/channel authority.
export async function gatewayAppSource({ repoRoot = process.cwd(), env = process.env } = {}) {
  try {
    const read = async args => String((await run("git", args, {
      cwd: repoRoot, windowsHide: true, timeout: 5000, maxBuffer: 4096,
    })).stdout).trim();
    const head = await read(["rev-parse", "HEAD"]);
    if (!/^[a-f0-9]{40}$/.test(head) ||
        await read(["status", "--porcelain", "--untracked-files=no"])) return null;
    const origin = await read(["remote", "get-url", "origin"]);
    if (!/^(?:https:\/\/github\.com\/|git@github\.com:)BryanHarrisScripts\/PlotPickle(?:\.git)?$/i.test(origin)) return null;
    if (env.PLOTPICKLE_LAUNCH_SOURCE_HEAD && env.PLOTPICKLE_LAUNCH_SOURCE_HEAD !== head) return null;
    const branch = await read(["branch", "--show-current"]);
    if (branch === "main" && env.PLOTPICKLE_LAUNCH_CHANNEL !== "pr-test")
      return { head, channel: "main" };
    if (env.PLOTPICKLE_LAUNCH_SOURCE_HEAD === head &&
        env.PLOTPICKLE_LAUNCH_CHANNEL === "pr-test" &&
        /^[1-9][0-9]{0,6}$/.test(env.PLOTPICKLE_LAUNCH_PR_NUMBER || ""))
      return { head, channel: "candidate" };
  } catch { return null; }
  return null;
}
