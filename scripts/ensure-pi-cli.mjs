#!/usr/bin/env node

import process from "node:process";
import { ensureManagedPiInstalled } from "./pi-managed-install.mjs";

async function main() {
  const pi = await ensureManagedPiInstalled();
  process.stdout.write(`${JSON.stringify({
    ready: true,
    command: pi.command,
    version: pi.version,
    installed: pi.installed,
    state: pi.state,
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
