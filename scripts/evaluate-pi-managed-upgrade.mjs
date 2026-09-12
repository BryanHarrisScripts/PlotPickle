#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { resolveActiveNpmCommand, runPortableCommand } from "./pi-worker-runtime.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = path.join(repoRoot, "config", "pi-managed-upgrade-evaluation.json");
const artifactDir = path.join(repoRoot, ".artifacts", "pi-1709");
const artifactPath = path.join(artifactDir, "evaluation.json");
const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".json", ".md", ".ps1"]);
const SKIP_DIRECTORIES = new Set([".git", ".next", ".artifacts", "node_modules"]);

function parseNpmSpec(spec) {
  const raw = String(spec || "").replace(/^npm:/u, "");
  const separator = raw.lastIndexOf("@");
  if (separator <= 0 || separator === raw.length - 1) throw new Error(`Expected an exact npm package spec, received ${spec}.`);
  return { name: raw.slice(0, separator), version: raw.slice(separator + 1) };
}

function packageRoot(base, packageName) {
  return path.join(base, "node_modules", ...packageName.split("/"));
}

async function scanForbiddenImports(root, forbidden) {
  const findings = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(full);
        continue;
      }
      if (!entry.isFile() || !SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      const text = await readFile(full, "utf8").catch(() => "");
      for (const token of forbidden) {
        if (text.includes(token)) findings.push({ path: path.relative(root, full).replaceAll("\\", "/"), token });
      }
    }
  }
  await visit(root);
  return findings;
}

async function runExtensionLoadProbe(candidateRoot, extensionRoots) {
  const probePath = path.join(candidateRoot, "plotpickle-extension-probe.mjs");
  const agentDir = path.join(candidateRoot, "agent-home");
  await mkdir(agentDir, { recursive: true });
  const source = `
import path from "node:path";
import { DefaultResourceLoader, SettingsManager } from "@earendil-works/pi-coding-agent";

const roots = JSON.parse(process.env.PLOTPICKLE_PI_1709_EXTENSION_ROOTS || "[]");
const cwd = process.env.PLOTPICKLE_PI_1709_REPO_ROOT;
const agentDir = process.env.PLOTPICKLE_PI_1709_AGENT_DIR;
const loader = new DefaultResourceLoader({
  cwd,
  agentDir,
  settingsManager: SettingsManager.inMemory({}),
  additionalExtensionPaths: roots,
  noSkills: true,
  noPromptTemplates: true,
  noThemes: true,
  noContextFiles: true,
});
await loader.reload();
const result = loader.getExtensions();
if (result.errors.length) {
  throw new Error("Pinned extension load errors: " + JSON.stringify(result.errors.map((item) => ({ path: item.path, error: String(item.error) }))));
}
const packages = roots.map((root) => {
  const normalized = path.resolve(root).toLowerCase();
  const extensions = result.extensions.filter((extension) => path.resolve(extension.resolvedPath || extension.path).toLowerCase().startsWith(normalized));
  if (!extensions.length) throw new Error("No Pi extension entry loaded from " + root);
  const registrations = extensions.reduce((total, extension) => total
    + (extension.tools?.size || 0)
    + (extension.commands?.size || 0)
    + (extension.handlers?.size || 0), 0);
  return { root, entries: extensions.length, registrations };
});
process.stdout.write(JSON.stringify({ loaded: true, packages }));
`;
  await writeFile(probePath, source, "utf8");
  const result = await runPortableCommand(process.execPath, [probePath], {
    cwd: candidateRoot,
    timeout: 60_000,
    env: {
      PLOTPICKLE_PI_1709_EXTENSION_ROOTS: JSON.stringify(extensionRoots),
      PLOTPICKLE_PI_1709_REPO_ROOT: repoRoot,
      PLOTPICKLE_PI_1709_AGENT_DIR: agentDir,
    },
  });
  return JSON.parse(result.stdout);
}

async function runRpcProbe(candidateRoot) {
  const manifestPath = path.join(candidateRoot, "node_modules", "@earendil-works", "pi-coding-agent", "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const binEntry = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.pi;
  if (!binEntry) throw new Error("Candidate Pi package does not expose the supported pi CLI entry.");
  const cliEntry = path.resolve(path.dirname(manifestPath), binEntry);
  const args = [
    cliEntry,
    "--mode", "rpc",
    "--no-session",
    "--no-extensions",
    "--no-skills",
    "--no-prompt-templates",
    "--no-themes",
    "--no-context-files",
  ];
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: candidateRoot,
      env: { ...process.env },
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error(`Candidate Pi stdio RPC probe timed out. stderr=${stderr.slice(-1000)}`)), 20_000);
    child.stderr.setEncoding("utf8");
    child.stdout.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      const lines = stdout.split(/\n/u);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const message = JSON.parse(trimmed);
          if (message.id === "plotpickle-1709-rpc" && message.type === "response") {
            if (message.success === false) finish(new Error(`Candidate Pi RPC get_state failed: ${trimmed}`));
            else finish(null, { ready: true, command: message.command || "get_state" });
            return;
          }
        } catch {
          // Keep collecting strict JSONL output; a partial final line will parse on the next chunk.
        }
      }
    });
    child.on("error", (error) => finish(error));
    child.on("close", (code) => {
      if (!settled) finish(new Error(`Candidate Pi RPC process exited before get_state response (code ${code}). stderr=${stderr.slice(-1000)}`));
    });
    child.stdin.write(`${JSON.stringify({ type: "get_state", id: "plotpickle-1709-rpc" })}\n`);
  });
}

async function main() {
  const contract = JSON.parse(await readFile(contractPath, "utf8"));
  const report = {
    schemaVersion: 1,
    issue: 1709,
    status: "failed",
    candidateVersion: contract.candidateVersion,
    currentManagedVersion: contract.currentManagedVersion,
    checks: {},
  };
  await mkdir(artifactDir, { recursive: true });
  let candidateRoot = "";
  try {
    const forbidden = await scanForbiddenImports(repoRoot, contract.forbiddenPlotPickleImports || []);
    if (forbidden.length) throw new Error(`PlotPickle uses Pi source-only/experimental imports: ${JSON.stringify(forbidden)}`);
    report.checks.forbiddenImports = { passed: true, findings: [] };

    candidateRoot = await mkdtemp(path.join(os.tmpdir(), "plotpickle-pi-1709-"));
    const extensionSpecs = contract.requiredExtensions.map(parseNpmSpec);
    const dependencies = Object.fromEntries([
      [contract.package, contract.candidateVersion],
      ...extensionSpecs.map(({ name, version }) => [name, version]),
    ]);
    await writeFile(path.join(candidateRoot, "package.json"), `${JSON.stringify({ private: true, type: "module", dependencies }, null, 2)}\n`, "utf8");

    const npmCommand = resolveActiveNpmCommand();
    await runPortableCommand(npmCommand, ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact"], {
      cwd: candidateRoot,
      timeout: 12 * 60_000,
    });
    report.checks.install = { passed: true, package: `${contract.package}@${contract.candidateVersion}` };

    const piCommand = process.platform === "win32"
      ? path.join(candidateRoot, "node_modules", ".bin", "pi.cmd")
      : path.join(candidateRoot, "node_modules", ".bin", "pi");
    const version = await runPortableCommand(piCommand, ["--version"], { cwd: candidateRoot, timeout: 20_000 });
    if (!String(version.stdout || version.stderr).includes(contract.candidateVersion)) {
      throw new Error(`Candidate Pi version mismatch: ${version.stdout || version.stderr || "<empty>"}`);
    }
    report.checks.version = { passed: true, actual: String(version.stdout || version.stderr).trim() };

    const extensionRoots = extensionSpecs.map(({ name }) => packageRoot(candidateRoot, name));
    report.checks.extensions = await runExtensionLoadProbe(candidateRoot, extensionRoots);
    report.checks.sdk = { passed: true, detail: "DefaultResourceLoader and SettingsManager imported from the supported package root." };
    report.checks.rpc = await runRpcProbe(candidateRoot);

    report.status = "passed";
    report.decision = "candidate-compatible";
    await writeFile(artifactPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.stdout.write(`PLOTPICKLE_PI_1709_STATUS=passed candidate=${contract.candidateVersion}\n`);
    process.stdout.write(`Evidence: ${artifactPath}\n`);
  } catch (error) {
    report.error = error instanceof Error ? error.stack || error.message : String(error);
    report.decision = "do-not-promote";
    await writeFile(artifactPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    throw error;
  } finally {
    if (candidateRoot) await rm(candidateRoot, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
