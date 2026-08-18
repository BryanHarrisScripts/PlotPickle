import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("ordinary local backup contains the PPF and project asset bytes but explicitly excludes secrets and transient state", async () => {
  const source = await read("build/local-backup-gateway.ts");
  assert.match(source, /format: typeof FORMAT/);
  assert.match(source, /projectFile: PortablePlotPickleFile/);
  assert.match(source, /assets: BackupAsset\[\]/);
  assert.match(source, /base64: bytes\.toString\("base64"\)/);
  for (const excluded of ["provider API keys", "BUZZ credentials", "Studio private signing key", "model caches", "temporary graph", "hidden reasoning", "Verification Inbox history"]) {
    assert.match(source, new RegExp(excluded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
  assert.doesNotMatch(source, /readCredentialJson|writeCredentialJson|github-connection\.json|ai-connection\.json/);
});

test("backup and restore verify package PPF and asset integrity before canonical project replacement", async () => {
  const source = await read("build/local-backup-gateway.ts");
  assert.match(source, /algorithm: "sha256"/);
  assert.match(source, /payloadSha256/);
  assert.match(source, /projectSha256/);
  assert.match(source, /Backup package integrity check failed\. No local project data was changed/);
  assert.match(source, /The backup project checksum does not match\. No local project data was changed/);
  assert.match(source, /failed its checksum\. No local project data was changed/);
  assert.match(source, /Backup is incomplete/);
  assert.match(source, /Restore would overwrite a different local asset/);
  const validation = source.indexOf("const validated = await validateRestore(bundle)");
  const stagingVerification = source.indexOf("Verify the staged copy before any active project path is touched");
  const projectCommit = source.indexOf("await atomicWrite(destinationProject, validated.projectSource)");
  assert.ok(validation >= 0 && stagingVerification > validation && projectCommit > stagingVerification, "restore must validate and stage before replacing the PPF");
});

test("restore is machine-independent and rejects unsafe portable asset paths", async () => {
  const source = await read("build/local-backup-gateway.ts");
  assert.match(source, /source\.startsWith\("assets\/"\)/);
  assert.match(source, /part === "\." \|\| part === "\.\."/);
  assert.match(source, /originalFilesystemPathRequired: false/);
  assert.match(source, /restore-staging/);
  assert.match(source, /restore-preimages/);
});

test("automatic retention is bounded while manual backups require owner deletion", async () => {
  const source = await read("build/local-backup-gateway.ts");
  assert.match(source, /AUTOMATIC_MAX_COUNT = 10/);
  assert.match(source, /AUTOMATIC_MAX_BYTES = 2 \* 1024 \* 1024 \* 1024/);
  assert.match(source, /MAX_PACKAGE_BYTES = 512 \* 1024 \* 1024/);
  assert.match(source, /pruneAutomaticBackups/);
  assert.match(source, /overCount \|\| overBudget/);
  assert.match(source, /retention: "kept-until-user-deletes"/);
  assert.match(source, /request\.method === "DELETE" && url\.pathname === `\$\{API\}\/manual`/);
  assert.match(source, /lastSuccessfulBackupAt/);
  assert.match(source, /approximateBytes/);
});

test("backup API is local-only and Studio identity recovery remains separate", async () => {
  const source = await read("build/local-backup-gateway.ts");
  const vite = await read("vite.config.ts");
  assert.match(source, /isLocalRequest/);
  assert.match(source, /Backup and restore are available only inside this local PlotPickle Studio/);
  assert.match(source, /studioIdentityRecovery: "separate-explicit-encrypted-flow-not-in-ordinary-backup"/);
  assert.match(vite, /localBackupGateway/);
  assert.match(vite, /localBackupGateway\(\)/);
});

test("final documentation names actual storage mechanisms and keeps functional and trust architecture separate", async () => {
  const docs = await read("docs/architecture/local-first-trust-storage.md");
  for (const phrase of [
    "Storage engine inventory",
    "PPF/project data",
    "Creative assets",
    "Agent Profiles",
    "Agent Skills",
    "Responsibility Runs / graphs",
    "Verification Inbox",
    "Provider/GitHub/BUZZ credentials",
    "Functional architecture",
    "Trust / authority architecture",
    "Edge legend",
    "federation never writes canon",
    "agent/tool content cannot grant itself authority",
  ]) assert.match(docs, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
});

test("deployment documentation does not pretend local PlotPickle already has hosted multi-tenant isolation", async () => {
  const docs = await read("docs/architecture/local-first-trust-storage.md");
  assert.match(docs, /local-first and server-based\/client-capable/i);
  assert.match(docs, /local owner\/writer is the approval authority/i);
  assert.match(docs, /federate outward through BUZZ\/Playhouse/i);
  assert.match(docs, /does not expose another Studio's localhost server/i);
  assert.match(docs, /future hosted or multi-user deployment/i);
  assert.match(docs, /separate roadmap/i);
  assert.doesNotMatch(docs, /currently provides hosted multi-tenant|existing tenant isolation|production multi-tenant auth/i);
});
