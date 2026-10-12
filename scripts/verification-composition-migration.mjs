import { mkdir, readFile, writeFile } from "node:fs/promises";
import { validateCompositionAssurance } from "../lib/verification/development/composition-migration.mjs";
const record = JSON.parse(await readFile("docs/verification/2939-composition-migration.json", "utf8"));
const catalogue = JSON.parse(await readFile("config/verification/test-catalog.json", "utf8"));
const result = await validateCompositionAssurance(record, { readSource: file => readFile(file, "utf8"), catalogueTargets: new Set(catalogue.entries.flatMap(entry => entry.runner.targets)) });
await mkdir(".artifacts/composition-migration", { recursive: true });
await writeFile(".artifacts/composition-migration/assurance.json", `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (result.status !== "VALID_ASSURANCE_RECORD") process.exitCode = 1;
