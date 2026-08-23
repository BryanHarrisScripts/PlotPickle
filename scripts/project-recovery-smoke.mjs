import assert from "node:assert/strict";
import { copyFile, mkdir, open, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

function hash(project) {
  const source = stable(project);
  let value = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    value ^= source.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return `fnv1a-${(value >>> 0).toString(16).padStart(8, "0")}`;
}

function ppf(project) {
  return { format: "plotpickle-project-file", formatVersion: 1, createdAt: new Date().toISOString(), applicationVersion: "test", project, assets: [], integrity: { algorithm: "fnv1a-32", projectHash: hash(project) } };
}

function verify(file) {
  return file?.format === "plotpickle-project-file" && file?.formatVersion === 1 && file?.integrity?.projectHash === hash(file.project);
}

async function atomicWrite(file, content) {
  const temporary = `${file}.${process.pid}.tmp`;
  const handle = await open(temporary, "w");
  try { await handle.writeFile(content); await handle.sync(); } finally { await handle.close(); }
  await rename(temporary, file);
}

const folder = path.join(os.tmpdir(), `plotpickle-recovery-smoke-${process.pid}`);
await rm(folder, { recursive: true, force: true });
await mkdir(path.join(folder, "projects"), { recursive: true });
await mkdir(path.join(folder, "backups"), { recursive: true });
const projectFile = path.join(folder, "projects", "long-running-story.ppf");
let project = { schemaVersion: "1.7.0", id: "project-test", metadata: { title: "Long Running Story", updatedAt: "" }, revision: 0 };

try {
  for (let revision = 1; revision <= 25; revision += 1) {
    try { await copyFile(projectFile, path.join(folder, "backups", `long-running-story-${String(revision).padStart(3, "0")}.ppf`)); } catch { /* first save has no previous file */ }
    project = { ...project, revision, metadata: { ...project.metadata, updatedAt: new Date().toISOString() } };
    await atomicWrite(projectFile, `${JSON.stringify(ppf(project), null, 2)}\n`);
    const backups = (await readdir(path.join(folder, "backups"))).sort().reverse();
    await Promise.all(backups.slice(20).map((name) => rm(path.join(folder, "backups", name), { force: true })));
  }

  assert.equal((await readdir(path.join(folder, "backups"))).length, 20, "Rolling backup limit must remain 20.");
  const healthy = JSON.parse(await readFile(projectFile, "utf8"));
  assert.equal(verify(healthy), true, "Current project should pass integrity validation.");
  healthy.project.metadata.title = "Corrupted title without checksum update";
  await writeFile(projectFile, JSON.stringify(healthy));
  const corrupted = JSON.parse(await readFile(projectFile, "utf8"));
  assert.equal(verify(corrupted), false, "Corruption must be detected before loading.");
  const newestBackup = (await readdir(path.join(folder, "backups"))).sort().at(-1);
  assert.ok(newestBackup, "A recovery backup should exist.");
  const recovered = JSON.parse(await readFile(path.join(folder, "backups", newestBackup), "utf8"));
  assert.equal(verify(recovered), true, "The newest backup should pass integrity validation.");
  assert.ok(recovered.project.revision >= 20, "Recovery should restore a recent revision.");
  console.log("PlotPickle rolling backup, corruption detection, and recovery smoke test passed.");
} finally {
  await rm(folder, { recursive: true, force: true });
}
