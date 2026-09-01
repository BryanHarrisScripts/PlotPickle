import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createExactHeadArchitectureSnapshot } from "../build/autonomous-guest/maintainer/architecture-learner.mjs";
import { runRepositoryArchitectureInventory } from "./repository-architecture-inventory.mjs";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedIndex = process.argv.indexOf("--exact-head");
const expectedHead = expectedIndex >= 0 ? process.argv[expectedIndex + 1] : "";
const [{ stdout }, { stdout: statusOutput }] = await Promise.all([
  run("git", ["rev-parse", "HEAD"], { cwd: ROOT }),
  run("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: ROOT }),
]);
const actualHead = stdout.trim().toLowerCase();
const trackedChanges = statusOutput
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((line) => !line.slice(3).replaceAll("\\", "/").startsWith(".artifacts/"));
if (trackedChanges.length) {
  throw new Error("Maintainer architecture learner requires a clean exact-head repository checkout.");
}
if (expectedHead && expectedHead.toLowerCase() !== actualHead) {
  throw new Error(`Maintainer architecture learner expected ${expectedHead.toLowerCase()} but repository HEAD is ${actualHead}.`);
}

const inventory = await runRepositoryArchitectureInventory({ writeArtifact: true });
const snapshot = createExactHeadArchitectureSnapshot({
  authority: {
    authorityClass: "delegated-guest-autonomous-operator",
    delegated: true,
    humanProfileId: "",
    accessMode: "desktop-loopback",
    autonomousRunId: process.env.PLOTPICKLE_AUTONOMOUS_RUN_ID || "maintainer-architecture-ci",
    workspaceId: process.env.PLOTPICKLE_WORKSPACE_ID || "repository-main",
    operatorId: process.env.PLOTPICKLE_OPERATOR_ID || "architecture-learner",
  },
  exactCommitSha: actualHead,
  inventory,
});

const artifactRoot = path.join(ROOT, ".artifacts", "repository-architecture");
await mkdir(artifactRoot, { recursive: true });
await writeFile(path.join(artifactRoot, "maintainer-snapshot.json"), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: "PASS", snapshotId: snapshot.snapshotId, exactCommitSha: snapshot.exactCommitSha, domainCount: snapshot.domains.length }));
