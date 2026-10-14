import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parsePlotPickleCreativeCommand,
  describePlotPickleCreativeCommand,
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
