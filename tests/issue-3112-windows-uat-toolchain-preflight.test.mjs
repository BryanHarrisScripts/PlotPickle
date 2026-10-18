import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  checkWindowsUatToolchain, parseWindowsUatCommand, startWindowsUat,
  driveWindowsUat, statusWindowsUat,
} from "../scripts/windows-uat-control.mjs";

const HEAD = "c".repeat(40), BASE = "d".repeat(40);
const cfg = parseWindowsUatCommand(["--start","--head",HEAD,"--base",BASE,"--task","issue-3112"]);
const checkout = async () => ({ head: HEAD });
const ready = () => ({ ready: true, code: "READY" });
const missing = () => ({ ready: false, code: "TYPESCRIPT_NOT_INSTALLED" });

async function fixture(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-3112-preflight-"));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test("non-mutating --doctor is an explicit no-argument mode and never becomes remote dispatch", () => {
  assert.deepEqual(parseWindowsUatCommand(["--doctor"]), {mode:"doctor"});
  for (const args of [
    ["--doctor", "--start", "--head",HEAD,"--base",BASE,"--task","issue-3112"],
    ["--doctor","--task","issue-3112"], ["--doctor","--doctor"],
  ]) assert.throws(() => parseWindowsUatCommand(args));
});
const pin = "npm:@typescript/typescript6@6.0.2";
const fixtures = {
  "package.json": { devDependencies: { typescript: pin } },
  "package-lock.json": {
    lockfileVersion: 3,
    packages: {
      "": { devDependencies: { typescript: pin } },
      "node_modules/typescript": {
        name: "@typescript/typescript6", version: "6.0.2",
        integrity: "sha512-AABBCC==",
        dependencies: { "@typescript/old": "npm:typescript@^6" },
      },
      "node_modules/@typescript/old": {
        name: "typescript", version: "6.0.3", integrity: "sha512-AABBCC==",
      },
    },
  },
  "node_modules/typescript/package.json": {
    name: "@typescript/typescript6", version: "6.0.2",
    dependencies: { "@typescript/old": "npm:typescript@^6" },
  },
  "node_modules/@typescript/old/package.json": { name: "typescript", version: "6.0.3" },
};
function simulatedToolchain(changes = {}, loadTypeScript = () => ({
  version: "6.0.3", transpileModule() {},
})) {
  return checkWindowsUatToolchain({
    readJson: (name) => {
      const result = Object.hasOwn(changes, name) ? changes[name] : fixtures[name];
      if (result instanceof Error) throw result;
      return result;
    },
    loadTypeScript,
  });
}
test("repo-pinned 6.0.2 wrapper reexports separately lock-pinned 6.0.3 compiler API", () => {
  const result = simulatedToolchain();
  assert.deepEqual(result, {
    ready: true, code: "READY", expectedVersion: "6.0.2",
    expectedCompilerVersion: "6.0.3", observedVersion: "6.0.3",
    wrapperPackage: "@typescript/typescript6", compilerPackage: "@typescript/old",
    source: "lockfile-and-installed-dev-toolchain",
    inferenceStarted: false, installationPerformed: false,
  });
  assert.doesNotMatch(JSON.stringify(result), /Users\\|C:\\|token|private/i);
});
test("toolchain rejects wrong lock, uninstalled wrapper, and replaced real compiler", () => {
  const badLock = simulatedToolchain({
    "package-lock.json": { ...fixtures["package-lock.json"], lockfileVersion: 2 },
  });
  assert.equal(badLock.code, "TYPESCRIPT_LOCK_MISMATCH");
  const noLock = Object.assign(new Error("C:\\Secret\\token"), { code: "ENOENT" });
  assert.equal(simulatedToolchain({ "package-lock.json": noLock }).code, "TYPESCRIPT_LOCK_UNAVAILABLE");
  assert.equal(simulatedToolchain({
    "node_modules/typescript/package.json": noLock,
  }).code, "TYPESCRIPT_NOT_INSTALLED");
  assert.equal(simulatedToolchain({
    "node_modules/@typescript/old/package.json": noLock,
  }).code, "TYPESCRIPT_NOT_INSTALLED");
  assert.equal(simulatedToolchain({
    "node_modules/@typescript/old/package.json": { name: "typescript", version: "6.0.4" },
  }).code, "TYPESCRIPT_VERSION_MISMATCH");
  assert.equal(simulatedToolchain({
    "node_modules/typescript/package.json": { name: "typescript", version: "6.0.2" },
  }).code, "TYPESCRIPT_PACKAGE_MISMATCH");
  assert.equal(simulatedToolchain({
    "package.json": { devDependencies: { typescript: "typescript@6" } },
  }).code, "TYPESCRIPT_PIN_UNVERIFIED");
});
test("wrong runtime API version or unusable transpiler blocks rather than silently widening compatibility", () => {
  assert.equal(simulatedToolchain({}, () => ({
    version: "6.0.2", transpileModule() {},
  })).code, "TYPESCRIPT_VERSION_MISMATCH");
  assert.equal(simulatedToolchain({}, () => ({
    version: "6.0.4", transpileModule() {},
  })).code, "TYPESCRIPT_VERSION_MISMATCH");
  assert.equal(simulatedToolchain({}, () => ({
    version: "6.0.3",
  })).code, "TYPESCRIPT_UNUSABLE");
  const missing = Object.assign(new Error("Cannot find module 'typescript' from C:\\Secret"), {
    code: "MODULE_NOT_FOUND",
  });
  assert.equal(simulatedToolchain({}, () => { throw missing; }).code, "TYPESCRIPT_NOT_INSTALLED");
  const failed = simulatedToolchain({}, () => { throw new Error("credential sk-SECRET"); });
  assert.equal(failed.code, "TYPESCRIPT_UNUSABLE");
  assert.doesNotMatch(JSON.stringify(failed), /SECRET|credential|private/i);
});
test("missing preflight prevents any reservation or launch; failure does not consume next attempt",()=>fixture(async appRoot=>{
  let called=0;
  const launch=()=>{ called++; return { pid:1234, unref(){} }; };
  await assert.rejects(startWindowsUat(cfg,{appRoot,inspect:checkout,preflight:missing,launch}),/TYPESCRIPT_NOT_INSTALLED/);
  assert.equal(called,0);
  const folder=path.join(appRoot,"engineering-team","windows-uat-control");
  await assert.rejects(readdir(folder), { code:"ENOENT" });
  const accepted=await startWindowsUat(cfg,{appRoot,inspect:checkout,preflight:ready,launch});
  assert.match(accepted.scope,/^[a-f0-9]{64}$/);
  assert.equal(called,1);
  const ledger=JSON.parse(await readFile(path.join(folder,accepted.scope,"reservation.json"),"utf8"));
  assert.equal(ledger.attempt,1);
  assert.equal(ledger.modelDispatchAuthorized,false);
}));
test("worker reconfirms preflight and fails closed if local toolchain disappears after admission",()=>fixture(async appRoot=>{
  const reserved=await startWindowsUat(cfg,{appRoot,inspect:checkout,preflight:ready,
    launch:()=>({pid:1234,unref(){}})});
  let called=0;
  const terminal=await driveWindowsUat(reserved.scope,{
    appRoot,inspect:checkout,preflight:missing,
    launch:()=>{called++;throw Error("must not launch missing-dependency test suite");},
  });
  assert.equal(called,0);
  assert.equal(terminal.state,"blocked");
  assert.equal(terminal.mergeEligible,false);
  const file=path.join(appRoot,"engineering-team","windows-uat-control",reserved.scope,"terminal.json");
  const evidence=JSON.parse(await readFile(file,"utf8"));
  assert.equal(evidence.code,"TYPESCRIPT_NOT_INSTALLED");
  assert.equal(evidence.childExitObserved,false);
  assert.equal((await statusWindowsUat(reserved.scope,{appRoot})).state,"blocked");
  await assert.rejects(driveWindowsUat(reserved.scope,{appRoot,inspect:checkout,preflight:ready}),/EEXIST/);
}));
