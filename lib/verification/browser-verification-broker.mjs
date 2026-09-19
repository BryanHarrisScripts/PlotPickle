import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const BROWSER_DIAGNOSTIC_SCHEMA_VERSION = 1;
export const BROWSER_VERIFICATION_ADAPTERS = Object.freeze({
  "playwright-test": Object.freeze({
    id: "playwright-test",
    role: "deterministic-ci",
    executableHere: true,
    capabilities: Object.freeze([
      "navigate",
      "visible-interaction",
      "webmcp-tools",
      "snapshot-find",
      "bounded-evaluate",
      "console-events",
      "runtime-errors",
      "network-events",
      "screenshot",
      "trace",
      "viewport-media",
      "cleanup",
    ]),
  }),
  "playwright-cli": Object.freeze({
    id: "playwright-cli",
    role: "developer-agent",
    executableHere: false,
    capabilities: Object.freeze([
      "navigate",
      "visible-interaction",
      "snapshot-find",
      "bounded-evaluate",
      "console-events",
      "runtime-errors",
      "network-events",
      "screenshot",
      "trace",
      "cleanup",
    ]),
  }),
  "playwright-mcp": Object.freeze({
    id: "playwright-mcp",
    role: "persistent-exploratory",
    executableHere: false,
    capabilities: Object.freeze([
      "navigate",
      "visible-interaction",
      "webmcp-tools",
      "snapshot-find",
      "bounded-evaluate",
      "console-events",
      "runtime-errors",
      "network-events",
      "screenshot",
      "trace",
      "cleanup",
    ]),
  }),
});

const DEFAULT_ALLOWLIST_PATH = "config/verification/browser-diagnostics-allowlist.json";
const DEFAULT_ARTIFACT_ROOT = ".artifacts/browser-diagnostics";
const BLOCKING_CATEGORIES = new Set([
  "runtime-exception",
  "page-crash",
  "console-error",
  "required-resource-failure",
  "application-5xx",
  "unexpected-dialog",
]);

function bounded(value, limit = 1200) {
  const text = String(value ?? "");
  return text.length <= limit ? text : `${text.slice(0, limit)}…`;
}

export function sanitizeBrowserDiagnosticText(input) {
  return bounded(input)
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/giu, "Bearer [REDACTED]")
    .replace(/\b(?:authorization|cookie|set-cookie|password|secret|token|api[_-]?key)\s*[:=]\s*[^\s,;]+/giu, (match) => {
      const separator = match.includes(":") ? ":" : "=";
      return `${match.split(separator, 1)[0]}${separator}[REDACTED]`;
    })
    .replace(/([?&](?:token|key|secret|password|code|session|auth|api_key)=)[^&#\s]+/giu, "$1[REDACTED]")
    .replace(/\b[A-Za-z]:\\(?:Users|Program Files|AppData)\\[^\s"'<>]+/gu, "[LOCAL_PATH]")
    .replace(/\/(?:home|Users|tmp)\/[^\s"'<>]+/gu, "[LOCAL_PATH]");
}

export function sanitizeBrowserDiagnosticUrl(input) {
  try {
    const url = new URL(String(input || ""));
    if (!["http:", "https:"].includes(url.protocol)) return `[${url.protocol.replace(":", "") || "unknown"}-url]`;
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return sanitizeBrowserDiagnosticText(input);
  }
}

export function browserDiagnosticFingerprint(input) {
  const stable = [
    input.category || "unknown",
    input.surfaceId || "unknown",
    input.route || "unknown",
    input.actionId || "unknown",
    sanitizeBrowserDiagnosticText(input.summary || ""),
    sanitizeBrowserDiagnosticText(input.detail || ""),
  ].join("|");
  return createHash("sha256").update(stable).digest("hex").slice(0, 20);
}

export function browserVerificationAdapterCapabilities(adapterId = "playwright-test") {
  const descriptor = BROWSER_VERIFICATION_ADAPTERS[adapterId];
  if (!descriptor) throw new Error(`Unsupported Browser Verification adapter: ${adapterId}`);
  return descriptor;
}

async function loadAllowlist(allowlistPath = DEFAULT_ALLOWLIST_PATH) {
  try {
    const parsed = JSON.parse(await readFile(path.resolve(allowlistPath), "utf8"));
    if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.entries)) throw new Error("schemaVersion 1 with entries[] is required");
    return parsed.entries.map((entry) => ({
      category: String(entry.category || ""),
      pattern: String(entry.pattern || ""),
      reason: String(entry.reason || ""),
      owner: String(entry.owner || ""),
      reviewAfter: entry.reviewAfter ? String(entry.reviewAfter) : "",
    })).filter((entry) => entry.category && entry.pattern && entry.reason);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw new Error(`Invalid browser diagnostics allowlist: ${error.message}`);
  }
}

function allowlistMatch(allowlist, finding) {
  return allowlist.find((entry) => {
    if (entry.category !== "*" && entry.category !== finding.category) return false;
    try {
      return new RegExp(entry.pattern, "u").test(`${finding.summary}\n${finding.sanitizedDetail}`);
    } catch {
      return false;
    }
  }) || null;
}

function isAllowedOrigin(url, allowedOrigins) {
  try {
    const origin = new URL(url).origin;
    return allowedOrigins.has(origin);
  } catch {
    return false;
  }
}

function resourceIsRequired(request) {
  const type = String(request?.resourceType?.() || "").toLowerCase();
  return ["document", "script", "stylesheet", "font", "image", "media"].includes(type);
}

function safeRequestMethod(request) {
  try { return String(request.method()); } catch { return ""; }
}

function safeRequestUrl(request) {
  try { return sanitizeBrowserDiagnosticUrl(request.url()); } catch { return ""; }
}

function safePageUrl(page) {
  try { return sanitizeBrowserDiagnosticUrl(page.url()); } catch { return ""; }
}

class BrowserDiagnosticsObserver {
  constructor({ runId, adapter, allowedOrigins, artifactRoot, allowlist, failOnBlockers }) {
    this.runId = runId;
    this.adapter = adapter;
    this.allowedOrigins = new Set(allowedOrigins);
    this.artifactRoot = artifactRoot;
    this.allowlist = allowlist;
    this.failOnBlockers = failOnBlockers;
    this.findings = [];
    this.findingByFingerprint = new Map();
    this.checkpoints = [];
    this.pageMetadata = new WeakMap();
    this.attachedPages = new WeakSet();
    this.contextStates = new Map();
    this.deepTasks = [];
    this.finalized = false;
  }

  metadataFor(page) {
    return this.pageMetadata.get(page) || {
      surfaceId: "unknown",
      route: safePageUrl(page),
      actionId: "unspecified",
    };
  }

  setPageMetadata(page, metadata = {}) {
    const previous = this.metadataFor(page);
    this.pageMetadata.set(page, {
      surfaceId: String(metadata.surfaceId || previous.surfaceId || "unknown"),
      route: sanitizeBrowserDiagnosticUrl(metadata.route || previous.route || safePageUrl(page)),
      actionId: String(metadata.actionId || previous.actionId || "unspecified"),
    });
  }

  record(page, input) {
    const metadata = this.metadataFor(page);
    const base = {
      schemaVersion: BROWSER_DIAGNOSTIC_SCHEMA_VERSION,
      runId: this.runId,
      adapter: this.adapter.id,
      adapterVersion: String(this.adapter.adapterVersion || ""),
      browser: "chromium",
      browserVersion: String(this.adapter.browserVersion || ""),
      surfaceId: metadata.surfaceId,
      route: metadata.route || safePageUrl(page),
      actionId: metadata.actionId,
      checkpoint: input.checkpoint || "continuous",
      severity: input.severity || (BLOCKING_CATEGORIES.has(input.category) ? "blocker" : "advisory"),
      category: input.category || "browser-event",
      summary: sanitizeBrowserDiagnosticText(input.summary || input.category || "Browser event"),
      sanitizedDetail: sanitizeBrowserDiagnosticText(input.detail || ""),
      firstSeenAt: new Date().toISOString(),
      count: 1,
      allowlistMatch: null,
      policyDecision: "recorded",
    };
    base.fingerprint = browserDiagnosticFingerprint({
      ...base,
      detail: base.sanitizedDetail,
    });

    const match = allowlistMatch(this.allowlist, base);
    if (match) {
      base.allowlistMatch = {
        category: match.category,
        pattern: match.pattern,
        reason: match.reason,
        owner: match.owner || undefined,
        reviewAfter: match.reviewAfter || undefined,
      };
      base.policyDecision = "allowlisted";
      if (base.severity === "blocker") base.severity = "advisory";
    }

    const existing = this.findingByFingerprint.get(base.fingerprint);
    if (existing) {
      existing.count += 1;
      return existing;
    }

    this.findings.push(base);
    this.findingByFingerprint.set(base.fingerprint, base);
    if (base.severity === "blocker" && !base.allowlistMatch) {
      this.deepTasks.push(this.captureDeepEvidence(page, base));
    }
    return base;
  }

  async captureDeepEvidence(page, finding) {
    const folder = path.resolve(this.artifactRoot, this.runId);
    await mkdir(folder, { recursive: true });
    const stem = `deep-${finding.fingerprint}`;
    const record = {
      schemaVersion: BROWSER_DIAGNOSTIC_SCHEMA_VERSION,
      runId: this.runId,
      fingerprint: finding.fingerprint,
      surfaceId: finding.surfaceId,
      route: finding.route,
      category: finding.category,
      capturedAt: new Date().toISOString(),
      page: null,
    };
    try {
      record.page = await page.evaluate(() => ({
        pathname: location.pathname,
        title: document.title,
        readyState: document.readyState,
        viewport: { width: innerWidth, height: innerHeight },
        documentSize: {
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
        },
        activeElement: document.activeElement instanceof HTMLElement
          ? {
              tag: document.activeElement.tagName.toLowerCase(),
              id: document.activeElement.id || "",
              role: document.activeElement.getAttribute("role") || "",
            }
          : null,
        visibleAlerts: [...document.querySelectorAll("[role='alert'], [role='status']")]
          .filter((node) => {
            if (!(node instanceof HTMLElement)) return false;
            const style = getComputedStyle(node);
            return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
          })
          .slice(0, 10)
          .map((node) => ({
            id: node.id || "",
            role: node.getAttribute("role") || "",
            ariaLabel: node.getAttribute("aria-label") || "",
          })),
      }));
      await page.screenshot({ path: path.join(folder, `${stem}.png`), fullPage: false });
      record.screenshotRef = path.posix.join(this.artifactRoot.replaceAll("\\", "/"), this.runId, `${stem}.png`);
    } catch (error) {
      record.captureError = sanitizeBrowserDiagnosticText(error?.message || error);
    }
    const jsonPath = path.join(folder, `${stem}.json`);
    await writeFile(jsonPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    finding.domRef = path.posix.join(this.artifactRoot.replaceAll("\\", "/"), this.runId, `${stem}.json`);
    finding.visualRef = record.screenshotRef || null;
  }

  attachPage(page) {
    if (!page || this.attachedPages.has(page)) return;
    this.attachedPages.add(page);
    this.setPageMetadata(page, { route: safePageUrl(page) });

    page.on("console", (message) => {
      const type = String(message.type?.() || "").toLowerCase();
      if (!["warning", "error"].includes(type)) return;
      this.record(page, {
        category: type === "error" ? "console-error" : "console-warning",
        severity: type === "error" ? "blocker" : "advisory",
        summary: `console.${type}`,
        detail: message.text?.() || "",
      });
    });
    page.on("pageerror", (error) => {
      this.record(page, {
        category: "runtime-exception",
        severity: "blocker",
        summary: error?.name || "Uncaught page error",
        detail: error?.stack || error?.message || error,
      });
    });
    page.on("crash", () => {
      this.record(page, {
        category: "page-crash",
        severity: "blocker",
        summary: "Browser page crashed",
        detail: safePageUrl(page),
      });
    });
    page.on("dialog", (dialog) => {
      this.record(page, {
        category: "unexpected-dialog",
        severity: "blocker",
        summary: `Unexpected ${dialog.type?.() || "dialog"}`,
        detail: dialog.message?.() || "",
      });
    });
    page.on("requestfailed", (request) => {
      const rawUrl = request?.url?.() || "";
      if (!isAllowedOrigin(rawUrl, this.allowedOrigins)) return;
      const required = resourceIsRequired(request);
      this.record(page, {
        category: required ? "required-resource-failure" : "request-failure",
        severity: required ? "blocker" : "advisory",
        summary: `${safeRequestMethod(request)} ${safeRequestUrl(request)} failed`,
        detail: request?.failure?.()?.errorText || "",
      });
    });
    page.on("response", (response) => {
      const status = Number(response?.status?.() || 0);
      if (status < 400) return;
      const request = response.request?.();
      const rawUrl = response?.url?.() || request?.url?.() || "";
      if (!isAllowedOrigin(rawUrl, this.allowedOrigins)) return;
      const required = resourceIsRequired(request);
      this.record(page, {
        category: status >= 500 ? "application-5xx" : (required ? "required-resource-http-error" : "application-4xx"),
        severity: status >= 500 ? "blocker" : "advisory",
        summary: `HTTP ${status} ${safeRequestMethod(request)} ${sanitizeBrowserDiagnosticUrl(rawUrl)}`,
        detail: required ? `required resource type: ${request?.resourceType?.() || "unknown"}` : "",
      });
    });
    page.on("framenavigated", (frame) => {
      if (frame !== page.mainFrame?.()) return;
      this.setPageMetadata(page, { route: safePageUrl(page), actionId: "navigation" });
    });
  }

  async attachContext(context) {
    if (!context || this.contextStates.has(context)) return;
    const state = { traceStarted: false, traceFinalized: false, index: this.contextStates.size + 1 };
    this.contextStates.set(context, state);
    context.on("page", (page) => this.attachPage(page));
    for (const page of context.pages?.() || []) this.attachPage(page);
    try {
      await context.tracing?.start?.({ screenshots: true, snapshots: true, sources: false });
      state.traceStarted = true;
    } catch {
      state.traceStarted = false;
    }
  }

  checkpoint(page, metadata = {}) {
    this.setPageMetadata(page, metadata);
    const current = this.metadataFor(page);
    const checkpoint = {
      schemaVersion: BROWSER_DIAGNOSTIC_SCHEMA_VERSION,
      runId: this.runId,
      adapter: this.adapter.id,
      surfaceId: current.surfaceId,
      route: current.route,
      actionId: current.actionId,
      checkpoint: String(metadata.checkpoint || "governed-surface-ready"),
      timestamp: new Date().toISOString(),
      diagnosticCounters: {
        blocker: this.findings.filter((item) => item.severity === "blocker" && !item.allowlistMatch).length,
        advisory: this.findings.filter((item) => item.severity !== "blocker" || item.allowlistMatch).length,
        total: this.findings.length,
      },
      findingFingerprints: this.findings.map((item) => item.fingerprint),
    };
    this.checkpoints.push(checkpoint);
    return checkpoint;
  }

  async finalizeContext(context) {
    await Promise.allSettled(this.deepTasks);
    const state = this.contextStates.get(context);
    if (!state || state.traceFinalized || !state.traceStarted) return;
    state.traceFinalized = true;
    try {
      const hasBlocking = this.findings.some((item) => item.severity === "blocker" && !item.allowlistMatch);
      if (hasBlocking) {
        const folder = path.resolve(this.artifactRoot, this.runId);
        await mkdir(folder, { recursive: true });
        const tracePath = path.join(folder, `trace-${state.index}.zip`);
        await context.tracing.stop({ path: tracePath });
        const traceRef = path.posix.join(this.artifactRoot.replaceAll("\\", "/"), this.runId, `trace-${state.index}.zip`);
        for (const finding of this.findings) {
          if (finding.severity === "blocker" && !finding.allowlistMatch && !finding.traceRef) finding.traceRef = traceRef;
        }
      } else {
        await context.tracing.stop();
      }
    } catch {
      // Diagnostics must never hide the verifier's original failure.
    }
  }

  async finalize() {
    if (this.finalized) return this.summary();
    this.finalized = true;
    await Promise.allSettled(this.deepTasks);
    for (const context of this.contextStates.keys()) await this.finalizeContext(context);
    const folder = path.resolve(this.artifactRoot, this.runId);
    await mkdir(folder, { recursive: true });
    const summary = this.summary();
    await writeFile(path.join(folder, "browser-diagnostics.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    return summary;
  }

  summary() {
    const blockers = this.findings.filter((item) => item.severity === "blocker" && !item.allowlistMatch);
    return {
      schemaVersion: BROWSER_DIAGNOSTIC_SCHEMA_VERSION,
      runId: this.runId,
      adapter: this.adapter,
      policy: {
        failOnBlockers: this.failOnBlockers,
        rule: "zero new unexplained browser-health regressions",
      },
      checkpoints: this.checkpoints,
      findings: this.findings,
      totals: {
        blocker: blockers.length,
        advisory: this.findings.length - blockers.length,
        total: this.findings.length,
      },
    };
  }
}

function proxyContext(rawContext, observer) {
  return new Proxy(rawContext, {
    get(target, property, receiver) {
      if (property === "newPage") {
        return async (...args) => {
          const page = await target.newPage(...args);
          observer.attachPage(page);
          return page;
        };
      }
      if (property === "close") {
        return async (...args) => {
          await observer.finalizeContext(target);
          return target.close(...args);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function proxyBrowser(rawBrowser, observer) {
  return new Proxy(rawBrowser, {
    get(target, property, receiver) {
      if (property === "newContext") {
        return async (...args) => {
          const context = await target.newContext(...args);
          await observer.attachContext(context);
          return proxyContext(context, observer);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export async function createBrowserVerificationSession({
  toolRoot,
  adapterId = "playwright-test",
  runId = `browser-${Date.now()}-${randomUUID().slice(0, 8)}`,
  allowedOrigins = [],
  artifactRoot = DEFAULT_ARTIFACT_ROOT,
  allowlistPath = DEFAULT_ALLOWLIST_PATH,
  failOnBlockers = true,
  launchOptions = { headless: true },
} = {}) {
  const adapter = browserVerificationAdapterCapabilities(adapterId);
  if (!adapter.executableHere) {
    throw new Error(`Browser Verification adapter ${adapterId} is host-managed and cannot be launched by the deterministic Node broker.`);
  }
  if (!toolRoot) throw new Error("Pass --tool-root pointing to the pinned browser verification install.");

  const toolRequire = createRequire(path.join(path.resolve(toolRoot), "package.json"));
  const playwright = toolRequire("@playwright/test");
  const chromium = playwright.chromium;
  const rawBrowser = await chromium.launch(launchOptions);
  const allowlist = await loadAllowlist(allowlistPath);
  const observer = new BrowserDiagnosticsObserver({
    runId,
    adapter: {
      ...adapter,
      adapterVersion: String(playwright.version || ""),
      browserVersion: String(rawBrowser.version?.() || ""),
    },
    allowedOrigins,
    artifactRoot,
    allowlist,
    failOnBlockers,
  });
  const browser = proxyBrowser(rawBrowser, observer);

  let closed = false;
  return {
    runId,
    adapter,
    browser,
    observer,
    async checkpoint(page, metadata) {
      return observer.checkpoint(page, metadata);
    },
    async close() {
      if (closed) return observer.summary();
      closed = true;
      const summary = await observer.finalize();
      await rawBrowser.close();
      if (failOnBlockers && summary.totals.blocker > 0) {
        const error = new Error(`Browser diagnostics found ${summary.totals.blocker} blocking browser-health finding(s). Evidence: ${path.posix.join(artifactRoot.replaceAll("\\", "/"), runId, "browser-diagnostics.json")}`);
        error.browserDiagnostics = summary;
        throw error;
      }
      return summary;
    },
  };
}
