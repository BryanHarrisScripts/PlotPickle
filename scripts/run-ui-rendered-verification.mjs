#!/usr/bin/env node

import os from "node:os";
import path from "node:path";
import process from "node:process";
import { cleanupVerificationSyntheticHome, establishVerificationSyntheticHuman } from "./full-verification-auth.mjs";
import { runUiAxeAudit, validateLocalServer, waitForUiServer } from "../lib/verification/ui-axe-audit.mjs";
import { runUiExperienceAudit } from "../lib/verification/ui-experience-audit.mjs";

function argument(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const serverUrl = argument("--server", "http://127.0.0.1:4173");
const fixtureServerUrl = argument("--fixture-server", "http://127.0.0.1:4174");
const toolRoot = argument("--tool-root");
const routesPath = argument("--routes", "config/ui-axe-routes.json");
const syntheticHome = path.join(process.env.RUNNER_TEMP || os.tmpdir(), `plotpickle-ui-rendered-auth-${process.pid}`);

if (!toolRoot) throw new Error("Rendered UI verification requires --tool-root for the pinned Playwright/axe install.");

const server = validateLocalServer(serverUrl);
await waitForUiServer(server);

let auth = null;
try {
  auth = await establishVerificationSyntheticHuman({ baseUrl: server.origin, home: syntheticHome });
  await runUiAxeAudit({
    serverUrl: server.origin,
    toolRoot,
    routesPath,
    storageStatePath: auth.storageStatePath,
  });
  await runUiExperienceAudit({
    serverUrl: server.origin,
    fixtureServerUrl,
    toolRoot,
    storageStatePath: auth.storageStatePath,
  });
} finally {
  if (auth?.home) await cleanupVerificationSyntheticHome(auth.home).catch(() => undefined);
}
