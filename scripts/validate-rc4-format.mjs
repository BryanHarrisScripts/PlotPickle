import { readFile, readdir } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";

const projectRoot = resolve(process.argv[2] ?? "tests/fixtures/rc4/minimal-project");
const errors = [];
const forbiddenKey = /(api[_-]?key|access[_-]?token|refresh[_-]?token|oauth|password|cookie|private[_-]?key)/i;
const absolutePath = /(?:[A-Za-z]:\\|^\/Users\/|^\/home\/|^\/var\/|^\/tmp\/)/;

const manifest = JSON.parse(await readFile(resolve(projectRoot, "manifest.json"), "utf8"));
const project = JSON.parse(await readFile(resolve(projectRoot, "project.json"), "utf8"));

for (const key of ["formatVersion", "projectId", "title", "author", "createdAt", "modifiedAt", "minimumPlotPickleVersion", "sdkApiVersion", "schemas"]) {
  if (!(key in manifest)) errors.push(`manifest.json missing ${key}`);
}
if (manifest.formatVersion !== "1.0.0") errors.push("manifest formatVersion must be 1.0.0");
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(manifest.projectId ?? "")) errors.push("projectId must be a UUID");
if (project.schemaVersion !== "1.0.0") errors.push("project.json schemaVersion must be 1.0.0");

function inspect(value, location) {
  if (Array.isArray(value)) return value.forEach((item, index) => inspect(item, `${location}[${index}]`));
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenKey.test(key)) errors.push(`${location}.${key} contains a forbidden credential field`);
      inspect(child, `${location}.${key}`);
    }
    return;
  }
  if (typeof value === "string" && absolutePath.test(value)) errors.push(`${location} contains a machine-specific absolute path`);
}

inspect(manifest, "manifest");
inspect(project, "project");

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = resolve(directory, entry.name);
    const portable = relative(projectRoot, full).split(sep).join("/");
    if (portable.includes("..")) errors.push(`invalid path ${portable}`);
    if (entry.isDirectory()) await walk(full);
  }
}
await walk(projectRoot);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`RC4 project format valid: ${projectRoot}`);
