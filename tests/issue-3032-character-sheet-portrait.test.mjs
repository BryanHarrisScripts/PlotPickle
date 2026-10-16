import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read = p => readFile(new URL(`../${p}`, import.meta.url), "utf8");

test("#3032 separate full sheet and square portrait creation uses actual source-bound selected character", async () => {
 const [ui,host,library] = await Promise.all([read("app/skin-v1/assets-character-deliverables.tsx"),read("app/skin-v1/assets-characters.tsx"),read("core/storage/library-project.ts")]);
 for(const x of ["character-sheet","character-portrait","Full Character Sheet","1:1 Portrait","mindMapCharacterVisualPrompt(project, characterId, \"front-full-body\")","referenceImages: references","billingAcknowledged: cloud && paidConsent","aspect = kind === \"character-portrait\" ? \"square\" : \"landscape\""]) assert.ok(ui.includes(x),x);
 assert.match(host, /<AssetsCharacterDeliverables/u);
 assert.match(library, /assetRegistry: ProjectAssetRegistry/u);
 assert.match(library, /normalizeProjectAssetRegistry\(source\.assetRegistry\)/u);
 assert.match(library, /createEmptyProjectAssetRegistry\(\)/u);
});
test("#3032 true 1:1 square output passed all cloud provider gateways and checked locally before Save", async () => {
 const [a,b,ui]=await Promise.all([read("build/local-ai-gateway-base.ts"),read("build/cloud-media-provider.ts"),read("app/skin-v1/assets-character-deliverables.tsx")]);
 for(const source of [a,b]) {
  assert.match(source,/input\.aspect === "square" \? "1024x1024"/u);
  assert.match(source,/input\.aspect === "square" \? "1:1"/u);
 }
 assert.match(ui,/bitmap\.width === bitmap\.height/u);
 assert.match(ui,/if \(square && typeof createImageBitmap !== "function"\) throw/u);
 assert.match(ui,/await crypto\.subtle\.digest\("SHA-256", bytes\)/u);
 assert.match(ui,/verified\.contentHash !== candidate\.contentHash/u);
});
test("#3032 approve and release keep exact portable asset variation identity and do not lock World Map angles",async()=>{
 const s=await read("app/skin-v1/assets-character-deliverables.tsx");
 for(const x of ["registerProjectAssetSource","variationExtensions","contentHash","bytes: candidate.bytes","approval: \"unreviewed\"","approvedVariationId","onSaved(saved)","await persistActiveProfileProject()","await flushProfilePrivateWrites()","readback.assetRegistry","sessionActiveProjectId()","compositeSheet: kind === \"character-sheet\"","independentWorldMapViews: 0"])assert.ok(s.includes(x),x);
 assert.doesNotMatch(s,/lockWorldMapCharacterVisualVersion/u);
});
test("#3032 responsive separate gallery gives explicit preview and accessible approval",async()=>{
 const [s,css]=await Promise.all([read("app/skin-v1/assets-character-deliverables.tsx"),read("app/skin-v1/assets-character-deliverables.module.css")]);
 for(const token of ['aria-label="Choose character asset type"','aria-pressed={kind === "character-sheet"}','aria-pressed={kind === "character-portrait"}','Save draft','Discard','Approve','Unlock','role="status" aria-live="polite"'])assert.ok(s.includes(token),token);
 assert.match(css,/focus-visible/u);assert.match(css,/@media\(max-width:560px\)/u);
});
