import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { auditThirdPartyOss } from "../scripts/third-party-oss-audit.mjs";

const root = new URL("../", import.meta.url);
const text = (path) => readFile(new URL(path, root), "utf8");
const json = async (path) => JSON.parse(await text(path));

test("#1895 registers current runtime and conceptual OSS contributors truthfully", async () => {
  const registry = await json("config/third-party-oss.json");
  const byId = new Map(registry.systems.map((item) => [item.id, item]));

  for (const id of ["ffmpeg", "reelbench-skills", "berd", "lightricks-comfyui-ltx-workflow", "comfyui-ltx-workflow-template"]) {
    assert.ok(byId.has(id), `missing OSS contributor ${id}`);
  }

  assert.equal(byId.get("ffmpeg").usage, "connect-only");
  assert.match(byId.get("ffmpeg").plotpickleUse, /does not bundle|not bundle/i);

  for (const id of ["reelbench-skills", "berd", "lightricks-comfyui-ltx-workflow", "comfyui-ltx-workflow-template"]) {
    const item = byId.get(id);
    assert.equal(item.usage, "reference-only", `${id} must remain an influence/reference, not a runtime dependency`);
    assert.ok(Array.isArray(item.evidencePaths) && item.evidencePaths.length > 0, `${id} needs evidence paths`);
  }

  assert.equal(byId.get("reelbench-skills").license, "Apache-2.0");
  assert.equal(byId.get("berd").license, "Apache-2.0");
  assert.equal(byId.get("lightricks-comfyui-ltx-workflow").revision, "36fdaf500b3cd6f7fa8b2dfec36e984746e630a2");
});

test("#1895 every reference-only contributor has a current evidence marker and the audit sees all declarations", async () => {
  const registry = await json("config/third-party-oss.json");
  const referenceOnly = registry.systems.filter((item) => item.usage === "reference-only");
  const prefix = registry.influencePolicy.markerPrefix;

  for (const item of referenceOnly) {
    let found = false;
    for (const evidencePath of item.evidencePaths) {
      const evidence = await text(evidencePath);
      if (evidence.includes(`${prefix}${item.id}`)) found = true;
    }
    assert.equal(found, true, `${item.id} needs its explicit OSS influence marker in declared evidence`);
  }

  const result = auditThirdPartyOss();
  assert.deepEqual(result.failures, [], result.failures.join("\n"));
  assert.equal(result.summary.registeredReferenceOnlySystems, referenceOnly.length);
  assert.equal(result.summary.declaredReferenceInfluences, referenceOnly.length);
});

test("#1895 audit contains two-way drift guards for undeclared and stale conceptual influences", async () => {
  const audit = await text("scripts/third-party-oss-audit.mjs");
  assert.match(audit, /has no registry entry/);
  assert.match(audit, /must resolve to a reference-only registry entry/);
  assert.match(audit, /appears in undeclared evidence path/);
  assert.match(audit, /has no current PLOTPICKLE:OSS-INFLUENCE marker/);
});

test("#1895 README separates software we use from OSS ideas we adapted", async () => {
  const [readme, registry] = await Promise.all([text("README.md"), json("config/third-party-oss.json")]);
  const start = readme.indexOf(registry.readme.startMarker);
  const end = readme.indexOf(registry.readme.endMarker);
  const section = readme.slice(start, end);

  assert.match(section, /### Open-source ideas and workflows we adapted/);
  for (const name of ["FFmpeg / ffprobe", "ReelBench Skills", "BERD", "Lightricks ComfyUI-LTXVideo pinned workflow", "ComfyUI LTX-Video workflow template"]) {
    assert.ok(section.includes(name), `README should acknowledge ${name}`);
  }
  assert.match(section, /Evaluation-only or future candidates are deliberately \*\*not\*\* presented as contributors/);
});

test("#1895 evaluated-only candidates stay out of the current contributor registry", async () => {
  const [registry, harness] = await Promise.all([
    json("config/third-party-oss.json"),
    text("docs/architecture/MANAGED-DESKTOP-HARNESS.md"),
  ]);
  const names = registry.systems.map((item) => item.name.toLowerCase());
  assert.doesNotMatch(JSON.stringify(registry), /agent client protocol/i);
  assert.equal(names.includes("tauri"), false);
  assert.match(harness, /ACP remains an evaluation candidate/);
  assert.match(harness, /Tauri 2 remains a candidate desktop shell/);
});
