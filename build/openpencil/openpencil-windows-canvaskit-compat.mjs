import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

// Temporary, version-pinned workaround for open-pencil/open-pencil#1168.
// Restrict mutations to PlotPickle's private installed package, never repository
// designs, user's FIG files, global npm or the Desktop installation.
const VERSION = "0.16.0";
const IMPORT = 'import { fileURLToPath as __plotpickleFileURLToPath } from "node:url";\n';
const MAIN_OLD = /decodeURIComponent\(new URL\(file,\s*ckPath\)\.pathname\)/gu;
const RASTER_OLD = /new URL\(["']\.["'],\s*ckPath\)\.pathname/gu;
const MAIN_NEW = "__plotpickleFileURLToPath(new URL(file, ckPath))";
const RASTER_NEW = '__plotpickleFileURLToPath(new URL(".", ckPath))';

async function regularFile(file) {
  try {
    const info = await lstat(file);
    return info.isFile() && !info.isSymbolicLink();
  } catch {
    return false;
  }
}

async function jsFiles(root, limit = 3000) {
  const pending = [root];
  const result = [];
  while (pending.length) {
    const folder = pending.pop();
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) pending.push(file);
      if (entry.isFile() && /\.(?:m?js)$/u.test(entry.name)) result.push(file);
      if (result.length + pending.length > limit) throw new Error("OPENPENCIL_COMPAT_SCAN_LIMIT");
    }
  }
  return result;
}

async function packageVersion(file) {
  if (!(await regularFile(file))) throw new Error("OPENPENCIL_COMPAT_PACKAGE_MISSING");
  return JSON.parse(await readFile(file, "utf8")).version;
}

export async function repairOpenPencilCanvasKitWindows(toolRoot, options = {}) {
  const platform = options.platform || process.platform;
  if (platform !== "win32") return Object.freeze({ state: "not-windows", changed: 0 });
  const root = path.resolve(toolRoot);
  const modules = path.join(root, "node_modules");
  const core = path.join(modules, "@open-pencil", "core");
  const cli = path.join(modules, "@open-pencil", "cli");
  if ((await packageVersion(path.join(cli, "package.json"))) !== VERSION
    || (await packageVersion(path.join(core, "package.json"))) !== VERSION) {
    throw new Error("OPENPENCIL_COMPAT_UNREVIEWED_VERSION");
  }
  if (!(await regularFile(path.join(modules, "canvaskit-wasm", "bin", "canvaskit.wasm")))) {
    throw new Error("OPENPENCIL_COMPAT_WASM_MISSING");
  }
  const files = await jsFiles(path.join(core, "dist"));
  const pending = [];
  let mainCount = 0;
  let rasterCount = 0;
  for (const file of files) {
    const original = await readFile(file, "utf8");
    const oldMain = [...original.matchAll(MAIN_OLD)].length;
    const oldRaster = [...original.matchAll(RASTER_OLD)].length;
    const newMain = original.split(MAIN_NEW).length - 1;
    const newRaster = original.split(RASTER_NEW).length - 1;
    if (oldMain + newMain + oldRaster + newRaster === 0) continue;
    if (oldMain + newMain > 1 || oldRaster + newRaster > 1) {
      throw new Error("OPENPENCIL_COMPAT_UNEXPECTED_SIGNATURE");
    }
    mainCount += oldMain + newMain;
    rasterCount += oldRaster + newRaster;
    const hasImport = original.startsWith(IMPORT);
    if ((newMain || newRaster) && !hasImport) {
      throw new Error("OPENPENCIL_COMPAT_PARTIAL_PATCH");
    }
    let updated = original.replace(MAIN_OLD, MAIN_NEW).replace(RASTER_OLD, RASTER_NEW);
    if ((oldMain || oldRaster) && !hasImport) updated = IMPORT + updated;
    if (updated !== original) pending.push({ file, original, updated });
  }
  // Refuse updates if an upstream package changed its loader layout.
  if (mainCount !== 1 || rasterCount > 1) {
    throw new Error("OPENPENCIL_COMPAT_UNEXPECTED_SIGNATURE");
  }
  const written = [];
  try {
    for (const change of pending) {
      await writeFile(change.file, change.updated, "utf8");
      written.push(change);
    }
  } catch (error) {
    for (const change of written.reverse()) {
      try { await writeFile(change.file, change.original, "utf8"); } catch {}
    }
    throw error;
  }
  return Object.freeze({ state: "ready", changed: pending.length, mainCount, rasterCount });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:\/)/u, ""))) {
  const expected = process.env.LOCALAPPDATA
    ? path.resolve(process.env.LOCALAPPDATA, "PlotPickle", "tools", "openpencil")
    : "";
  const requested = process.argv[2] ? path.resolve(process.argv[2]) : "";
  if (!expected || !requested || expected.toLowerCase() !== requested.toLowerCase()) {
    process.stderr.write("OPENPENCIL_COMPAT_MANAGED_ROOT_REQUIRED\n");
    process.exitCode = 10;
  } else {
    repairOpenPencilCanvasKitWindows(requested).then(
      (result) => process.stdout.write("OPENPENCIL_COMPAT_" + result.state.toUpperCase() + " changed=" + result.changed + "\n"),
      (error) => {
        process.stderr.write(String(error?.message || "OPENPENCIL_COMPAT_UNKNOWN") + "\n");
        process.exitCode = 10;
      },
    );
  }
}
