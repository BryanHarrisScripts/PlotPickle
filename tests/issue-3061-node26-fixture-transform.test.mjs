import assert from "node:assert/strict";
import module, { stripTypeScriptTypes } from "node:module";
import test from "node:test";
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
