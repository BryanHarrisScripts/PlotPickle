import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { analyzeBaselines } from "../scripts/performance/analyze-real-machine-baselines.mjs";
import { idleWindowMs } from "../scripts/performance/measure-browser-responsiveness.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("#1411 idle probe measures bounded browser-visible activity without overclaiming hidden processes", async () => {
  assert.equal(idleWindowMs, 5_000);
  const source = await read("scripts/performance/measure-browser-responsiveness.mjs");
  assert.match(source, /Network\.requestWillBeSent/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /Performance\.getMetrics/);
  assert.match(source, /TaskDuration/);
  assert.match(source, /sameOriginRequestCount/);
  assert.match(source, /apiRequestCount/);
  assert.match(source, /externalRequestCount/);
  assert.match(source, /not-observable-from-browser-cdp/);
  assert.match(source, /zero mutations do not prove zero React renders/);
});

test("#1411 baseline analyzer aggregates idle request, DOM and renderer evidence by startup mode", () => {
  const sample = (sameOriginRequestCount, apiRequestCount, domMutationCount, rendererTaskDurationMs) => ({
    benchmarkIssue: 1411,
    authoritative: true,
    mode: "warm-persistent-runtime",
    environment: {
      platform: "win32",
      arch: "x64",
      node: "v24.19.0",
      commit: "idle-head",
      plotpickleVersion: "1.0.0",
      afterglowFixture: "afterglow-v9",
      curriculumIdentity: "afterglow-v9-current-catalog",
      ppfStartingRevision: "9",
      buzzMode: "disabled",
      optionalIntegrations: [],
    },
    measurements: {
      navigation: [],
      memory: {},
      browser: {
        idle: {
          reliability: "headless-browser-cdp-idle-window",
          windowMs: 5_000,
          sameOriginRequestCount,
          apiRequestCount,
          externalRequestCount: 0,
          domMutationCount,
          rendererTaskDurationMs,
        },
      },
    },
    result: { harnessHealthy: true, startupHealthy: true },
  });

  const report = analyzeBaselines([
    sample(0, 0, 2, 10),
    sample(1, 1, 4, 20),
    sample(2, 1, 6, 30),
  ]);
  const idle = report.modes["warm-persistent-runtime"].browser.idle;
  assert.equal(report.readyForBudgetRatification, true);
  assert.equal(idle.samples, 3);
  assert.equal(idle.windowMs.mean, 5_000);
  assert.equal(idle.sameOriginRequestCount.mean, 1);
  assert.equal(idle.apiRequestCount.mean, 0.67);
  assert.equal(idle.externalRequestCount.mean, 0);
  assert.equal(idle.domMutationCount.mean, 4);
  assert.equal(idle.rendererTaskDurationMs.mean, 20);
  assert.equal(idle.modelOrAgentWakeups.reliability, "not-observable-from-browser-cdp");
});
