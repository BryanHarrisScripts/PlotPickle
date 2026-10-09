import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {inventoryAfterglowMedia,verifyAfterglowMedia} from "../modules/library/afterglow-media-integrity.mjs";

const png=()=>Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1]);
const digest=b=>"sha256:"+createHash("sha256").update(b).digest("hex");
const packaged="/assets/library/examples/afterglow/current/proof.png";
const local="/api/local-ai/assets/storyboard-1.png";
const historical="/api/local-ai/assets/earlier.png";
const project=(id,urls)=>({id,worldMap:{characterVisuals:urls.map((assetUrl,i)=>({id:String(i),assetUrl}))}});
const input=(candidateUrls,sourceUrls)=>{
 const candidate=project("master",candidateUrls);
 return {candidate,sources:[{project:project("old",sourceUrls)},{project:project("new",candidateUrls)}]};
};
const runner=(values,opts={})=>{
 let requests=0,decoded=0,guards=0;
 const read=async(url,maxBytes)=>{
   requests++;
   const bytes=values[url];
   if(!bytes)return {ok:false};
   assert.ok(bytes.length<=maxBytes);
   return {ok:true,bytes};
 };
 const decode=async()=>{decoded++;if(opts.failDecode)throw Error("Image decode rejected damaged content.");};
 const hash=async bytes=>digest(bytes);
 const beforeRead=()=>{guards++;if(opts.stale && guards>1)throw Error("Profile changed during readback.");};
 return {read,decode,hash,beforeRead,counts:()=>({requests,decoded,guards})};
};
test("#2863 candidate and unselected source images are both inventoried, exact URLs are deduplicated",()=>{
 const report=inventoryAfterglowMedia(input([local,packaged],[historical,local,local]));
 assert.deepEqual(new Set(report.map(x=>x.url)),new Set([local,historical,packaged]));
 assert.equal(report.find(x=>x.url===local).selected,true);
 assert.deepEqual(report.find(x=>x.url===local).sourceProjectIds,["old","new"]);
 assert.equal(report.find(x=>x.url===historical).selected,false);
 assert.equal(report.find(x=>x.url===historical).sourceProjectIds.length,1);
});
test("#2863 actual bytes match pinned packaged manifest, current local index never claims historical identity",async()=>{
 const bytes=png();
 const r=runner({[packaged]:bytes,[local]:bytes,[historical]:bytes});
 const report=await verifyAfterglowMedia({
   ...input([packaged,local],[historical]),
   packagedManifest:{assets:[{publicUrl:packaged,contentHash:digest(bytes)}]},
   localAssetIndex:{assets:[{url:local,contentHash:digest(bytes)},{url:historical,contentHash:digest(bytes)}]},
   ...r,
 });
 assert.equal(report.selectedCount,2);
 assert.equal(report.historyCount,1);
 assert.equal(report.verifiedPinned,1);
 assert.equal(report.readableWithoutSavedProof,1);
 assert.equal(report.failed,0);
 assert.equal(report.results.find(x=>x.url===packaged).status,"verified-pinned");
 assert.equal(report.results.find(x=>x.url===local).status,"verified-current");
 assert.equal(report.results.find(x=>x.url===historical).selected,false);
 assert.equal(report.readyForHumanCommit,false);
 assert.equal(report.packageModified,false);
 assert.deepEqual(r.counts(),{requests:3,decoded:3,guards:4});
});
test("#2863 old local file with no authoritative index digest is readable but UNPINNED",async()=>{
 const bytes=png();
 const report=await verifyAfterglowMedia({
   ...input([local],[]),packagedManifest:{assets:[]},localAssetIndex:{assets:[]},
   ...runner({[local]:bytes}),
 });
 assert.equal(report.results[0].status,"readable-unpinned");
 assert.equal(report.readyForHumanCommit,false);
 assert.equal(report.readableWithoutSavedProof,1);
});
test("#2863 missing files, corrupt signature, bad decoder, and changed hash are separate failures",async()=>{
 const bytes=png();
 const changed=Uint8Array.from(bytes);changed[20]=1;
 const cases=[
   {values:{},opts:{},status:"missing",index:null},
   {values:{[local]:Uint8Array.from([1,2,3,4])},opts:{},status:"corrupt",index:null},
   {values:{[local]:bytes},opts:{failDecode:true},status:"unreadable",index:null},
   {values:{[local]:changed},opts:{},status:"hash-mismatch",index:digest(bytes)},
 ];
 for(const item of cases){
   const report=await verifyAfterglowMedia({
     ...input([local],[]),
     packagedManifest:{assets:[]},
     localAssetIndex:{assets:item.index?[{url:local,contentHash:item.index}]:[]},
     ...runner(item.values,item.opts),
   });
   assert.equal(report.failed,1,item.status);
   assert.equal(report.results[0].status,item.status);
   assert.equal(report.verifiedPinned,0);
   assert.equal(report.readyForHumanCommit,false);
 }
});
test("#2863 untrusted external and encoded URLs never get fetched (no SSRF or cross-account redirects)",async()=>{
 const URLs=["https://outside.example/a.png","//outside.example/a.png",
   "/api/local-ai/assets/../../private.png","/api/local-ai/assets/a.png?key=secret",
   "/assets/library/examples/../private.png","data:image/png;base64,AAAA"];
 for(const url of URLs){
   const r=runner({});
   const report=await verifyAfterglowMedia({
     ...input([url],[]),packagedManifest:{assets:[]},localAssetIndex:{assets:[]},...r,
   });
   assert.equal(report.results[0].status,"unsupported",url);
   assert.equal(r.counts().requests,0,url);
 }
});
test("#2863 active owner/session changes abort inspection instead of leaving a valid stamp",async()=>{
 await assert.rejects(()=>verifyAfterglowMedia({
   ...input([local],[historical]),packagedManifest:{assets:[]},localAssetIndex:{assets:[]},
   ...runner({[local]:png(),[historical]:png()},{stale:true}),
 }),/Profile changed/u);
});
test("#2863 read-only Settings action checks profile, source revisions and reports byte-proof limitations",async()=>{
 const panel=await readFile(new URL("../modules/library/ui/afterglow-management-panel.tsx",import.meta.url),"utf8");
 assert.match(panel,/Verify source and selected media \(read-only\)/u);
 assert.match(panel,/profilePrivateBrowserReadyFor\(profileId\)/u);
 assert.match(panel,/project\.revision !== source\.revision/u);
 assert.match(panel,/beforeRead: guard/u);
 assert.match(panel,/redirect: "error"/u);
 assert.match(panel,/cache: "no-store"/u);
 assert.match(panel,/response\.body\.getReader\(\)/u);
 assert.match(panel,/createImageBitmap\(/u);
 assert.match(panel,/crypto\.subtle\.digest\("SHA-256"/u);
 assert.match(panel,/A stored historical content hash is still needed/u);
 assert.match(panel,/mediaReport\.verifiedPinned/u);
 assert.doesNotMatch(panel,/createLibraryWorkingCopy|saveActiveLibraryProject|archiveLibraryProject|persistActiveProfileProject/u);
});
