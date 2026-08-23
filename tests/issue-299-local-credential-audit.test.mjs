import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const auditScript = path.join(root, "scripts", "local-credential-audit.mjs");

function runAudit(home) {
  return spawnSync(process.execPath, [auditScript, "--root", root, "--home", home, "--strict", "--json"], {
    cwd: root,
    encoding: "utf8",
  });
}

async function withTemporaryHome(callback) {
  const home = await mkdtemp(path.join(os.tmpdir(), "plotpickle-credential-audit-"));
  try {
    await callback(home);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

test("installed-machine audit reports protected envelope metadata without printing ciphertext", async () => {
  await withTemporaryHome(async (home) => {
    const secrets = path.join(home, "secrets");
    await mkdir(secrets, { recursive: true });
    const ciphertext = ["opaque", "ciphertext", "fixture", "value"].join("-");
    const envelope = {
      format: "plotpickle-protected-credential",
      version: 1,
      protection: process.platform === "win32" ? "windows-dpapi-current-user" : "linux-systemd-creds-current-user",
      ciphertext,
    };
    const credentialPath = path.join(secrets, "ai-connection.json");
    await writeFile(credentialPath, `${JSON.stringify(envelope)}\n`, { mode: 0o600 });
    if (process.platform !== "win32") await chmod(credentialPath, 0o600);

    const result = runAudit(home);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.passed, true);
    assert.equal(report.credential_files.length, 1);
    assert.equal(report.credential_files[0].name, "ai-connection.json");
    assert.doesNotMatch(result.stdout, new RegExp(ciphertext));
  });
});

test("installed-machine audit fails closed without echoing discovered secret values", async () => {
  await withTemporaryHome(async (home) => {
    const secrets = path.join(home, "secrets");
    const projectDirectory = path.join(home, "projects");
    const buzzRuntime = path.join(home, "buzz", "runtime");
    await mkdir(secrets, { recursive: true });
    await mkdir(projectDirectory, { recursive: true });
    await mkdir(buzzRuntime, { recursive: true });

    const syntheticToken = ["gh", "p_", "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"].join("");
    await writeFile(path.join(secrets, "ai-connection.json"), `${JSON.stringify({ apiKey: syntheticToken })}\n`, { mode: 0o600 });
    await writeFile(path.join(projectDirectory, "example.ppf"), `${JSON.stringify({ token: syntheticToken })}\n`);
    await writeFile(path.join(buzzRuntime, ".env.runtime"), "TEMPORARY_RUNTIME_SECRET=present\n", { mode: 0o600 });

    const result = runAudit(home);
    assert.equal(result.status, 1, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.passed, false);
    const rules = report.findings.map((entry) => entry.rule);
    assert.ok(rules.includes("credential-not-os-user-encrypted"));
    assert.ok(rules.includes("transient-secret-file-left-on-disk"));
    assert.ok(rules.some((rule) => rule.startsWith("recognizable-secret:") || rule === "non-redacted-sensitive-value-outside-vault"));
    assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, new RegExp(syntheticToken));
  });
});

test("canonical registry includes encrypted GitHub project synchronization state", async () => {
  const registry = JSON.parse(await import("node:fs/promises").then(({ readFile }) => readFile(path.join(root, "config", "credential-boundary.registry.json"), "utf8")));
  const sync = registry.credentials.find((entry) => entry.file === "github-project-sync.json");
  assert.equal(sync?.source, "build/github-project-sync-gateway.ts");
  assert.match(sync?.export_boundary || "", /never|not embedded/i);
});
