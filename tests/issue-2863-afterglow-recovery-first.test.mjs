import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { inventoryAfterglowRecoveredWork } from "../modules/library/afterglow-work-recovery.mjs";

const baseline = () => ({
  id:"packaged", updatedAt:"2026-10-01T00:00:00Z",
  foundations:{lessons:{"premise":{answers:{"output-1":"Existing premise"}}}},
  world:{lessons:{
    genres:{answers:{"output-1":"Science fiction"}},
    "story-bible":{answers:{"output-1":"Original world authority"}},
    locations:{answers:{"output-1":"The station"}},
  }},
  storyDevelopment:{fields:{"character:characters-engine:output-1":{
    value:"Joy wants to survive.",acceptedSource:"human",proposal:"",updatedAt:"2026-10-01"
  }}},
  mindMapNotes:{topics:{},fields:{}},
  worldMap:{characterVisuals:[]},
});
const fields = [
  {canonicalId:"world:genres:output-1",topicId:"world",lessonId:"genres",lessonTitle:"Genre and tropes",fieldId:"output-1"},
  {canonicalId:"world:story-bible:output-1",topicId:"world",lessonId:"story-bible",lessonTitle:"Story Bible",fieldId:"output-1"},
  {canonicalId:"world:locations:output-1",topicId:"world",lessonId:"locations",lessonTitle:"Locations",fieldId:"output-1"},
  {canonicalId:"foundations:premise:output-1",topicId:"foundations",lessonId:"premise",lessonTitle:"Premise",fieldId:"output-1"},
  {canonicalId:"character:characters-engine:output-1",topicId:"character",lessonId:"characters-engine",lessonTitle:"Character engine",fieldId:"output-1"},
  {canonicalId:"character:characters-cast-system:output-1",topicId:"character",lessonId:"characters-cast-system",lessonTitle:"Character cast",fieldId:"output-1"},
];
function copy(id,update) {
  const project=structuredClone(baseline());
  project.id=id;
  project.updatedAt="2026-10-09T12:00:00Z";
  update(project);
  return {project};
}
const report = sources=>inventoryAfterglowRecoveredWork({baseline:baseline(),sources,fields});
const group = (r,id)=>r.groups.find(item=>item.id===id);
const note = (id,text)=>({text,updatedAt:"2026-10-09T12:00:00Z"});

test("#2863 recovering saved Mind Map work reads legacy World, Story Bible and character state without inventing values",()=>{
  const first=copy("older",project=>{
    project.world.lessons.genres.answers["output-1"]="Science fiction, mystery and found-family tropes";
    project.world.lessons.locations.answers["output-1"]="Hidden station behind the lake";
    project.storyDevelopment.fields["character:characters-engine:output-1"]={
      value:"Joy protects Kai.",acceptedSource:"agent-proposal",proposal:"",updatedAt:"2026-10-08",
    };
    project.storyDevelopment.fields["character:characters-cast-system:output-1"]={
      value:"Kai and Jai each pursue a different choice.",acceptedSource:"human",proposal:"",updatedAt:"2026-10-08",
    };
    project.mindMapNotes.fields["world:story-bible:output-1"]=note("x","Keep the village rumor.");
    project.worldMap.characterVisuals=[{
      characterId:"joy",characterName:"Joy",references:[{id:"joy-front",view:"front-full-body",
        reviewState:"approved",assetUrl:"/api/local-ai/assets/joy.webp",versionId:"v1"}],
      lockedVersionId:"v1",
    }];
  });
  const newer=copy("newer",project=>{
    project.world.lessons.genres.answers["output-1"]="Science fiction, mystery and found-family tropes";
    project.world.lessons["story-bible"].answers["output-1"]="The lake holds the town's memories";
    project.storyDevelopment.fields["character:characters-engine:output-1"].updatedAt="2026-10-09";
    project.storyDevelopment.fields["character:characters-engine:output-1"].proposal="Joy faces the truth.";
  });
  const original=structuredClone([first,newer]);
  const result=report([newer,first]);
  const genres=group(result,"genres");
  assert.equal(genres.items.length,1);
  assert.equal(genres.items[0].alternatives.length,1,"same saved value deduplicates");
  assert.deepEqual(genres.items[0].alternatives[0].sources.map(item=>item.id).sort(),["newer","older"]);
  assert.equal(group(result,"world").items[0].alternatives[0].text,"Hidden station behind the lake");
  assert.equal(group(result,"story-bible").items[0].alternatives[0].text,"The lake holds the town's memories");
  const characters=group(result,"character").items;
  assert.ok(characters.some(item=>item.alternatives.some(v=>v.text==="Joy protects Kai.")));
  assert.ok(characters.some(item=>item.alternatives.some(v=>v.text.includes("Kai and Jai"))));
  const agent=characters.find(item=>item.kind==="unaccepted-agent-suggestion");
  assert.equal(agent.alternatives[0].text,"Joy faces the truth.","unaccepted proposal must not become accepted canon");
  assert.equal(group(result,"notes").items[0].alternatives[0].text,"Keep the village rumor.");
  assert.ok(group(result,"visuals").items.some(item=>item.kind==="saved-image-reference"));
  assert.ok(group(result,"visuals").items.some(item=>item.kind==="saved-image-lock"));
  assert.deepEqual([first,newer],original,"inventory must never change existing saved copies");
  assert.equal(result.packageModified,false);
  assert.equal(result.readyForHumanCommit,false);
});
test("#2863 identical packaged answers do not appear as recovered edits",()=>{
  const saved=copy("unchanged",()=>{});
  const result=report([saved]);
  assert.equal(result.recoveredItemCount,0);
  assert.equal(result.differingValueCount,0);
});
test("#2863 competing saved answers are visible as separate sourced alternatives, never silently newest wins",()=>{
  const a=copy("old",p=>{p.world.lessons.genres.answers["output-1"]="Drama";});
  const b=copy("new",p=>{p.world.lessons.genres.answers["output-1"]="Mystery";});
  const result=report([a,b]), variants=group(result,"genres").items[0].alternatives;
  assert.deepEqual(variants.map(v=>v.text),["Drama","Mystery"]);
  assert.deepEqual(variants.map(v=>v.sources[0].id),["old","new"]);
  assert.equal(result.differingValueCount,1);
});
test("#2863 act/character scoped fields, legacy unknown IDs and proposals remain discoverable",()=>{
  const saved=copy("scoped",p=>{
    p.storyDevelopment.fields["character:characters-engine:output-1::character-joy"]={
      value:"Joy's relationship to Kai evolves.",proposal:"",updatedAt:"2026-10-09",
    };
    p.storyDevelopment.fields["world:locations:output-1::act-2"]={
      value:"The village disappears.",proposal:"",updatedAt:"2026-10-09",
    };
    p.storyDevelopment.fields["legacy-unmapped-ask-agent"]={
      value:"Old saved creative truth",proposal:"Another idea",updatedAt:"2026-10-09",
    };
  });
  const result=report([saved]);
  assert.ok(group(result,"character").items.some(item=>item.id.endsWith("::character-joy")));
  assert.ok(group(result,"world").items.some(item=>item.id.endsWith("::act-2")));
  assert.ok(group(result,"other").items.some(item=>item.kind==="unknown-field-answer"));
  assert.ok(group(result,"other").items.some(item=>item.kind==="unaccepted-agent-suggestion"));
});
test("#2863 arbitrary N saved copies are searched, rather than assuming four",()=>{
  const saved=Array.from({length:50},(_,i)=>copy("version-"+i,p=>{
    p.mindMapNotes.fields["note-"+i]=note("note-"+i,"Saved thought "+i);
  }));
  const result=report(saved);
  assert.equal(result.sourceCount,50);
  assert.equal(group(result,"notes").items.length,50);
});
test("#2863 readable recovery view is primary, advanced evidence remains optional, and publication stays separate",async()=>{
  const ui=await readFile(new URL("../modules/library/ui/afterglow-management-panel.tsx",import.meta.url),"utf8");
  const inventoryIndex=ui.indexOf('<section aria-label="Recovered Mind Map and character work"');
  const advancedIndex=ui.indexOf("<summary>Advanced consolidation diagnostics");
  assert.ok(inventoryIndex>=0&&advancedIndex>inventoryIndex);
  assert.match(ui,/inventoryAfterglowRecoveredWork/u);
  assert.match(ui,/An Agent suggestion is not automatically an accepted answer/u);
  assert.match(ui,/Original versions are unchanged/u);
  assert.match(ui,/separate, publisher-approved release/u);
  assert.match(ui,/Signing in and saving[\s\S]*never publishes it for everyone else/u);
  assert.match(ui,/Save Consolidated Afterglow verifies/u);
  assert.doesNotMatch(ui,/onClick=\{\(\) => void commitAfterglowMaster/u);
});

test("#2863 opening Afterglow continues the saved personal copy unless the Human explicitly starts a fresh reference",async()=>{
  const library=await readFile(new URL("../modules/library/ui/library-workspace.tsx",import.meta.url),"utf8");
  const chooser=await readFile(new URL("../modules/library/afterglow-open-contract.ts",import.meta.url),"utf8");
  assert.match(library,/latestAfterglowSavedChoice\(choices\)\?\.id \?\? "defaults"/u);
  assert.match(library,/setAfterglowOpening\(\{ item, choices \}\)/u);
  assert.match(library,/sourceId: AFTERGLOW_EXAMPLE_DEFAULTS_SOURCE_ID/u);
  assert.match(library,/Continue your saved personal Afterglow by default/u);
  assert.match(library,/Loading the provided example deliberately creates a new copy/u);
  assert.match(chooser,/\.filter\(\(choice\) => choice\.id === `saved:\$\{choice\.project\.id\}`/u);
  assert.doesNotMatch(library,/setAfterglowSource\("defaults"\);\s*setAfterglowOpening/u);
});

test("#2863 library opens only an authenticated, freshly verified Afterglow master, never stale browser choices",async()=>{
  const [library,browser,api,choices]=await Promise.all([
    "modules/library/ui/library-workspace.tsx",
    "core/storage/profile-private-browser.ts",
    "app/api/auth/profile-private/route.ts",
    "modules/library/afterglow-open-contract.ts",
  ].map(file=>readFile(new URL("../"+file,import.meta.url),"utf8")));
  const opener=library.slice(library.indexOf("async function openVerifiedAfterglow"),
    library.indexOf("async function unloadCurrentStory"));
  assert.match(opener,/await refreshAfterglowLibraryFromEncryptedProfile\(\)/u);
  assert.match(opener,/afterglowRestoreChoices\(listAfterglowExampleProjects\(\)/u);
  assert.ok(opener.indexOf("await refreshAfterglowLibraryFromEncryptedProfile()")
    <opener.indexOf("afterglowRestoreChoices("),"refresh must precede building choices");
  assert.match(opener,/authority\.masterId/u);
  assert.match(opener,/setAfterglowOpening\(\{ item, choices \}\)/u);
  assert.match(library,/The refreshed encrypted profile has no verified consolidated master/u);
  assert.match(browser,/await flushProfilePrivateWrites\(\)/u);
  assert.match(browser,/await hydrateProfilePrivateBrowser\(profileId, token, true\)/u);
  assert.match(browser,/const serverMaster = server\.afterglowMaster/u);
  assert.match(api,/const ledgerId = "afterglow-master-" \+ createHash\("sha256"\)/u);
  assert.match(api,/afterglowMaster: verifiedMasters\[0\] \?\? null/u);
  assert.match(choices,/Consolidated master/u);
  assert.doesNotMatch(opener,/createLibraryWorkingCopy|commitConsolidatedAfterglow/u);
});
