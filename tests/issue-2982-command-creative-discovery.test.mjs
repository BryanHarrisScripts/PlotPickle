import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parsePlotPickleCreativeCommand,
  describePlotPickleCreativeCommand,
  executePlotPickleLibraryOpen,
  describePlotPickleLibraryInventory,
  executePlotPickleLibraryRename,
  inspectPlotPickleLibraryProject,
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
test("#3000 typed CMD connects to the real Local Cloud and Hybrid Settings modes", () => {
  assert.deepEqual(parsePlotPickleCreativeCommand("PlotPickle connections"), { action: "connections-help" });
  assert.deepEqual(parsePlotPickleCreativeCommand("PlotPickle connect local"), { action: "connections-open", mode: "local" });
  assert.deepEqual(parsePlotPickleCreativeCommand("PlotPickle connect CLOUD"), { action: "connections-open", mode: "cloud" });
  assert.deepEqual(parsePlotPickleCreativeCommand("PlotPickle connections hybrid"), { action: "connections-open", mode: "hybrid" });
  assert.equal(parsePlotPickleCreativeCommand("PlotPickle connect nonsense"), null);
  assert.equal(parsePlotPickleCreativeCommand("PlotPickle connect cloud key=secret"), null, "Never treat pasted credentials as a connection action");
});

test("#3000 Command uses existing Settings StoryModeHost navigation; no duplicate provider store or secret logging", async () => {
  const [dashboard, command, storyMode, hybrid] = await Promise.all([
    readFile(new URL("../app/skin-v1/dashboard-bbs-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/skin-v1/global-dsdd-conversation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/skin-v1/story-mode-host.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/skin-v1/hybrid-story-mode-panel.tsx", import.meta.url), "utf8"),
  ]);
  assert.ok(command.includes('window.dispatchEvent(new CustomEvent("plotpickle:open-story-mode"'));
  assert.ok(command.includes("Never paste API keys into Command"));
  assert.ok(command.includes("if (runConnectionsCommand(submitted)) return;"));
  assert.ok(dashboard.includes('window.addEventListener("plotpickle:open-story-mode", openConnections)'));
  for (const mode of ["local", "cloud", "hybrid"]) {
    assert.ok(dashboard.includes('setStoryModeView("' + mode + '")'), mode);
  }
  assert.ok(dashboard.includes("<StoryModeHost initialView={storyModeView}"));
  assert.ok(storyMode.includes("<HybridStoryModePanel"));
  assert.ok(hybrid.includes('fetch("/api/ai-routing/join"'), "The existing GUI owns mutation, not the command parser");
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
  assert.match(core,/const plan\s*=\s*describePlotPickleCreativeCommand\(\{\s*action:\s*"plan",\s*blockNumber:\s*1\s*\}/u);
  assert.doesNotMatch(handler,/createLibraryUserProject|createLibraryWorkingCopy|\/api\/local-ai\/generate|\/api\/storyboard\//u);
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
  assert.match(ui,/const profileId\s*=\s*\(\)\s*=>\s*window\.sessionStorage\.getItem\(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY\)/);
  assert.match(ui,/profileReady:\s*\(\)\s*=>\s*profilePrivateBrowserReadyFor\(profileId\(\)\)/);
  assert.match(ui,/listInventory: listPersistableLibraryProjects/);
  assert.match(ui,/listProjects: listHumanLibraryProjects/);
  assert.match(ui,/command\?\.action !== "open" && command\?\.action !== "library"/);
  assert.match(library,/export function listPersistableLibraryProjects\(\)/);
  assert.match(profile,/export function profilePrivateBrowserReadyFor\(profileId: string\)/);
  assert.match(core,/describePlotPickleLibraryInventory/);
});

function renameHarness({ records = [project()], selected = null, ready = true, failure = "", profile = "profile_verified" } = {}) {
  const entries=records.map(p=>structuredClone(p));
  let active=selected, profileId=profile, isReady=ready;
  const events=[];
  const services={
    profileReady() {events.push("auth");return isReady;},
    profileId() {return profileId;},
    listProjects() {return entries.map(p=>({id:p.id,title:p.title,sourceKind:p.sourceKind||"user"})).filter(p=>!["example","synthetic"].includes(p.sourceKind));},
    listInventory() {return entries.map(p=>({id:p.id,title:p.title,sourceKind:p.sourceKind||"user"}));},
    activeProjectId() {return active;},
    readSnapshot(id) {events.push("read:"+id);return entries.find(p=>p.id===id) ?? null;},
    switchProject(id) {events.push("switch:"+id);if(failure==="switch")throw Error("switch blocked");active=id;return entries.find(p=>p.id===id);},
    saveProject(next) {events.push("save:"+next.id); if(failure==="save")throw Error("save blocked"); const index=entries.findIndex(p=>p.id===next.id);entries[index]={...structuredClone(next),updatedAt:"new-timestamp"}; active=next.id;return entries[index];},
    async persistProject(id) {events.push("persist:"+id);if(failure==="persist")throw Error("encrypted commit declined");},
    async flushWrites() {events.push("flush");if(failure==="flush")throw Error("pending writes unavailable");},
  };
  return {services,events,entries,activeId:()=>active,setProfile:(v)=>{profileId=v;},setReady:(v)=>{isReady=v;}};
}

test("#2982 title review creates a proposal only, with exact prior title/ID/revision and no mutation",async()=>{
  const h=renameHarness();
  const cmd=parsePlotPickleCreativeCommand("PlotPickle rename selected-ppf-2982 to Brotherly Love");
  const unchanged=JSON.stringify(h.entries);
  const output=await executePlotPickleLibraryRename(cmd,h.services);
  assert.match(output,/NO CHANGE:/);
  assert.equal(JSON.stringify(h.entries),unchanged);
  assert.ok(!h.events.some(e=>e.startsWith("persist:")||e.startsWith("save:")));

  const preview=await executePlotPickleLibraryRename(parsePlotPickleCreativeCommand("PlotPickle rename selected-ppf-2982 to Brotherhoodly Love"),h.services);
  assert.match(preview,/TITLE RENAME PREVIEW/);
  assert.match(preview,/Saved PPF: Brotherly Love/);
  assert.match(preview,/Project ID: selected-ppf-2982/);
  assert.match(preview,/Revision: 6/);
  assert.match(preview,/PlotPickle confirm rename selected-ppf-2982 revision 6 from "Brotherly Love" to "Brotherhoodly Love"/);
  assert.equal(JSON.stringify(h.entries),unchanged);
  assert.ok(!h.events.some(e=>e.startsWith("persist:")||e.startsWith("switch:")||e.startsWith("save:")));
});
test("#2982 confirmed exact title edit uses the existing Library Save, authenticated encrypted commit, and preserves film",async()=>{
  const h=renameHarness();
  const old=structuredClone(h.entries[0]);
  const preview=await executePlotPickleLibraryRename({action:"rename",projectId:old.id,title:"Brotherly Love — Feature"},h.services);
  const confirm=preview.trim().split("\n").at(-1);
  const parsed=parsePlotPickleCreativeCommand(confirm);
  assert.equal(parsed.action,"confirm-rename");
  assert.equal(parsed.previousTitle,old.title);
  const done=await executePlotPickleLibraryRename(parsed,h.services);
  assert.match(done,/TITLE RENAME VERIFIED/);
  assert.match(done,/Next: PlotPickle plan Block 01/);
  assert.equal(h.activeId(),old.id);
  const now=h.entries[0];
  assert.equal(now.id,old.id);
  assert.equal(now.title,"Brotherly Love — Feature");
  for(const key of ["structure","sourceEvidence","writing","storyIntent"]) assert.deepEqual(now[key],old[key],key+" must survive");
  assert.deepEqual(h.events.filter(x=>x.startsWith("switch:")||x.startsWith("save:")||x.startsWith("persist:")),
    ["switch:selected-ppf-2982","save:selected-ppf-2982","persist:selected-ppf-2982"]);
  assert.ok(h.events.filter(x=>x==="flush").length>=2);
});
test("#2982 rename refuses staleness, mismatched old title and identity without unintended writes",async()=>{
  for(const mutation of ["revision","old-title","wrong-id","missing","duplicate-new-title"]){
    const p=project(),other={...project(),id:"another",title:"Afterglow"};
    const h=renameHarness({records:mutation==="duplicate-new-title"?[p,other]:[p]});
    const preview=await executePlotPickleLibraryRename({action:"rename",projectId:p.id,title:"Afterglow"},h.services);
    if(mutation==="duplicate-new-title"){assert.match(preview,/BLOCKED: Another saved Library PPF/);continue;}
    const cmd={action:"confirm-rename",projectId:p.id,revision:p.revision,previousTitle:p.title,title:"Afterglow"};
    if(mutation==="revision")h.entries[0].revision++;
    if(mutation==="old-title")h.entries[0].title="Updated without revision";
    if(mutation==="wrong-id")cmd.projectId="unrelated";
    if(mutation==="missing")h.entries.length=0;
    const result=await executePlotPickleLibraryRename(cmd,h.services);
    assert.match(result,/BLOCKED/);
    assert.ok(!h.events.some(e=>e.startsWith("save:")||e.startsWith("persist:")));
  }
});
test("#2982 title rename must not select examples, change another active story, or run against locked/wrong profile",async()=>{
  const saved=project(),example={...project(),id:"reference",sourceKind:"example",title:"Afterglow"};
  for(const config of [{records:[example],selected:null,profile:"profile_verified"},
    {records:[saved],selected:"other-project",profile:"profile_verified"},
    {records:[saved],selected:null,ready:false,profile:"profile_verified"}]){
    const h=renameHarness(config);
    const id=config.records[0].id;
    const result=await executePlotPickleLibraryRename({action:"rename",projectId:id,title:"Brotherly Love"},h.services);
    assert.match(result,/BLOCKED|NO CHANGE/);
    assert.ok(!h.events.some(e=>e.startsWith("save:")||e.startsWith("persist:")||e.startsWith("switch:")));
  }
  const h=renameHarness();
  const cmd={action:"confirm-rename",projectId:saved.id,previousTitle:saved.title,revision:saved.revision,title:"Renamed Film"};
  const flush=h.services.flushWrites;
  h.services.flushWrites=async()=>{h.setProfile("other-profile");return flush();};
  const output=await executePlotPickleLibraryRename(cmd,h.services);
  assert.match(output,/Profile or active project changed/);
  assert.ok(!h.events.some(e=>e.startsWith("save:")||e.startsWith("persist:")));
});
test("#2982 encrypted write or Library Save failure cannot be presented as a verified rename",async()=>{
  const cmd={action:"confirm-rename",projectId:"selected-ppf-2982",revision:6,previousTitle:"Brotherly Love",title:"Renamed Film"};
  for(const failure of ["flush","switch","save","persist"]){
    const h=renameHarness({failure});
    const text=await executePlotPickleLibraryRename(cmd,h.services);
    assert.match(text,/BLOCKED/);
    assert.doesNotMatch(text,/TITLE RENAME VERIFIED/);
    if(failure==="flush")assert.ok(!h.events.some(e=>e.startsWith("save:")||e.startsWith("switch:")));
  }
});
test("#2982 title-confirmation parser does not mistake free-form narration for authority",()=>{
  assert.equal(parsePlotPickleCreativeCommand("Rename Brotherly Love to my film"),null);
  const preview=parsePlotPickleCreativeCommand("PlotPickle rename selected-ppf-2982 to Brotherly Love");
  assert.deepEqual(preview,{action:"rename",projectId:"selected-ppf-2982",title:"Brotherly Love"});
  const confirm=parsePlotPickleCreativeCommand('PlotPickle confirm rename selected-ppf-2982 revision 6 from "Old Title" to "Brotherly Love"');
  assert.deepEqual(confirm,{action:"confirm-rename",projectId:"selected-ppf-2982",revision:6,previousTitle:"Old Title",title:"Brotherly Love"});
  for(const command of ["PlotPickle rename bad id to New Title","PlotPickle confirm rename abc revision x from \"Old\" to \"New\"",
    "PlotPickle confirm rename abc revision 6 to New","PlotPickle rename bad/id to New"]) {
    assert.notEqual(parsePlotPickleCreativeCommand(command)?.action,"confirm-rename");
    assert.notEqual(parsePlotPickleCreativeCommand(command)?.action,"rename");
  }
});
test("#2982 Command title changes use the existing profile-owned Library Save and never bypass DSDD or media gates",async()=>{
  const [ui,core,lib]=await Promise.all([
    readFile(new URL("../app/skin-v1/global-dsdd-conversation.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/_components/settings/plotpickle-creative-command.mjs",import.meta.url),"utf8"),
    readFile(new URL("../core/storage/project-library-browser.ts",import.meta.url),"utf8"),
  ]);
  assert.match(ui,/saveProject:\s*saveActiveLibraryProject/);
  assert.match(ui,/persistProject:\s*\(projectId\?:\s*string\)\s*=>\s*persistActiveProfileProject\("", projectId \|\| ""\)/);
  assert.match(ui,/await executePlotPickleLibraryRename\(command, services\)/);
  assert.match(lib,/export function saveActiveLibraryProject\(/);
  assert.match(core,/const saved = services\.saveProject\(\{\s*\.\.\.check,\s*title:\s*targetTitle\s*\}\)/);
  assert.match(core,/await services\.persistProject\(id\)/);
  assert.match(core,/await services\.flushWrites\(\)/);
  assert.doesNotMatch(core,/\bfetch\(|\/api\/storyboard|\/api\/local-ai\//);
});

function inspectHarness({ record, ready = true, profile = "human-profile", mismatch = false } = {}) {
  const imported = record ?? {
    ...project(), id: "synthetic-import-ppt", title: "-", revision: 4,
    sourceEvidence: {
      screenplay: {
        sourceFileName: "Brotherly-Love-original.fdx",
        sourceFormat: "Final Draft",
        analysisStatus: "suggested",
        totalPassageCount: 42,
        storedPassageCount: 2,
        passagesTruncated: true,
        passages: [
          { id: "p1", type: "scene-heading", text: "INT. STUDIO - NIGHT" },
          { id: "p2", type: "action", text: "Two brothers talk about their future." },
        ],
        sectionMarkers: [{ id:"sc1", title:"ACT ONE", page:1 }],
      },
    },
  };
  const calls=[];
  const services = {
    profileReady() { calls.push("auth"); return ready; },
    profileId() { return profile; },
    listInventory() { calls.push("inventory"); return [{id:imported.id,title:imported.title,
      sourceKind:"import",sourceId:"Brotherly-Love-original.fdx"}]; },
    readSnapshot(id) {calls.push("read:"+id); return mismatch ? {...imported,title:"mismatch"} : id===imported.id ? imported : null; },
    switchProject() { throw new Error("inspect must not switch project"); },
    saveProject() { throw new Error("inspect must not save project"); },
    persistProject() { throw new Error("inspect must not write encrypted profile"); },
    flushWrites() { throw new Error("inspect must not flush or mutate"); },
  };
  return { imported, services, calls };
}
test("#2982 screenshot UAT imported dash-title PPF inspected without selecting, renaming or creating a story", () => {
  const h=inspectHarness();
  const before=JSON.stringify(h.imported);
  const parsed=parsePlotPickleCreativeCommand("PlotPickle inspect synthetic-import-ppt");
  assert.deepEqual(parsed,{action:"inspect",projectId:"synthetic-import-ppt"});
  const response=inspectPlotPickleLibraryProject(parsed,h.services);
  assert.match(response,/SAVED PPF INSPECTION · read-only/);
  assert.match(response,/Library title: -/);
  assert.match(response,/Library classification: import/);
  assert.match(response,/Screenplay filename: Brotherly-Love-original.fdx/);
  assert.match(response,/42 total, 2 retained, truncated: yes/);
  assert.match(response,/INT\. STUDIO - NIGHT/);
  assert.match(response,/None of this proves a particular film identity automatically/);
  assert.match(response,/No PPF was selected, saved, renamed, restored or modified/);
  assert.deepEqual(h.calls,["auth","inventory","read:synthetic-import-ppt","auth"]);
  assert.equal(JSON.stringify(h.imported),before);
});
test("#2982 imported PPF identification remains explicitly unproven if no screenplay provenance exists", () => {
  const h=inspectHarness({record:{...project(),id:"import-dash",title:"-",sourceEvidence:{screenplay:null}}});
  const response=inspectPlotPickleLibraryProject({action:"inspect",projectId:"import-dash"},h.services);
  assert.match(response,/SCREENPLAY IDENTITY UNPROVEN/);
  assert.match(response,/not recorded/);
  assert.doesNotMatch(response,/Screenplay filename: Brotherly/);
  assert.ok(!h.calls.some(c=>/save|switch|persist|flush/u.test(c)));
});
test("#2982 PPF inspect refuses stale title, another ID, and unhydrated profile without showing private story material",()=>{
  for (const v of [{ready:false},{mismatch:true}]){
    const h=inspectHarness(v);
    const result=inspectPlotPickleLibraryProject({action:"inspect",projectId:"synthetic-import-ppt"},h.services);
    assert.match(result,/BLOCKED/);
    assert.doesNotMatch(result,/Two brothers|Studio|ACT ONE/);
  }
  const h=inspectHarness();
  const other=inspectPlotPickleLibraryProject({action:"inspect",projectId:"unknown-id"},h.services);
  assert.match(other,/BLOCKED/);
  assert.doesNotMatch(other,/Brotherly-Love-original/);
  assert.equal(parsePlotPickleCreativeCommand("PlotPickle inspect bad/id"),null);
  assert.equal(parsePlotPickleCreativeCommand("Investigate my imported PPF"),null);
});
test("#2982 inspector observes current-profile authority again before returning any screenplay evidence",()=>{
  const h=inspectHarness();
  let authCount=0;
  h.services.profileReady=()=>++authCount===1;
  const result=inspectPlotPickleLibraryProject({action:"inspect",projectId:"synthetic-import-ppt"},h.services);
  assert.match(result,/BLOCKED: The authenticated Human profile changed/);
  assert.doesNotMatch(result,/Brothers|ACT ONE|original\.fdx/);
});
test("#2982 real Command inspector reuses only read-only authenticated Library owners",async()=>{
  const [ui,projectCore]=await Promise.all([
    readFile(new URL("../app/skin-v1/global-dsdd-conversation.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/_components/settings/plotpickle-creative-command.mjs",import.meta.url),"utf8"),
  ]);
  assert.match(ui,/inspectPlotPickleLibraryProject\(command, services\)/);
  assert.match(ui,/listInventory: listPersistableLibraryProjects/);
  assert.match(ui,/readSnapshot: loadLibraryProjectSnapshot/);
  assert.match(ui,/profileReady:\s*\(\)\s*=>\s*profilePrivateBrowserReadyFor\(profileId\(\)\)/);
  assert.match(projectCore,/export function inspectPlotPickleLibraryProject\(/);
  const inspected=projectCore.slice(projectCore.indexOf("export function inspectPlotPickleLibraryProject("));
  assert.doesNotMatch(inspected,/services\.(?:switchProject|saveProject|persistProject|flushWrites)\(/);
  assert.doesNotMatch(inspected,/\bfetch\(|\/api\/storyboard|\/api\/local-ai\//);
});

test("#2982 Command accepts only explicit local-only Story Architect and read-only assessment reconciliation",()=>{
  assert.deepEqual(parsePlotPickleCreativeCommand("PlotPickle assess Block 01 local"),{action:"assess-local",blockNumber:1});
  assert.deepEqual(parsePlotPickleCreativeCommand("PlotPickle assessment Block 01"),{action:"assessment",blockNumber:1});
  assert.deepEqual(parsePlotPickleCreativeCommand("/plotpickle assess block 24 local"),{action:"assess-local",blockNumber:24});
  assert.equal(parsePlotPickleCreativeCommand("PlotPickle assess Block 25 local").action,"invalid");
  assert.equal(parsePlotPickleCreativeCommand("PlotPickle assess Block 01 with OpenAI"),null);
  assert.equal(parsePlotPickleCreativeCommand("PlotPickle assess Block 01 cloud"),null);
  assert.equal(parsePlotPickleCreativeCommand("Just create my movie with no cost"),null);
});

test("#2982 Command executes real Story Architect owner and imports only host-validated protected findings",async()=>{
  const [ui,gateway,handler,browser,assessment,save]=await Promise.all([
    readFile(new URL("../app/skin-v1/global-dsdd-conversation.tsx",import.meta.url),"utf8"),
    readFile(new URL("../build/projects/outline-task-gateway.ts",import.meta.url),"utf8"),
    readFile(new URL("../build/projects/outline-task-http.ts",import.meta.url),"utf8"),
    readFile(new URL("../modules/plan/assessments/outline-task-browser.ts",import.meta.url),"utf8"),
    readFile(new URL("../modules/plan/outline-agent-assessment.ts",import.meta.url),"utf8"),
    readFile(new URL("../core/storage/project-library/revision-safe-browser.ts",import.meta.url),"utf8"),
  ]);
  assert.match(ui,/await changeOutlineTask\("start-local", project, \{ blocks: \[command\.blockNumber\] \}\)/);
  assert.match(ui,/await readOutlineTasks\(\)/);
  assert.match(ui,/await importOutlineTaskFindings\(project, task\)/);
  assert.match(ui,/await saveFoundationProjectDurably\(next, project\.revision\)/);
  assert.match(ui,/await runCreativeAssessmentCommand\(submitted\)/);
  assert.match(gateway,/async startLocal\(auth: AuthContext, blocks: number\[\]\)/);
  assert.match(gateway,/\["local", "ollama"\]\.includes\(execution\.provider\)/);
  assert.match(gateway,/execution\.cloudCostUpperBoundUsd !== 0/);
  assert.match(gateway,/record\.computeReceipt !== execution\.receipt/);
  assert.match(handler,/input\.action === "start-local"/);
  assert.match(browser,/action === "start-local"/);
  assert.match(assessment,/validateOutlineAgentAssessment/);
  assert.match(save,/await flushProfilePrivateWrites\(\)/);
  assert.doesNotMatch(ui.slice(ui.indexOf("  async function runCreativeAssessmentCommand("),ui.indexOf("  function runCreativeDiscoveryCommand(")),/\/api\/writing-assistant\/chat|\/api\/cloud-story-mode|requestWriterApproval\(/);
});
