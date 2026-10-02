import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { enqueueServiceRequest, claimServiceRequests, completeServiceRequest, readServiceResult } from "../core/sidecars/runtime/service-bus.mjs";
import { browserVerificationRuntimeDescriptor, executeBrowserRuntimeRequest } from "../scripts/sidecars/browser-verification-service.mjs";
import { dsddRuntimeDescriptor, routeDsddRuntimeRequest } from "../scripts/sidecars/dsdd-service.mjs";

test("#2695 headless DSDD is startup-ready with zero UI/provider authority", () => {
  const descriptor = dsddRuntimeDescriptor();
  assert.equal(descriptor.state, "ready");
  assert.match(descriptor.evidence.map((item) => item.summary).join("\n"), /no model\/provider request/i);
  assert.match(descriptor.evidence.map((item) => item.summary).join("\n"), /repository mutation authority is unchanged/i);
});

test("#2695 Browser Verification broker is ready while heavy browser work remains lazy", () => {
  const descriptor = browserVerificationRuntimeDescriptor();
  assert.equal(descriptor.state, "ready");
  const summary = descriptor.evidence.map((item) => item.summary).join("\n");
  assert.match(summary, /lazy/i);
  assert.match(summary, /launches no browser journey/i);
  assert.match(summary, /never the Human browser profile/i);
});

test("#2695 DSDD routes a bounded named journey into the Browser Verification inbox", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "plotpickle-2695-"));
  try {
    const result = await routeDsddRuntimeRequest(home, {
      requestId: "intent-2695",
      operation: "verify-contract",
      target: "mind-map-world-map-shared-header",
    });
    assert.equal(result.state, "ready");
    const claimed = await claimServiceRequests(home, "browser-verification");
    assert.equal(claimed.length, 1);
    assert.equal(claimed[0].request.operation, "rendered-acceptance");
    assert.equal(claimed[0].request.target, "mind-map-world-map-shared-header");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("#2695 Browser Verification refuses arbitrary work and does not execute without isolated tooling/profile", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "plotpickle-2695-"));
  let ran = false;
  try {
    const unavailable = await executeBrowserRuntimeRequest({
      home,
      server: "http://127.0.0.1:4173",
      rawRequest: { requestId: "browser-1", operation: "rendered-acceptance", target: "mind-map-world-map-shared-header" },
      runner: async () => { ran = true; return { status: "PASS", reportPath: "never" }; },
    });
    assert.equal(unavailable.state, "unavailable");
    assert.equal(ran, false);
    await assert.rejects(
      executeBrowserRuntimeRequest({
        home,
        server: "http://127.0.0.1:4173",
        rawRequest: { requestId: "browser-2", operation: "shell", target: "anything" },
      }),
      /not permitted/,
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("#2695 file bus claims each request once and records bounded result evidence", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "plotpickle-2695-"));
  try {
    await enqueueServiceRequest(home, "dsdd", { requestId: "health-1", operation: "health" });
    const first = await claimServiceRequests(home, "dsdd");
    const second = await claimServiceRequests(home, "dsdd");
    assert.equal(first.length, 1);
    assert.equal(second.length, 0);
    await completeServiceRequest(home, "dsdd", first[0], { requestId: "health-1", state: "ready", evidence: [] });
    assert.equal((await readServiceResult(home, "dsdd", "health-1")).state, "ready");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("#2695 normal runtime registry entrypoints now exist for DSDD and Browser Verification", async () => {
  const config = JSON.parse(await readFile(new URL("../config/runtime-sidecars.json", import.meta.url), "utf8"));
  assert.equal(config.services.find((item) => item.id === "dsdd").entrypoint, "scripts/sidecars/dsdd-service.mjs");
  assert.equal(config.services.find((item) => item.id === "browser-verification").entrypoint, "scripts/sidecars/browser-verification-service.mjs");
});
