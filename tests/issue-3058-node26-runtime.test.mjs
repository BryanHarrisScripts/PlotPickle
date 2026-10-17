import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);
const source=path=>readFile(new URL(path,root),"utf8");
const active=[
  ".github/workflows/product-gate.yml",
  ".github/workflows/windows-installer.yml",
  ".github/workflows/demo-onboarding.yml",
  ".github/workflows/profile-experience.yml",
  ".github/workflows/runtime-weight-inventory.yml",
  ".github/workflows/repository-architecture-inventory.yml",
];
const version="26.12.0";

test("#3058 actual CI process uses Node 26.12 and exposes native Temporal",()=>{
  assert.equal(process.versions.node,version);
  assert.equal(typeof Temporal.Now.instant,"function","Node 26 provides the standard Temporal API");
  const instant=Temporal.Instant.from("2026-10-16T22:00:00Z");
  assert.equal(instant.epochMilliseconds,1792188000000);
});

test("#3058 all active distribution and product verification lanes pin the same executable",async()=>{
  for(const path of active){
    const content=await source(path);
    assert.ok(content.includes("node-version:"),path+" must actually select a Node runner");
    assert.ok(content.includes(version),path+" must pin the current executable");
    assert.ok(!content.includes("24.19.0") && !content.includes("22.13.0"),
      path+" may not silently fall back to the old application runtime");
  }
  const installer=await source("scripts/windows-installer/stage.mjs");
  assert.match(installer,/process\.versions\.node/);
  assert.match(installer,/cpSync\(nodeRoot, stagedNode/);
  assert.match(installer,/manifest\.bundledNode = /);
});

test("#3058 architecture and product verification use the same Node 26 executable",async()=>{
  const architecture=await source(".github/workflows/architecture-shadow.yml");
  assert.match(architecture,/node-version: '26[.]12[.]0'/);
  assert.doesNotMatch(architecture,/node-version: '22[.]13[.]0'/);
  assert.doesNotMatch(architecture,/legacy TypeScript transform fixtures/);
});

test("#3058 source-of-truth registry identifies shipped Node and licensed distribution",async()=>{
  const inventory=JSON.parse(await source("config/third-party-oss.json"));
  const node=inventory.systems.find(x=>x.id==="nodejs");
  assert.equal(node.usage,"bundled");
  assert.equal(node.version,version);
  assert.equal(node.licenseSource,"https://github.com/nodejs/node/blob/v26.12.0/LICENSE");
});

test("#3058 historic performance and Portless proof stay tied to measured Node 24",async()=>{
  const history=JSON.parse(await source("scripts/performance/ratified/performance-budgets.json"));
  assert.equal(history.identity.node,"v24.19.0");
  const portless=JSON.parse(await source("config/portless-runtime.json"));
  assert.equal(portless.windowsAcceptance.nodeVersion,"24.19.0");
});
