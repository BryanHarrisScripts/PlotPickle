import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let commit = process.env.GITHUB_SHA || process.env.CF_PAGES_COMMIT_SHA || process.env.OPENAI_GIT_COMMIT_SHA || "";
if (!commit) {
  try { commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(); } catch { commit = "unknown"; }
}
const payload = {
  schemaVersion: 1,
  repository: "https://github.com/BryanHarrisScripts/PlotPickle",
  sourceCommit: commit,
  generatedAt: new Date().toISOString(),
  authority: "github-main",
  hosting: "chatgpt-sites",
};
const target = resolve(root, "public", "source.json");
await mkdir(dirname(target), { recursive: true });
await writeFile(target, JSON.stringify(payload, null, 2) + "\n", "utf8");
process.stdout.write("Wrote public/source.json for " + commit + "\n");
