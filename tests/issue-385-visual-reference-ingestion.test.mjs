import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #385 adds normalized visual references with rights and provenance", async () => {
  const project = await source("lib/project.ts");
  for (const field of [
    "VisualReference",
    "visualReferences",
    "sourceUrl",
    "importFileName",
    "purpose",
    "rightsStatus",
    "ownershipNotes",
    "permittedUse",
    "attribution",
    "targetKind",
    "targetLabel",
    "normalizeVisualReference",
  ]) assert.ok(project.includes(field), `Missing visual reference model field: ${field}`);

  assert.match(project, /visualReferencePurposes/);
  assert.match(project, /visualReferenceRightsStatuses/);
  assert.match(project, /visualReferences: \[\]/);
  assert.match(project, /visualReferences: Array\.isArray\(development\.visualReferences\)/);
});

test("issue #385 preserves privacy boundaries for imported references", async () => {
  const project = await source("lib/project.ts");
  assert.match(project, /function safeReferenceUrl/);
  assert.match(project, /function safeImportFileName/);
  assert.match(project, /\^\(\?:file\|\[a-z\]\):/i);
  assert.match(project, /url\.username \|\| url\.password/);
  assert.match(project, /source\.includes\("\/\"\) \|\| source\.includes\("\\\\\"\)/);
});

test("issue #385 exposes a no-AI Visual References planner section", async () => {
  const page = await source("app/page.tsx");
  for (const phrase of [
    'id: "references"',
    'code: "VR"',
    'label: "Visual References"',
    "Collect references with rights attached.",
    "Add reference",
    "Reference purpose",
    "Rights status",
    "Permitted use",
    "Attribution",
    "Store the filename only",
  ]) assert.ok(page.includes(phrase), `Missing visual reference UI phrase: ${phrase}`);

  assert.match(page, /inspiration/);
  assert.match(page, /identity/);
  assert.match(page, /continuity/);
  assert.match(page, /composition/);
  assert.doesNotMatch(page, /visualReferences[\s\S]{0,1800}api\/local-ai|visualReferences[\s\S]{0,1800}providerId|visualReferences[\s\S]{0,1800}modelId/);
});

test("issue #385 is registered as a focused programme slice", async () => {
  const [registry, progress, packageJson] = await Promise.all([
    source("config/ai-native-visual-writing-programme.json"),
    source("lib/project-progress.ts"),
    source("package.json"),
  ]);
  assert.match(registry, /"issue": 385/);
  assert.match(registry, /"id": "visual-reference-ingestion"/);
  assert.match(progress, /references/);
  assert.match(packageJson, /issue-385-visual-reference-ingestion\.test\.mjs/);
});
