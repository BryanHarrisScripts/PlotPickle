import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const findings = new Map();
const MAX_FINDINGS = 50;

const forbiddenNames = [
  /(^|\/)\.env(?:\.|$)/i,
  /\.(?:pem|key|pfx|p12)$/i,
  /(^|\/)(?:credentials?|secrets?)\.json$/i,
  /(^|\/)id_(?:rsa|dsa|ecdsa|ed25519)$/i,
];

const secretPatterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["GitHub token", /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,}/],
  ["OpenAI key", /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/],
  ["Google API key", /AIza[0-9A-Za-z_-]{30,}/],
  ["AWS access key", /AKIA[0-9A-Z]{16}/],
  ["Slack token", /xox[baprs]-[A-Za-z0-9-]{20,}/],
  ["npm token", /npm_[A-Za-z0-9]{30,}/],
  ["Stripe live secret", /sk_live_[A-Za-z0-9]{20,}/],
  ["Buzz invitation token", /communities\.buzz\.xyz\/invite\/v2\.[A-Za-z0-9_-]{20,}/],
];

const ignoredContentPaths = [
  /(^|\/)package-lock\.json$/i,
  /(^|\/)(?:dist|build|release|releases|out|coverage|node_modules)\//i,
  /\.(?:png|jpe?g|gif|webp|ico|pdf|zip|7z|tar|gz|woff2?|ttf|otf|mp3|mp4|mov|wav)$/i,
];

function record(label, commit, path) {
  if (findings.size >= MAX_FINDINGS) return;
  const safeCommit = commit ? commit.slice(0, 12) : "unknown";
  const safePath = path || "unknown path";
  const key = `${label}|${safeCommit}|${safePath}`;
  findings.set(key, { label, commit: safeCommit, path: safePath });
}

async function gitLines(args, onLine) {
  const child = spawn("git", args, { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  for await (const line of lines) await onLine(line);
  const code = await new Promise((resolve) => child.on("close", resolve));
  if (code !== 0) throw new Error(`git ${args.join(" ")} failed: ${stderr.trim()}`);
}

let shallow = "";
await gitLines(["rev-parse", "--is-shallow-repository"], (line) => { shallow = line.trim(); });
if (shallow === "true") {
  console.error("Public history audit requires a complete clone. Use checkout with fetch-depth: 0.");
  process.exit(1);
}

let commit = "";
await gitLines(["log", "--all", "--name-only", "--format=@@commit:%H"], (line) => {
  if (line.startsWith("@@commit:")) {
    commit = line.slice(9).trim();
    return;
  }
  const path = line.trim();
  if (!path || path === ".env.example") return;
  if (forbiddenNames.some((pattern) => pattern.test(path))) record("private filename", commit, path);
});

commit = "";
let path = "";
await gitLines(["log", "--all", "--no-ext-diff", "--no-renames", "--unified=0", "--format=@@commit:%H", "-p"], (line) => {
  if (line.startsWith("@@commit:")) {
    commit = line.slice(9).trim();
    path = "";
    return;
  }
  const diff = line.match(/^diff --git a\/(.+) b\/(.+)$/);
  if (diff) {
    path = diff[2];
    return;
  }
  if (!path || ignoredContentPaths.some((pattern) => pattern.test(path))) return;
  if ((!line.startsWith("+") && !line.startsWith("-")) || line.startsWith("+++") || line.startsWith("---")) return;
  const text = line.slice(1);
  for (const [label, pattern] of secretPatterns) {
    if (pattern.test(text)) record(label, commit, path);
  }
});

if (findings.size) {
  console.error("Public history audit failed. Potential private material exists in Git history:");
  for (const finding of findings.values()) {
    console.error(`- ${finding.label} at ${finding.commit} in ${finding.path}`);
  }
  if (findings.size >= MAX_FINDINGS) console.error(`- Output stopped after ${MAX_FINDINGS} findings.`);
  console.error("No secret values are printed. Rotate any exposed credential before rewriting history or recording a narrowly scoped revoked-token exception.");
  process.exit(1);
}

console.log("Public history audit passed: no recognizable secrets or private filenames were found in reachable Git history.");
