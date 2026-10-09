import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {afterglowReviewProgress, afterglowImageSlotKey,
  selectAfterglowImageOption,resetAfterglowImageSlot}
from "../modules/library/afterglow-review-progress.mjs";

const genre="/world/lessons/genres/answers/output-1";
const theme="/storyDevelopment/fields/theme";
const narration="/production/graphicNovelTextApprovals/@approval:shot-1";
const group=(id,label,items)=>({id,label,items});
const rows=[
  group("world","World-building",[
    {id:"genre",label:"Genre",reviewPath:genre},
    {id:"theme",label:"Theme",reviewPath:theme},
    {id:"opaque",label:"Old approval timestamp",reviewPath:null},
  ]),
];
const versions=[
  {key:"ren-a",id:"a",characterId:"ren",characterName:"Ren",view:"right"},
  {key:"ren-b",id:"b",characterId:"ren",characterName:"Ren",view:"right"},
  {key:"ren-front",id:"front",characterId:"ren",characterName:"Ren",view:"front"},
  {key:"joy-a",id:"c",characterId:"joy",characterName:"Joy",view:"right"},
];
const input=(patch={})=>({
  groups:rows,candidatePaths:[genre],conflictPaths:[theme],
  confirmations:{},exclusions:[],decisions:{},
  extraConflicts:[{path:narration,label:"Graphic novel dialogue"}],
  imageOptions:versions,imageChoices:{},...patch,
});

test("#2863 current saved values are yellow, not implicitly confirmed",()=>{
  const progress=afterglowReviewProgress(input());
  assert.equal(progress.total,6,"two fields + narration + three character views");
  assert.equal(progress.completed,0);
  assert.equal(progress.pending,6);
  assert.equal(progress.allCreativeDecided,false);
  assert.equal(progress.needsIndependentReview.length,1);
  assert.deepEqual(progress.sections.map(section=>[section.label,section.total]),
    [["World-building",2],["Narration & Graphic Novel",1],["Characters & Images",3]]);
});
test("#2863 3 of 5 selections never permits a master save",()=>{
  const progress=afterglowReviewProgress(input({
    imageOptions:versions.slice(0,2),extraConflicts:[],
    confirmations:{[genre]:true},
    decisions:{[theme]:0},
    imageChoices:{"ren-a":"keep","ren-b":"exclude"},
  }));
  assert.equal(progress.total,3);
  assert.equal(progress.completed,3);
  const partial=afterglowReviewProgress(input({
    imageOptions:versions,extraConflicts:[],
    confirmations:{[genre]:true},decisions:{[theme]:0},
    imageChoices:{"ren-a":"keep","ren-b":"exclude"},
  }));
  assert.equal(partial.total,5);
  assert.equal(partial.completed,3);
  assert.equal(partial.pending,2);
  assert.equal(partial.allCreativeDecided,false);
});
test("#2863 selecting one image excludes competing versions and confirms exactly one character view",()=>{
  const selected=selectAfterglowImageOption(versions,{},"ren-b","keep");
  assert.deepEqual(selected,{"ren-a":"exclude","ren-b":"keep"});
  const before=structuredClone(selected);
  const result=afterglowReviewProgress(input({imageChoices:selected}));
  assert.equal(result.sections.find(section=>section.id==="images").completed,1);
  assert.deepEqual(selected,before);
  assert.equal(afterglowImageSlotKey(versions[0]),afterglowImageSlotKey(versions[1]));
  const changed=selectAfterglowImageOption(versions,selected,"ren-a","keep");
  assert.deepEqual(changed,{"ren-a":"keep","ren-b":"exclude"});
  assert.deepEqual(resetAfterglowImageSlot(versions,changed,afterglowImageSlotKey(versions[0])),{});
});
test("#2863 exclusions require explicit user action and all confirmed decisions count once",()=>{
  const all={...input(), confirmations:{[genre]:true},
    decisions:{[theme]:"baseline",[narration]:1},
    imageChoices:{"ren-a":"keep","ren-b":"exclude","ren-front":"exclude","joy-a":"exclude"}};
  const progress=afterglowReviewProgress(all);
  assert.equal(progress.completed,progress.total);
  assert.equal(progress.pending,0);
  assert.equal(progress.allCreativeDecided,true);
  assert.throws(()=>afterglowReviewProgress({...all,
    imageChoices:{"ren-a":"keep","ren-b":"keep","ren-front":"exclude","joy-a":"exclude"}}),
    /Only one image version/u);
  assert.equal(afterglowReviewProgress({...all,decisions:{[theme]:"baseline"}}).allCreativeDecided,false);
});
test("#2863 UI shows rolling section truth and remains non-authorizing without verified durable transaction",async()=>{
  const ui=await readFile(new URL("../modules/library/ui/afterglow-management-panel.tsx",import.meta.url),"utf8");
  assert.match(ui,/afterglowReviewProgress\(/u);
  assert.match(ui,/reviewProgress\.completed\} of \{reviewProgress\.total\}/u);
  assert.match(ui,/reviewProgress\.sections\.map/u);
  assert.match(ui,/data-afterglow-decision-state/u);
  assert.match(ui,/Confirm current/u);
  assert.match(ui,/selectAfterglowImageOption/u);
  assert.match(ui,/View other saved versions/u);
  assert.match(ui,/confirmedCurrent/u);
  assert.match(ui,/All required choices must be decided/u);
  assert.match(ui,/No Save Current Master action is enabled/u);
  assert.doesNotMatch(ui,/commitAfterglowMaster\(/u);
});
