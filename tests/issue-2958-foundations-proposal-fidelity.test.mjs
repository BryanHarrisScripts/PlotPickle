import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";
import {
  assessMindMapProposalFidelity,
  requestMindMapFidelityProposal,
} from "../modules/learn/model/mind-map-proposal-fidelity.mjs";

const SOURCE = "The sisters alternate between their mother's household and their father's household.";
const GOOD = "The sisters leave their mother's household for their father's household every weekend.";
const FIELD = { topicId:"foundations", fieldId:"output-1", canonicalId:"development.foundations.synthetic", lessonId:"synthetic", prompt:"Describe the story premise in English.", lessonTitle:"Synthetic Foundations", scope:"project-wide" };
const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2958 TRUTH-FOUNDATIONS-PROPOSAL-001: preserves two explicitly separate households instead of 'respective parents'", () => {
  const collapsed = "The girls travel between their respective parents and receive guidance.";
  const verdict=assessMindMapProposalFidelity({topicId:"foundations",currentValue:SOURCE,fieldPrompt:FIELD.prompt,proposal:collapsed});
  assert.equal(verdict.ok,false);
  assert.match(verdict.issues.join(" "),/mother's household/u);
  assert.match(verdict.issues.join(" "),/father's household/u);
  assert.equal(assessMindMapProposalFidelity({topicId:"foundations",currentValue:SOURCE,fieldPrompt:FIELD.prompt,proposal:GOOD}).ok,true);
});

test("#2958 mixed unexpected Han and invented family wisdom reject an otherwise recognizable premise", () => {
  const mixed=GOOD+" 在未来，每个人都获得秘密智慧。 The mother's advice guides them.";
  const verdict=assessMindMapProposalFidelity({topicId:"foundations",currentValue:SOURCE,fieldPrompt:FIELD.prompt,proposal:mixed});
  assert.equal(verdict.ok,false);
  assert.match(verdict.issues.join(" "),/Chinese-script/u);
  assert.match(verdict.issues.join(" "),/unsupported parental guidance/u);
  assert.equal(assessMindMapProposalFidelity({topicId:"foundations",currentValue:"Describe this film in Chinese.",fieldPrompt:FIELD.prompt,proposal:"在未来，她发现新的世界。"}).ok,true,"an explicit Human Chinese-language request must not be rejected");
  assert.equal(assessMindMapProposalFidelity({topicId:"foundations",currentValue:"故事背景",fieldPrompt:FIELD.prompt,proposal:"故事设在未来。"}).ok,true,"Human text already in Han script is not an English-only premise");
});

test("#2958 bounded correction retries once and admits only a matching English suggestion", async () => {
  const asks=[];
  const candidates=[
    "They move between their respective parents. 今天故事开始。",
    GOOD
  ];
  const result=await requestMindMapFidelityProposal({topicId:"foundations",currentValue:SOURCE,fieldPrompt:FIELD.prompt,ask:async feedback => {asks.push(feedback);return candidates[asks.length-1];}});
  assert.equal(result.ok,true);
  assert.equal(result.attempts,2);
  assert.equal(result.proposal,GOOD);
  assert.equal(asks[0],"");
  assert.match(asks[1],/Chinese-script/u);
  assert.match(asks[1],/mother's household/u);
});

test("#2958 two invalid agent responses fail closed; cannot use an invalid candidate", async () => {
  let requests=0;
  const result=await requestMindMapFidelityProposal({topicId:"foundations",currentValue:SOURCE,fieldPrompt:FIELD.prompt,ask:async()=>{requests++;return "The children visit their parents."; }});
  assert.equal(requests,2);
  assert.equal(result.ok,false);
  assert.equal(result.proposal,"");
  assert.match(result.issues.join(" "),/father's household/u);
  assert.equal(assessMindMapProposalFidelity({topicId:"foundations",currentValue:SOURCE,fieldPrompt:FIELD.prompt,proposal:""}).ok,false);
  assert.equal(assessMindMapProposalFidelity({topicId:"world",currentValue:SOURCE,fieldPrompt:FIELD.prompt,proposal:"A different world."}).ok,true,"household guard must not be imposed on unrelated World fields");
});

async function renderRealMindMapHandler(candidates, options={}) {
  const source=await read("app/skin-v1/discovery-surface.tsx");
  const start=source.indexOf("  async function createCanonicalFieldProposal(");
  const end=source.indexOf("  async function useCanonicalFieldProposal(",start);
  assert.ok(start>=0 && end>start);
  const fn=stripTypeScriptTypes(source.slice(start,end));
  const events=[],currentValue=SOURCE,project={id:"synthetic-private-free",revision:7};
  const target=`${project.id}:7:1:${FIELD.canonicalId}`;
  const pending={current:target};
  const context={
    FIELD, fieldDrafts:{[`slot-${FIELD.canonicalId}-1`]:currentValue},
    project, developingFieldId:null, selectedAct:1,
    selectedCharacter:null, proposalTargetRef:pending,
    storyDevelopmentFieldStorageId:(field,act)=>`slot-${field.canonicalId}-${act}`,
    storyDevelopmentFieldView:()=>({value:currentValue}),
    setDevelopingFieldId:value=>events.push(["busy",value]),
    setNotice:value=>events.push(["notice",value]),
    setProposalDrafts:updater=>events.push(["proposal",updater({})]),
    hasActiveLibraryProject:()=>Boolean(options.active),
    loadActiveLibraryProject:()=>({id:project.id,revision:7}),
    compactProjectContext:()=>({project:{id:project.id}}),
    requestMindMapFidelityProposal,
    fetch:async(url,{body})=>{
      assert.equal(url,"/api/writing-assistant/chat");
      const prompt=JSON.parse(body).message;
      events.push(["request",prompt]);
      if(options.switchTargetOnResponse)pending.current="other-project:8:1:other-field";
      return {ok:true,json:async()=>({text:candidates.shift()??""})};
    },
    persistCanonicalProject:async()=>{events.push(["persist"]);return project;},
    writeStoryDevelopmentFieldProposal:()=>{events.push(["write-proposal"]);return project;},
    Error,JSON,
  };
  const run=vm.runInNewContext(fn+"\ncreateCanonicalFieldProposal",context);
  await run(FIELD);
  return {events,project};
}

test("#2958 actual Mind Map Ask Agent handler rejects both corrupt attempts before proposal/state persistence",async()=>{
  const {events}=await renderRealMindMapHandler(["The respective parents offer guidance. 中文。","The respective parents offer guidance. 中文。"]);
  assert.equal(events.filter(e=>e[0]==="request").length,2);
  assert.equal(events.some(e=>e[0]==="proposal"||e[0]==="persist"||e[0]==="write-proposal"),false);
  assert.match(events.find(e=>e[0]==="notice"&&/blocked/.test(e[1]))?.[1]??"",/Original Human Project Value was not changed/);
});

test("#2958 actual Ask Agent handler persists only repaired result as separate proposal, not Human accepted value",async()=>{
  const {events}=await renderRealMindMapHandler(["The respective parents meet. 中文。",GOOD],{active:true});
  assert.equal(events.filter(e=>e[0]==="request").length,2);
  assert.equal(events.filter(e=>e[0]==="write-proposal").length,1);
  assert.equal(events.filter(e=>e[0]==="persist").length,1);
  assert.equal(events.filter(e=>e[0]==="proposal").length,1);
  const proposed=events.find(e=>e[0]==="proposal")[1];
  assert.equal(proposed[`slot-${FIELD.canonicalId}-1`],GOOD);
  assert.match(events.find(e=>e[0]==="notice"&&/saved separately/.test(e[1]))?.[1]??"",/Human review/);
});

test("#2958 actual handler refuses stale asynchronous project/Act/field selection before writing proposal",async()=>{
  const {events}=await renderRealMindMapHandler([GOOD],{active:true,switchTargetOnResponse:true});
  assert.equal(events.filter(e=>e[0]==="proposal"||e[0]==="persist"||e[0]==="write-proposal").length,0);
  assert.match(events.find(e=>e[0]==="notice"&&/not saved/.test(e[1]))?.[1]??"",/target project, revision or Act changed/);
});

test("#2958 legacy unscreened Use Suggestion path rechecks current Human premise before adoption",async()=>{
  const source=await read("app/skin-v1/discovery-surface.tsx");
  const start=source.indexOf("  async function useCanonicalFieldProposal(");
  const end=source.indexOf("  if (!project) {",start);
  assert.ok(start>0&&end>start);
  const fn=stripTypeScriptTypes(source.slice(start,end));
  let saves=0;const notices=[];
  const context={
    project:{id:"synthetic"},selectedAct:1,
    fieldDrafts:{[`slot-${FIELD.canonicalId}-1`]:SOURCE},
    proposalDrafts:{[`slot-${FIELD.canonicalId}-1`]:"The sisters visit their respective parents."},
    storyDevelopmentFieldStorageId:(field,act)=>`slot-${field.canonicalId}-${act}`,
    storyDevelopmentFieldView:()=>({value:SOURCE,proposal:""}),
    assessMindMapProposalFidelity,
    setNotice:x=>notices.push(x),
    persistCanonicalProject:async()=>{saves++;return {};},
    writeStoryDevelopmentFieldProposal:()=>{throw Error("must not stage invalid");},
    acceptStoryDevelopmentFieldProposal:()=>{throw Error("must not accept invalid");},
  };
  const fnCall=vm.runInNewContext(fn+"\nuseCanonicalFieldProposal",context);
  await fnCall(FIELD);
  assert.equal(saves,0);
  assert.match(notices.at(-1),/does not satisfy/);
});

test("#2958 fidelity gate is limited evidence, not a claim of arbitrary semantic equivalence",async()=>{
  const surface=await read("app/skin-v1/discovery-surface.tsx");
  assert.match(surface,/requestMindMapFidelityProposal\(/);
  assert.match(surface,/screened\.ok/);
  assert.match(surface,/assessMindMapProposalFidelity\(/);
  assert.match(surface,/Do not claim the proposal is accepted canon/);
  assert.match(surface,/acceptStoryDevelopmentFieldProposal/);
  assert.match(surface,/Original Human Project Value was not changed/);
});
