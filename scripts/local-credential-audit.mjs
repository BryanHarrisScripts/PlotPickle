#!/usr/bin/env node

import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const MAX_TEXT_BYTES = 5_000_000;
const PROTECTED_FORMAT = "plotpickle-protected-credential";
const supportedProtection = new Set([
  "windows-dpapi-current-user",
  "macos-keychain-current-user",
  "linux-secret-service-current-user",
  "linux-systemd-creds-current-user",
]);
const skippedDirectories = new Set([".git", "node_modules", ".next", "dist", "coverage", "assets"]);
const recognizableSecrets = [
  ["private-key-block", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["github-token", /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,}/],
  ["openai-key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ["google-oauth-token", /\b(?:ya29\.|1\/\/)[A-Za-z0-9._-]{20,}\b/],
  ["buzz-private-key", /\bnsec1[a-z0-9]{30,}\b/i],
  ["buzz-invitation", /communities\.buzz\.xyz\/invite\/v2\.[A-Za-z0-9_-]{20,}/],
];
const sensitiveJsonValue = /["'](?:apiKey|accessToken|refreshToken|token|clientSecret|deviceCode|verifier|privateKey|relayPrivateKey|gitHookSecret|postgresPassword|redisPassword|s3AccessKey|s3SecretKey|password)["']\s*:\s*["'](?!\[?redacted\]?|example|placeholder|test|none|null)[^"'\r\n]{8,}["']/i;

function options(argv) {
  const result = { root: repositoryRoot, home: "", json: false, strict: false };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--root") result.root = path.resolve(argv[++index] || "");
    else if (item === "--home") result.home = path.resolve(argv[++index] || "");
    else if (item === "--json") result.json = true;
    else if (item === "--strict") result.strict = true;
    else throw new Error(`Unknown local credential-audit option: ${item}`);
  }
  return result;
}

function persistentHome() {
  if (process.env.PLOTPICKLE_HOME) return path.resolve(process.env.PLOTPICKLE_HOME);
  if (process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, "PlotPickle");
  return path.join(os.homedir(), ".plotpickle");
}

function relative(root, target) {
  return (path.relative(root, target) || ".").split(path.sep).join("/");
}

async function walk(directory, root = directory) {
  if (!existsSync(directory)) return [];
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) output.push(...await walk(absolute, root));
    } else if (entry.isFile()) output.push({ absolute, relative: relative(root, absolute) });
  }
  return output;
}

async function safeText(filePath) {
  const information = await stat(filePath);
  if (!information.isFile() || information.size > MAX_TEXT_BYTES) return null;
  const bytes = await readFile(filePath);
  if (bytes.includes(0)) return null;
  return { text: bytes.toString("utf8"), bytes: information.size, mode: information.mode & 0o777 };
}

function finding(report, severity, filePath, rule) {
  report.findings.push({ severity, path: filePath, rule });
}

async function main() {
  const settings = options(process.argv.slice(2));
  const home = settings.home || persistentHome();
  const registry = JSON.parse(await readFile(path.join(settings.root, "config", "credential-boundary.registry.json"), "utf8"));
  const registered = new Set(registry.credentials.map((entry) => entry.file));
  const report = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    home,
    home_exists: existsSync(home),
    credential_files: [],
    scanned_non_vault_files: 0,
    findings: [],
  };

  if (report.home_exists) {
    const secretsDirectory = path.join(home, "secrets");
    if (existsSync(secretsDirectory)) {
      for (const entry of await readdir(secretsDirectory, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        const absolute = path.join(secretsDirectory, entry.name);
        const information = await stat(absolute);
        let protection = "malformed-or-plaintext";
        try {
          const envelope = JSON.parse(await readFile(absolute, "utf8"));
          if (envelope?.format === PROTECTED_FORMAT
            && supportedProtection.has(envelope.protection)
            && typeof envelope.ciphertext === "string"
            && envelope.ciphertext.length > 0) protection = envelope.protection;
        } catch { /* The report remains metadata-only. */ }
        report.credential_files.push({
          name: entry.name,
          bytes: information.size,
          protection,
          mode: process.platform === "win32" ? null : (information.mode & 0o777).toString(8).padStart(3, "0"),
        });
        if (!registered.has(entry.name)) finding(report, settings.strict ? "error" : "warning", `secrets/${entry.name}`, "unregistered-credential-file");
        if (!supportedProtection.has(protection)) finding(report, "error", `secrets/${entry.name}`, "credential-not-os-user-encrypted");
        if (process.platform !== "win32" && (information.mode & 0o077) !== 0) finding(report, "error", `secrets/${entry.name}`, "credential-file-permissions-not-user-only");
      }
    }

    const transient = path.join(home, "buzz", "runtime", ".env.runtime");
    if (existsSync(transient)) finding(report, "error", "buzz/runtime/.env.runtime", "transient-secret-file-left-on-disk");

    for (const file of await walk(home)) {
      if (file.relative.startsWith("secrets/")) continue;
      if (!/\.(?:ppf|json|log|txt|md|env|runtime)$/i.test(file.relative) && !/(^|\/)\.env(?:\.|$)/i.test(file.relative)) continue;
      const value = await safeText(file.absolute);
      if (!value) continue;
      report.scanned_non_vault_files += 1;
      for (const [label, pattern] of recognizableSecrets) {
        if (pattern.test(value.text)) finding(report, "error", file.relative, `recognizable-secret:${label}`);
      }
      if (sensitiveJsonValue.test(value.text)) finding(report, "error", file.relative, "non-redacted-sensitive-value-outside-vault");
    }
  }

  report.credential_files.sort((left, right) => left.name.localeCompare(right.name));
  report.findings.sort((left, right) => `${left.severity}:${left.path}:${left.rule}`.localeCompare(`${right.severity}:${right.path}:${right.rule}`));
  report.passed = !report.findings.some((item) => item.severity === "error");

  if (settings.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    console.log(`Local credential audit: ${report.passed ? "PASS" : "FAIL"}`);
    console.log(`PlotPickle home present: ${report.home_exists ? "yes" : "no"}`);
    console.log(`Credential envelopes: ${report.credential_files.length}`);
    console.log(`Non-vault text files scanned: ${report.scanned_non_vault_files}`);
    for (const item of report.findings) console.log(`- ${item.severity.toUpperCase()} ${item.path}: ${item.rule}`);
    if (!report.findings.length) console.log("- No local credential-boundary violations found.");
    console.log("No credential values were decrypted or printed.");
  }
  if (!report.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Local credential audit could not run: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
