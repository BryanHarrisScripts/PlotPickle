#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { resolveActiveNpmCommand, runPortableCommand } from "./pi-worker-runtime.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = path.join(repoRoot, "config", "pi-087-dsdd-session-evaluation.json");
const artifactDir = path.join(repoRoot, ".artifacts", "pi-2338");
const artifactPath = path.join(artifactDir, "evaluation.json");
const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".ps1"]);
const SKIP_DIRECTORIES = new Set([".git", ".next", ".artifacts", "node_modules", "docs", "tests", "config", ".github"]);

function parseNpmSpec(spec) {
  const raw = String(spec || "").replace(/^npm:/u, "");
  const separator = raw.lastIndexOf("@");
  if (separator <= 0 || separator === raw.length - 1) {
    throw new Error(`Expected an exact npm package spec, received ${spec}.`);
  }
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
      const source = await readFile(full, "utf8").catch(() => "");
      for (const token of forbidden) {
        if (source.includes(token)) findings.push({
          path: path.relative(root, full).replaceAll("\\", "/"),
          token,
        });
      }
    }
  }
  await visit(root);
  return findings;
}

async function runExtensionLoadProbe(candidateRoot, extensionRoots) {
  const probeExtension = path.join(candidateRoot, "plotpickle-dsdd-context-probe.mjs");
  await writeFile(probeExtension, `
export default function plotpickleDsddContextProbe(pi) {
  pi.on("context_with_system", async (event) => ({ messages: event.messages }));
}
`, "utf8");

  const probePath = path.join(candidateRoot, "plotpickle-extension-probe.mjs");
  const agentDir = path.join(candidateRoot, "agent-home");
  await mkdir(agentDir, { recursive: true });
  const source = `
import path from "node:path";
import { DefaultResourceLoader, SettingsManager } from "@earendil-works/pi-coding-agent";

const roots = JSON.parse(process.env.PLOTPICKLE_PI_2338_EXTENSION_ROOTS || "[]");
const probeExtension = process.env.PLOTPICKLE_PI_2338_CONTEXT_EXTENSION;
const cwd = process.env.PLOTPICKLE_PI_2338_REPO_ROOT;
const agentDir = process.env.PLOTPICKLE_PI_2338_AGENT_DIR;
const loader = new DefaultResourceLoader({
  cwd,
  agentDir,
  settingsManager: SettingsManager.inMemory({}),
  additionalExtensionPaths: [...roots, probeExtension],
  noSkills: true,
  noPromptTemplates: true,
  noThemes: true,
  noContextFiles: true,
});
await loader.reload();
const result = loader.getExtensions();
if (result.errors.length) {
  throw new Error("Pi 0.87 extension load errors: " + JSON.stringify(
    result.errors.map((item) => ({ path: item.path, error: String(item.error) }))
  ));
}
const packages = roots.map((root) => {
  const normalized = path.resolve(root).toLowerCase();
  const extensions = result.extensions.filter((extension) =>
    path.resolve(extension.resolvedPath || extension.path).toLowerCase().startsWith(normalized)
  );
  if (!extensions.length) throw new Error("No pinned Pi extension entry loaded from " + root);
  const registrations = extensions.reduce((total, extension) => total
    + (extension.tools?.size || 0)
    + (extension.commands?.size || 0)
    + (extension.handlers?.size || 0), 0);
  return { root, entries: extensions.length, registrations };
});
const dsdd = result.extensions.find((extension) =>
  path.resolve(extension.resolvedPath || extension.path).toLowerCase() === path.resolve(probeExtension).toLowerCase()
);
if (!dsdd) throw new Error("PlotPickle DSDD context_with_system probe extension did not load.");
if ((dsdd.handlers?.get?.("context_with_system")?.length || 0) < 1) {
  throw new Error("Pi 0.87 did not register the context_with_system extension event.");
}
process.stdout.write(JSON.stringify({ loaded: true, packages, contextWithSystem: true }));
`;
  await writeFile(probePath, source, "utf8");
  const result = await runPortableCommand(process.execPath, [probePath], {
    cwd: candidateRoot,
    timeout: 60_000,
    env: {
      PLOTPICKLE_PI_2338_EXTENSION_ROOTS: JSON.stringify(extensionRoots),
      PLOTPICKLE_PI_2338_CONTEXT_EXTENSION: probeExtension,
      PLOTPICKLE_PI_2338_REPO_ROOT: repoRoot,
      PLOTPICKLE_PI_2338_AGENT_DIR: agentDir,
    },
  });
  return JSON.parse(result.stdout);
}

async function runContextEditProbe(candidateRoot) {
  const probePath = path.join(candidateRoot, "plotpickle-context-edit-probe.mjs");
  const source = `
import { SessionManager } from "@earendil-works/pi-coding-agent";

const session = SessionManager.inMemory(process.cwd());
const original = "HUMAN_INTENT_ORIGINAL";
const projected = "LOCKED_DSDD_WORKING_INTENT";
const targetId = session.appendMessage({
  role: "user",
  content: original,
  timestamp: Date.now(),
});
const before = session.getEntry(targetId);
if (!before || before.type !== "message" || before.message.content !== original) {
  throw new Error("Pi 0.87 failed to preserve the original Human message before context editing.");
}
const editId = session.appendContextEdit(targetId, { content: projected });
const edit = session.getEntry(editId);
if (!edit || edit.type !== "context_edit" || edit.targetId !== targetId) {
  throw new Error("Pi 0.87 did not append a ContextEditEntry.");
}
const raw = session.getEntry(targetId);
if (!raw || raw.type !== "message" || raw.message.content !== original) {
  throw new Error("Context editing rewrote raw Human provenance.");
}
const projection = session.buildSessionProjection();
const visible = projection.messages.find((message) => message.role === "user");
if (!visible || visible.content !== projected) {
  throw new Error("Pi 0.87 model-visible projection did not apply the ContextEditEntry.");
}
const entries = session.getEntries();
if (!entries.some((entry) => entry.type === "context_edit" && entry.targetId === targetId)) {
  throw new Error("ContextEditEntry was not retained in canonical session history.");
}
process.stdout.write(JSON.stringify({
  contextEdit: true,
  rawHistoryPreserved: true,
  projectionChanged: true,
  entryCount: entries.length,
}));
`;
  await writeFile(probePath, source, "utf8");
  const result = await runPortableCommand(process.execPath, [probePath], {
    cwd: candidateRoot,
    timeout: 30_000,
  });
  return JSON.parse(result.stdout);
}

async function runRpcProbe(candidateRoot) {
  const manifestPath = path.join(
    candidateRoot,
    "node_modules",
    "@earendil-works",
    "pi-coding-agent",
    "package.json",
  );
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
    const timer = setTimeout(
      () => finish(new Error(`Pi 0.87 stdio RPC probe timed out. stderr=${stderr.slice(-1000)}`)),
      20_000,
    );
    child.stderr.setEncoding("utf8");
    child.stdout.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      for (const line of stdout.split(/\n/u)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const message = JSON.parse(trimmed);
          if (message.id === "plotpickle-2338-rpc" && message.type === "response") {
            if (message.success === false) finish(new Error(`Pi 0.87 RPC get_state failed: ${trimmed}`));
            else finish(null, { ready: true, command: message.command || "get_state" });
            return;
          }
        } catch {
          // A partial JSONL line will be retried when the next chunk arrives.
        }
      }
    });
    child.on("error", (error) => finish(error));
    child.on("close", (code) => {
      if (!settled) {
        finish(new Error(
          `Pi 0.87 RPC process exited before get_state response (code ${code}). stderr=${stderr.slice(-1000)}`,
        ));
      }
    });
    child.stdin.write(`${JSON.stringify({ type: "get_state", id: "plotpickle-2338-rpc" })}\n`);
  });
}

async function main() {
  const contract = JSON.parse(await readFile(contractPath, "utf8"));
  const report = {
    schemaVersion: 1,
    issue: 2338,
    status: "failed",
    candidateVersion: contract.candidateVersion,
    currentManagedVersion: contract.currentManagedVersion,
    releaseTag: contract.releaseTag,
    checks: {},
  };
  await mkdir(artifactDir, { recursive: true });
  let candidateRoot = "";
  try {
    const forbidden = await scanForbiddenImports(repoRoot, contract.forbiddenPlotPickleImports || []);
    if (forbidden.length) {
      throw new Error(`PlotPickle uses Pi source-only/experimental imports: ${JSON.stringify(forbidden)}`);
    }
    report.checks.forbiddenImports = { passed: true, findings: [] };

    candidateRoot = await mkdtemp(path.join(os.tmpdir(), "plotpickle-pi-2338-"));
    const extensionSpecs = contract.requiredExtensions.map(parseNpmSpec);
    const dependencies = Object.fromEntries([
      [contract.package, contract.candidateVersion],
      ...extensionSpecs.map(({ name, version }) => [name, version]),
    ]);
    await writeFile(
      path.join(candidateRoot, "package.json"),
      `${JSON.stringify({ private: true, type: "module", dependencies }, null, 2)}\n`,
      "utf8",
    );

    await runPortableCommand(
      resolveActiveNpmCommand(),
      ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact"],
      { cwd: candidateRoot, timeout: 12 * 60_000 },
    );
    report.checks.install = {
      passed: true,
      package: `${contract.package}@${contract.candidateVersion}`,
    };

    const piCommand = process.platform === "win32"
      ? path.join(candidateRoot, "node_modules", ".bin", "pi.cmd")
      : path.join(candidateRoot, "node_modules", ".bin", "pi");
    const version = await runPortableCommand(piCommand, ["--version"], {
      cwd: candidateRoot,
      timeout: 20_000,
    });
    if (!String(version.stdout || version.stderr).includes(contract.candidateVersion)) {
      throw new Error(`Pi 0.87 candidate version mismatch: ${version.stdout || version.stderr || "<empty>"}`);
    }
    report.checks.version = {
      passed: true,
      actual: String(version.stdout || version.stderr).trim(),
    };

    const extensionRoots = extensionSpecs.map(({ name }) => packageRoot(candidateRoot, name));
    report.checks.extensions = await runExtensionLoadProbe(candidateRoot, extensionRoots);
    report.checks.contextEdit = await runContextEditProbe(candidateRoot);
    report.checks.rpc = await runRpcProbe(candidateRoot);

    report.status = "passed";
    report.decision = "candidate-compatible";
    await writeFile(artifactPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.stdout.write(`PLOTPICKLE_PI_2338_STATUS=passed candidate=${contract.candidateVersion}\n`);
    process.stdout.write(`Evidence: ${artifactPath}\n`);
  } catch (error) {
    report.error = error instanceof Error ? error.stack || error.message : String(error);
    report.decision = "do-not-promote";
    await writeFile(artifactPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    throw error;
  } finally {
    if (candidateRoot) {
      await rm(candidateRoot, { recursive: true, force: true }).catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
