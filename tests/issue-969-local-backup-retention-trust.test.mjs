import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("complete backup keeps the existing PPF as the canonical project payload", async () => {
  const [backup, ppf] = await Promise.all([
    read("lib/local-backup.ts"),
    read("lib/ppf-exchange.ts"),
  ]);
  assert.match(backup, /packageProject/);
  assert.match(backup, /kind: "complete-project"/);
  assert.match(backup, /"project\.ppf": packaged\.buffer/);
  assert.match(backup, /inspectPackage\(outer\.entries\["project\.ppf"\]\)/);
  assert.match(backup, /projectFromPackage\(outer\.entries\["project\.ppf"\]\)/);
  assert.match(ppf, /sha256/);
  assert.match(ppf, /Checksum failed for/);
  assert.match(ppf, /gitIncluded: false/);
});

test("complete backup records canonical revision and rejects project/revision mismatches", async () => {
  const backup = await read("lib/local-backup.ts");
  assert.match(backup, /currentProjectRevision\(project\)/);
  assert.match(backup, /Backup project ID does not match project\.ppf/);
  assert.match(backup, /Backup project revision does not match project\.ppf canonical revision/);
  assert.match(backup, /requiresExplicitApply: true/);
  assert.match(backup, /overwritePerformed: false/);
});

test("project backup explicitly excludes credentials signing keys and BUZZ-owned private data", async () => {
  const [backup, docs] = await Promise.all([
    read("lib/local-backup.ts"),
    read("docs/local-backup-retention.md"),
  ]);
  for (const phrase of ["credential", "provider secrets", "private signing keys", "BUZZ private keys", "BUZZ-owned private agent memory", "BUZZ runtime/provider/model configuration", "relay history"]) {
    assert.match(backup, new RegExp(phrase, "i"));
    assert.match(docs, new RegExp(phrase, "i"));
  }
  assert.match(backup, /includesCredentials: false/);
  assert.match(backup, /includesProviderSecrets: false/);
  assert.match(backup, /includesStudioPrivateSigningKeys: false/);
  assert.match(backup, /includesBuzzPrivateKeys: false/);
  assert.match(backup, /includesBuzzOwnedMemoryOrRuntimeConfig: false/);
  assert.match(docs, /must not crawl `~\/\.buzz`/);
});

test("restore is previewed and explicitly confirmed before browser project replacement", async () => {
  const [gateway, controls, page] = await Promise.all([
    read("build/local-backup-gateway.ts"),
    read("app/local-backup-controls.tsx"),
    read("app/diagnostics/page.tsx"),
  ]);
  assert.match(gateway, /previewBackup/);
  assert.match(gateway, /requiresExplicitApply: true/);
  assert.match(gateway, /overwritePerformed: false/);
  assert.match(gateway, /Restore confirmation is required/);
  assert.match(gateway, /input\.confirm === true/);
  assert.match(controls, /Preview & Restore/);
  assert.match(controls, /window\.confirm/);
  assert.match(controls, /confirm: true/);
  assert.match(page, /applyRestoredProject/);
  assert.match(page, /window\.localStorage\.setItem/);
  assert.ok(controls.indexOf("window.confirm") < controls.indexOf("confirm: true"));
});

test("retention defaults bound operational evidence while canonical project history is never auto-pruned", async () => {
  const retention = await read("lib/retention-policy.ts");
  assert.match(retention, /responsibilityRuns: \{ maxAgeDays: 30, maxCount: 100, minimumKeep: 10 \}/);
  assert.match(retention, /verification: \{ maxAgeDays: 90, maxCount: 100, minimumKeep: 10 \}/);
  assert.match(retention, /traceLogs: \{ maxAgeDays: 14, maxCount: 50, minimumKeep: 5 \}/);
  assert.match(retention, /backups: \{ maxAgeDays: 180, maxCount: 20, minimumKeep: 5 \}/);
  assert.match(retention, /canonicalProjectHistory: "never-auto-prune"/);
  assert.match(retention, /if \(record\.pinned\)/);
  assert.match(retention, /reason: "pinned"/);
  assert.match(retention, /ppfCanonicalRevisionHistory: "never-auto-prune"/);
  assert.match(retention, /acceptedCreativeMutations: "never-auto-prune"/);
});

test("retention gateway only manages approved evidence directories rather than sweeping app support", async () => {
  const gateway = await read("build/local-backup-gateway.ts");
  assert.match(gateway, /persistentHome\(\), "responsibility-runs"/);
  assert.match(gateway, /persistentHome\(\), "verification-inbox", "records"/);
  assert.match(gateway, /persistentHome\(\), "full-verification"/);
  assert.match(gateway, /persistentHome\(\), "backup-archives"/);
  assert.match(gateway, /retentionRecords/);
  assert.match(gateway, /rootForKind/);
  assert.match(gateway, /planRetention/);
  assert.doesNotMatch(gateway, /readdir\(persistentHome\(\)/);
  assert.doesNotMatch(gateway, /\.buzz|BUZZ_PRIVATE_KEY|github-connection\.json/);
});

test("writer can see storage use pin delete clean up and export safe diagnostics", async () => {
  const controls = await read("app/local-backup-controls.tsx");
  assert.match(controls, /Local backup, restore & storage/);
  assert.match(controls, /Create complete backup/);
  assert.match(controls, /Clean up old evidence/);
  assert.match(controls, /Export diagnostics/);
  assert.match(controls, /reclaimableBytes/);
  assert.match(controls, /Pin/);
  assert.match(controls, /Unpin/);
  assert.match(controls, /Delete/);
  assert.match(controls, /Canonical project history is not included in that cleanup/);
});

test("safe diagnostics export contains metadata only and says what it excludes", async () => {
  const gateway = await read("build/local-backup-gateway.ts");
  assert.match(gateway, /format: "plotpickle-local-diagnostics"/);
  assert.match(gateway, /records: records\.map\(\(\{ id, kind, createdAt, bytes, pinned \}\)/);
  assert.match(gateway, /Project content, prompts, credentials, provider secrets, signing keys and BUZZ private data are excluded/);
});

test("trust docs contain truthful current and target diagrams plus the required authority matrix", async () => {
  const docs = await read("docs/architecture-trust-boundaries.md");
  assert.match(docs, /Current architecture — implemented foundation/);
  assert.match(docs, /Target architecture — universal adoption path/);
  assert.ok((docs.match(/```mermaid/g) || []).length >= 2);
  assert.match(docs, /Authority matrix/);
  for (const actor of ["Writer", "PPF canonical project", "Product agent", "Deterministic\/fresh verifier", "BUZZ-hosted", "Repair\/developer agent", "Agent Skill"]) assert.match(docs, new RegExp(actor, "i"));
  assert.match(docs, /Some older product-agent call paths still/);
  assert.match(docs, /execution capability never implies PlotPickle authority/);
});

test("deployment docs distinguish same-machine support from unverified LAN/cloud assumptions", async () => {
  const docs = await read("docs/private-deployment.md");
  assert.match(docs, /Local desktop \/ same-machine server/);
  assert.match(docs, /current sensitive local gateways are intentionally loopback-only/);
  assert.match(docs, /Do not open the existing loopback gateways to a LAN or the public Internet/);
  assert.match(docs, /Optional cloud\/BYOK model calls/);
  assert.match(docs, /BUZZ remains a separate trust domain/);
  assert.match(docs, /Production now vs target wiring/);
  assert.match(docs, /future NOOA\/Python specialist/);
  assert.match(docs, /not part of the current production runtime/);
});

test("backup gateway is loopback-only and registered beside existing local storage safety", async () => {
  const [gateway, vite] = await Promise.all([
    read("build/local-backup-gateway.ts"),
    read("vite.config.ts"),
  ]);
  assert.match(gateway, /isLocalRequest/);
  assert.match(gateway, /Backups and retention are available only inside this local PlotPickle Studio/);
  assert.match(vite, /localStorageSafetyGateway/);
  assert.match(vite, /localBackupGateway/);
});
