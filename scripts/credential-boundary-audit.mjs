import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const args = process.argv.slice(2);

function option(name, fallback = "") {
  const index = args.indexOf(name);
  return index >= 0 && typeof args[index + 1] === "string" ? args[index + 1] : fallback;
}

const root = path.resolve(option("--root", repositoryRoot));
const mode = option("--mode", root === repositoryRoot ? "source" : "package");
if (!new Set(["source", "package"]).has(mode)) throw new Error("Use --mode source or --mode package.");

const failures = [];
const registryPath = path.join(root, "config", "credential-boundary.registry.json");
if (!existsSync(registryPath)) failures.push("Missing config/credential-boundary.registry.json.");
const registry = existsSync(registryPath)
  ? JSON.parse(readFileSync(registryPath, "utf8"))
  : { credentials: [], sensitive_field_names: [], redaction_contracts: [] };
const publicConfigs = [
  {
    path: "config/github-app.json",
    forbiddenFields: ["clientSecret", "privateKey", "accessToken", "refreshToken", "webhookSecret"],
  },
  {
    path: "config/google-oauth.json",
    forbiddenFields: ["clientSecret", "accessToken", "refreshToken", "authorizationCode", "privateKey"],
  },
];

const skippedDirectories = new Set([".git", ".next", ".wrangler", "coverage", "dist", "node_modules", "releases"]);
const skippedBinaryExtensions = new Set([
  ".7z", ".avi", ".bmp", ".eot", ".gif", ".gz", ".ico", ".jpeg", ".jpg", ".mov", ".mp3", ".mp4",
  ".otf", ".pdf", ".png", ".tar", ".ttf", ".wav", ".webm", ".webp", ".woff", ".woff2", ".zip",
]);

function walk(folder, output = []) {
  for (const name of readdirSync(folder).sort()) {
    if (skippedDirectories.has(name)) continue;
    const absolute = path.join(folder, name);
    const info = statSync(absolute);
    if (info.isDirectory()) walk(absolute, output);
    else if (info.isFile()) output.push(path.relative(root, absolute).split(path.sep).join("/"));
  }
  return output;
}

function sourceFiles() {
  if (mode === "source") {
    try {
      return execFileSync("git", ["-C", root, "ls-files", "-z"], { encoding: "utf8" })
        .split("\0")
        .filter(Boolean)
        .sort();
    } catch {
      // A source archive without .git is still auditable through a recursive file walk.
    }
  }
  return walk(root);
}

const files = sourceFiles();
const fileSet = new Set(files);

function textFile(relative) {
  const absolute = path.join(root, relative);
  if (!existsSync(absolute)) return "";
  const info = statSync(absolute);
  if (!info.isFile() || info.size > 5_000_000 || skippedBinaryExtensions.has(path.extname(relative).toLowerCase())) return "";
  const bytes = readFileSync(absolute);
  return bytes.includes(0) ? "" : bytes.toString("utf8");
}

const forbiddenNames = [
  /(^|\/)\.env(?:\.(?!example$).+)?$/i,
  /\.(?:pem|key|pfx|p12)$/i,
  /(^|\/)(?:credentials?|secrets?)\.json$/i,
  /(^|\/)id_(?:rsa|dsa|ecdsa|ed25519)$/i,
];

for (const relative of files) {
  if (relative === ".env.example" || relative.endsWith("/.env.example")) continue;
  if (forbiddenNames.some((pattern) => pattern.test(relative))) failures.push(`Private credential filename is included: ${relative}`);
}

const secretPatterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["GitHub token", /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,}/],
  ["OpenAI key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ["Google OAuth access token", /\bya29\.[A-Za-z0-9._-]{20,}\b/],
  ["Google OAuth refresh token", /\b1\/\/[A-Za-z0-9._-]{20,}\b/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ["npm token", /\bnpm_[A-Za-z0-9]{30,}\b/],
  ["Stripe live secret", /\bsk_live_[A-Za-z0-9]{20,}\b/],
  ["Buzz private key", /\bnsec1[a-z0-9]{30,}\b/i],
  ["Buzz invitation token", /communities\.buzz\.xyz\/invite\/v2\.[A-Za-z0-9_-]{20,}/],
];

for (const relative of files) {
  if (relative === "package-lock.json") continue;
  const source = textFile(relative);
  if (!source) continue;
  for (const [label, pattern] of secretPatterns) {
    if (pattern.test(source)) failures.push(`Recognizable ${label} appears in ${relative}.`);
  }
}

const localCredentialsPath = "build/local-credentials.ts";
const localCredentials = textFile(localCredentialsPath);
for (const marker of [
  "windows-dpapi-current-user",
  "macos-keychain-current-user",
  "linux-secret-service-current-user",
  "linux-systemd-creds-current-user",
  "PlotPickle will not save credentials without Linux user encryption",
  'open(temporary, "w", 0o600)',
  "await writeCredentialJson(safeName, stored)",
]) {
  if (!localCredentials.includes(marker)) failures.push(`Encrypted storage contract is missing marker ${JSON.stringify(marker)} in ${localCredentialsPath}.`);
}
if (registry.encryption_contract?.plaintext_fallback_allowed !== false) failures.push("Credential registry must explicitly forbid plaintext fallback.");

const credentialFiles = new Set();
for (const credential of registry.credentials || []) {
  for (const field of ["id", "file", "source", "browser_exposure", "export_boundary", "remove_or_revoke", "owner_follow_up"]) {
    if (!credential[field] || typeof credential[field] !== "string") failures.push(`Credential registry entry ${credential.id || "<unknown>"} is missing ${field}.`);
  }
  if (!Array.isArray(credential.contains) || !credential.contains.length) failures.push(`Credential registry entry ${credential.id || "<unknown>"} has no sensitive fields.`);
  if (credentialFiles.has(credential.file)) failures.push(`Credential registry repeats ${credential.file}.`);
  credentialFiles.add(credential.file);
  if (!fileSet.has(credential.source)) failures.push(`Credential source is missing from ${mode}: ${credential.source}.`);
  const source = textFile(credential.source);
  if (source && !source.includes(credential.file)) failures.push(`${credential.source} does not name registered credential file ${credential.file}.`);
  if (source && !/readCredentialJson|writeCredentialJson|removeCredentialFile/.test(source)) {
    failures.push(`${credential.source} does not use the encrypted credential gateway for ${credential.file}.`);
  }
}

function hasForbiddenKey(value, forbidden, prefix = "") {
  if (!value || typeof value !== "object") return [];
  const findings = [];
  for (const [key, child] of Object.entries(value)) {
    const location = prefix ? `${prefix}.${key}` : key;
    if (forbidden.has(key)) findings.push(location);
    findings.push(...hasForbiddenKey(child, forbidden, location));
  }
  return findings;
}

for (const publicConfig of publicConfigs) {
  if (!fileSet.has(publicConfig.path)) failures.push(`Public application configuration is missing: ${publicConfig.path}.`);
  const source = textFile(publicConfig.path);
  if (!source) continue;
  let value;
  try { value = JSON.parse(source); } catch { failures.push(`Public application configuration is not valid JSON: ${publicConfig.path}.`); continue; }
  const forbidden = new Set(publicConfig.forbiddenFields);
  for (const location of hasForbiddenKey(value, forbidden)) failures.push(`Public application configuration exposes forbidden field ${location} in ${publicConfig.path}.`);
}

for (const contract of registry.redaction_contracts || []) {
  if (!fileSet.has(contract.path)) failures.push(`Redaction contract source is missing: ${contract.path}.`);
  const source = textFile(contract.path);
  for (const marker of contract.markers || []) {
    if (!source.includes(marker)) failures.push(`Redaction marker ${JSON.stringify(marker)} is missing from ${contract.path}.`);
  }
}

const sensitiveNames = [...new Set(registry.sensitive_field_names || [])];
const browserFiles = files.filter((relative) => /^(?:app|lib)\//.test(relative) && /\.(?:js|jsx|mjs|ts|tsx)$/.test(relative));
for (const relative of browserFiles) {
  const source = textFile(relative);
  if (!source || !/(?:localStorage|sessionStorage|indexedDB)/.test(source)) continue;
  for (const line of source.split("\n")) {
    if (!/(?:localStorage|sessionStorage|indexedDB)/.test(line)) continue;
    for (const name of sensitiveNames) {
      if (new RegExp(`\\b${name}\\b`, "i").test(line)) failures.push(`Browser persistence may include sensitive field ${name} in ${relative}.`);
    }
  }
}

const exportFiles = files.filter((relative) =>
  /^schema\//.test(relative)
  || /^(?:lib|build)\/.*(?:ppf|project-export|project-exchange|project-package)/i.test(relative)
  || /^lib\/project(?:\.|-)/.test(relative),
);
for (const relative of exportFiles) {
  const source = textFile(relative);
  for (const name of sensitiveNames) {
    const propertyPattern = new RegExp(`["']${name}["']\\s*:`, "i");
    if (propertyPattern.test(source)) failures.push(`Export or PPF boundary includes sensitive property ${name} in ${relative}.`);
  }
}

if (mode === "package") {
  if (files.some((relative) => /(^|\/)secrets\//i.test(relative))) failures.push("Packaged release contains a runtime secrets directory.");
  if (files.some((relative) => /(^|\/)\.env\.runtime$/i.test(relative))) failures.push("Packaged release contains a generated Buzz .env.runtime file.");
}

if (failures.length) {
  console.error(`Credential-boundary audit failed in ${mode} mode:`);
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Credential-boundary audit passed in ${mode} mode for ${files.length} files and ${(registry.credentials || []).length} registered credential records.`);
