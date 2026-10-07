import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

test("#2821 offline artifact validation admits Worker intrinsics without executing initializers and rejects invalid artifacts", async () => {
  const root = await mkdtemp(path.resolve("node_modules/.2821-artifact-"));
  try {
    const source = await readFile("scripts/build-verified.mjs", "utf8");
    const run = source.slice(source.indexOf("function run("), source.indexOf("async function prepareEnvironment"));
    const validator = source.slice(source.indexOf("async function validateArtifact("), source.indexOf("async function main("));
    const fixture = path.join(root, "validator.mjs");
    const spawnHelper = pathToFileURL(path.resolve("scripts/spawn-command.mjs")).href;
    await writeFile(fixture, `import {access,readFile} from "node:fs/promises";import {join} from "node:path";import process from "node:process";import {spawnCommand} from ${JSON.stringify(spawnHelper)};const ROOT=${JSON.stringify(root)};${run}\nexport ${validator}`);
    const { validateArtifact } = await import(pathToFileURL(fixture).href);
    await mkdir(path.join(root, "dist/server"), { recursive: true });
    await mkdir(path.join(root, "dist/.openai"), { recursive: true });
    await writeFile(path.join(root, "dist/.openai/hosting.json"), "{}");
    const worker = path.join(root, "dist/server/index.js");
    await writeFile(worker, 'import {env} from "cloudflare:workers";throw new Error("Do not execute Worker initializers in Node");export default {fetch(){return new Response("fixture");}};');
    await validateArtifact(process.env);
    await writeFile(worker, 'export default {};');
    await assert.rejects(validateArtifact(process.env), /valid default Worker export with fetch/u);
    await writeFile(worker, 'export const worker = {fetch(){return new Response("fixture");}};');
    await assert.rejects(validateArtifact(process.env), /valid default Worker export with fetch/u);
    await writeFile(worker, 'export default {fetch(){');
    await assert.rejects(validateArtifact(process.env), /failed with/u);
    if (process.platform !== "win32") {
      await writeFile(worker, 'import missing from "./missing.js";export default {fetch(){return missing();}};');
      await assert.rejects(validateArtifact(process.env), /Could not resolve/u);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
