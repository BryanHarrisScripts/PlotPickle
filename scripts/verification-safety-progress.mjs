import { mkdir, readFile, writeFile } from "node:fs/promises";
import { validateSafetyAssurance } from "../lib/verification/development/safety-progress.mjs";

const record = JSON.parse(await readFile("docs/verification/2938-safety-progress.json", "utf8"));
const catalogue = JSON.parse(await readFile("config/verification/test-catalog.json", "utf8"));
const result = await validateSafetyAssurance(record, {
  readSource: (file) => readFile(file, "utf8"),
  catalogueTargets: new Set(catalogue.entries.flatMap((entry) => entry.runner.targets)),
});
await mkdir(".artifacts/safety-progress", { recursive: true });
await writeFile(".artifacts/safety-progress/assurance.json", `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (result.status !== "VALID_ASSURANCE_RECORD") process.exitCode = 1;
