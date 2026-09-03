import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

async function missing(path) {
  try {
    await access(new URL(`../${path}`, import.meta.url));
    return false;
  } catch {
    return true;
  }
}

const retired = [
  "lib/responsibility-runs.ts",
  "lib/responsibility-graph.ts",
  "lib/responsibility-run-interrupts.ts",
  "lib/connector-trust-policy.ts",
];

const canonical = [
  "lib/agents/responsibility/responsibility-runs.ts",
  "lib/agents/responsibility/responsibility-graph.ts",
  "lib/agents/responsibility/responsibility-run-interrupts.ts",
  "lib/agents/responsibility/connector-trust-policy.ts",
];

test("#1651 retires only proven Responsibility compatibility bridges while preserving canonical owners", async () => {
  for (const path of retired) assert.equal(await missing(path), true, `${path} should be retired`);
  for (const path of canonical) assert.equal(await missing(path), false, `${path} must remain canonical`);
});

test("#1651 runtime consumers import Responsibility contracts directly from the canonical owner", async () => {
  const [activity, telemetryGateway, runGateway] = await Promise.all([
    read("app/responsibility-run-activity.tsx"),
    read("build/run-telemetry-gateway.ts"),
    read("build/responsibility-run-gateway.ts"),
  ]);

  assert.match(activity, /lib\/agents\/responsibility\/responsibility-runs/);
  assert.match(telemetryGateway, /lib\/agents\/responsibility\/responsibility-runs/);
  assert.match(runGateway, /lib\/agents\/responsibility\/responsibility-runs/);
  assert.match(runGateway, /lib\/agents\/responsibility\/connector-trust-policy/);

  for (const source of [activity, telemetryGateway, runGateway]) {
    assert.doesNotMatch(source, /\.\.\/lib\/responsibility-runs/);
    assert.doesNotMatch(source, /\.\.\/lib\/connector-trust-policy/);
  }
});

test("#1651 workflow ownership follows canonical Responsibility paths instead of deleted shims", async () => {
  const [buzz, trust] = await Promise.all([
    read(".github/workflows/buzz-mastra-orchestration.yml"),
    read(".github/workflows/agent-skill-trust.yml"),
  ]);

  for (const path of [
    "lib/agents/responsibility/responsibility-runs.ts",
    "lib/agents/responsibility/responsibility-run-interrupts.ts",
    "lib/agents/responsibility/responsibility-graph.ts",
  ]) assert.match(buzz, new RegExp(path.replaceAll("/", "\\/")));
  assert.match(trust, /lib\/agents\/responsibility\/connector-trust-policy\.ts/);

  assert.doesNotMatch(buzz, /"lib\/responsibility-(?:runs|run-interrupts|graph)\.ts"/);
  assert.doesNotMatch(trust, /"lib\/connector-trust-policy\.ts"/);
});
