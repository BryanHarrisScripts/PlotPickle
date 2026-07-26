import { readFileSync, writeFileSync } from "node:fs";

const path = "lib/review-workflows.ts";
let source = readFileSync(path, "utf8");

const importNeedle = 'import { createHash } from "node:crypto";\n';
if (!source.includes(importNeedle)) throw new Error("Expected Node crypto import was not found.");
source = source.replace(importNeedle, "");

const hashNeedle = `function promptHash(value: string) {\n  return \`sha256-\${createHash("sha256").update(value).digest("hex").slice(0, 20)}\`;\n}`;
const hashReplacement = `function promptHash(value: string) {\n  let hash = 2166136261;\n  for (let index = 0; index < value.length; index += 1) {\n    hash ^= value.charCodeAt(index);\n    hash = Math.imul(hash, 16777619);\n  }\n  return \`fnv1a-\${(hash >>> 0).toString(16).padStart(8, "0")}\`;\n}`;
if (!source.includes(hashNeedle)) throw new Error("Expected Node prompt hash implementation was not found.");
source = source.replace(hashNeedle, hashReplacement);

if (source.includes('from "node:crypto"') || source.includes("createHash(")) throw new Error("Node crypto remains in the browser-facing workflow model.");
writeFileSync(path, source, "utf8");
console.log("Replaced the Node-only prompt hash with the browser-safe deterministic hash.");
