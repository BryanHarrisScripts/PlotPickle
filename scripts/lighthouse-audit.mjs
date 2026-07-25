#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import process from "node:process";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const APP_DIR = join(ROOT, "app");
const REPORT_ROOT = join(ROOT, "reports", "lighthouse");
const HOST = "127.0.0.1";
const DEFAULT_PORT = 4173;
const LIGHTHOUSE_VERSION = "12.8.2";
const PAGE_FILE = /^page\.(?:[cm]?[jt]sx?)$/;

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function slugFor(route) {
  if (route === "/") return "root";
  return route
    .replace(/^\//, "")
    .replace(/[?&=]+/g, "-")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-|-$/g, "") || "root";
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(fullPath)));
    else if (PAGE_FILE.test(entry.name)) files.push(fullPath);
  }
  return files;
}

export async function discoverRoutes() {
  const pages = await walk(APP_DIR);
  const staticRoutes = [];
  const dynamicRoutes = [];

  for (const page of pages) {
    const directory = relative(APP_DIR, dirname(page));
    const segments = directory === "" ? [] : directory.split(sep);
    const route = `/${segments.filter((segment) => !segment.startsWith("(")).join("/")}`.replace(/\/$/, "") || "/";
    if (segments.some((segment) => segment.includes("[") || segment.includes("]"))) {
      dynamicRoutes.push({ route, source: relative(ROOT, page), reason: "Dynamic route needs a real sample parameter." });
    } else {
      staticRoutes.push({ route, source: relative(ROOT, page) });
    }
  }

  const unique = new Map(staticRoutes.map((item) => [item.route, item]));
  unique.set("/", unique.get("/") ?? { route: "/", source: "app/page.tsx" });
  unique.set("/?workspace=1", { route: "/?workspace=1", source: "main workspace audit variant" });

  return {
    staticRoutes: [...unique.values()].sort((a, b) => a.route.localeCompare(b.route)),
    dynamicRoutes: dynamicRoutes.sort((a, b) => a.route.localeCompare(b.route)),
  };
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: options.stdio ?? "inherit", shell: process.platform === "win32", ...options });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise({ code, signal });
      else reject(new Error(`${command} ${args.join(" ")} failed with ${signal ?? `exit ${code}`}`));
    });
  });
}

function commandForNpx() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

async function waitForServer(url, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status > 0) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error(`Preview server did not become ready at ${url}: ${lastError?.message ?? "timeout"}`);
}

async function choosePort(preferred = DEFAULT_PORT) {
  for (let port = preferred; port < preferred + 30; port += 1) {
    const available = await new Promise((resolvePromise) => {
      const server = createServer();
      server.once("error", () => resolvePromise(false));
      server.listen(port, HOST, () => server.close(() => resolvePromise(true)));
    });
    if (available) return port;
  }
  throw new Error("Could not find a free local preview port.");
}

function startPreview(port) {
  return spawn(commandForNpx(), ["--yes", "vite", "preview", "--host", HOST, "--port", String(port)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
}

async function auditRoute({ baseUrl, route, mode, outputDirectory }) {
  const slug = slugFor(route);
  const jsonPath = join(outputDirectory, `${slug}.json`);
  const htmlPath = join(outputDirectory, `${slug}.html`);
  const logPath = join(outputDirectory, `${slug}.log.txt`);
  const target = new URL(route, baseUrl).href;
  const args = [
    "--yes",
    `lighthouse@${LIGHTHOUSE_VERSION}`,
    target,
    "--quiet",
    "--chrome-flags=--headless --no-sandbox --disable-gpu",
    "--output=json",
    "--output=html",
    `--output-path=${join(outputDirectory, slug)}`,
  ];
  if (mode === "desktop") args.push("--preset=desktop");

  const log = createWriteStream(logPath, { flags: "w" });
  let exitCode = 0;
  try {
    await run(commandForNpx(), args, { stdio: ["ignore", log, log] });
  } catch (error) {
    exitCode = 1;
    log.write(`\n${error.stack ?? error.message}\n`);
  } finally {
    log.end();
  }

  const possibleJson = [`${join(outputDirectory, slug)}.report.json`, `${join(outputDirectory, slug)}.json`];
  const possibleHtml = [`${join(outputDirectory, slug)}.report.html`, `${join(outputDirectory, slug)}.html`];
  for (const candidate of possibleJson) {
    try { await access(candidate); if (candidate !== jsonPath) await writeFile(jsonPath, await readFile(candidate)); break; } catch {}
  }
  for (const candidate of possibleHtml) {
    try { await access(candidate); if (candidate !== htmlPath) await writeFile(htmlPath, await readFile(candidate)); break; } catch {}
  }

  try {
    const report = JSON.parse(await readFile(jsonPath, "utf8"));
    const categories = report.categories ?? {};
    const audits = Object.values(report.audits ?? {});
    const failedAudits = audits
      .filter((audit) => audit?.score !== null && audit?.score < 0.9 && audit?.scoreDisplayMode !== "notApplicable")
      .map((audit) => ({ id: audit.id, title: audit.title, score: audit.score, displayValue: audit.displayValue ?? "" }));
    const seriousAccessibility = audits
      .filter((audit) => audit?.details?.type === "table" && ["serious", "critical"].includes(audit?.details?.debugData?.impact))
      .map((audit) => ({ id: audit.id, title: audit.title, impact: audit.details.debugData.impact }));
    const consoleErrors = report.audits?.["errors-in-console"]?.details?.items ?? [];

    return {
      route,
      requestedUrl: target,
      finalUrl: report.finalDisplayedUrl ?? report.finalUrl ?? target,
      status: exitCode === 0 ? "audited" : "audited-with-command-error",
      scores: {
        performance: categories.performance?.score ?? null,
        accessibility: categories.accessibility?.score ?? null,
        bestPractices: categories["best-practices"]?.score ?? null,
        seo: categories.seo?.score ?? null,
      },
      failedAudits,
      seriousAccessibility,
      consoleErrors,
      files: { json: basename(jsonPath), html: basename(htmlPath), log: basename(logPath) },
    };
  } catch (error) {
    return {
      route,
      requestedUrl: target,
      finalUrl: null,
      status: "failed",
      error: error.message,
      scores: { performance: null, accessibility: null, bestPractices: null, seo: null },
      failedAudits: [],
      seriousAccessibility: [],
      consoleErrors: [],
      files: { log: basename(logPath) },
    };
  }
}

function summaryMarkdown(summary) {
  const lines = [
    `# PlotPickle Lighthouse audit`,
    "",
    `Generated: ${summary.generatedAt}`,
    `Mode: ${summary.mode}`,
    `Base URL: ${summary.baseUrl}`,
    "",
    "| Route | Status | Performance | Accessibility | Best Practices | SEO | Final URL |",
    "|---|---:|---:|---:|---:|---:|---|",
  ];
  for (const item of summary.results) {
    const score = (value) => value === null ? "—" : String(Math.round(value * 100));
    lines.push(`| \`${item.route}\` | ${item.status} | ${score(item.scores.performance)} | ${score(item.scores.accessibility)} | ${score(item.scores.bestPractices)} | ${score(item.scores.seo)} | ${item.finalUrl ?? "—"} |`);
  }
  if (summary.dynamicRoutes.length) {
    lines.push("", "## Dynamic routes needing sample parameters", "");
    for (const item of summary.dynamicRoutes) lines.push(`- \`${item.route}\` — ${item.reason} (${item.source})`);
  }
  lines.push("", "## Privacy", "", "This audit ran against the local PlotPickle server on 127.0.0.1. No story project was sent to a remote audit service.");
  return `${lines.join("\n")}\n`;
}

async function runMode(mode, reportDirectory) {
  const outputDirectory = join(reportDirectory, mode);
  await mkdir(outputDirectory, { recursive: true });
  const inventory = await discoverRoutes();
  const port = await choosePort();
  const baseUrl = `http://${HOST}:${port}`;

  console.log(`Building PlotPickle before ${mode} audit…`);
  await run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"]);
  const preview = startPreview(port);
  preview.stdout.on("data", (chunk) => process.stdout.write(`[preview] ${chunk}`));
  preview.stderr.on("data", (chunk) => process.stderr.write(`[preview] ${chunk}`));

  try {
    await waitForServer(baseUrl);
    const results = [];
    for (const item of inventory.staticRoutes) {
      console.log(`[${mode}] ${item.route}`);
      results.push(await auditRoute({ baseUrl, route: item.route, mode, outputDirectory }));
    }
    const summary = { generatedAt: new Date().toISOString(), mode, baseUrl, routes: inventory.staticRoutes, dynamicRoutes: inventory.dynamicRoutes, results };
    await writeFile(join(outputDirectory, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    await writeFile(join(outputDirectory, "summary.md"), summaryMarkdown(summary));
    return summary;
  } finally {
    preview.kill("SIGTERM");
  }
}

async function zipLatest() {
  await mkdir(REPORT_ROOT, { recursive: true });
  const entries = (await readdir(REPORT_ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
  if (!entries.length) throw new Error("No Lighthouse report folder exists. Run an audit first.");
  const latest = join(REPORT_ROOT, entries[0]);
  const zipPath = `${latest}.zip`;
  if (process.platform === "win32") {
    await run("powershell.exe", ["-NoProfile", "-Command", `Compress-Archive -Path '${latest}\\*' -DestinationPath '${zipPath}' -Force`]);
  } else {
    await run("zip", ["-r", zipPath, basename(latest)], { cwd: dirname(latest) });
  }
  console.log(`Upload this file for review: ${zipPath}`);
}

async function main() {
  const command = process.argv[2] ?? "all";
  if (command === "zip") return zipLatest();
  const reportDirectory = join(REPORT_ROOT, timestamp());
  await mkdir(reportDirectory, { recursive: true });
  if (command === "desktop" || command === "mobile") await runMode(command, reportDirectory);
  else if (command === "all") {
    await runMode("desktop", reportDirectory);
    await runMode("mobile", reportDirectory);
  } else throw new Error(`Unknown audit mode: ${command}`);
  await writeFile(join(REPORT_ROOT, "latest.txt"), `${reportDirectory}\n`);
  console.log(`Audit complete: ${reportDirectory}`);
  console.log("Run npm run audit:lighthouse:zip to create the uploadable ZIP.");
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
