#!/usr/bin/env node

import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { requireCurrentRepository, requiredWorkbenchTempPath } from "./workbench-cli.mjs";
import { resolveActiveNpmCommand, runPortableCommand } from "../../scripts/pi-worker-runtime.mjs";

const MAX_SEEDS = 48;
const MAX_OUTPUT_CHARS = 90_000;
const MISSING_CODES = new Set(["ENOENT", "ENOTDIR"]);
const SAFE_IGNORE = [
  ".env", ".env.*", "**/.env", "**/.env.*", "**/*.pem", "**/*.key", "**/*.p12", "**/*.pfx",
  "**/credentials.json", "**/secrets.json", "**/.npmrc", "**/.yarnrc",
  "node_modules/**", "dist/**", "release/**", "out/**", "coverage/**", ".next/**", ".vite/**",
  ".cache/**", ".artifacts/**", "artifacts/**", "test-results/**", "playwright-report/**", "repomix-output.*",
].join(",");

function normalizeRelative(root, candidate) {
  const raw = String(candidate || "").trim().replaceAll("\\", "/").replace(/^\.\//u, "");
  if (!raw || raw.includes("\0") || path.isAbsolute(raw)) return "";
  const resolved = path.resolve(root, raw);
  const relative = path.relative(root, resolved);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return "";
  return relative.replaceAll("\\", "/");
}

async function pathExists(root, relative) {
  try {
    await access(path.join(root, relative));
    return true;
  } catch (error) {
    if (MISSING_CODES.has(error?.code)) return false;
    throw error;
  }
}

function packageText(reviewPackage) {
  const values = [
    reviewPackage?.issue?.title,
    reviewPackage?.issue?.body,
    reviewPackage?.pullRequest?.title,
    reviewPackage?.pullRequest?.body,
    ...(reviewPackage?.issue?.comments || []).map((item) => item?.body),
    ...(reviewPackage?.pullRequest?.comments || []).map((item) => item?.body),
  ];
  return values.filter(Boolean).join("\n");
}

function mentionedPaths(text) {
  const matches = String(text || "").matchAll(/(?:^|[\s`'"(])((?:app|build|config|core|docs|lib|modules|public|scripts|tests|Utilities)\/[A-Za-z0-9_.@+\-/]+\.[A-Za-z0-9_.-]+)(?=$|[\s`'"),:;])/gmu);
  return [...matches].map((match) => match[1]);
}

async function matchingTests(root, reviewPackage, changed) {
  const testRoot = path.join(root, "tests");
  let entries;
  try {
    entries = await readdir(testRoot, { withFileTypes: true });
  } catch (error) {
    if (MISSING_CODES.has(error?.code)) return [];
    throw error;
  }
  const issueNumber = Number(reviewPackage?.issue?.number || reviewPackage?.selectedNumber || 0);
  const tokens = new Set(
    changed.flatMap((file) => path.basename(file, path.extname(file)).toLowerCase().split(/[^a-z0-9]+/u))
      .filter((token) => token.length >= 5),
  );
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => {
      const lower = name.toLowerCase();
      if (issueNumber > 0 && lower.includes(String(issueNumber))) return true;
      return [...tokens].some((token) => lower.includes(token));
    })
    .slice(0, 12)
    .map((name) => `tests/${name}`);
}

export async function selectRepomixSeeds(reviewPackage) {
  const root = requireCurrentRepository(reviewPackage);
  const changed = (reviewPackage?.pullRequest?.files || []).map((item) => item?.path).filter(Boolean);
  const candidates = [
    ...changed,
    ...mentionedPaths(packageText(reviewPackage)),
    ...(await matchingTests(root, reviewPackage, changed)),
  ];
  const selected = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const relative = normalizeRelative(root, candidate);
    if (!relative || seen.has(relative.toLowerCase())) continue;
    if (!(await pathExists(root, relative))) continue;
    seen.add(relative.toLowerCase());
    selected.push(relative);
    if (selected.length >= MAX_SEEDS) break;
  }
  return selected;
}

export async function buildRepomixEvidence(reviewPackage, outputPath) {
  const root = requireCurrentRepository(reviewPackage);
  const seeds = await selectRepomixSeeds(reviewPackage);
  await mkdir(path.dirname(outputPath), { recursive: true });
  if (!seeds.length) {
    await writeFile(outputPath, [
      "# Repomix evidence",
      "",
      "No deterministic repository file seed was available from the current Issue/PR package.",
      "The reviewer must rely on the bounded GitHub package, repository instruction bundle, and read-only repository inspection instead of a broad repository pack.",
      "",
    ].join("\n"), "utf8");
    return { seeds, used: false };
  }

  const temporary = path.join(path.dirname(outputPath), `repomix-${process.pid}-${Date.now()}.xml`);
  try {
    await runPortableCommand(resolveActiveNpmCommand(), [
      "exec", "--yes", "--package=repomix@1.18.0", "--", "repomix",
      "--style", "xml",
      "--parsable-style",
      "--output-show-line-numbers",
      "--output", temporary,
      "--include", seeds.join(","),
      "--ignore", SAFE_IGNORE,
    ], {
      cwd: root,
      timeout: 3 * 60_000,
      maxBuffer: 16 * 1024 * 1024,
    });
    const packed = await readFile(temporary, "utf8");
    const bounded = packed.length <= MAX_OUTPUT_CHARS
      ? packed
      : `${packed.slice(0, MAX_OUTPUT_CHARS)}\n[Repomix evidence truncated by Developer Workbench context budget.]`;
    await writeFile(outputPath, [
      "# Repomix evidence",
      "",
      `Selected deterministic seeds (${seeds.length}): ${seeds.join(", ")}`,
      "Repomix is evidence only; it does not grant the reviewer additional filesystem or write authority.",
      "",
      bounded,
      "",
    ].join("\n"), "utf8");
    return { seeds, used: true };
  } finally {
    await rm(temporary, { force: true });
  }
}

if (process.argv.includes("--input")) {
  const inputPath = requiredWorkbenchTempPath(process.argv, "--input");
  const outputPath = requiredWorkbenchTempPath(process.argv, "--output");
  const reviewPackage = JSON.parse(await readFile(inputPath, "utf8"));
  if (!reviewPackage?.repositoryPath) throw new Error("Repomix evidence requires repositoryPath in the review package.");
  requireCurrentRepository(reviewPackage);
  await buildRepomixEvidence(reviewPackage, outputPath);
  process.stdout.write(`${outputPath}\n`);
}
