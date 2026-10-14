import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { canonicalizePiBareFilenameClaims, draftWithVerifiedGrounding } from "../scripts/pi/dsdd-grounding-repair.mjs";
import { assessPiDraftGrounding } from "../scripts/dsdd-integrity.mjs";

const tick = String.fromCharCode(96);
const quote = name => tick + name + tick;
const present = [
  "modules/write/model/selected-ppf-runtime-grid.mjs",
  "build/dsdd/dsdd-github-brief.ts",
  "tests/issue-1847-1849-cloud-agents-settings.test.mjs",
  "tests/issue-2863-settings-time-and-operations-order.test.mjs",
];
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(),"plotpickle-2980-"));
  t.after(() => rm(root,{recursive:true,force:true}));
  const track = async (name, contents="// regular\n") => {
    await mkdir(path.dirname(path.join(root,name)),{recursive:true});
    await writeFile(path.join(root,name),contents);
  };
  for(const name of present) await track(name);
  await track("modules/a/shared.ts");
  await track("modules/b/shared.ts");
  await track("tests/deleted-mocked.ts");
  await track("AGENTS.md");
  execFileSync("git",["init","-q"],{cwd:root});
  execFileSync("git",["add","--","."] ,{cwd:root});
  await unlink(path.join(root,"tests/deleted-mocked.ts"));
  await track("tests/untracked-mocked.ts");
  return root;
}
test("#2980 unique tracked basename resolves to verified full path, never substring/fuzzy path", async t => {
  const root=await fixture(t);
  const original=[
    "# Developer brief",
    "Ground " + present.map(p=>quote(path.basename(p))).join(", "),
    "Do not claim " + quote("story-decisions.yml") + " or " + quote("command-review-panel.tsx") + " exists.",
    "Existing qualified path " + quote(present[0]) + " must remain unchanged.",
    "Potential path " + quote("modules/unknown/selected-ppf-runtime-grid.mjs") + " is still invalid.",
  ].join("\n");
  const x=canonicalizePiBareFilenameClaims(original,root);
  assert.equal(x.replacements.length,4);
  for(const name of present) assert.ok(x.text.includes(quote(name)));
  assert.ok(x.text.includes(quote("story-decisions.yml")));
  assert.ok(x.text.includes(quote("command-review-panel.tsx")));
  assert.ok(x.text.includes(quote("modules/unknown/selected-ppf-runtime-grid.mjs")));
  assert.deepEqual(x.ambiguous,[]);
  assert.deepEqual(assessPiDraftGrounding(x.text,root).missing,
    ["story-decisions.yml","command-review-panel.tsx","modules/unknown/selected-ppf-runtime-grid.mjs"]);
});
test("#2980 duplicate tracked basename stays unresolved and final guard fails closed",async t=>{
  const root=await fixture(t);
  const source="Use "+quote("shared.ts")+" only if the owner is verified.";
  const x=canonicalizePiBareFilenameClaims(source,root);
  assert.equal(x.text,source);
  assert.deepEqual(x.ambiguous,["shared.ts"]);
  assert.deepEqual(assessPiDraftGrounding(x.text,root).missing,["shared.ts"]);
});
test("#2980 ignored, deleted, traversal and untracked files never become evidence",async t=>{
  const root=await fixture(t);
  await symlink(path.join(root,"AGENTS.md"),path.join(root,"tests","linked.ts"));
  const source=["untracked-mocked.ts","deleted-mocked.ts","linked.ts","../AGENTS.md"]
    .map(quote).join(" ");
  const x=canonicalizePiBareFilenameClaims(source,root,{
    trackedListing:"tests\\untracked-mocked.ts\0tests\\deleted-mocked.ts\0tests\\linked.ts\0../AGENTS.md\0",
  });
  assert.equal(x.text,source);
  assert.equal(x.replacements.length,0);
  assert.deepEqual(assessPiDraftGrounding(x.text,root).missing,
    ["untracked-mocked.ts","deleted-mocked.ts","../AGENTS.md"]);
});
test("#2980 read-only Pi repair canonically fixes valid bare names; inventing files still needs one bounded correction",async t=>{
  const root=await fixture(t);
  const lockedPrompt="LOCKED HUMAN INTENT: Enable PlotPickle Command to orchestrate tools with evidence and without modifying approved story.";
  const first="# Pi Technical Developer Draft\nInspect "+
    present.map(p=>quote(path.basename(p))).join(", ")+"; also inspect "+
    quote("story-decisions.yml")+" and "+quote("command-review-panel.tsx")+".";
  const second="# Pi Technical Developer Draft\nUse "+
    quote(path.basename(present[0]))+" and "+quote("dsdd-github-brief.ts")+
    "; remaining components are Unknown / requires inspection.";
  const calls=[];
  const res=await draftWithVerifiedGrounding({
    repoRoot:root, lockedPrompt, intentText:"Command developer brief",
    runDraft:async prompt=>{calls.push(prompt);return {stdout:calls.length===1?first:second};},
  });
  assert.equal(res.attempts,2);
  assert.equal(calls.length,2);
  assert.ok(calls.every(p=>p.startsWith(lockedPrompt)));
  assert.match(calls[1],/ONE BOUNDED CORRECTION/u);
  assert.match(calls[1],/story-decisions.yml/u);
  assert.deepEqual(res.grounding.missing,[]);
  assert.ok(res.text.includes(quote(present[0])));
  assert.ok(res.text.includes(quote(present[1])));
  assert.ok(!res.text.includes(quote("story-decisions.yml")));
});
test("#2980 second nonexisting claim is still rejected, not silently removed or published",async t=>{
  const root=await fixture(t);
  let calls=0;
  await assert.rejects(
    ()=>draftWithVerifiedGrounding({
      repoRoot:root, lockedPrompt:"LOCKED HUMAN INTENT",intentText:"Command",
      runDraft:async()=>({stdout:"Brief "+quote(++calls===1?"missing-one.ts":"missing-two.ts")}),
    }),
    /not found: missing-two\.ts/u,
  );
  assert.equal(calls,2);
});
test("#2980 Windows separators in git listing canonicalize only indexed present paths",async t=>{
  const root=await fixture(t);
  const actual=present[0];
  const x=canonicalizePiBareFilenameClaims("Reference "+quote("selected-ppf-runtime-grid.mjs"),root,{
    trackedListing:actual.replaceAll("/","\\")+"\0",
  });
  assert.equal(x.text,"Reference "+quote(actual));
});
