import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const STYLELINT_VERSION = "17.15.0";

const STYLE_EXTENSIONS = new Set([".css", ".scss"]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const TOKEN_SOURCE = "app/design-tokens.css";
const FOUNDATION_ROOT = "app/_components/foundation";
const STYLE_EXEMPTION_PATTERN = /pp-ui-style-exempt:\s*[^\s].+/i;

function normalizedPath(file) {
  return file.replaceAll("\\", "/");
}

export function isUiPath(file) {
  const value = normalizedPath(file);
  return value.startsWith("app/") || value.startsWith("components/") || /(^|\/)ui\//.test(value);
}

function findCssDeclarationViolations(file, content) {
  const violations = [];
  const declarationPattern = /(^|[;{]\s*)(margin(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?|padding(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?|gap|row-gap|column-gap|border-radius|font-size|font-family|line-height|letter-spacing|box-shadow|transition-duration)\s*:\s*([^;}]+)/gim;

  for (const match of content.matchAll(declarationPattern)) {
    const property = match[2].toLowerCase();
    const value = match[3].trim();
    const tokenized = /var\(--pp-[^)]+\)/.test(value);
    const safeLiteral = value === "0" || value === "none" || value === "normal" || value === "inherit" || value === "initial" || value === "unset";

    if (property === "font-family" && !/var\(--pp-font-(?:body|display|code)\)/.test(value)) {
      violations.push(`${file}: ${property} must use a --pp-font-* token (found ${value})`);
      continue;
    }

    if (!tokenized && !safeLiteral && /(?:\d|["'])/.test(value)) {
      violations.push(`${file}: ${property} must use a PlotPickle token (found ${value})`);
    }
  }

  return violations;
}

function findSourceStyleViolations(file, content) {
  const violations = [];

  if (/\bstyle\s*=\s*\{\s*\{/.test(content)) {
    violations.push(`${file}: inline style objects are not allowed in migrated/new UI; use a tokenized CSS module`);
  }

  if (/\bstyled(?:\.|\()|\bcss\s*`/.test(content)) {
    violations.push(`${file}: ad-hoc CSS-in-JS is not allowed in the Phase 1 UI foundation`);
  }

  return violations;
}

export function findTokenViolations(file, content) {
  const normalized = normalizedPath(file);
  if (!isUiPath(normalized) || normalized === TOKEN_SOURCE || STYLE_EXEMPTION_PATTERN.test(content)) return [];

  const extension = extname(normalized).toLowerCase();
  if (STYLE_EXTENSIONS.has(extension)) return findCssDeclarationViolations(normalized, content);
  if (SOURCE_EXTENSIONS.has(extension)) return findSourceStyleViolations(normalized, content);
  return [];
}

function changedFiles(baseRef) {
  const result = spawnSync("git", ["diff", "--name-only", "--diff-filter=ACMR", `${baseRef}...HEAD`], {
    encoding: "utf8"
  });

  if (result.error || result.status !== 0) {
    const detail = result.stderr?.trim() || result.error?.message || "unknown git diff failure";
    throw new Error(`Unable to determine changed UI files: ${detail}`);
  }

  return result.stdout.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

async function foundationFiles() {
  const entries = await readdir(FOUNDATION_ROOT, { recursive: true });
  return entries.map((entry) => normalizedPath(`${FOUNDATION_ROOT}/${entry}`));
}

async function readableFiles(files) {
  const output = [];
  for (const file of files) {
    try {
      await readFile(file, "utf8");
      output.push(normalizedPath(file));
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "EISDIR") throw error;
    }
  }
  return output;
}

function runStylelint(files) {
  if (!files.length) return;
  const executable = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(
    executable,
    ["--yes", `--package=stylelint@${STYLELINT_VERSION}`, "stylelint", "--config", "stylelint.config.mjs", ...files],
    { stdio: "inherit" }
  );

  if (result.error || result.status !== 0) {
    throw new Error(`Stylelint token gate failed${result.error ? `: ${result.error.message}` : ""}`);
  }
}

export async function runUiStylelintGate({ baseRef = null, allFoundation = false } = {}) {
  if (!baseRef && !allFoundation) {
    throw new Error("Pass --base-ref <sha/ref> for PR changed-file enforcement or --all-foundation for the foundation smoke gate.");
  }

  const candidates = allFoundation ? await foundationFiles() : changedFiles(baseRef);
  const files = (await readableFiles(candidates)).filter(isUiPath).filter((file) => file !== TOKEN_SOURCE);
  const violations = [];
  const styleFiles = [];

  for (const file of files) {
    const content = await readFile(file, "utf8");
    if (STYLE_EXEMPTION_PATTERN.test(content)) continue;
    violations.push(...findTokenViolations(file, content));
    if (STYLE_EXTENSIONS.has(extname(file).toLowerCase())) styleFiles.push(file);
  }

  if (violations.length) {
    for (const violation of violations) console.error(`UI token gate: ${violation}`);
    throw new Error(`UI token gate found ${violations.length} hardcoded/ad-hoc style violation(s).`);
  }

  runStylelint(styleFiles);
  console.log(`UI token gate passed for ${files.length} changed/foundation UI file(s).`);
}

const directExecution = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (directExecution) {
  const baseRefIndex = process.argv.indexOf("--base-ref");
  runUiStylelintGate({
    baseRef: baseRefIndex >= 0 ? process.argv[baseRefIndex + 1] : null,
    allFoundation: process.argv.includes("--all-foundation")
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
