import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import module, { stripTypeScriptTypes } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const nativeStrip = module.stripTypeScriptTypes;
const { transpileTypeScriptFixture } = await import("../scripts/verification/typescript-fixture-transform.mjs");
const load = (source) => import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("#3061 uses exact TypeScript 6.0.3 on the native Node 26.12 fixture runtime", () => {
  assert.equal(process.versions.node, "26.12.0");
  assert.equal(ts.version, "6.0.3");
});

test("#3061 explicit compilation executes enum and constructor parameter-property semantics", async () => {
  const compiled = transpileTypeScriptFixture(`export enum Workflow { Draft, Approved }
export class Receipt { constructor(public readonly status: Workflow) {} }
export function createReceipt() { return new Receipt(Workflow.Approved); }`);
  const fixture = await load(compiled);
  assert.equal(fixture.createReceipt().status, fixture.Workflow.Approved);
  assert.equal(fixture.Workflow.Approved, 1);
});

test("#3053 native TypeScript 7 checks valid and invalid input beside the exact TypeScript 6 fixture API", async () => {
  const compiler = fileURLToPath(new URL("../node_modules/@typescript/native/bin/tsc", import.meta.url));
  const run = (args) => spawnSync(process.execPath, [compiler, ...args], {
    encoding: "utf8", timeout: 30_000, windowsHide: true,
  });
  const version = run(["--version"]);
  assert.equal(version.status, 0, version.stderr || version.stdout);
  assert.equal(version.stdout.trim(), "Version 7.0.2");
  assert.equal(ts.version, "6.0.3");
  assert.equal(typeof ts.transpileModule, "function");

  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-typescript7-"));
  try {
    const project = path.join(root, "tsconfig.json");
    const source = path.join(root, "compiler-fixture.ts");
    await writeFile(project, JSON.stringify({
      compilerOptions: { strict: true, noEmit: true, types: [], target: "ES2022", module: "ESNext" },
      files: ["compiler-fixture.ts"],
    }));
    await writeFile(source, "export const total: number = 41;\n");
    const valid = run(["--project", project, "--pretty", "false"]);
    assert.equal(valid.status, 0, valid.stderr || valid.stdout);

    await writeFile(source, 'export const total: number = "invalid";\n');
    const invalid = run(["--project", project, "--pretty", "false"]);
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stdout + invalid.stderr, /compiler-fixture\.ts.*TS2322/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("#3061 caller-owned import isolation remains explicit and executable", async () => {
  const compiled = transpileTypeScriptFixture('import { value } from "./fixture-dependency"; export const result: number = value + 1;');
  assert.match(compiled, /from "\.\/fixture-dependency"/);
  const isolated = compiled.replace('import { value } from "./fixture-dependency";', "const value = 40;");
  assert.notEqual(isolated, compiled);
  assert.equal((await load(isolated)).result, 41);
});

test("#3061 malformed fixture syntax fails with its source filename and diagnostic", () => {
  assert.throws(() => transpileTypeScriptFixture("export enum { =", { fileName: "broken-fixture.ts" }),
    (error) => /TypeScript fixture compilation failed/.test(error.message)
      && /broken-fixture\.ts/.test(error.message) && /TS\d+/.test(error.message));
  assert.throws(() => transpileTypeScriptFixture(null), /TypeScript fixture source must be a string/);
});

test("#3061 importing the helper leaves native stripping and removed transform-mode errors intact", () => {
  assert.equal(module.stripTypeScriptTypes, nativeStrip);
  assert.equal(stripTypeScriptTypes, nativeStrip);
  assert.match(stripTypeScriptTypes("export const text: string = 'safe';"), /export const text/);
  assert.throws(() => stripTypeScriptTypes("enum Kind { A }", { mode: "transform" }), { code: "ERR_INVALID_ARG_VALUE" });
});
