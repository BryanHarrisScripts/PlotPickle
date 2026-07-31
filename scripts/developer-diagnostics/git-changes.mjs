import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { normalizeRepositoryPath } from "./registry.mjs";

const execFileAsync = promisify(execFile);

function splitLines(value) {
  return String(value || "").split(/\r?\n/).map(normalizeRepositoryPath).filter(Boolean);
}

async function git(root, args) {
  const { stdout } = await execFileAsync("git", args, {
    cwd: root,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout;
}

export async function discoverChangedFiles(root = process.cwd(), options = {}) {
  if (options.files?.length) {
    return { files: options.files.map(normalizeRepositoryPath), source: "explicit", base: null, head: null };
  }

  const environmentBase = process.env.GITHUB_BASE_SHA || process.env.GITHUB_EVENT_BEFORE || "";
  const environmentHead = process.env.GITHUB_SHA || "HEAD";
  const base = options.base || environmentBase;
  const head = options.head || environmentHead;

  if (base && !/^0+$/.test(base)) {
    try {
      const stdout = await git(root, ["diff", "--name-only", `${base}...${head}`]);
      return { files: splitLines(stdout), source: "git-range", base, head };
    } catch {}
  }

  try {
    const stdout = await git(root, ["diff", "--name-only", "HEAD~1", "HEAD"]);
    const files = splitLines(stdout);
    if (files.length) return { files, source: "git-head", base: "HEAD~1", head: "HEAD" };
  } catch {}

  try {
    const stdout = await git(root, ["status", "--porcelain"]);
    const files = splitLines(stdout).map((line) => normalizeRepositoryPath(line.slice(3)));
    if (files.length) return { files, source: "git-status", base: null, head: null };
  } catch {}

  return { files: [], source: "unavailable", base: base || null, head: head || null };
}
