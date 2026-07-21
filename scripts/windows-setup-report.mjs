import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statfsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const manifest = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));
const mode = process.argv[2] ?? "plan";

const RECOMMENDED_FREE_BYTES = 2 * 1024 ** 3;
const ESTIMATED_WORKING_BYTES = 1.5 * 1024 ** 3;

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
  const packageFile = path.join(projectRoot, "node_modules", ...packageName.split("/"), "package.json");
  if (!existsSync(packageFile)) return null;
  try {
    return JSON.parse(readFileSync(packageFile, "utf8")).version ?? "installed";
  } catch {
    return "installed";
  }
}

function npmCachePath() {
  const options = {
    cwd: projectRoot,
    encoding: "utf8",
    windowsHide: true,
  };
  const result = process.platform === "win32"
    ? spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm config get cache"], options)
    : spawnSync("npm", ["config", "get", "cache"], options);
  return result.status === 0 ? result.stdout.trim() : "npm user cache";
}

function freeSpaceBytes() {
  try {
    const stats = statfsSync(projectRoot);
    return Number(stats.bavail) * Number(stats.bsize);
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
          // A temporary or locked file should not prevent the success report.
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
  console.log("Security and privacy:");
  console.log("  - The launcher does not request Administrator rights.");
  console.log("  - It does not install a Windows service or add itself to Windows startup.");
  console.log("  - npm uses package.json and package-lock.json to select packages and verify integrity data.");
  console.log("  - Dependencies are placed inside this PlotPickle folder; npm also keeps a reusable user cache.");
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
  console.log("");
  console.log("Every top-level package requested by PlotPickle:");
  printComponentPlan();
  console.log("");
  console.log("Where files will go:");
  console.log(`  - PlotPickle dependencies: ${path.join(projectRoot, "node_modules")}`);
  console.log(`  - Reusable npm download cache: ${npmCachePath()}`);
  console.log("");
  console.log("Space planning:");
  console.log(`  - Recommended free space before setup: ${formatBytes(RECOMMENDED_FREE_BYTES)}`);
  console.log(`  - Expected maximum working space during first setup: about ${formatBytes(ESTIMATED_WORKING_BYTES)}`);
  console.log("  - Actual use varies by Windows, npm cache contents, and package compression.");
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
  const installedFolder = path.join(projectRoot, "node_modules");
  divider();
  console.log(includeInstalledSize
    ? "  SUCCESS - PLOTPICKLE INSTALLATION COMPLETED"
    : "  SUCCESS - PLOTPICKLE COMPONENTS VERIFIED");
  divider();
  console.log(`Application version: ${manifest.version}`);
  console.log("");
  console.log("Verified installed components:");
  const missing = printInstalledComponents();
  console.log("");
  console.log(`Installed dependency folder: ${installedFolder}`);
  if (includeInstalledSize) {
    console.log("Calculating the final installed dependency size...");
    console.log(`Installed dependency size: ${formatBytes(directorySize(installedFolder))}`);
  } else {
    console.log("Installed dependency size was measured during setup and is not recalculated on every launch.");
  }
  console.log(`npm cache: ${npmCachePath()}`);
  console.log("");
  console.log("What running a local server means:");
  console.log("  - PlotPickle runs as a small web application on your own computer.");
  console.log("  - Your browser opens http://127.0.0.1:4173 to display it.");
  console.log("  - 127.0.0.1 is the private loopback address for this computer only.");
  console.log("  - PlotPickle is not being published to your home network or the public internet.");
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
