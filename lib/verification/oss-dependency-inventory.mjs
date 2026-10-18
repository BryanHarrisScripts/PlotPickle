import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";

const digestText = (text) => createHash("sha256").update(text.replace(/\r\n/gu, "\n")).digest("hex");
const isGraph = (file) => /(?:^|\/)(?:package-lock\.json|Cargo\.lock|requirements[^/]*\.txt)$/u.test(file);

function npmRecords(text, source) {
  const lock = JSON.parse(text);
  if (!lock.packages || typeof lock.packages !== "object" || Array.isArray(lock.packages)) {
    throw new Error(`OSS dependency inventory requires npm packages metadata: ${source}`);
  }
  return Object.entries(lock.packages).filter(([location]) => location).map(([location, entry]) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`OSS dependency inventory invalid npm package: ${source}#${location}`);
    }
    const target = entry?.link === true && Object.hasOwn(lock.packages, entry.resolved)
      ? lock.packages[entry.resolved] : entry;
    return {
      location,
      name: target?.name || location.split("node_modules/").at(-1),
      version: target?.version || null,
      license: typeof target?.license === "string" ? target.license : null,
      licenseEvidence: target?.license ? "lockfile-field" : "UNKNOWN_NOT_IN_LOCK",
      integrity: target?.integrity || null,
      linkedTarget: entry?.link === true ? entry.resolved : null,
      disposition: target?.license ? "REVIEW_RECORDED_LICENSE" : "REVIEW_MISSING_LICENSE",
    };
  });
}

function cargoRecords(text, source) {
  const sections = text.split(/^\[\[package\]\]\s*$/mu).slice(1);
  if (!sections.length) throw new Error(`OSS dependency inventory requires Cargo packages: ${source}`);
  return sections.map((section) => {
    const value = (key) => section.match(new RegExp(`^${key} = "([^"\\r\\n]+)"$`, "mu"))?.[1] || null;
    const name = value("name"), version = value("version");
    if (!name || !version) throw new Error(`OSS dependency inventory incomplete Cargo package: ${source}`);
    return {
      name, version, source: value("source"), integrity: value("checksum"),
      license: null, licenseEvidence: "UNKNOWN_NOT_IN_LOCK", disposition: "REVIEW_CRATE_LICENSE_METADATA",
    };
  });
}

function requirementRecords(text, source) {
  return text.split(/\r?\n/u).map((line) => line.trim()).filter((line) => line && !line.startsWith("#")).map((line) => {
    const match = line.match(/^([A-Za-z0-9][A-Za-z0-9_.-]*)(\[[A-Za-z0-9_,.-]+\])?\s*([^;#]*)(?:\s*;.*)?$/u);
    if (!match) throw new Error(`OSS dependency inventory unsupported Python requirement: ${source}`);
    const constraint = match[3].trim();
    return {
      name: match[1], constraint, version: /^==[^*,\s]+$/u.test(constraint) ? constraint.slice(2) : null,
      license: null, licenseEvidence: "UNKNOWN_NOT_IN_REQUIREMENTS",
      disposition: /^==[^*,\s]+$/u.test(constraint) ? "REVIEW_PACKAGE_METADATA" : "UNLOCKED_RANGE_REQUIRES_RESOLUTION",
    };
  });
}

/** Inventory every tracked npm/Cargo lock and Python requirements file without
 * claiming installed versions, legal clearance, or resolved Python ranges.
 */
export function inventoryRepositoryDependencyGraphs(root, trackedPaths) {
  const realRoot = realpathSync(root);
  const sources = [...new Set(trackedPaths.map((file) => file.replaceAll("\\", "/")).filter(isGraph))].sort();
  const graphs = sources.map((source) => {
    if (path.isAbsolute(source) || path.win32.isAbsolute(source) || source.split(/[\\/]/u).includes("..")) {
      throw new Error(`OSS dependency inventory path escapes repository: ${source}`);
    }
    const absolute = realpathSync(path.resolve(realRoot, source));
    const relative = path.relative(realRoot, absolute);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error(`OSS dependency inventory path escapes repository: ${source}`);
    }
    const text = readFileSync(absolute, "utf8");
    const kind = source.endsWith("package-lock.json") ? "npm-lock" : source.endsWith("Cargo.lock") ? "cargo-lock" : "python-requirements";
    const records = kind === "npm-lock" ? npmRecords(text, source) : kind === "cargo-lock" ? cargoRecords(text, source) : requirementRecords(text, source);
    return { source, sourceDigestLf: digestText(text), kind, records };
  });
  return {
    scope: "ALL_TRACKED_NPM_CARGO_AND_PYTHON_REQUIREMENTS",
    graphCount: graphs.length,
    recordCount: graphs.reduce((total, graph) => total + graph.records.length, 0),
    limits: "Tracked-source metadata only. External installations, untracked graphs, model bytes, advisories and licence clearance require separate observations.",
    graphs,
  };
}
