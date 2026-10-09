import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {summarizeAfterglowSavedVersion} from "../modules/library/afterglow-version-summary.mjs";

const field=(topicId,lessonId,index,scope="project-wide")=>({
  topicId,lessonId,fieldId:"output-"+index,
  canonicalId:topicId+":"+lessonId+":output-"+index,
  scope,validActs:[1,2,3,4],
});
const fields=[
  ...Array.from({length:9},(_,i)=>field("foundations","premise",i+1)),
  ...Array.from({length:9},(_,i)=>field("world","genres",i+1)),
  ...Array.from({length:9},(_,i)=>field("character","relationships",i+1,"repeatable-by-act")),
];
function empty(id="copy") {
  return {
    id,foundations:{lessons:{premise:{answers:{}}}},
    world:{lessons:{genres:{answers:{}}}},
    storyDevelopment:{fields:{}},mindMapNotes:{fields:{},topics:{}},
  };
}
const values=(ids)=>ids.map(id=>({id,text:"Saved context "+id}));
const contextForField=(f,act)=> {
  if(f.topicId==="foundations")return values(["context-a","context-b"]);
  if(f.topicId==="world")return values(["context-b","context-c"]);
  if(f.topicId==="character")return values(act===2?["context-e"]:["context-d"]);
  return [];
};
test("#2863 saved copy brief uses canonical 9/27 fields and five distinct contexts",()=>{
  const p=empty("oct-08");
  for(let i=1;i<=3;i++)p.foundations.lessons.premise.answers["output-"+i]="Foundation "+i;
  for(let i=1;i<=3;i++)p.world.lessons.genres.answers["output-"+i]="Genre "+i;
  p.storyDevelopment.fields["character:relationships:output-1"]={value:"Joy and Kai"};
  p.storyDevelopment.fields["character:relationships:output-2::act-2"]={value:"Kai meets Jai"};
  p.mindMapNotes.fields["world:genres:output-1"]={text:"Keep trope"};
  p.storyDevelopment.fields["character:relationships:output-3"]={value:"",proposal:"Only a suggestion"};
  const report=summarizeAfterglowSavedVersion({project:p,fields,contextForField});
  assert.equal(report.completedFields,8);
  assert.equal(report.possibleFields,27);
  assert.equal(report.contextCount,5);
  assert.equal(report.noteCount,1);
  assert.equal(report.suggestionCount,1);
  assert.deepEqual(report.topicBreakdown,[
    {topicId:"foundations",count:3},
    {topicId:"world",count:3},
    {topicId:"character",count:2},
  ]);
  assert.equal(report.readOnly,true);
});
test("#2863 different saved copies are inspected independently, without cumulative false positives",()=>{
  const base=empty("oct-07");
  const changed=structuredClone(base);
  changed.id="oct-09";
  changed.world.lessons.genres.answers["output-1"]="Mystery";
  const unchanged=structuredClone([base,changed]);
  const read=p=>summarizeAfterglowSavedVersion({project:p,fields,contextForField});
  assert.equal(read(base).completedFields,0);
  assert.equal(read(changed).completedFields,1);
  assert.equal(read(changed).possibleFields,27);
  assert.deepEqual([base,changed],unchanged);
});
test("#2863 prompts, notes and unaccepted Agent proposals are not counted as authored values",()=>{
  const p=empty();
  p.storyDevelopment.fields["character:relationships:output-1"]={value:"",proposal:"Agent text only"};
  p.mindMapNotes.topics.world={text:"Research note"};
  const report=summarizeAfterglowSavedVersion({project:p,fields,contextForField});
  assert.equal(report.completedFields,0);
  assert.equal(report.contextCount,0);
  assert.equal(report.noteCount,1);
  assert.equal(report.suggestionCount,1);
});
test("#2863 arbitrary N unique saved copies need no fixed date or copy count",()=>{
  const copies=Array.from({length:50},(_,i)=>{
    const p=empty("copy-"+i);
    for(let j=1;j<=(i%9)+1;j++)p.world.lessons.genres.answers["output-"+j]="Authored "+i+" / "+j;
    return p;
  });
  for(let i=0;i<copies.length;i++)assert.equal(
    summarizeAfterglowSavedVersion({project:copies[i],fields,contextForField}).completedFields,(i%9)+1
  );
});
test("#2863 version inventory is placed beside saved dates in Afterglow Management only",async()=>{
  const ui=await readFile(new URL("../modules/library/ui/afterglow-management-panel.tsx",import.meta.url),"utf8");
  assert.match(ui,/const sourceSummaries = useMemo/u);
  assert.match(ui,/loadLibraryProjectSnapshot\(source.id\)/u);
  assert.match(ui,/summarizeAfterglowSavedVersion\(/u);
  assert.match(ui,/relevantProjectContextForField/u);
  assert.match(ui,/sourceSummaries\.get\(source\.id\)/u);
  assert.match(ui,/Mind Map fields with saved answers/u);
  assert.match(ui,/distinct context references/u);
  assert.match(ui,/topicBreakdown\.slice\(0, 4\)/u);
  assert.doesNotMatch(ui,/commitAfterglowMaster|deleteArchivedLibraryProject/u);
});
