import { mkdir, readFile, writeFile } from "node:fs/promises";
import { compareMeasuredOutcomes, validateMeasurementProtocol } from "../lib/verification/development/outcome-measurement.mjs";
const protocol = JSON.parse(await readFile("docs/verification/2940-measurement-protocol.json", "utf8"));
const dataset = JSON.parse(await readFile("docs/verification/2940-measurements.json", "utf8"));
const preparation = validateMeasurementProtocol(protocol);
const comparison = await compareMeasuredOutcomes(protocol, dataset);
const result = { preparation, comparison };
await mkdir(".artifacts/outcome-measurement", { recursive: true });
await writeFile(".artifacts/outcome-measurement/report.json", `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
// Engineering preparation can be valid while practical benefit is unproven.
if (preparation.status !== "PREPARED_PROTOCOL") process.exitCode = 1;
