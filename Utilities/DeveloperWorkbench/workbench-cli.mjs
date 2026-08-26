import os from "node:os";
import path from "node:path";

export function requiredCliValue(argv, flag) {
  const position = argv.indexOf(flag);
  const value = position >= 0 ? argv[position + 1] : "";
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required ${flag} argument.`);
  }
  return value;
}

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return Boolean(relative)
    && relative !== ".."
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative);
}

export function requiredWorkbenchTempPath(argv, flag) {
  const trustedRoot = path.resolve(os.tmpdir(), "PlotPickle", "DeveloperWorkbench");
  const candidate = path.resolve(requiredCliValue(argv, flag));
  if (!inside(trustedRoot, candidate)) {
    throw new Error(`${flag} must stay inside the PlotPickle Developer Workbench temporary directory.`);
  }
  return candidate;
}

export function requireCurrentRepository(reviewPackage) {
  const current = path.resolve(process.cwd());
  const supplied = path.resolve(String(reviewPackage?.repositoryPath || ""));
  if (!reviewPackage?.repositoryPath || supplied !== current) {
    throw new Error("Developer Workbench review package repositoryPath must match the host-selected working directory.");
  }
  reviewPackage.repositoryPath = current;
  return current;
}
