import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { skinV1RouteMigrationLedger } from "../lib/verification/skin-v1-route-migration-ledger.mjs";

const target = resolve(process.cwd(), ".artifacts/visual-readiness/skin-v1-route-migration-ledger.json");
mkdirSync(dirname(target), { recursive: true });
const ledger = skinV1RouteMigrationLedger();
writeFileSync(target, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

console.log(`Skin V1 route migration ledger: ${target}`);
console.log(`Canonical direct: ${ledger.counts.canonicalOrchestratedDirect}; routed debt: ${ledger.counts.routedCompatibilityDebt}; state debt: ${ledger.counts.stateCompatibilityDebt}; public exceptions: ${ledger.counts.publicExceptions}.`);
