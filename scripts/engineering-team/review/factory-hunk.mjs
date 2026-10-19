#!/usr/bin/env node
/**
 * #3146: manual, read-only Hunk 0.23 review handoff for factory draft PRs.
 * This tool is never called by the unattended engineering worker. Hunk
 * supplies an operator diff viewer, not an independent pass or merge gate.
 */
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { HunkReviewController, hunkReviewArguments } from "../../../build/dsdd/hunk-review-controller.mjs";
import { runPortableCommand } from "../../pi-worker-runtime.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..", "..");
const BRIDGE = path.resolve(HERE, "..", "..", "pi", "hunk-review-terminal.ps1");
const PR = /^[1-9][0-9]{0,9}$/;

export function parseFactoryHunkArgs(argv) {
  if (argv.length === 1 && argv[0] === "--status")
    return Object.freeze({ mode: "status" });
  if (argv.length === 2 && argv[0] === "--pr" && PR.test(argv[1])) {
    const number = Number(argv[1]);
    if (Number.isSafeInteger(number) && number <= 2_147_483_647)
      return Object.freeze({ mode: "review", number });
  }
  throw new Error("Use --status or --pr POSITIVE_PLOTPICKLE_PR_NUMBER only.");
}

export function factoryHunkTarget(number) {
  if (!Number.isSafeInteger(number) || number <= 0 || number > 2_147_483_647)
    throw new Error("Invalid bounded pull request number.");
  const target = Object.freeze({ kind: "pull-request", number });
  // Reuse the existing reviewed adapter: no extensions, fixed repo, no
  // human-provided paths, refs, shell flags, issue titles, or PR prose.
  const args = hunkReviewArguments(target);
  if (args.join(" ") !== `--no-extensions gh pr ${number} --repo BryanHarrisScripts/PlotPickle`)
    throw new Error("Unrecognized Hunk review adapter.");
  return target;
}

export async function factoryHunkReview(argv, {
  platform = process.platform,
  controller = new HunkReviewController({ repositoryRoot: REPO }),
  run = runPortableCommand,
  repositoryRoot = REPO,
  bridge = BRIDGE,
} = {}) {
  const request = parseFactoryHunkArgs(argv);
  const advisory = Object.freeze({
    sourceMutation: false, modelDispatch: false,
    independentCiProof: false, windowsProductGateProof: false,
    mergeAuthority: false, unattendedReview: false,
  });
  if (request.mode === "status") {
    const status = await controller.capabilities();
    return Object.freeze({ state: status.state === "ready" ? "HUNK_REVIEW_READY" : "HUNK_REVIEW_UNAVAILABLE",
      versionPolicy: "0.23.x", message: status.message, ...advisory });
  }
  if (platform !== "win32") throw new Error("Native Hunk review requires a local Windows operator.");
  const target = factoryHunkTarget(request.number);
  const command = await controller.command(); // exact existing 0.23.x check
  const result = await run("powershell.exe", [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", bridge,
    "-Action", "Start", "-HunkCommand", command,
    "-RepositoryRoot", repositoryRoot,
    "-PullRequest", String(target.number),
  ], { timeout: 15_000 });
  const ownership = JSON.parse(String(result.stdout || "").trim());
  if (!Number.isSafeInteger(ownership.pid) || ownership.pid <= 0 ||
    !/^\d+$/.test(ownership.startTicks || ""))
    throw new Error("Hunk review launch has no native process ownership receipt.");
  return Object.freeze({
    state: "HUNK_ADVISORY_REVIEW_LAUNCHED",
    pullRequest: target.number, pid: ownership.pid, startTicks: ownership.startTicks,
    reviewProcess: "locally launched; close the Hunk window to end the review",
    ...advisory,
  });
}

async function main() {
  const result = await factoryHunkReview(process.argv.slice(2));
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  main().catch(error => {
    process.stderr.write("FACTORY_HUNK_REVIEW_BLOCKED: " + String(error?.message || "unknown").slice(0, 150) + "\n");
    process.exitCode = 1;
  });
