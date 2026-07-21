import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statfsSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const packageFile = path.join(projectRoot, "package.json");
const lockFile = path.join(projectRoot, "package-lock.json");
const manifest = JSON.parse(readFileSync(packageFile, "utf8"));
const mode = process.argv[2] ?? "plan";

const RECOMMENDED_FREE_BYTES = 2 * 1024 ** 3;
const ESTIMATED_WORKING_BYTES = 1.5 * 1024 ** 3;
const MAX_REASONABLE_FREE_BYTES = 1024 ** 5;

const components = [
  ["Project data runtime", "drizzle-orm"],
  ["Application framework", "next"],
  ["User interface", "react"],
  ["Browser renderer", "react-dom"],
  ["Cloudflare/Vite build compatibility", "@cloudflare/vite-plugin"],
  ["Tailwind PostCSS integration", "@tailwindcss/postcss"],
  ["Node.js type definitions", "@types/node"],
  ["React type definitions", "@types/react"],
  ["React DOM type definitions", "@types/react-dom"],
  ["React/Vite build integration", "@vitejs/plugin-react"],
  ["React Server Components integration", "@vitejs/plugin-rsc"],
  ["Project data build tooling", "drizzle-kit"],
  ["Code-quality checking", "eslint"],
  ["Next.js quality rules", "eslint-config-next"],
  ["Styling framework", "tailwindcss"],
  ["Code safety and compilation", "typescript"],
  ["Next.js-to-Vite compatibility", "vinext"],
  ["Private local development server", "vite"],
  ["Local/build compatibility", "wrangler"],
];

function persistentHome() {
  if (process.env.PLOTPICKLE_HOME) return path.resolve(process.env.PLOTPICKLE_HOME);
  if (process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, "PlotPickle");
  return path.join(os.homedir(), ".plotpickle");
}

function dependencyHash() {
  const source = existsSync(lockFile) ? readFileSync(lockFile) : readFileSync(packageFile);
  return createHash("sha256").update(source).digest("hex").slice(0, 20);
}

function runtimeDirectory() {
  return process.env.PLOTPICKLE_RUNTIME_DIR || path.join(persistentHome(), "runtimes", dependencyHash());
}

function dependencyDirectory() {
  return process.env.PLOTPICKLE_RUNTIME_MODULES || path.join(runtimeDirectory(), "node_modules");
}

function npmCachePath() {
  return process.env.PLOTPICKLE_NPM_CACHE || path.join(persistentHome(), "npm-cache");
}

function divider() {
  console.log("============================================================");
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "unknown";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

function dependencySpec(packageName) {
  return manifest.dependencies?.[packageName] ?? manifest.devDependencies?.[packageName] ?? "not listed";
}

function installedVersion(packageName) {
  const packagePath = path.join(dependencyDirectory(), ...packageName.split("/"), "package.json");
  if (!existsSync(packagePath)) return null;
  try {
    return JSON.parse(readFileSync(packagePath, "utf8")).version ?? "installed";
  } catch {
    return "installed";
  }
}

function freeSpaceBytes() {
  try {
    const target = process.platform === "win32" ? persistentHome() : projectRoot;
    const stats = statfsSync(existsSync(target) ? target : path.dirname(target));
    const value = Number(stats.bavail) * Number(stats.bsize);
    return Number.isFinite(value) && value >= 0 && value <= MAX_REASONABLE_FREE_BYTES
      ? value
      : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

function directorySize(root) {
  if (!existsSync(root)) return 0;
  let total = 0;
  const pending = [root];

  while (pending.length) {
    const current = pending.pop();
    if (!current) continue;
    let entries = [];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const item = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        pending.push(item);
      } else if (entry.isFile()) {
        try {
          total += statSync(item).size;
        } catch {
          // Temporary or locked files do not invalidate the verification report.
        }
      }
    }
  }

  return total;
}

function printComponentPlan() {
  for (const [purpose, packageName] of components) {
    console.log(`  - ${purpose}: ${packageName} ${dependencySpec(packageName)}`);
  }
}

function printInstalledComponents() {
  let missing = 0;
  for (const [purpose, packageName] of components) {
    const version = installedVersion(packageName);
    if (version) {
      console.log(`  [OK] ${purpose}: ${packageName} ${version}`);
    } else {
      console.log(`  [MISSING] ${purpose}: ${packageName}`);
      missing += 1;
    }
  }
  return missing;
}

function printSecurityExplanation() {
  console.log("Security, privacy, and upgrades:");
  console.log("  - The launcher does not request Administrator rights.");
  console.log("  - It does not install a Windows service or add itself to Windows startup.");
  console.log("  - npm uses package.json and package-lock.json to select packages and verify integrity data.");
  console.log("  - Dependencies live in a user-owned persistent runtime under the PlotPickle local-app-data folder.");
  console.log("  - A fresh PlotPickle download reuses a matching runtime instead of reinstalling packages.");
  console.log("  - The launcher does not upload your story project.");
  console.log("  - The server listens on 127.0.0.1, so it is available only on this computer.");
  console.log("  - Closing the server window stops PlotPickle immediately.");
}

function printPlan() {
  const free = freeSpaceBytes();
  divider();
  console.log("  PLOTPICKLE INSTALLATION PLAN");
  divider();
  console.log(`Application version: ${manifest.version}`);
  console.log(`Dependency fingerprint: ${dependencyHash()}`);
  console.log("");
  console.log("Every top-level package requested by PlotPickle:");
  printComponentPlan();
  console.log("");
  console.log("Where files will go:");
  console.log(`  - Replaceable PlotPickle program files: ${projectRoot}`);
  console.log(`  - Reusable dependency runtime: ${runtimeDirectory()}`);
  console.log(`  - Persistent dependency folder: ${dependencyDirectory()}`);
  console.log(`  - Persistent npm download cache: ${npmCachePath()}`);
  console.log("");
  console.log("Space planning:");
  console.log(`  - Recommended free space before the first runtime setup: ${formatBytes(RECOMMENDED_FREE_BYTES)}`);
  console.log(`  - Expected maximum working space during first setup: about ${formatBytes(ESTIMATED_WORKING_BYTES)}`);
  console.log("  - Later code-only upgrades reuse this runtime and normally require no package download.");
  console.log("  - A new package-lock fingerprint creates a separate runtime only when dependencies change.");
  console.log(`  - Free space currently available: ${formatBytes(free)}`);
  if (Number.isFinite(free) && free < RECOMMENDED_FREE_BYTES) {
    console.log("  [WARNING] Less than 2 GB is currently free. Setup may fail until space is available.");
  }
  console.log("");
  printSecurityExplanation();
  console.log("");
  console.log("During installation npm will display package download, extraction, and verification messages below.");
}

function printSuccess(includeInstalledSize) {
  const installedFolder = dependencyDirectory();
  divider();
  console.log(includeInstalledSize
    ? "  SUCCESS - PLOTPICKLE RUNTIME INSTALLATION COMPLETED"
    : "  SUCCESS - PLOTPICKLE RUNTIME REUSED AND VERIFIED");
  divider();
  console.log(`Application version: ${manifest.version}`);
  console.log(`Dependency fingerprint: ${dependencyHash()}`);
  console.log("");
  console.log("Verified installed components:");
  const missing = printInstalledComponents();
  console.log("");
  console.log(`Persistent runtime: ${runtimeDirectory()}`);
  console.log(`Installed dependency folder: ${installedFolder}`);
  if (includeInstalledSize) {
    console.log("Calculating the final installed dependency size...");
    console.log(`Installed dependency size: ${formatBytes(directorySize(installedFolder))}`);
  } else {
    console.log("Installed dependency size is not recalculated on every launch.");
  }
  console.log(`Persistent npm cache: ${npmCachePath()}`);
  console.log("");
  console.log("Upgrade meaning:");
  console.log("  - You can replace or update the PlotPickle program folder without deleting this runtime.");
  console.log("  - Matching future versions reconnect to these packages immediately.");
  console.log("  - Update-PlotPickle.bat replaces program files while preserving this runtime.");
  console.log("");
  console.log("What running a local server means:");
  console.log("  - PlotPickle runs as a small web application on your own computer.");
  console.log("  - Your browser opens http://127.0.0.1:4173 to display it.");
  console.log("  - 127.0.0.1 is the private loopback address for this computer only.");
  console.log("  - PlotPickle is not published to your home network or the public internet.");
  console.log("  - Keep the server window open while using PlotPickle; close it to stop the application.");
  console.log("");
  printSecurityExplanation();
  console.log("");
  if (missing > 0) {
    console.log(`[ERROR] ${missing} expected component(s) could not be verified.`);
    process.exitCode = 1;
  } else {
    console.log("All required components passed verification. PlotPickle can now start in private local mode.");
  }
}

if (mode === "success") {
  printSuccess(true);
} else if (mode === "ready") {
  printSuccess(false);
} else {
  printPlan();
}
