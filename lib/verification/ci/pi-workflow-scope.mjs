// #3293: pi-specific reusable Product Gate job changes select only Pi proof lanes.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const JOBS = Object.freeze(["pi-runtime-windows", "pi-cli-mock-windows"]);
const TARGET = ".github/workflows/product-gate.yml";

export function piJobBody(source, id) {
  const lines = String(source).replaceAll("\r\n", "\n").split("\n");
  const start = lines.findIndex(line => line === "  " + id + ":");
  if (start < 0) throw new Error("Missing Pi Product Gate job: " + id);
  let end = start + 1;
  while (end < lines.length && !/^  [a-z0-9-]+:\s*$/.test(lines[end])) end++;
  return lines.slice(start, end).join("\n").trimEnd();
}
export function piWindowsJobChanged(before, after) {
  return JOBS.some(id => piJobBody(before, id) !== piJobBody(after, id));
}

function main() {
  const base = process.argv[2] || "";
  if (!/^[a-f0-9]{40}$/.test(base)) throw new Error("Exact Git base SHA required");
  const previous = execFileSync("git", ["show", base + ":" + TARGET],
    { encoding: "utf8", timeout: 10000, maxBuffer: 1024 * 1024 });
  const current = readFileSync(TARGET, "utf8");
  process.stdout.write(piWindowsJobChanged(previous, current) ? "true\n" : "false\n");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) {
    process.stderr.write("PI_SCOPE_UNVERIFIABLE: " + error.message + "\n");
    process.exitCode = 1;
  }
}
