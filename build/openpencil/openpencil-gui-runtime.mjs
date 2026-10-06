import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

export const OPENPENCIL_DESKTOP_VERSION = "0.15.1";
export const OPENPENCIL_SURFACE_REGISTRY = "designs/openpencil/surfaces.json";

function platformPath(platform) {
  return platform === "win32" ? path.win32 : path.posix;
}

function pathEntries(value, platform) {
  return String(value || "").split(platform === "win32" ? ";" : ":").map((entry) => entry.trim()).filter(Boolean);
}

function executableCandidates(command, dependencies) {
  const pathApi = platformPath(dependencies.platform);
  const directories = pathEntries(dependencies.env.PATH || dependencies.env.Path, dependencies.platform);
  if (dependencies.platform !== "win32") return directories.map((directory) => pathApi.join(directory, command));
  return directories.flatMap((directory) => [
    pathApi.join(directory, `${command}.cmd`),
    pathApi.join(directory, `${command}.exe`),
    pathApi.join(directory, command),
  ]);
}

function defaultRunProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: options.env || process.env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve({ stdout, stderr, code: 0 });
      else reject(new Error(`PROCESS_FAILED:${code ?? signal ?? "unknown"}:${stderr.trim() || stdout.trim()}`));
    });
  });
}

function defaultDependencies(overrides = {}) {
  return {
    platform: overrides.platform || process.platform,
    env: overrides.env || process.env,
    repositoryRoot: overrides.repositoryRoot || process.cwd(),
    exists: overrides.exists || existsSync,
    readText: overrides.readText || ((value) => readFile(value, "utf8")),
    spawnProcess: overrides.spawnProcess || ((command, args, options) => spawn(command, [...args], options)),
    runProcess: overrides.runProcess || defaultRunProcess,
    wait: overrides.wait || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))),
    nodeExecutable: overrides.nodeExecutable || process.execPath,
  };
}

function managedCliEntrypoint(dependencies) {
  if (dependencies.platform !== "win32") return "";
  const localAppData = String(dependencies.env.LOCALAPPDATA || "").trim();
  if (!localAppData) return "";
  const pathApi = platformPath(dependencies.platform);
  return pathApi.join(localAppData, "PlotPickle", "tools", "openpencil", "node_modules", "@open-pencil", "cli", "bin", "openpencil.js");
}

export function resolveOpenPencilCliLaunch(overrides = {}) {
  const dependencies = defaultDependencies(overrides);
  const pathApi = platformPath(dependencies.platform);
  const override = String(dependencies.env.PLOTPICKLE_OPENPENCIL_CLI_ENTRYPOINT || "").trim();
  if (override) {
    if (!pathApi.isAbsolute(override) || !dependencies.exists(override) || !/\.(?:mjs|js)$/iu.test(override)) return null;
    return Object.freeze({ executable: dependencies.nodeExecutable, args: Object.freeze([override]), source: "override" });
  }

  const managed = managedCliEntrypoint(dependencies);
  if (managed && dependencies.exists(managed)) {
    return Object.freeze({ executable: dependencies.nodeExecutable, args: Object.freeze([managed]), source: "plotpickle-managed" });
  }

  const located = executableCandidates("openpencil", dependencies).find((candidate) => dependencies.exists(candidate));
  if (!located) return null;
  if (dependencies.platform === "win32" && located.toLowerCase().endsWith(".cmd")) {
    const entrypoint = pathApi.join(pathApi.dirname(located), "node_modules", "@open-pencil", "cli", "bin", "openpencil.js");
    if (!dependencies.exists(entrypoint)) return null;
    return Object.freeze({ executable: dependencies.nodeExecutable, args: Object.freeze([entrypoint]), source: "npm-global" });
  }
  return Object.freeze({ executable: located, args: Object.freeze([]), source: "path" });
}

export function resolveOpenPencilDesktopLaunch(overrides = {}) {
  const dependencies = defaultDependencies(overrides);
  if (dependencies.platform !== "win32") return null;
  const pathApi = platformPath(dependencies.platform);
  const override = String(dependencies.env.PLOTPICKLE_OPENPENCIL_DESKTOP_EXE || "").trim();
  if (override) {
    if (!pathApi.isAbsolute(override) || !dependencies.exists(override) || !/OpenPencil\.exe$/iu.test(override)) return null;
    return Object.freeze({ executable: pathApi.resolve(override), source: "override" });
  }

  const localAppData = String(dependencies.env.LOCALAPPDATA || "").trim();
  const programFiles = String(dependencies.env.ProgramFiles || dependencies.env.PROGRAMFILES || "").trim();
  const programFilesX86 = String(dependencies.env["ProgramFiles(x86)"] || dependencies.env.PROGRAMFILES_X86 || "").trim();
  const candidates = [
    localAppData ? pathApi.join(localAppData, "OpenPencil", "OpenPencil.exe") : "",
    localAppData ? pathApi.join(localAppData, "Programs", "OpenPencil", "OpenPencil.exe") : "",
    programFiles ? pathApi.join(programFiles, "OpenPencil", "OpenPencil.exe") : "",
    programFilesX86 ? pathApi.join(programFilesX86, "OpenPencil", "OpenPencil.exe") : "",
  ].filter(Boolean);
  const found = candidates.find((candidate) => dependencies.exists(candidate));
  return found ? Object.freeze({ executable: found, source: "installed" }) : null;
}

function canonicalKey(value) {
  return String(value || "").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

async function loadRegistry(dependencies) {
  const registryPath = platformPath(dependencies.platform).resolve(dependencies.repositoryRoot, OPENPENCIL_SURFACE_REGISTRY);
  const parsed = JSON.parse(await dependencies.readText(registryPath));
  if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.surfaces)) throw new Error("OPENPENCIL_SURFACE_REGISTRY_INVALID");
  return { registryPath, registry: parsed };
}

export async function resolveOpenPencilSurface(surfaceName, overrides = {}) {
  const dependencies = defaultDependencies(overrides);
  const pathApi = platformPath(dependencies.platform);
  const { registry } = await loadRegistry(dependencies);
  const wanted = canonicalKey(surfaceName);
  const match = registry.surfaces.find((surface) => {
    const names = [surface?.name, ...(Array.isArray(surface?.aliases) ? surface.aliases : [])].map(canonicalKey);
    return names.includes(wanted);
  });
  if (!match) {
    const supported = registry.surfaces.map((surface) => surface.name).filter(Boolean);
    const error = new Error("OPENPENCIL_SURFACE_UNKNOWN");
    error.supported = supported;
    throw error;
  }

  const workspaceRoot = pathApi.resolve(dependencies.repositoryRoot, "designs", "openpencil");
  const file = String(match.file || "").trim();
  const bootstrap = String(match.bootstrap || "").trim();
  const page = String(match.page || match.name || "").trim();
  if (!file || !page || pathApi.isAbsolute(file) || (bootstrap && pathApi.isAbsolute(bootstrap))) {
    throw new Error("OPENPENCIL_SURFACE_REGISTRY_INVALID");
  }

  const designFile = pathApi.resolve(workspaceRoot, file);
  const relative = pathApi.relative(workspaceRoot, designFile);
  if (!relative || relative.startsWith("..") || pathApi.isAbsolute(relative)) throw new Error("OPENPENCIL_SURFACE_OUTSIDE_WORKSPACE");

  const bootstrapFile = bootstrap ? pathApi.resolve(workspaceRoot, bootstrap) : "";
  const relativeBootstrapFile = bootstrapFile ? pathApi.relative(workspaceRoot, bootstrapFile) : "";
  if (bootstrapFile && (!relativeBootstrapFile || relativeBootstrapFile.startsWith("..") || pathApi.isAbsolute(relativeBootstrapFile))) {
    throw new Error("OPENPENCIL_SURFACE_OUTSIDE_WORKSPACE");
  }

  return Object.freeze({
    name: String(match.name),
    page,
    designFile,
    relativeFile: relative,
    bootstrapFile,
    relativeBootstrapFile,
    workspaceRoot,
  });
}

function parseJson(value, code) {
  const source = String(value || "").trim();
  if (!source) throw new Error(code);
  return JSON.parse(source);
}

function runCli(cli, args, dependencies, cwd) {
  return dependencies.runProcess(cli.executable, [...cli.args, ...args], {
    cwd,
    env: dependencies.env,
  });
}

export function publicOpenPencilGuiError(error) {
  const code = error instanceof Error ? error.message : String(error);
  if (code === "OPENPENCIL_SURFACE_UNKNOWN") {
    const supported = Array.isArray(error?.supported) ? error.supported.join(", ") : "";
    return `Unknown OpenPencil surface. Name one explicitly${supported ? `: ${supported}` : "."}`;
  }
  if (code === "OPENPENCIL_SURFACE_REGISTRY_INVALID") return "The repository OpenPencil surface registry is invalid.";
  if (code === "OPENPENCIL_SURFACE_OUTSIDE_WORKSPACE") return "The OpenPencil surface target must stay inside designs\\openpencil.";
  if (code === "OPENPENCIL_DESIGN_FILE_MISSING") return "The registered OpenPencil design file is missing.";
  if (code === "OPENPENCIL_DESIGN_BOOTSTRAP_MISSING") return "The registered OpenPencil design is missing and its repository bootstrap seed is unavailable.";
  if (code === "OPENPENCIL_DESIGN_BOOTSTRAP_FAILED") return "PlotPickle could not materialize the registered OpenPencil design from its repository bootstrap seed.";
  if (code === "OPENPENCIL_DESIGN_PAGE_MISSING") return "The registered OpenPencil page is missing from the design file.";
  if (code === "OPENPENCIL_DESKTOP_MISSING") return "OpenPencil Desktop is not installed yet. PlotPickle prepares the reviewed desktop app after core startup; retry Check status or restart PlotPickle.";
  if (code === "OPENPENCIL_CLI_MISSING") return "The reviewed OpenPencil CLI helper is not ready yet. PlotPickle prepares it after core startup.";
  if (code === "OPENPENCIL_GUI_ACTIVATION_TIMEOUT") return "OpenPencil Desktop opened the design, but PlotPickle could not confirm the requested page before the local timeout.";
  if (code === "OPENPENCIL_PAGES_INVALID") return "OpenPencil could not read the registered design pages.";
  return "OpenPencil GUI could not open the requested design surface.";
}

export function createOpenPencilGuiController(overrides = {}) {
  const dependencies = defaultDependencies(overrides);

  async function openSurface(surfaceName) {
    const target = await resolveOpenPencilSurface(surfaceName, dependencies);
    const desktop = resolveOpenPencilDesktopLaunch(dependencies);
    if (!desktop) throw new Error("OPENPENCIL_DESKTOP_MISSING");
    const cli = resolveOpenPencilCliLaunch(dependencies);
    if (!cli) throw new Error("OPENPENCIL_CLI_MISSING");

    let bootstrapState = "existing";
    if (!dependencies.exists(target.designFile)) {
      if (!target.bootstrapFile || !dependencies.exists(target.bootstrapFile)) {
        throw new Error("OPENPENCIL_DESIGN_BOOTSTRAP_MISSING");
      }
      await runCli(
        cli,
        ["convert", target.bootstrapFile, "--output", target.designFile, "--format", "fig"],
        dependencies,
        target.workspaceRoot,
      );
      if (!dependencies.exists(target.designFile)) throw new Error("OPENPENCIL_DESIGN_BOOTSTRAP_FAILED");
      bootstrapState = "materialized";
    }

    const pagesResult = await runCli(cli, ["pages", target.designFile, "--json"], dependencies, target.workspaceRoot);
    const pages = parseJson(pagesResult.stdout, "OPENPENCIL_PAGES_INVALID");
    const page = Array.isArray(pages)
      ? pages.find((candidate) => canonicalKey(candidate?.name) === canonicalKey(target.page))
      : null;
    if (!page?.id) throw new Error("OPENPENCIL_DESIGN_PAGE_MISSING");

    const launched = dependencies.spawnProcess(desktop.executable, [target.designFile], {
      cwd: target.workspaceRoot,
      env: dependencies.env,
      detached: true,
      stdio: "ignore",
      windowsHide: false,
      shell: false,
    });
    launched.unref?.();

    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        const listResult = await runCli(cli, ["documents", "list", "--json"], dependencies, target.workspaceRoot);
        const documents = parseJson(listResult.stdout, "OPENPENCIL_GUI_ACTIVATION_TIMEOUT");
        const pathApi = platformPath(dependencies.platform);
        const doc = Array.isArray(documents)
          ? documents.find((candidate) => candidate?.path && pathApi.resolve(candidate.path) === pathApi.resolve(target.designFile))
          : null;
        if (doc?.id) {
          await runCli(cli, ["documents", "activate", String(doc.id), "--page-id", String(page.id), "--json"], dependencies, target.workspaceRoot);
          return Object.freeze({
            state: "ready",
            surface: target.name,
            page: target.page,
            designFile: target.designFile,
            relativeFile: target.relativeFile,
            desktopSource: desktop.source,
            cliSource: cli.source,
            bootstrapState,
            message: `OpenPencil GUI opened ${target.name} · ${target.relativeFile} · page ${target.page}.`,
          });
        }
      } catch {}
      await dependencies.wait(250);
    }
    throw new Error("OPENPENCIL_GUI_ACTIVATION_TIMEOUT");
  }

  async function reviewSurface(surfaceName) {
    const target = await resolveOpenPencilSurface(surfaceName, dependencies);
    if (!dependencies.exists(target.designFile)) throw new Error("OPENPENCIL_DESIGN_FILE_MISSING");
    const pathApi = platformPath(dependencies.platform);
    const repositoryDesignPath = pathApi.join("designs", "openpencil", target.relativeFile);
    const status = await dependencies.runProcess("git", ["status", "--porcelain=v1", "--", repositoryDesignPath], {
      cwd: dependencies.repositoryRoot,
      env: dependencies.env,
    });
    const diff = await dependencies.runProcess("git", ["diff", "--no-ext-diff", "--numstat", "HEAD", "--", repositoryDesignPath], {
      cwd: dependencies.repositoryRoot,
      env: dependencies.env,
    }).catch(() => ({ stdout: "", stderr: "", code: 0 }));
    const statusText = status.stdout.trim() || "clean";
    const diffText = diff.stdout.trim() || "no committed-base diff";
    const handoffDraft = [
      `Review the saved OpenPencil design changes for ${target.name}.`,
      `Design artifact: ${repositoryDesignPath.replaceAll("\\", "/")}.`,
      `OpenPencil page: ${target.page}.`,
      `Git status: ${statusText}.`,
      `Git diff summary: ${diffText}.`,
      "Treat the visual design as a proposal. Prepare a developer brief for the implementation changes represented by this design, then publish the approved brief as a GitHub issue. Do not implement source code or create an implementation PR in this handoff.",
    ].join("\n");
    return Object.freeze({
      state: "review-ready",
      surface: target.name,
      page: target.page,
      relativeFile: target.relativeFile,
      status: statusText,
      diff: diffText,
      handoffDraft,
      message: `OpenPencil design review evidence is ready for ${target.name}. The DSDD request box can now enter Interpret → Pi Draft → Publish Brief.`,
    });
  }

  return Object.freeze({ openSurface, reviewSurface });
}
