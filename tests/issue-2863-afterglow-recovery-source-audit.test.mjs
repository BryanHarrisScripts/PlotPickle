import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {isAfterglowRecoverySnapshot,summarizeAfterglowRecoverySnapshot} from "../modules/library/afterglow-recovery-snapshot.mjs";

function snapshot(id="old-Afterglow",characterImageCount=41){
  return {
    format:"2.0-foundation",id,revision:557,
    sourceEvidence:{referenceFixture:{sourceId:"afterglow-v9-complete-baseline"}},
    worldMap:{characterVisuals:[{
      characterId:"joy",characterName:"Joy",lockedVersionId:"v1",
      references:Array.from({length:characterImageCount},(_,i)=>({
        id:"reference-"+i,versionId:"v1",assetUrl:"/api/local-ai/assets/shot-"+i+".webp",
      })),
    }]},
    build:{foundations:{
      visualArtifacts:Array.from({length:70},(_,i)=>({
        id:"shot-"+i,workflow:"storyboard-frame-webp-v2",
        reviewState:i<3?"accepted":"draft",
      })),
      acceptedVisualArtifactIds:["shot-0","shot-1","shot-2"],
    }},
    production:{graphicNovelTextApprovals:[{anchorRef:"block-1",position:1,narration:"Joy arrives."}]},
  };
}
const roster=[{id:"joy",name:"Joy"},{id:"kai",name:"Kai"},{id:"jai",name:"Jai"}];
test("#2863 the older October recovery can contain 41 character-image references, different from later 23",()=>{
  const older=snapshot("old",41),newer=snapshot("new",23);
  const unchanged=structuredClone([older,newer,roster]);
  const found=summarizeAfterglowRecoverySnapshot({project:older,characters:roster});
  const latest=summarizeAfterglowRecoverySnapshot({project:newer,characters:roster});
  assert.equal(found.characterImageReferences,41);
  assert.equal(latest.characterImageReferences,23);
  assert.equal(found.storyboardImages,70);
  assert.equal(found.lockedStoryboardImages,3);
  assert.deepEqual(found.characterNames,["Joy","Kai","Jai"]);
  assert.equal(found.lockedCharacterVersions,1);
  assert.equal(found.approvedNarrationCount,1);
  assert.equal(found.mediaBytesVerified,false,"metadata never proves file readback");
  assert.equal(found.readOnly,true);
  assert.deepEqual([older,newer,roster],unchanged);
});
test("#2863 only complete reference-fixture Afterglow is eligible for story-specific recovery discovery",()=>{
  assert.equal(isAfterglowRecoverySnapshot(snapshot()),true);
  assert.equal(isAfterglowRecoverySnapshot({...snapshot(),sourceEvidence:{}}),false);
  assert.equal(isAfterglowRecoverySnapshot({title:"Afterglow",id:"guess"}),false);
  assert.equal(isAfterglowRecoverySnapshot({id:"",sourceEvidence:{referenceFixture:{sourceId:"afterglow-v9-complete-baseline"}}}),false);
  assert.throws(()=>summarizeAfterglowRecoverySnapshot({project:{id:"foreign"},characters:roster}),/real Afterglow snapshot/u);
});
test("#2863 empty media and claims are explicit, not invented from titles or file names",()=>{
  const project=snapshot();project.worldMap.characterVisuals=[];
  project.build.foundations.visualArtifacts=[];
  project.build.foundations.acceptedVisualArtifactIds=[];
  project.production.graphicNovelTextApprovals=[];
  const found=summarizeAfterglowRecoverySnapshot({project,characters:[]});
  assert.equal(found.characterCount,0);
  assert.deepEqual(found.characterNames,[]);
  assert.equal(found.characterImageReferences,0);
  assert.equal(found.storyboardImages,0);
  assert.equal(found.lockedCharacterVersions,0);
  assert.equal(found.approvedNarrationCount,0);
});
test("#2863 recovery discovery is in Afterglow only, while general Data Recovery keeps its restore semantics",async()=>{
  const [ui,dataRecovery,planner]=await Promise.all([
    readFile(new URL("../modules/library/ui/afterglow-management-panel.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/skin-v1/settings-review-system-panel.tsx",import.meta.url),"utf8"),
    readFile(new URL("../modules/library/afterglow-consolidation.mjs",import.meta.url),"utf8"),
  ]);
  assert.match(ui,/listProfileRecoveryPoints\(\)/u);
  assert.match(ui,/listArchivedLibraryProjects\(\)/u);
  assert.match(ui,/isAfterglowRecoverySnapshot\(point\.project\)/u);
  assert.match(ui,/point\.project\.id !== point\.projectId/u);
  assert.match(ui,/key: string/u);
  assert.match(ui,/"point:"\+point\.id/u);
  assert.match(ui,/Older Afterglow states found in Data Recovery/u);
  assert.match(ui,/Not yet included in the consolidation draft/u);
  assert.match(ui,/Media files have not been verified/u);
  assert.match(ui,/Legacy disk backups must be separately inspected and imported/u);
  assert.match(dataRecovery,/async function restoreRecoveryPoint\(point: ProfileRecoveryPoint\)/u);
  assert.match(dataRecovery,/createProfileRecoveryPoint\(current, "pre-restore"\)/u);
  assert.match(planner,/sourceEvidence\.referenceFixture/u);
  assert.doesNotMatch(ui,/restoreRecoveryPoint\(|archiveLibraryProject\(|deleteArchivedLibraryProject\(/u);
  assert.doesNotMatch(ui,/commitAfterglowMaster\(/u);
});
