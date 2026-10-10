import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {afterglowChoiceKind,partitionAfterglowChoices}
  from "../modules/library/afterglow-creative-choice-boundary.mjs";
import {planAfterglowConsolidation,reviewAfterglowConsolidationDecisions}
  from "../modules/library/afterglow-consolidation.mjs";

const competing=(path, options=["October 7","October 8"])=>({
  path,reason:"competing-values",options,optionSources:["point:oct7","working-oct8"],
  sources:["point:oct7","working-oct8"],
});
const technical=[
  competing("/build/foundations/visualArtifacts/@id:abc/sourceDecisionKeys",[
    ["approval:one","recovery-origin:abc"],["approval:two","recovery-origin:def"]
  ]),
  competing("/build/foundations/visualArtifacts/@id:def/updatedAt"),
  competing("/build/foundations/visualArtifacts/@id:ghi/pitch"),
  competing("/build/foundations/visualArtifacts/@id:ghi/id"),
  competing("/production/graphicNovelTextApprovals"),
  competing("/sourceEvidence/characterTruth/claims/@id:joy/reviewState"),
];
const narration=competing("/production/graphicNovelTextApprovals/@approval:storyboard-anchor:block:block-01:mini-1:position:2",[
  {anchorRef:"storyboard-anchor:block:block-01:mini-1",position:2,narration:"",noText:true},
  {anchorRef:"storyboard-anchor:block:block-01:mini-1",position:2,narration:"Joy recognizes Kai.",noText:false},
]);
const answer=competing("/world/lessons/genres/answers/output-1",["Drama","Drama and adventure"]);

test("#2863 approval lineage, image metadata, timestamps and arbitrary project arrays never become Human creative votes",()=>{
  for(const item of technical)assert.equal(afterglowChoiceKind(item),"verification",item.path);
  const result=partitionAfterglowChoices([...technical,narration,answer],[]);
  assert.equal(result.verification.length,technical.length);
  assert.deepEqual(result.human.map(x=>x.creativeKind),["narration","answer"]);
  assert.equal(result.inRecovered.length,0);
  assert.ok(result.verification.includes(technical[0]),"all opaque conflicts survive for independent verification");
  assert.ok(result.verification.includes(technical[3]),"no metadata may be silently dropped");
  assert.equal(afterglowChoiceKind(competing("/storyDevelopment/fields/theme",[
    {updatedAt:"2026-10-08"},{updatedAt:"2026-10-09"}
  ])),"verification","opaque field metadata is not a creative choice");
  assert.equal(afterglowChoiceKind(competing("/production/graphicNovelTextApprovals/@approval:shot:position:1",[
    {sourceKey:"hash-a"},{sourceKey:"hash-b"}
  ])),"verification","unreadable caption metadata cannot be chosen as dialogue");
});
test("#2863 canonical Mind Map field choices are presented in their consolidated group once",()=>{
  const field=competing("/storyDevelopment/fields/character:character-engine:output-1",[
    {value:"Joy chooses Kai",acceptedSource:"human"},
    {value:"Joy confronts Kai",acceptedSource:"human"},
  ]);
  const result=partitionAfterglowChoices([...technical,field,narration],
    [field.path]);
  assert.deepEqual(result.inRecovered.map(x=>x.path),[field.path]);
  assert.deepEqual(result.human.map(x=>x.path),[narration.path]);
  assert.equal(result.verification.length,technical.length);
  assert.equal(afterglowChoiceKind({...answer,reason:"overlapping-paths"}),"verification");
});
test("#2863 creative selection changes the proposed outcome but never edits the original saved snapshot",()=>{
  const reference={
    format:"2.0-foundation",id:"baseline",revision:0,
    sourceEvidence:{referenceFixture:{sourceId:"afterglow-v9-complete-baseline"}},
    world:{lessons:{genres:{answers:{"output-1":"Drama"}}}},
    production:{graphicNovelTextApprovals:[]},storyDevelopment:{fields:{}},
    mindMapNotes:{fields:{},topics:{}},
  };
  const source=(id,text,stamp)=>{
    const project=structuredClone(reference);project.id=id;project.updatedAt=stamp;
    project.world.lessons.genres.answers["output-1"]=text;return {project};
  };
  const a=source("copy-a","Drama / action","2026-10-07T12:00:00Z");
  const b=source("copy-b","Drama / mystery","2026-10-08T12:00:00Z");
  const unchanged=structuredClone([a,b]);
  const plan=planAfterglowConsolidation({baseline:reference,sources:[a,b]});
  const path="/world/lessons/genres/answers/output-1";
  const outcomeA=reviewAfterglowConsolidationDecisions(plan,{[path]:0});
  const outcomeB=reviewAfterglowConsolidationDecisions(plan,{[path]:1});
  assert.equal(outcomeA.candidate.world.lessons.genres.answers["output-1"],"Drama / action");
  assert.equal(outcomeB.candidate.world.lessons.genres.answers["output-1"],"Drama / mystery");
  assert.deepEqual([a,b],unchanged);
  assert.equal(outcomeA.readyForHumanCommit,false);
  assert.equal(outcomeB.readyForHumanCommit,false);
});
test("#2863 consolidated creative work appears before advanced verification, with selected outcome and expandable history",async()=>{
  const ui=await readFile(new URL("../modules/library/ui/afterglow-management-panel.tsx",import.meta.url),"utf8");
  const title=ui.indexOf("CONSOLIDATED creative work");
  const technical=ui.indexOf("Save Consolidated Afterglow verifies");
  assert.ok(title>0&&technical>title);
  assert.match(ui,/partitionAfterglowChoices\(preview\?\.conflicts/u);
  assert.match(ui,/YOUR CHOICE — included in consolidated draft/u);
  assert.match(ui,/readableCreativeChoice\(conflict\.options\?\.\[Number\(decisions\[conflict\.path\]\)\]\)/u);
  assert.match(ui,/savedAlternatives/u);
  assert.match(ui,/technical differences remain for independent verification/u);
  assert.doesNotMatch(ui,/Advanced verification details|Unresolved review items \(first 35\)/u);
  assert.doesNotMatch(ui,/This saved alternative needs a more specific creative description before it can be selected here/u);
  assert.match(ui,/saved approvals automatically/u);
  assert.doesNotMatch(ui,/commitAfterglowMaster\(/u);
});
