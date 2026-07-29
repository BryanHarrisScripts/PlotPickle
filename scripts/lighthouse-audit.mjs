#!/usr/bin/env node

import { spawnCommand } from "./spawn-command.mjs";
import { createWriteStream } from "node:fs";
import { access, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP_DIR = join(ROOT, "app");
const REPORT_ROOT = join(ROOT, "reports", "lighthouse");
const HOST = "127.0.0.1";
const DEFAULT_PORT = 4173;
const LIGHTHOUSE_VERSION = "12.8.2";
const LIGHTHOUSE_ROUTE_TIMEOUT_MS = 60_000;
const PAGE_FILE = /^page\.(?:[cm]?[jt]sx?)$/;
const SMOKE_AUDITS = [
  "http-status-code",
  "errors-in-console",
  "document-title",
  "meta-description",
  "network-requests",
];
const REQUIRED_ASSETS = [
  "/manifest.webmanifest",
  "/brand/favicon/plotpickle-icon-32.png",
  "/brand/plotpickle-header-horizontal-600.png",
  "/brand/plotpickle-logo-stacked-transparent-800.png",
];

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
    const { timeoutMs, ...spawnOptions } = options;
    const child = spawnCommand(command, args, {
      cwd: ROOT,
      stdio: spawnOptions.stdio ?? "inherit",
      ...spawnOptions,
    });
    let settled = false;
    let timeout;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      callback();
    };
    child.once("error", (error) => finish(() => reject(error)));
    child.once("exit", (code, signal) => {
      finish(() => {
        if (code === 0) resolvePromise({ code, signal });
        else reject(new Error(`${command} ${args.join(" ")} failed with ${signal ?? `exit ${code}`}`));
      });
    });
    if (timeoutMs) {
      timeout = setTimeout(() => {
        child.kill("SIGTERM");
        finish(() => reject(new Error(`${command} timed out after ${timeoutMs}ms`)));
      }, timeoutMs);
    }
  });
}

function commandForNpx() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

export function waitForWritableOpen(stream) {
  if (stream.fd !== null) return Promise.resolve();
  return new Promise((resolvePromise, reject) => {
    const cleanup = () => {
      stream.off("open", onOpen);
      stream.off("error", onError);
    };
    const onOpen = () => { cleanup(); resolvePromise(); };
    const onError = (error) => { cleanup(); reject(error); };
    stream.once("open", onOpen);
    stream.once("error", onError);
  });
}

export function closeWritable(stream) {
  if (stream.closed) return Promise.resolve();
  return new Promise((resolvePromise, reject) => {
    const cleanup = () => {
      stream.off("close", onClose);
      stream.off("error", onError);
    };
    const onClose = () => { cleanup(); resolvePromise(); };
    const onError = (error) => { cleanup(); reject(error); };
    stream.once("close", onClose);
    stream.once("error", onError);
    stream.end();
  });
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

function startLocalServer(port) {
  return spawnCommand(commandForNpx(), ["--yes", "vite", "--host", HOST, "--port", String(port)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function smokeResult(report, target, exitCode, consoleErrors) {
  const failures = [];
  const httpAudit = report.audits?.["http-status-code"];
  const titleAudit = report.audits?.["document-title"];
  const descriptionAudit = report.audits?.["meta-description"];
  const requests = report.audits?.["network-requests"]?.details?.items ?? [];
  const finalUrl = report.finalDisplayedUrl ?? report.finalUrl ?? target;
  const requestedOrigin = new URL(target).origin;
  let finalOrigin = "";
  try {
    finalOrigin = new URL(finalUrl).origin;
  } catch {
    failures.push("Lighthouse did not return a valid final URL.");
  }

  const documentRequests = requests.filter((item) => item?.resourceType === "Document");
  const successfulDocument = httpAudit?.score === 1
    && (documentRequests.length === 0 || documentRequests.some((item) => Number(item.statusCode) >= 200 && Number(item.statusCode) < 400));
  const documentTitle = titleAudit?.score === 1;
  const metaDescription = descriptionAudit?.score === 1;
  const consoleClean = consoleErrors.length === 0;
  const browserErrorPage = Boolean(report.runtimeError) || (finalOrigin !== "" && finalOrigin !== requestedOrigin);

  if (exitCode !== 0) failures.push("The Lighthouse command reported an error.");
  if (!successfulDocument) failures.push("The route did not return a successful document.");
  if (!documentTitle) failures.push("The route is missing a document title.");
  if (!metaDescription) failures.push("The route is missing a meta description.");
  if (!consoleClean) failures.push(`The route produced ${consoleErrors.length} serious browser console error${consoleErrors.length === 1 ? "" : "s"}.`);
  if (browserErrorPage) failures.push("The route ended on a runtime, browser or cross-origin error page.");

  return {
    passed: failures.length === 0,
    failures,
    browserErrorPage,
    documentTitle,
    metaDescription,
    successfulDocument,
    consoleClean,
  };
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
    `--output-path=${join(outputDirectory, slug)}`,
  ];
  if (mode !== "smoke") args.push("--output=html");
  if (mode === "desktop" || mode === "smoke") args.push("--preset=desktop");
  if (mode === "smoke") args.push(`--only-audits=${SMOKE_AUDITS.join(",")}`);

  const log = createWriteStream(logPath, { flags: "w" });
  let exitCode = 0;
  try {
    await waitForWritableOpen(log);
    await run(commandForNpx(), args, {
      stdio: ["ignore", log, log],
      timeoutMs: LIGHTHOUSE_ROUTE_TIMEOUT_MS,
    });
  } catch (error) {
    exitCode = 1;
    if (!log.destroyed) log.write(`\n${error.stack ?? error.message}\n`);
  } finally {
    await closeWritable(log);
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
    const requests = report.audits?.["network-requests"]?.details?.items ?? [];
    const failedAudits = audits
      .filter((audit) => audit?.score !== null && audit?.score < 0.9 && audit?.scoreDisplayMode !== "notApplicable")
      .map((audit) => ({ id: audit.id, title: audit.title, score: audit.score, displayValue: audit.displayValue ?? "" }));
    const accessibilityAuditRefs = new Set((categories.accessibility?.auditRefs ?? []).map((item) => item.id));
    const seriousAccessibility = audits
      .filter((audit) => accessibilityAuditRefs.has(audit?.id) && audit?.score === 0)
      .map((audit) => ({ id: audit.id, title: audit.title, impact: "failed-accessibility-audit" }));
    const consoleErrors = report.audits?.["errors-in-console"]?.details?.items ?? [];
    const finalUrl = report.finalDisplayedUrl ?? report.finalUrl ?? target;
    const smoke = smokeResult(report, target, exitCode, consoleErrors);
    const result = {
      route,
      requestedUrl: target,
      finalUrl,
      status: exitCode === 0 ? "audited" : "audited-with-command-error",
      smoke,
      scores: mode === "smoke" ? {
        performance: null,
        accessibility: null,
        bestPractices: null,
        seo: null,
      } : {
        performance: categories.performance?.score ?? null,
        accessibility: categories.accessibility?.score ?? null,
        bestPractices: categories["best-practices"]?.score ?? null,
        seo: categories.seo?.score ?? null,
      },
      failedAudits,
      seriousAccessibility,
      consoleErrors,
      files: mode === "smoke"
        ? { json: basename(jsonPath), log: basename(logPath) }
        : { json: basename(jsonPath), html: basename(htmlPath), log: basename(logPath) },
    };
    if (mode === "smoke") {
      const auditEvidence = Object.fromEntries(SMOKE_AUDITS.map((id) => {
        const audit = report.audits?.[id];
        return [id, {
          id,
          title: audit?.title ?? id,
          score: audit?.score ?? null,
          displayValue: audit?.displayValue ?? "",
        }];
      }));
      const failedNetworkRequests = requests
        .filter((item) => Number(item?.statusCode) >= 400)
        .map((item) => ({
          url: item.url ?? "",
          statusCode: Number(item.statusCode),
          resourceType: item.resourceType ?? "",
        }));
      await writeFile(jsonPath, `${JSON.stringify({
        lighthouseVersion: report.lighthouseVersion ?? "",
        fetchTime: report.fetchTime ?? "",
        route,
        requestedUrl: target,
        finalUrl,
        smoke,
        audits: auditEvidence,
        consoleErrors,
        failedNetworkRequests,
      }, null, 2)}\n`);
      for (const candidate of [...possibleJson, ...possibleHtml]) {
        if (candidate !== jsonPath) await rm(candidate, { force: true });
      }
    }
    return result;
  } catch (error) {
    return {
      route,
      requestedUrl: target,
      finalUrl: null,
      status: "failed",
      error: error.message,
      smoke: {
        passed: false,
        failures: [`No readable Lighthouse report was produced: ${error.message}`],
        browserErrorPage: true,
        documentTitle: false,
        metaDescription: false,
        successfulDocument: false,
        consoleClean: false,
      },
      scores: { performance: null, accessibility: null, bestPractices: null, seo: null },
      failedAudits: [],
      seriousAccessibility: [],
      consoleErrors: [],
      files: { log: basename(logPath) },
    };
  }
}

async function checkRequiredAssets(baseUrl) {
  const results = [];
  for (const path of REQUIRED_ASSETS) {
    try {
      const response = await fetch(new URL(path, baseUrl), { redirect: "follow" });
      const body = await response.arrayBuffer();
      results.push({
        path,
        status: response.status,
        contentType: response.headers.get("content-type") ?? "",
        bytes: body.byteLength,
        passed: response.ok && body.byteLength > 0,
      });
    } catch (error) {
      results.push({ path, status: null, contentType: "", bytes: 0, passed: false, error: error.message });
    }
  }
  return results;
}

function summaryMarkdown(summary) {
  const lines = [
    "# PlotPickle Lighthouse audit",
    "",
    `Generated: ${summary.generatedAt}`,
    `Mode: ${summary.mode}`,
    `Base URL: ${summary.baseUrl}`,
    `Smoke result: ${summary.smoke.passed ? "PASS" : "FAIL"}`,
    "",
    "| Route | Smoke | Status | Performance | Accessibility | Best Practices | SEO | Final URL |",
    "|---|---:|---:|---:|---:|---:|---:|---|",
  ];
  for (const item of summary.results) {
    const score = (value) => value === null ? "—" : String(Math.round(value * 100));
    lines.push(`| \`${item.route}\` | ${item.smoke.passed ? "PASS" : "FAIL"} | ${item.status} | ${score(item.scores.performance)} | ${score(item.scores.accessibility)} | ${score(item.scores.bestPractices)} | ${score(item.scores.seo)} | ${item.finalUrl ?? "—"} |`);
  }
  if (summary.smoke.routeFailures.length) {
    lines.push("", "## Route smoke failures", "");
    for (const item of summary.smoke.routeFailures) {
      lines.push(`- \`${item.route}\`: ${item.failures.join(" ")}`);
    }
  }
  lines.push("", "## Required metadata and brand assets", "");
  for (const item of summary.requiredAssets) {
    lines.push(`- ${item.passed ? "PASS" : "FAIL"} \`${item.path}\` — ${item.status ?? "request failed"}, ${item.bytes} bytes`);
  }
  if (summary.dynamicRoutes.length) {
    lines.push("", "## Dynamic routes needing sample parameters", "");
    for (const item of summary.dynamicRoutes) lines.push(`- \`${item.route}\` — ${item.reason} (${item.source})`);
  }
  lines.push(
    "",
    "## Interpretation",
    "",
    "The smoke result is the release gate: the server starts, every supported static route returns a real document on the local origin, required title and description metadata are present, serious browser console errors are absent, and required brand assets load. Lighthouse category scores remain diagnostic and do not create arbitrary release thresholds.",
    "",
    "## Privacy",
    "",
    "This audit ran against the local PlotPickle server on 127.0.0.1. No story project was sent to a remote audit service.",
  );
  return `${lines.join("\n")}\n`;
}

async function runMode(mode, reportDirectory) {
  const outputDirectory = join(reportDirectory, mode);
  await mkdir(outputDirectory, { recursive: true });
  const inventory = await discoverRoutes();
  const port = await choosePort();
  const baseUrl = `http://${HOST}:${port}`;
  const localServer = startLocalServer(port);
  localServer.stdout.on("data", (chunk) => process.stdout.write(`[local-server] ${chunk}`));
  localServer.stderr.on("data", (chunk) => process.stderr.write(`[local-server] ${chunk}`));

  try {
    await waitForServer(baseUrl);
    const results = [];
    for (const item of inventory.staticRoutes) {
      console.log(`[${mode}] ${item.route}`);
      results.push(await auditRoute({ baseUrl, route: item.route, mode, outputDirectory }));
    }
    const requiredAssets = await checkRequiredAssets(baseUrl);
    const routeFailures = results
      .filter((item) => !item.smoke.passed)
      .map((item) => ({ route: item.route, failures: item.smoke.failures }));
    const assetFailures = requiredAssets.filter((item) => !item.passed).map((item) => item.path);
    const summary = {
      generatedAt: new Date().toISOString(),
      mode,
      baseUrl,
      routes: inventory.staticRoutes,
      dynamicRoutes: inventory.dynamicRoutes,
      requiredAssets,
      results,
      smoke: {
        passed: routeFailures.length === 0 && assetFailures.length === 0,
        routeFailures,
        assetFailures,
      },
    };
    await writeFile(join(outputDirectory, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    await writeFile(join(outputDirectory, "summary.md"), summaryMarkdown(summary));
    return summary;
  } finally {
    localServer.kill("SIGTERM");
  }
}

async function zipDirectory(directory) {
  const zipPath = `${directory}.zip`;
  if (process.platform === "win32") {
    await run("powershell.exe", ["-NoProfile", "-Command", `Compress-Archive -Path '${directory}\\*' -DestinationPath '${zipPath}' -Force`]);
  } else {
    await run("zip", ["-r", zipPath, basename(directory)], { cwd: dirname(directory) });
  }
  console.log(`Upload this file for review: ${zipPath}`);
  return zipPath;
}

async function zipLatest() {
  await mkdir(REPORT_ROOT, { recursive: true });
  const entries = (await readdir(REPORT_ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
  if (!entries.length) throw new Error("No Lighthouse report folder exists. Run an audit first.");
  return zipDirectory(join(REPORT_ROOT, entries[0]));
}

async function main() {
  const command = process.argv[2] ?? "smoke";
  if (command === "zip") return zipLatest();
  const reportDirectory = join(REPORT_ROOT, timestamp());
  await mkdir(reportDirectory, { recursive: true });
  if (process.env.PLOTPICKLE_LIGHTHOUSE_SKIP_BUILD === "1") {
    console.log("Using the build already verified by CI.");
  } else {
    console.log("Building PlotPickle once before the Lighthouse audit…");
    await run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"]);
  }

  const summaries = [];
  if (command === "smoke" || command === "desktop" || command === "mobile") {
    summaries.push(await runMode(command, reportDirectory));
  } else if (command === "all") {
    summaries.push(await runMode("desktop", reportDirectory));
    summaries.push(await runMode("mobile", reportDirectory));
  } else {
    throw new Error(`Unknown audit mode: ${command}`);
  }

  await writeFile(join(REPORT_ROOT, "latest.txt"), `${reportDirectory}\n`);
  await zipDirectory(reportDirectory);
  const failures = summaries.filter((summary) => !summary.smoke.passed);
  if (failures.length) {
    throw new Error(`Lighthouse smoke failed in ${failures.map((summary) => summary.mode).join(", ")} mode. Review ${reportDirectory}.`);
  }
  console.log(`Lighthouse smoke passed: ${reportDirectory}`);
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
