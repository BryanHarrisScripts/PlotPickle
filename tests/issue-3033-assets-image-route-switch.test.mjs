import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("#3033 use existing authenticated status/test/select capabilities, no parallel provider owner",async()=>{
 const [ui,host]=await Promise.all([read("app/skin-v1/assets-image-route-selector.tsx"),read("app/skin-v1/assets-workspace.tsx")]);
 for(const text of ['authenticatedComputeFetch','"/api/ai-routing/status"','"/api/media-routing/test/image"','"/api/ai-routing/select"','capability:"image"','verified.image?.options?.[chosenRoute]','paidAcknowledged:cloud&&charges','dataSharingAcknowledged:cloud&&share','onChanged(persisted)','plotpickle:connection-status-refresh'])assert.ok(ui.includes(text),text);
 assert.match(host,/<AssetsImageRouteSelector status=\{route\} onChanged=\{setRoute\}/u);
 assert.doesNotMatch(ui,/localStorage\.setItem|window\.fetch\(|process\.env|OPENAI_API_KEY/u);
});

test("#3033 Preview/Consent before image test or selection, retain original choice when blocked",async()=>{
 const ui=await read("app/skin-v1/assets-image-route-selector.tsx");
 for(const q of ['"idle"|"preview"','stage!=="preview"','cloud&&(!charges||!share)','if(!latestOption.ready||!latestOption.verifiedAt)','if(!proof?.ready||!proof.verifiedAt)','if(persisted.image?.selected!==chosenRoute','Refresh verification','Review Switch + Test','Authorize this provider test\'s charges','Authorize sending the test prompt to the cloud provider','Confirm, Test if needed & Switch','Cancel']){
   assert.ok(ui.includes(q),q);
 }
 assert.doesNotMatch(ui,/autoConfirm|setTimeout\([^)]*select|silentFallback/u);
});
test("#3033 unsupported hybrid stays visibly blocked; no invented local-cloud executable join",async()=>{
 const ui=await read("app/skin-v1/assets-image-route-selector.tsx");
 for(const q of ['"local" | "cloud" | "hybrid"','Hybrid · no verified cross-locality image workflow','No paid fallback has been activated','if(busy||stage!=="preview"||hybrid'])assert.ok(ui.includes(q),q);
 assert.doesNotMatch(ui,/\/api\/ai-routing\/join/u);
});

test("#3033 keyboard and status accessibility follow the Matrix skin",async()=>{
 const [ui,css]=await Promise.all([read("app/skin-v1/assets-image-route-selector.tsx"),read("app/skin-v1/assets-image-route-selector.module.css")]);
 assert.match(ui,/aria-label="ASSETS image compute route"/u);
 assert.match(ui,/aria-pressed=\{mode===value\}/u);
 assert.match(ui,/role="status" aria-live="polite"/u);
 assert.match(css,/focus-visible/u);
 assert.match(css,/@media\(max-width:560px\)/u);
});
