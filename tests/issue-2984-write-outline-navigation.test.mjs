import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");
function outlineHandler(source) {
  const tree = ts.createSourceFile("write.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const matches = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "openOutlineFromWrite") matches.push(node);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.equal(matches.length, 1, "test the actual Write Outline handoff");
  return stripTypeScriptTypes(matches[0].getText(tree)) + "\nopenOutlineFromWrite";
}
function context(overrides = {}) {
  const calls = [], messages = [];
  const address = { blockNumber: 7, miniBlockNumber: 3 };
  return { calls, messages, address, values: {
    address, dirty: false, saveInFlightRef: { current: false }, filmSaveInFlightRef: { current: false },
    onOpenOutline(value) { calls.push(value); }, setStatus(value) { messages.push(value); },
    window: { confirm() { throw new Error("clean navigation requires no confirmation"); },
      location: { assign() { throw new Error("Outline must not reload the document"); } } },
    ...overrides,
  } };
}
const execute = async state => vm.runInNewContext(outlineHandler(await read("modules/write/ui/block-native-write-workspace.tsx")), state.values)();

test("#2984 clean Outline handoff retains the exact address without document reload", async () => {
  const state = context();
  await execute(state);
  assert.equal(state.calls.length, 1);
  assert.equal(state.calls[0], state.address);
  assert.equal(state.messages.length, 0);
});
test("#2984 both in-flight encrypted saves prevent Outline handoff", async () => {
  for (const key of ["saveInFlightRef", "filmSaveInFlightRef"]) {
    const state = context({ [key]: { current: true } });
    await execute(state);
    assert.equal(state.calls.length, 0);
    assert.match(state.messages[0], /Wait for the encrypted profile Save result/);
  }
});
test("#2984 rejected dirty-editor departure retains work; explicit discard permits handoff", async () => {
  for (const allow of [false, true]) {
    let confirmations = 0;
    const state = context({ dirty: true, window: { confirm() { confirmations++; return allow; } } });
    await execute(state);
    assert.equal(confirmations, 1);
    assert.equal(state.calls.length, allow ? 1 : 0);
  }
});
test("#2984 standalone Write reports absent Outline host rather than wrong navigation", async () => {
  const state = context({ onOpenOutline: undefined });
  await execute(state);
  assert.equal(state.calls.length, 0);
  assert.match(state.messages[0], /Open Outline from the PlotPickle Dashboard/);
});
test("#2984 Matrix uses its existing Outline owner and does not replace the Library project", async () => {
  const host = await read("app/skin-v1/dashboard-bbs-review-host.tsx");
  assert.match(host, /onOpenOutline=\{\(address\) => \{ setWriteOpen\(false\); openOutline\(address\); \}\}/);
  const tree = ts.createSourceFile("host.tsx", host, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let open;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "openOutline") open = node;
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(open);
  const calls = [], address = { blockNumber: 7, miniBlockNumber: 3 };
  vm.runInNewContext(stripTypeScriptTypes(open.getText(tree)) + "\nopenOutline", {
    updateReviewAddress(stage, position) { calls.push([stage, position]); },
    closePreproductionSurfaces() {}, setOutlineOpen(value) { assert.equal(value, true); },
    onSurfaceNameChange(value) { assert.equal(value, "OUTLINE"); },
  })(address);
  assert.equal(calls[0][0], "outline");
  assert.equal(calls[0][1], address);
});
