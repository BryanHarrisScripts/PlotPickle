import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(root, "config", "third-party-oss.json");
const readJson = (relative) => JSON.parse(readFileSync(path.join(root, relative), "utf8"));
const exists = (relative) => existsSync(path.join(root, relative));

export function auditThirdPartyOss() {
  const failures = [];
  const warnings = [];
  if (!existsSync(registryPath)) {
    return { ok: false, failures: ["Missing canonical registry: config/third-party-oss.json"], warnings, summary: null };
  }

  const registry = readJson("config/third-party-oss.json");
  const packageJson = readJson(registry?.npm?.manifest || "package.json");
  const packageLock = readJson(registry?.npm?.lockfile || "package-lock.json");
  const rootLock = packageLock.packages?.[""] ?? {};
  const directRuntime = packageJson.dependencies ?? {};
  const directDevelopment = packageJson.devDependencies ?? {};
  const direct = { ...directRuntime, ...directDevelopment };
  const allowedDirect = new Set(registry?.npm?.reviewedDirectLicenseExpressions ?? []);
  const systems = Array.isArray(registry.systems) ? registry.systems : [];
  const assets = Array.isArray(registry.thirdPartyAssets) ? registry.thirdPartyAssets : [];
  const nonOss = Array.isArray(registry.nonOssConnections) ? registry.nonOssConnections : [];

  if (registry.schemaVersion !== 1) failures.push(`Unsupported third-party registry schemaVersion: ${registry.schemaVersion ?? "missing"}`);
  if (!Object.keys(direct).length) failures.push("package.json exposes no direct dependencies to audit.");
  if (!allowedDirect.size) failures.push("Registry has no reviewed direct npm licence expressions.");

  const ids = new Set();
  for (const entry of [...systems, ...assets, ...nonOss]) {
    if (!entry?.id || !entry?.name) {
      failures.push("Every third-party registry record must have id and name.");
      continue;
    }
    if (ids.has(entry.id)) failures.push(`Duplicate third-party registry id: ${entry.id}`);
    ids.add(entry.id);
  }

  const directRecords = [];
  for (const [name, requested] of Object.entries(direct)) {
    const locked = packageLock.packages?.[`node_modules/${name}`];
    if (!locked) {
      failures.push(`Direct dependency is missing from package-lock.json: ${name}`);
      continue;
    }
    const license = typeof locked.license === "string" ? locked.license.trim() : "";
    const version = String(locked.version ?? "").trim();
    if (!license) failures.push(`Direct dependency has no recorded licence metadata: ${name}`);
    else if (!allowedDirect.has(license)) failures.push(`Direct dependency licence needs review: ${name} (${license})`);
    if (!version) failures.push(`Direct dependency has no locked version: ${name}`);
    directRecords.push({
      name,
      requested,
      version,
      license,
      scope: Object.hasOwn(directRuntime, name) ? "runtime" : "development",
    });
  }

  const rootRuntimeNames = Object.keys(rootLock.dependencies ?? {}).sort();
  const manifestRuntimeNames = Object.keys(directRuntime).sort();
  const rootDevelopmentNames = Object.keys(rootLock.devDependencies ?? {}).sort();
  const manifestDevelopmentNames = Object.keys(directDevelopment).sort();
  if (JSON.stringify(rootRuntimeNames) !== JSON.stringify(manifestRuntimeNames)) failures.push("package.json runtime dependencies drift from package-lock.json root dependencies.");
  if (JSON.stringify(rootDevelopmentNames) !== JSON.stringify(manifestDevelopmentNames)) failures.push("package.json development dependencies drift from package-lock.json root devDependencies.");

  for (const system of systems) {
    for (const field of ["category", "usage", "source", "license", "licenseSource", "plotpickleUse"]) {
      if (!String(system?.[field] ?? "").trim()) failures.push(`OSS system ${system?.id ?? "<unknown>"} is missing ${field}.`);
    }
    if (system.package) {
      const directRecord = directRecords.find((item) => item.name === system.package);
      if (!directRecord) failures.push(`OSS system ${system.id} references package that is not a direct dependency: ${system.package}`);
      else if (system.license !== directRecord.license) failures.push(`OSS system ${system.id} licence disagrees with package-lock.json: ${system.license} != ${directRecord.license}`);
    }
    for (const field of ["noticePath", "manifestPath", "evidencePath"]) {
      if (system[field] && !exists(system[field])) failures.push(`OSS system ${system.id} references missing ${field}: ${system[field]}`);
    }
  }

  for (const asset of assets) {
    for (const field of ["usage", "source", "license", "plotpickleUse"]) {
      if (!String(asset?.[field] ?? "").trim()) failures.push(`Third-party asset ${asset?.id ?? "<unknown>"} is missing ${field}.`);
    }
    if (asset.evidencePath && !exists(asset.evidencePath)) failures.push(`Third-party asset ${asset.id} references missing evidencePath: ${asset.evidencePath}`);
  }

  const packageEntries = Object.entries(packageLock.packages ?? {})
    .filter(([name]) => name && name.startsWith("node_modules/"));
  const licenseCounts = new Map();
  const missingTransitive = [];
  for (const [location, record] of packageEntries) {
    const license = typeof record?.license === "string" ? record.license.trim() : "";
    if (!license) {
      missingTransitive.push({ location, version: record?.version ?? "" });
      continue;
    }
    licenseCounts.set(license, (licenseCounts.get(license) ?? 0) + 1);
  }
  if (missingTransitive.length) warnings.push(`${missingTransitive.length} installed package record(s) have no licence field in package-lock.json; see JSON audit output for locations.`);

  const readme = readFileSync(path.join(root, "README.md"), "utf8");
  const startMarker = String(registry?.readme?.startMarker ?? "");
  const endMarker = String(registry?.readme?.endMarker ?? "");
  const start = startMarker ? readme.indexOf(startMarker) : -1;
  const end = endMarker ? readme.indexOf(endMarker) : -1;
  if (start < 0 || end < 0 || end <= start) {
    failures.push("README is missing the canonical Open Source acknowledgement marker section.");
  } else {
    const section = readme.slice(start, end + endMarker.length);
    for (const system of systems.filter((item) => item.readme === true)) {
      if (!section.includes(system.name)) failures.push(`README OSS section does not acknowledge registered system: ${system.name}`);
    }
    for (const item of nonOss) {
      if (section.includes(`| ${item.name} |`)) failures.push(`README OSS table incorrectly includes non-OSS connection: ${item.name}`);
    }
  }

  const summary = {
    registrySchemaVersion: registry.schemaVersion,
    registeredSystems: systems.length,
    registeredThirdPartyAssets: assets.length,
    explicitlyNonOssConnections: nonOss.length,
    directNpmDependencies: directRecords.length,
    installedPackageRecords: packageEntries.length,
    npmLicenseExpressions: Object.fromEntries([...licenseCounts.entries()].sort(([a], [b]) => a.localeCompare(b))),
    missingTransitiveLicenseRecords: missingTransitive,
    directNpm: directRecords.sort((a, b) => a.name.localeCompare(b.name)),
  };

  return { ok: failures.length === 0, failures, warnings, summary };
}

function main() {
  const result = auditThirdPartyOss();
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    if (result.summary) {
      console.log(`Third-party OSS audit: ${result.summary.registeredSystems} registered systems; ${result.summary.directNpmDependencies} direct npm dependencies; ${result.summary.installedPackageRecords} installed package records.`);
      console.log(`npm licence expressions: ${Object.entries(result.summary.npmLicenseExpressions).map(([license, count]) => `${license}=${count}`).join(", ") || "none"}`);
    }
    for (const warning of result.warnings) console.warn(`OSS audit warning: ${warning}`);
    if (result.failures.length) {
      console.error("Third-party OSS audit failed:");
      for (const failure of result.failures) console.error(`- ${failure}`);
    } else {
      console.log("Third-party OSS audit passed.");
    }
  }
  process.exitCode = result.ok ? 0 : 1;
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) main();
