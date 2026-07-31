#!/usr/bin/env node

import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { loadDiagnosticsRegistry } from "./index.mjs";

async function main() {
  const root = process.cwd();
  const registry = await loadDiagnosticsRegistry(root);
  const missingRequiredOwners = [];

  for (const [contractId, contract] of Object.entries(registry.contracts)) {
    let available = false;
    for (const owner of contract.owners) {
      try {
        await access(path.resolve(root, owner.path));
        available = true;
      } catch {
        if (!owner.optional) missingRequiredOwners.push(`${contractId}: ${owner.path}`);
      }
    }
    if (!available && contract.owners.every((owner) => owner.optional)) {
      missingRequiredOwners.push(`${contractId}: no optional owner currently exists`);
    }
  }

  if (missingRequiredOwners.length) {
    throw new Error(`Diagnostics contract owners are missing:\n- ${missingRequiredOwners.join("\n- ")}`);
  }

  console.log(`Developer diagnostics registry v${registry.version} is valid: ${registry.areas.length} areas, ${Object.keys(registry.contracts).length} contracts.`);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
