import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parsePlotPickleCreativeCommand,
  describePlotPickleCreativeCommand,
  executePlotPickleLibraryOpen,
  describePlotPickleLibraryInventory,
} from "../app/_components/settings/plotpickle-creative-command.mjs";

function project(accepted=0, targetMinutes=15) {
  return {
    id: "selected-ppf-2982",
    title: "Brotherly Love",
    revision: 6,
    storyIntent: targetMinutes === null ? null : { format: "Short Film", targetMinutes },
    structure: { blocks: Array.from({length:24}, (_, n) => ({
      id: "block-" + (n+1), number: n+1,
      miniBlocks: Array.from({length:4},(_, i) => ({
        ordinal: i+1,
        stages: { plan: {
          state: n===0 && i < accepted ? "accepted" : "available",
          acceptedAt: n===0 && i < accepted ? "2026-10-14T17:00:00Z" : null,
          content: n===0 && i < accepted ? "Approved plan" : "",
        } },
      })),
    })) },
    sourceEvidence: { screenplay: { passages: [
      {id:"one",blockNumber:1,miniBlockNumber:1,text:"private source"},
      {id:"two",blockNumber:1,miniBlockNumber:4,text:"private second source"},
      {id:"three",blockNumber:2,miniBlockNumber:1,text:"other block"},
    ], passagesTruncated: false } },
    writing: { entries: [{blockNumber:1,miniBlockNumber:1,text:"Approved saved working text"}] },
  };
}
test("#2982 explicit PlotPickle commands are distinct from authored DSDD intent", () => {
  assert.deepEqual(parsePlotPickleCreativeCommand("PlotPickle tools"),{action:"tools"});
  assert.deepEqual(parsePlotPickleCreativeCommand("/plotpickle help"),{action:"tools"});
  assert.deepEqual(parsePlotPickleCreativeCommand("PlotPickle status"),{action:"status"});
  assert.deepEqual(parsePlotPickleCreativeCommand("PlotPickle library"),{action:"library"});
  assert.deepEqual(parsePlotPickleCreativeCommand("PlotPickle list projects"),{action:"library"});
  assert.deepEqual(parsePlotPickleCreativeCommand("plotpickle plan Block 01"),{action:"plan",blockNumber:1});
  assert.deepEqual(parsePlotPickleCreativeCommand("PlotPickle plan Block 24"),{action:"plan",blockNumber:24});
  assert.equal(parsePlotPickleCreativeCommand("PlotPickle plan Block 25").action,"invalid");
  assert.equal(parsePlotPickleCreativeCommand("Create Brotherly Love Block 01 using all PlotPickle agents"),null);
  assert.equal(parsePlotPickleCreativeCommand("PlotPickle create images"),null);
  assert.equal(parsePlotPickleCreativeCommand("OpenPencil open Timeline"),null);
  assert.equal(parsePlotPickleCreativeCommand(""),null);
});
test("#2982 tools inventory labels every route accurately and does not assert execution", () => {
  const s=describePlotPickleCreativeCommand({action:"tools"});
  for(const phrase of ["Library","Story Architect","Outline","Write","Storyboard","Previs","Timeline","Media providers","DSDD defect brief"]) {
    assert.ok(s.includes(phrase),phrase);
  }
  assert.match(s,/read-only discovery/);
  assert.match(s,/no cloud credits spent/i);
  assert.match(s,/01 Interpret → 02 Pi Draft → 03 Publish Brief/);
  assert.doesNotMatch(s,/successfully created first movie Block/);
});
test("#2982 selected project identity must match session and cannot be silently replaced", () => {
  const p=project(4);
  for (const selectedId of ["","other-owner","older-snapshot"]) {
    const s=describePlotPickleCreativeCommand({action:"plan",blockNumber:1},{project:p,activeProjectId:selectedId});
    assert.match(s,/BLOCKED/);
    assert.match(s,/No matching selected Library PPF/);
    assert.match(s,/No tool was executed/);
  }
  assert.match(describePlotPickleCreativeCommand({action:"status"},{project:null,activeProjectId:p.id}),/BLOCKED/);
});
test("#2982 real Outline handoff census and compressed runtime are read-only, not stage execution", () => {
  const p=project(0,15);
  const unchanged=JSON.stringify(p);
  const text=describePlotPickleCreativeCommand({action:"plan",blockNumber:1},{project:p,activeProjectId:p.id,currentAssessment:true});
  assert.match(text,/Brotherly Love/);
  assert.match(text,/selected-ppf-2982/);
  assert.match(text,/Revision: 6/);
  assert.match(text,/4 Acts \/ 12 Sequences \/ 24 Blocks \/ 96 Mini-Blocks/);
  assert.match(text,/Human-selected target 15 min/);
  assert.match(text,/Outline: 0\/4 Human-accepted Plans/);
  assert.match(text,/Imported screenplay passages mapped: 2/);
  assert.match(text,/saved writing: 1\/4/);
  assert.match(text,/Story Architect: current ADVISORY assessment; not Human-approved/);
  assert.match(text,/Mini-Block 1\.4: Plan available — Human review required/);
  assert.match(text,/BLOCKED: Do not prepare Write candidate stages/);
  assert.match(text,/No Story Architect inference, writing, image\/video generation/);
  assert.equal(JSON.stringify(p),unchanged,"inspection must never modify accepted creative evidence or source");
});
test("#2982 all four accepted Plans permit proposal preparation but not fake agent execution", () => {
  const p=project(4,15);
  const text=describePlotPickleCreativeCommand({action:"plan",blockNumber:1},{project:p,activeProjectId:p.id});
  assert.match(text,/Outline: 4\/4 Human-accepted Plans/);
  assert.match(text,/proposal-only Responsibility Run records/);
  assert.match(text,/NOT creative agent execution/);
  assert.doesNotMatch(text,/BLOCKED: Do not prepare/);
});
test("#2982 missing film intent and malformed PPF fail closed with no invented runtime or creative writes", () => {
  const noTime=project(0,null);
  const s=describePlotPickleCreativeCommand({action:"status"},{project:noTime,activeProjectId:noTime.id});
  assert.match(s,/runtime-unset/);
  assert.match(s,/No feature default was inferred/);
  const broken=project();
  broken.structure.blocks[0].miniBlocks.pop();
  const result=describePlotPickleCreativeCommand({action:"plan",blockNumber:1},{project:broken,activeProjectId:broken.id});
  assert.match(result,/BLOCKED: Selected PPF inspection failed/);
  assert.match(result,/No tool was executed/);
});
test("#2982 actual Command UI dispatch is guarded, read-only and leaves DSDD and OpenPencil intact",async()=>{
  const src=await readFile(new URL("../app/skin-v1/global-dsdd-conversation.tsx",import.meta.url),"utf8");
  const planStart=src.indexOf("  function runCreativeDiscoveryCommand(submitted: string) {");
  const planEnd=src.indexOf("  async function runOpenPencilCommand",planStart);
  assert.ok(planStart > 0 && planEnd > planStart);
  const handler=src.slice(planStart,planEnd);
  assert.match(handler,/parsePlotPickleCreativeCommand\(submitted\)/);
  assert.match(handler,/sessionActiveProjectId\(\)/);
  assert.match(handler,/loadActiveLibraryProject\(\)/);
  assert.match(handler,/currentOutlineAssessment\(project, command.blockNumber\)/);
  assert.match(handler,/describePlotPickleCreativeCommand\(command/);
  assert.doesNotMatch(handler,/persistActiveProfileProject|saveActiveLibraryProject|\/api\/local-ai\/generate|\/api\/storyboard\/|fetch\(/);
  assert.match(src,/if \(runCreativeDiscoveryCommand\(submitted\)\) return;\s*if \(await runOpenPencilCommand\(submitted\)\) return;/);
  assert.match(src,/action: "append-human"/);
  assert.match(src,/action: "draft-brief"/);
  assert.match(src,/action: "publish-brief"/);
});

function libraryHarness({ entries = [project()], selected = null, persistFails = false, switchFails = false, ready = true, extraInventory = [] } = {}) {
  const calls = [];
  let current = selected;
  const services = {
    profileReady() { calls.push("authority"); return ready; },
    listInventory() { calls.push("inventory"); return [...entries.map(p => ({ id:p.id, title:p.title, sourceKind:"user" })), ...extraInventory]; },
    listProjects() { calls.push("list"); return entries.map(p => ({ id: p.id, title: p.title })); },
    activeProjectId() { return current; },
    readSnapshot(id) { calls.push("read:" + id); return entries.find(p => p.id === id) ?? null; },
    switchProject(id) {
      calls.push("switch:" + id);
      if (switchFails) throw new Error("Selected PPF cannot be activated.");
      current = id;
      // In the product, switchActiveLibraryProject also emits PROJECT_LIBRARY_CHANGED_EVENT.
      calls.push("library-change-event");
      return entries.find(p => p.id === id) ?? null;
    },
    async persistProject() { calls.push("persist"); if (persistFails) throw new Error("Vault refused encrypted save"); },
    async flushWrites() { calls.push("flush"); },
    loadActiveProject() { calls.push("reload"); return entries.find(p => p.id === current) ?? null; },
    currentAssessment(p, block) { calls.push("assessment:" + p.id + ":" + block); return false; },
  };
  return { services, calls, currentId: () => current, entries };
}

test("#2982 explicit Library open command parses only a named saved story, not an inferred creative request", () => {
  assert.deepEqual(parsePlotPickleCreativeCommand("PlotPickle open Brotherly Love"), { action: "open", title: "Brotherly Love" });
  assert.deepEqual(parsePlotPickleCreativeCommand("/plotpickle open Brotherly Love"), { action: "open", title: "Brotherly Love" });
  assert.equal(parsePlotPickleCreativeCommand("Open Brotherly Love and make a movie"), null);
  assert.equal(parsePlotPickleCreativeCommand("PlotPickle open"), null);
  assert.equal(parsePlotPickleCreativeCommand("PlotPickle open " + "X".repeat(170)).action, "invalid");
  assert.equal(parsePlotPickleCreativeCommand("PlotPickle spend credits"), null);
});

test("#2982 Command opens the unique existing Human PPF via Library owner then immediately reports actual status and Block 01", async () => {
  const h = libraryHarness();
  const before = JSON.stringify(h.entries);
  const output = await executePlotPickleLibraryOpen(parsePlotPickleCreativeCommand("PlotPickle open Brotherly Love"), h.services);
  assert.match(output, /LIBRARY PPF VERIFIED: Brotherly Love/);
  assert.match(output, /Selected PPF: Brotherly Love/);
  assert.match(output, /PLOTPICKLE BLOCK 01/);
  assert.match(output, /Outline: 0\/4 Human-accepted Plans/);
  assert.match(output, /No creative edits, provider requests, approvals, paid generation/);
  assert.deepEqual(h.calls, ["authority","inventory","list","read:selected-ppf-2982","switch:selected-ppf-2982","library-change-event",
    "persist","flush","reload","assessment:selected-ppf-2982:1"]);
  assert.equal(h.currentId(),"selected-ppf-2982");
  assert.equal(JSON.stringify(h.entries),before,"Command selection cannot rewrite screenplay, source, Plan or media");
});

test("#2982 repeat Open on the already selected PPF is idempotent and does not rewrite its encrypted snapshot", async () => {
  const h=libraryHarness({selected:"selected-ppf-2982"});
  const output=await executePlotPickleLibraryOpen({action:"open",title:"brotherly love"},h.services);
  assert.match(output,/LIBRARY PPF VERIFIED/);
  assert.ok(!h.calls.includes("persist"));
  assert.ok(!h.calls.some(item=>item.startsWith("switch:")));
  assert.ok(!h.calls.includes("flush"));
});

test("#2982 no story, ambiguous title, and another active PPF fail closed without changing selection", async () => {
  const other={...project(), id:"unrelated", title:"Afterglow"};
  for (const entries of [[], [project(), {...project(),id:"duplicate"}]]) {
    const h=libraryHarness({entries});
    const output=await executePlotPickleLibraryOpen({action:"open",title:"Brotherly Love"},h.services);
    assert.match(output,/BLOCKED/);
    assert.ok(!h.calls.some(item=>item.startsWith("switch:")));
    assert.ok(!h.calls.includes("persist"));
  }
  const h=libraryHarness({entries:[other,project()],selected:"unrelated"});
  const output=await executePlotPickleLibraryOpen({action:"open",title:"Brotherly Love"},h.services);
  assert.match(output,/A different PPF/);
  assert.equal(h.currentId(),"unrelated");
  assert.ok(!h.calls.some(item=>item.startsWith("switch:")));
});

test("#2982 mismatched title/revision and storage errors never masquerade as completed production", async () => {
  const candidate=project();
  const mismatch=libraryHarness({entries:[candidate]});
  mismatch.services.readSnapshot=()=>({...candidate,title:"Wrong project"});
  const denied=await executePlotPickleLibraryOpen({action:"open",title:"Brotherly Love"},mismatch.services);
  assert.match(denied,/BLOCKED: Library could not verify/);
  assert.ok(!mismatch.calls.some(item=>item.startsWith("switch:")));

  const failed=libraryHarness({persistFails:true});
  const output=await executePlotPickleLibraryOpen({action:"open",title:"Brotherly Love"},failed.services);
  assert.match(output,/BLOCKED: Library Open could not be durably verified/);
  assert.match(output,/Selection or encrypted-save acknowledgement may be uncertain/);
  assert.doesNotMatch(output,/LIBRARY PPF VERIFIED/);

  const rejected=libraryHarness({switchFails:true});
  const output2=await executePlotPickleLibraryOpen({action:"open",title:"Brotherly Love"},rejected.services);
  assert.match(output2,/BLOCKED/);
  assert.doesNotMatch(output2,/LIBRARY PPF VERIFIED/);
});

test("#2982 actual Command Open uses Library authority then reuses existing status/plan, not fake creative workflow", async () => {
  const [ui,library,core]=await Promise.all([
    readFile(new URL("../app/skin-v1/global-dsdd-conversation.tsx",import.meta.url),"utf8"),
    readFile(new URL("../core/storage/project-library-browser.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/_components/settings/plotpickle-creative-command.mjs",import.meta.url),"utf8"),
  ]);
  const start=ui.indexOf("  async function runCreativeLibraryCommand(submitted: string) {");
  const end=ui.indexOf("  function runCreativeDiscoveryCommand(submitted: string) {",start);
  assert.ok(start>0 && end>start,"Command needs a distinct, real Library selection path");
  const handler=ui.slice(start,end);
  for(const symbol of ["listHumanLibraryProjects","loadLibraryProjectSnapshot","switchActiveLibraryProject",
    "persistActiveProfileProject","flushProfilePrivateWrites","executePlotPickleLibraryOpen"]) assert.match(handler,new RegExp(symbol));
  assert.match(ui,/if \(await runCreativeLibraryCommand\(submitted\)\) return;\s*if \(runCreativeDiscoveryCommand\(submitted\)\) return;/u);
  assert.match(library,/export function switchActiveLibraryProject[\s\S]*markSessionActiveProject\(result\.activeProject\.id\);[\s\S]*announceChange\(\)/u);
  assert.match(core,/const plan = describePlotPickleCreativeCommand\(\{ action: "plan", blockNumber: 1 \}/u);
  assert.doesNotMatch(handler,/createLibraryUserProject|createLibraryWorkingCopy|saveActiveLibraryProject|\/api\/local-ai\/generate|\/api\/storyboard\//u);
});

test("#2982 screenshot UAT — no exact Brotherly Love title produces current-profile diagnostics, never a fabricated Library open", async () => {
  const h=libraryHarness({entries:[{...project(),id:"brotherly-source",title:"Brotherly Love — imported screenplay"}]});
  const output=await executePlotPickleLibraryOpen({action:"open",title:"Brotherly Love"},h.services);
  assert.match(output,/BLOCKED: No Human-owned saved PPF exactly titled Brotherly Love/);
  assert.match(output,/Other matching titles: Brotherly Love — imported screenplay/);
  assert.match(output,/PlotPickle library/);
  assert.equal(h.currentId(),null);
  assert.ok(!h.calls.some(s=>s.startsWith("switch:")));
  assert.ok(!h.calls.includes("persist"));
});

test("#2982 Command lists authoritative current-profile saved titles and classifications without switching or running providers", async () => {
  const example={id:"packaged-example",title:"Afterglow",sourceKind:"example"};
  const h=libraryHarness({extraInventory:[example],selected:null});
  const output=await executePlotPickleLibraryOpen({action:"library"},h.services);
  assert.match(output,/PLOTPICKLE LIBRARY/);
  assert.match(output,/Brotherly Love \[id: selected-ppf-2982, kind: user\]/);
  assert.match(output,/Afterglow \[id: packaged-example, kind: example\]/);
  assert.match(output,/Current-profile saved Library titles \(2\)/);
  assert.deepEqual(h.calls,["authority","inventory"]);
  assert.equal(h.currentId(),null);
  assert.doesNotMatch(output,/LIBRARY PPF VERIFIED/);
});

test("#2982 profile not hydrated is distinguishable from an absent saved story and reveals no names", async () => {
  const h=libraryHarness({ready:false});
  for(const command of [{action:"library"},{action:"open",title:"Brotherly Love"}]) {
    const result=await executePlotPickleLibraryOpen(command,h.services);
    assert.match(result,/BLOCKED: Authenticated profile Library is not/);
    assert.doesNotMatch(result,/selected-ppf-2982/);
    assert.doesNotMatch(result,/LIBRARY PPF VERIFIED/);
  }
  assert.ok(!h.calls.includes("inventory"));
  assert.ok(!h.calls.some(s=>s.startsWith("switch:")));
});

test("#2982 classification exclusion is explained without converting saved examples or synthetic fixtures", async () => {
  const h=libraryHarness({entries:[],extraInventory:[{id:"excluded",title:"Brotherly Love",sourceKind:"synthetic"}]});
  const output=await executePlotPickleLibraryOpen({action:"open",title:"Brotherly Love"},h.services);
  assert.match(output,/present in the current-profile Library index but excluded/);
  assert.match(output,/kind: synthetic/);
  assert.equal(h.currentId(),null);
});

test("#2982 read-only Library inspection handles zero projects and oversized inventories without leaking project content", () => {
  const services={profileReady:()=>true,activeProjectId:()=>null,listInventory:()=>[]};
  assert.match(describePlotPickleLibraryInventory(services),/zero saved PPFs/);
  const records=Array.from({length:33},(_,i)=>({id:"rec-"+i,title:"Saved Title "+i,sourceKind:"user"}));
  const output=describePlotPickleLibraryInventory({...services,listInventory:()=>records});
  assert.match(output,/Current-profile saved Library titles \(33\)/);
  assert.match(output,/13 more/);
  assert.doesNotMatch(output,/Saved Title 32/);
  assert.doesNotMatch(output,/screenplay|passages|provider token/i);
});

test("#2982 Command Library lookup remains profile-gated and uses actual project owner not an alternate store", async () => {
  const [ui,library,core,profile]=await Promise.all([
    readFile(new URL("../app/skin-v1/global-dsdd-conversation.tsx",import.meta.url),"utf8"),
    readFile(new URL("../core/storage/project-library-browser.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/_components/settings/plotpickle-creative-command.mjs",import.meta.url),"utf8"),
    readFile(new URL("../core/storage/profile-private-browser.ts",import.meta.url),"utf8"),
  ]);
  assert.match(ui,/profilePrivateBrowserReadyFor\(window\.sessionStorage\.getItem\(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY\)/);
  assert.match(ui,/listInventory: listPersistableLibraryProjects/);
  assert.match(ui,/listProjects: listHumanLibraryProjects/);
  assert.match(ui,/command\?\.action !== "open" && command\?\.action !== "library"/);
  assert.match(library,/export function listPersistableLibraryProjects\(\)/);
  assert.match(profile,/export function profilePrivateBrowserReadyFor\(profileId: string\)/);
  assert.match(core,/describePlotPickleLibraryInventory/);
});
