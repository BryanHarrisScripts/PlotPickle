import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { isSageOpenShortcut } from "../modules/creative-room/sage-keyboard-shortcut.mjs";

const valid = Object.freeze({
  key: "S",
  shiftKey: true,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  defaultPrevented: false,
  repeat: false,
});

test("PP-SAGE-KEY-001 preserves normal Shift+S access and lower/upper case", () => {
  assert.equal(isSageOpenShortcut(valid), true);
  assert.equal(isSageOpenShortcut({ ...valid, key: "s" }), true);
  assert.equal(isSageOpenShortcut({ ...valid, key: "S" }), true);
  assert.equal(isSageOpenShortcut({ ...valid, key: "s", shiftKey: false }), false);
  assert.equal(isSageOpenShortcut({ ...valid, key: "s", shiftKey: undefined }), false);
});

test("PP-SAGE-KEY-001 ignores malformed, missing, non-string or unsupported keys safely", () => {
  const keys = [
    undefined, null, false, true, 0, 83, NaN, Infinity,
    {}, { toLowerCase: null }, [], ["S"], Symbol("S"),
    "", " ", "Shift", "Escape", "Tab", "Enter", "Dead",
    "Process", "Unidentified", "F1", "ß", "Ｓ",
  ];
  for (const key of keys) {
    assert.doesNotThrow(() => isSageOpenShortcut({ ...valid, key }), String(key));
    assert.equal(isSageOpenShortcut({ ...valid, key }), false, String(key));
  }
  for (const event of [null, undefined, false, true, 0, 1, "", "S", {}, Object.create(null)]) {
    assert.doesNotThrow(() => isSageOpenShortcut(event));
    assert.equal(isSageOpenShortcut(event), false);
  }
  // The observed Windows automation failure omitted KeyboardEvent.key.
  const automatedEvent = Object.freeze({ shiftKey: true, repeat: false, defaultPrevented: false });
  assert.equal(isSageOpenShortcut(automatedEvent), false);
});

test("PP-SAGE-KEY-001 blocks prevented/repeated or modified shortcuts, retaining existing semantics", () => {
  for (const [name, value] of Object.entries({
    defaultPrevented: true,
    repeat: true,
    ctrlKey: true,
    metaKey: true,
    altKey: true,
    shiftKey: false,
  })) {
    assert.equal(isSageOpenShortcut({ ...valid, [name]: value }), false, name);
  }
  for (let mask = 0; mask < 16; mask += 1) {
    const event = {
      ...valid,
      ctrlKey: Boolean(mask & 1),
      metaKey: Boolean(mask & 2),
      altKey: Boolean(mask & 4),
      repeat: Boolean(mask & 8),
    };
    assert.equal(isSageOpenShortcut(event), mask === 0, `modifier/repeat mask ${mask}`);
  }
});

test("PP-SAGE-KEY-001 real overlay keeps secondary safety gates, focus behavior, Escape and Tab handling", async () => {
  const source = await readFile(new URL("../app/global-sage-overlay.tsx", import.meta.url), "utf8");
  assert.match(source, /import \{ isSageOpenShortcut \}/u);
  assert.match(source, /window\.addEventListener\("keydown", onKeyDown, true\)/u);
  assert.match(source, /window\.removeEventListener\("keydown", onKeyDown, true\)/u);
  assert.match(source, /if \(!isSageOpenShortcut\(event\)\) return;/u);
  assert.doesNotMatch(source, /event\.key\.toLowerCase\(\)/u);
  const start = source.indexOf("const onKeyDown = (event: KeyboardEvent) =>");
  const end = source.indexOf('window.addEventListener("keydown", onKeyDown, true)', start);
  assert.ok(start >= 0 && end > start, "global shortcut must have an event listener");
  const handler = source.slice(start, end);
  assert.ok(handler.indexOf("isSageOpenShortcut(event)") < handler.indexOf("isTextEditingTarget(event.target)"));
  assert.match(handler, /hasBlockingOverlay\(\)/u);
  assert.match(handler, /hasVisiblePlotPickleSurface\(\)/u);
  assert.match(handler, /event\.preventDefault\(\)/u);
  assert.match(handler, /event\.stopPropagation\(\)/u);
  assert.match(handler, /originRef\.current = document\.activeElement/u);
  assert.match(handler, /setOpen\(true\)/u);
  assert.match(source, /if \(event\.key === "Escape"\)/u);
  assert.match(source, /if \(event\.key !== "Tab"\) return;/u);
  assert.match(source, /setOpen\(false\)/u);
});

test("PP-SAGE-KEY-001 fails closed when malformed automation event accessors throw", () => {
  const brokenKeys = [
    { ...valid, get key() { throw new Error("synthetic key getter failure"); } },
    { ...valid, get shiftKey() { throw new Error("synthetic shift getter failure"); } },
    { ...valid, get defaultPrevented() { throw new Error("synthetic cancelled getter failure"); } },
    new Proxy(valid, { get() { throw new Error("synthetic proxy failure"); } }),
  ];
  for (const candidate of brokenKeys) {
    assert.doesNotThrow(() => isSageOpenShortcut(candidate));
    assert.equal(isSageOpenShortcut(candidate), false);
  }
});

test("PP-SAGE-KEY-001 executes the actual global listener: malformed event is inert before DOM, Shift+S keeps its gates", async () => {
  const source = await readFile(new URL("../app/global-sage-overlay.tsx", import.meta.url), "utf8");
  const start = source.indexOf("const onKeyDown = (event: KeyboardEvent) => {");
  const end = source.indexOf('window.addEventListener("keydown", onKeyDown, true)', start);
  assert.ok(start >= 0 && end > start);
  const handler = source.slice(start, end).replace("(event: KeyboardEvent)", "(event)");
  const calls = [];
  let editing = false, blocking = false, surface = true;
  const context = {
    isSageOpenShortcut,
    isTextEditingTarget: () => { calls.push("editing-gate"); return editing; },
    hasBlockingOverlay: () => { calls.push("blocking-gate"); return blocking; },
    hasVisiblePlotPickleSurface: () => { calls.push("surface-gate"); return surface; },
    document: { activeElement: null },
    HTMLElement: class HTMLElement {},
    originRef: {current:null},
    setError: value => calls.push("error:"+value),
    setOpen: value => calls.push("open:"+value),
  };
  const listener = vm.runInNewContext(handler + "\nonKeyDown", context);
  const malformed = [
    {}, null, { shiftKey:true },
    { ...valid, key: undefined },
    { ...valid, get key() { throw new Error("bad automation key property"); } },
    new Proxy({ ...valid }, { get() { throw new Error("bad proxy"); } }),
  ];
  for(const value of malformed) {
    calls.length = 0;
    assert.doesNotThrow(() => listener(value));
    assert.deepEqual(calls, [], "invalid events cannot invoke DOM or dialog state");
  }
  const dispatch = (overrides={}) => {
    calls.length=0;
    listener({ ...valid, target:null, ...overrides,
      preventDefault() {calls.push("preventDefault");},
      stopPropagation() {calls.push("stopPropagation");},
    });
    return [...calls];
  };
  assert.deepEqual(dispatch(), ["editing-gate","blocking-gate","surface-gate","preventDefault","stopPropagation","error:","open:true"]);
  editing=true;
  assert.deepEqual(dispatch(),["editing-gate"],"typing in an editor must not open Sage");
  editing=false;blocking=true;
  assert.deepEqual(dispatch(),["editing-gate","blocking-gate"],"modal must not open Sage");
  blocking=false;surface=false;
  assert.deepEqual(dispatch(),["editing-gate","blocking-gate","surface-gate"],"invisible Matrix cannot open Sage");
  surface=true;
  assert.deepEqual(dispatch({key:"S",ctrlKey:true}),[],"modified key remains inert");
  assert.deepEqual(dispatch({key:"S",repeat:true}),[],"repeat remains inert");
});
