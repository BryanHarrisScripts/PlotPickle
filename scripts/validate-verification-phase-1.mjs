import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  translatePhase0Entry,
  validateCatalogDocument,
  validateCatalogEntry,
  validateOwnershipMap,
  validateVocabulary,
} from "../lib/verification/verification-contracts.mjs";

const root = process.cwd();
const readJson = async (relative) => JSON.parse(await readFile(path.join(root, relative), "utf8"));

const [architecture, phase0Inventory, vocabulary, catalog, ownership, catalogSchema, ownershipSchema, evidenceSchema] = await Promise.all([
  readJson("architecture/plotpickle.architecture.json"),
  readJson("config/verification/phase-0-inventory.json"),
  readJson("config/verification/phase-1-vocabulary.json"),
  readJson("config/verification/test-catalog.json"),
  readJson("config/verification/ownership-map.json"),
  readJson("schema/verification/test-catalog.schema.json"),
  readJson("schema/verification/ownership.schema.json"),
  readJson("schema/verification/evidence.schema.json"),
]);

const errors = [
  ...validateVocabulary({ architecture, phase0Inventory, vocabulary }),
  ...validateCatalogDocument({ catalog, architecture, vocabulary }),
  ...validateOwnershipMap({ ownership, architecture, vocabulary }),
];

for (const [name, schema] of [
  ["test catalog", catalogSchema],
  ["ownership", ownershipSchema],
  ["evidence", evidenceSchema],
]) {
  if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") {
    errors.push(`${name} schema must use JSON Schema draft 2020-12`);
  }
  if (schema.type !== "object" || schema.additionalProperties !== false) {
    errors.push(`${name} schema must be a closed object contract`);
  }
}

const translatedEntries = phase0Inventory.entries.map((entry) => translatePhase0Entry(entry, vocabulary));
for (const translated of translatedEntries) {
  for (const error of validateCatalogEntry(translated, { architecture, vocabulary })) {
    errors.push(`Phase 0 translation ${translated.id}: ${error}`);
  }
}

if (errors.length > 0) {
  console.error("Phase 1 verification contract validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Phase 1 verification contracts valid: 7 layers, ${translatedEntries.length} Phase 0 entries translatable, fail-closed production ownership.`);
}
