import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1569 reference task bridge stays inside the local Guest authority and registered routes", async () => {
  const [service, gateway, vite] = await Promise.all([
    read("build/autonomous-guest/reference/reference-route-tasks.ts"),
    read("build/autonomous-guest/reference/reference-task-gateway.ts"),
    read("vite.config.ts"),
  ]);

  for (const contract of [
    "delegated-guest-autonomous-operator",
    "humanProfileId !== \"\"",
    "autonomousGuestRegisteredRouteIds",
    "enqueueAutonomousGuestRouteTask",
    "resolveAutonomousGuestStoredRouteTaskPolicy",
    "acquireAutonomousGuestTaskLease",
    "completeAutonomousGuestTask",
    "reference-route-audit:no-provider",
    "disposition:operated",
  ]) assert.ok(service.includes(contract), `Reference task service is missing ${contract}`);

  for (const contract of [
    "getAutonomousGuestAuthority",
    '"desktop-loopback"',
    "LOOPBACK",
    "autonomousGuestReferenceTaskGateway",
    'action === "initialize"',
    'action === "claim"',
    'action === "finish"',
  ]) assert.ok(gateway.includes(contract), `Reference task gateway is missing ${contract}`);

  assert.ok(vite.includes('import { autonomousGuestReferenceTaskGateway } from "./build/autonomous-guest/reference/reference-task-gateway"'));
  assert.ok(vite.includes("autonomousGuestReferenceTaskGateway()"));
  assert.doesNotMatch(service + gateway, /saveActiveLibraryProject|applyStoryCommand|writeCanon|canon-write|authenticated-human|BUZZ_AUTH_TAG|private[_-]?key/i);
});

test("#1569 one-command Afterglow reference consumes one durable real-route task across application restart", async () => {
  const source = await read("scripts/creative-uat/autonomous/run-autonomous-story-reference.mjs");

  const initialize = source.indexOf('action: "initialize"');
  const restart = source.indexOf("lifecycleRestart = await lifecycle.restart()");
  const claim = source.indexOf('action: "claim", routeId: "library"');
  const secondPass = source.indexOf('runRoutePass("after application restart")');
  const finish = source.indexOf('action: "finish"');

  assert.ok(initialize >= 0 && restart > initialize, "The durable task must be initialized before the real application restart.");
  assert.ok(claim > restart, "The durable task must be claimed only after the new PlotPickle process starts.");
  assert.ok(secondPass > claim, "The existing route operator must run only after the recovered task is leased.");
  assert.ok(finish > secondPass, "Task completion must follow the existing route operation receipt.");

  for (const contract of [
    'routeIds: ["library"]',
    'routeResult(after?.report, "library")',
    "library?.disposition",
    "completedFromOperatedRoute",
    'finalState !== "completed"',
    "#1553 one-command reference",
    "taskLedgerProof",
  ]) assert.ok(source.includes(contract), `Reference controller is missing ${contract}`);

  assert.doesNotMatch(source, /saveActiveLibraryProject|applyStoryCommand|writeCanon|canon-write|buzz-story-bridge|local-buzz|writing-assistant\/chat/i);
});
