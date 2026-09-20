import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createBrowserVerificationSession } from "../browser-verification-broker.mjs";
import { openWebMcpGovernedSurface } from "./webmcp-governed-surface.mjs";

const PROBE_PREFIX = "/__plotpickle_webmcp_qa_probe__/";

export async function runWebMcpResilienceProfile({
  serverUrl,
  toolRoot,
  storageStatePath,
  runId,
  artifactRoot,
} = {}) {
  const origin = new URL(serverUrl).origin;
  const session = await createBrowserVerificationSession({
    toolRoot,
    runId: `${runId}-resilience`,
    allowedOrigins: [origin],
    failOnBlockers: false,
  });
  const context = await session.browser.newContext({
    viewport: { width: 1440, height: 1000 },
    ...(storageStatePath ? { storageState: storageStatePath } : {}),
  });
  const page = await context.newPage();

  try {
    await openWebMcpGovernedSurface(page, serverUrl, "dashboard");
    await page.route(`**${PROBE_PREFIX}**`, async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const scenario = pathname.slice(PROBE_PREFIX.length);
      if (scenario === "delay") {
        await new Promise((resolve) => setTimeout(resolve, 120));
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ delayed: true }) });
        return;
      }
      if (scenario === "server-error") {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ verificationFault: true }) });
        return;
      }
      if (scenario === "empty") {
        await route.fulfill({ status: 200, contentType: "application/json", body: "" });
        return;
      }
      if (scenario === "malformed") {
        await route.fulfill({ status: 200, contentType: "application/json", body: "{" });
        return;
      }
      if (scenario === "cancelled") {
        await route.abort("aborted");
        return;
      }
      await route.fulfill({ status: 404, body: "" });
    });

    const scenarios = await page.evaluate(async (prefix) => {
      const run = async (name) => {
        const started = performance.now();
        try {
          const response = await fetch(`${prefix}${name}`, { cache: "no-store" });
          const body = await response.text();
          return {
            name,
            status: response.status,
            ok: response.ok,
            bodyLength: body.length,
            durationMs: Math.round(performance.now() - started),
          };
        } catch (error) {
          return {
            name,
            status: 0,
            ok: false,
            error: error instanceof Error ? error.name : "fetch-error",
            durationMs: Math.round(performance.now() - started),
          };
        }
      };
      const results = [];
      for (const name of ["delay", "server-error", "empty", "malformed", "cancelled"]) results.push(await run(name));
      return results;
    }, PROBE_PREFIX);

    const byName = new Map(scenarios.map((scenario) => [scenario.name, scenario]));
    const expectations = [
      ["delay", (value) => value?.status === 200 && value.durationMs >= 80, "delayed 200 response"],
      ["server-error", (value) => value?.status === 503, "controlled HTTP 503"],
      ["empty", (value) => value?.status === 200 && value.bodyLength === 0, "empty successful response"],
      ["malformed", (value) => value?.status === 200 && value.bodyLength === 1, "malformed response body"],
      ["cancelled", (value) => value?.status === 0 && Boolean(value.error), "cancelled request failure"],
    ];
    const findings = expectations.flatMap(([name, predicate, expected]) => {
      const observed = byName.get(name);
      return predicate(observed) ? [] : [{
        profile: "resilience",
        surfaceId: "dashboard",
        severity: "blocker",
        probeId: `fault-${name}`,
        trigger: "synthetic-internal-network-interception",
        expected,
        observed,
      }];
    });

    const diagnostics = session.observer.summary();
    const unexpectedDiagnostics = diagnostics.findings.filter((finding) =>
      finding.severity === "blocker"
      && !String(finding.summary || "").includes("__plotpickle_webmcp_qa_probe__"),
    );
    for (const finding of unexpectedDiagnostics) {
      findings.push({
        profile: "resilience",
        surfaceId: finding.surfaceId,
        severity: "blocker",
        probeId: "unexpected-browser-diagnostic",
        trigger: "browser-observer",
        expected: "Only declared verification fault injection produces browser-health findings",
        observed: { category: finding.category, summary: finding.summary },
      });
    }

    const report = {
      schemaVersion: 1,
      profile: "resilience",
      runId,
      status: findings.some((finding) => finding.severity === "blocker") ? "FAIL" : "PASS",
      verificationOnly: true,
      externalProviderCalls: false,
      mutationOfExternalSystems: false,
      scenarios,
      findings,
      expectedInjectedDiagnostics: diagnostics.findings.filter((finding) =>
        String(finding.summary || "").includes("__plotpickle_webmcp_qa_probe__")),
      totals: {
        scenarios: scenarios.length,
        blockers: findings.filter((finding) => finding.severity === "blocker").length,
        advisories: findings.filter((finding) => finding.severity === "advisory").length,
      },
    };
    const target = path.join(artifactRoot, "profile-3-resilience", "report.json");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    return { ...report, report: target };
  } finally {
    await context.close();
    await session.close();
  }
}
