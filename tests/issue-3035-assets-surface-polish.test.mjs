import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read = path => readFile(new URL(`../${path}`, import.meta.url),"utf8");
test("#3035 ASSETS navigation is selected, accessible and offers Outline/Community-style overview",async()=>{
 const [s,css]=await Promise.all([read("app/skin-v1/assets-workspace.tsx"),read("app/skin-v1/assets-workspace.module.css")]);
 for(const key of ['aria-label="ASSETS folders"','data-selected={folder === id ? "true" : "false"}','aria-current={folder === id ? "page" : undefined}','aria-label="Selected story authority"','aria-label="ASSETS project overview"','Back to Dashboard','Current story','PROJECT LIBRARY']){
  assert.ok(s.includes(key)||key==="Current story"&&s.includes("CURRENT STORY"),key);
 }
 for(const cls of ["shell","header","projectStrip","tabs","overviewGrid","gallery","viewer","focusImage","focusDetails","creation","routing"])assert.match(css,new RegExp(`\\.${cls}\\b`,"u"));
 assert.match(css,/focus-visible/u);assert.match(css,/@media\(max-width:600px\)/u);
});
test("#3035 posters show one selected preview, bounded thumbnails and explicit human Save / Approve",async()=>{
 const s=await read("app/skin-v1/assets-workspace.tsx");
 for(const q of ['selectedPosterId','setSelectedPosterId(poster.id)','data-selected-poster={selectedPoster.id}','data-assets-poster={poster.id}','aria-label="Saved poster variations"','Approve for Library','Save poster draft','Unsaved candidate','Generate 1 poster','lockedMarketingReference','marketingReferenceVersions'])assert.ok(s.includes(q),q);
 assert.doesNotMatch(s,/style=\{\{maxWidth: 180/u);
 assert.match(s,/onClick=\{\(\) => void approvePoster\(selectedPoster\)\}/u);
});
test("#3035 World and Sounds remain explicit project-bound asset surfaces with honest unavailable controls",async()=>{
 const s=await read("app/skin-v1/assets-workspace.tsx");
 for(const q of ['aria-label="World visual assets"','data-assets-folder="world"','setSelectedWorldId(image.id)','aria-label="Saved world image gallery"','aria-label="Sounds folder"','onOpenSound("foley")','onOpenSound("narration")','onOpenSound("music")','Collectibles authoring is planned','New world-view generation is a later #3019 gate']) assert.ok(s.includes(q),q);
 assert.match(s,/<AssetsCharacters/u);
 assert.match(s,/<AssetsImageRouteSelector status=\{route\} onChanged=\{setRoute\}/u);
});
test("#3035 saved approved poster remains Library authority; UI does not duplicate storage or dispatch compute while viewing",async()=>{
 const [s,lib]=await Promise.all([read("app/skin-v1/assets-workspace.tsx"),read("modules/library/ui/library-workspace.tsx")]);
 assert.match(s,/acceptedVisualArtifactIds\.includes\(selectedPoster\.id\)/u);
 assert.match(lib,/lockedMarketingReference/u);
 assert.match(s,/PROJECT_LIBRARY_CHANGED_EVENT/u);
 assert.doesNotMatch(s,/localStorage\.setItem|window\.location\.assign/u);
});
