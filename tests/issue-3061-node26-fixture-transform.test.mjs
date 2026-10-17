import assert from "node:assert/strict";
import test from "node:test";
import { stripTypeScriptTypes } from "node:module";

test("#3061 Node 26 fixture bridge uses a real pinned TypeScript compiler only for tests", () => {
  const proof = globalThis.__plotpickleNode26LegacyFixtureBridge;
  assert.equal(Number(process.versions.node.split(".")[0]), 26);
  assert.equal(proof?.node, process.versions.node);
  assert.equal(proof?.scope, "test-fixtures-only");
  assert.match(proof.compiler, /^6[.]/);
});

test("#3061 TypeScript enum and constructor property produce executable JavaScript", async () => {
  const code = `export enum Workflow { Draft, Approved }
export class Receipt {
  constructor(public readonly status: Workflow) {}
}
export function createReceipt() { return new Receipt(Workflow.Approved); }`;
  const compiled = stripTypeScriptTypes(code, { mode: "transform" });
  const mod = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
  assert.equal(mod.createReceipt().status, mod.Workflow.Approved);
  assert.equal(mod.Workflow.Approved, 1);
});

test("#3061 invalid TypeScript fixture compilation fails closed", () => {
  assert.throws(() => stripTypeScriptTypes("export enum { =", { mode: "transform" }),
    /fixture TypeScript compilation failed/);
});

test("#3061 native strip mode still delegates to Node's built-in implementation", () => {
  const compiled = stripTypeScriptTypes("export const text: string = 'safe';");
  assert.match(compiled, /export const text/);
  assert.doesNotMatch(compiled, /: string/);
});
