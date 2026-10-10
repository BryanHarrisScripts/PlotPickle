import test from 'node:test';
import assert from 'node:assert/strict';
import {planAfterglowConsolidation,reviewAfterglowConsolidationDecisions} from '../modules/library/afterglow-consolidation.mjs';
import {reconcileAfterglowTechnicalRecords,afterglowCollidingMediaUrls} from '../modules/library/master/afterglow-technical-reconciliation.mjs';
const artifact=(id,extra={})=>({id,assetUrl:'/api/local-ai/assets/'+id+'.webp',reviewState:'accepted',workflow:'storyboard-frame-webp-v2',sourceDecisionKeys:['storyboard-local-save:v1'],parentArtifactId:null,narrativeIntention:'Shot '+id,...extra});
const baseline=()=>({id:'base',format:'2.0-foundation',revision:0,updatedAt:'2026-10-01T00:00:00Z',sourceEvidence:{referenceFixture:{sourceId:'afterglow-v9-complete-baseline'}},build:{foundations:{visualArtifacts:[],acceptedVisualArtifactIds:[]},world:{visualArtifacts:[],acceptedVisualArtifactIds:[]}}});
const saved=(b,id,artifacts,revision=1)=>({project:{...structuredClone(b),id,revision,build:{...b.build,foundations:{visualArtifacts:artifacts,acceptedVisualArtifactIds:artifacts.filter(x=>x.reviewState==='accepted').map(x=>x.id)}}}});
function reconcile(b,sources,verifiedMediaHashes){const plan=planAfterglowConsolidation({baseline:b,sources});return reconcileAfterglowTechnicalRecords({baseline:b,sources,verifiedMediaHashes,reviewed:reviewAfterglowConsolidationDecisions(plan)});}
test('#2896 bundled and local aliases require independent matching byte hashes',()=>{
 const b=baseline();b.build.foundations={visualArtifacts:[artifact('one',{assetUrl:'/assets/library/examples/afterglow/current/generated/one.webp'})],acceptedVisualArtifactIds:['one']};
 const sources=[saved(b,'working',[artifact('one')])],originals=structuredClone(sources);
 const packaged=b.build.foundations.visualArtifacts[0].assetUrl,local=sources[0].project.build.foundations.visualArtifacts[0].assetUrl;
 assert.deepEqual(afterglowCollidingMediaUrls({baseline:b,sources}),[local,packaged].sort());
 assert.match(reconcile(b,sources).technicalBlockers.join(' '),/assetUrl/);
 const hash='sha256:'+'a'.repeat(64);
 assert.match(reconcile(b,sources,{[packaged]:hash}).technicalBlockers.join(' '),/assetUrl/);
 const verified={[packaged]:hash,[local]:hash};
 assert.deepEqual(reconcile(b,sources,verified).technicalBlockers,[]);
 assert.equal(reconcile(b,sources,verified).candidate.build.foundations.visualArtifacts[0].assetUrl,packaged);
 assert.deepEqual(sources,originals);
 assert.match(reconcile(b,sources,{...verified,[local]:'sha256:'+'b'.repeat(64)}).technicalBlockers.join(' '),/assetUrl/);
 sources[0].project.build.foundations.visualArtifacts[0].prompt='A different shot';
 assert.match(reconcile(b,sources,verified).technicalBlockers.join(' '),/prompt/);
});
test('#2896 recovery hash claims do not authorize media equivalence or change approval',()=>{
 const b=baseline(),a=saved(b,'a',[artifact('one')]),other=saved(b,'b',[artifact('one',{assetUrl:'/api/local-ai/assets/other.webp',sourceDecisionKeys:['storyboard-local-save:v1','recovery-content-hash:sha256:'+'a'.repeat(64)]})]);
 assert.match(reconcile(b,[a,other]).technicalBlockers.join(' '),/assetUrl/);
 const verified={'/api/local-ai/assets/one.webp':'sha256:'+'a'.repeat(64),'/api/local-ai/assets/other.webp':'sha256:'+'a'.repeat(64)};
 other.project.build.foundations.acceptedVisualArtifactIds=[];other.project.build.foundations.visualArtifacts[0].reviewState='draft';
 assert.match(reconcile(b,[a,other],verified).technicalBlockers.join(' '),/another unlocks/);
});
test('#2896 remaining story blockers identify exact paths',()=>{
 const b=baseline(),r=reconcileAfterglowTechnicalRecords({baseline:b,sources:[],reviewed:{candidate:b,unresolvedConflicts:[{path:'/writing/script',reason:'competing-values'}],needsReview:[{path:'/worldMap/visualBible',reason:'possible-deletion'}]}});
 assert.match(r.technicalBlockers.join(' '),/\/writing\/script/);assert.match(r.technicalBlockers.join(' '),/\/worldMap\/visualBible/);
});
test('bookkeeping order, lineage and source keys converge without changing images or source snapshots',()=>{
 const b=baseline();b.build.foundations={visualArtifacts:[artifact('one',{parentArtifactId:'original'}),artifact('two')],acceptedVisualArtifactIds:['one','two']};
 const sources=[saved(b,'working',[artifact('two'),artifact('one',{sourceDecisionKeys:['storyboard-local-save:v1','recorded-evidence']})])];
 const originals=structuredClone(sources),r=reconcile(b,sources);
 assert.deepEqual(r.technicalBlockers,[]);assert.equal(r.candidate.build.foundations.visualArtifacts[0].parentArtifactId,'original');
 assert.deepEqual(r.candidate.build.foundations.visualArtifacts[0].sourceDecisionKeys,['storyboard-local-save:v1','recorded-evidence']);assert.deepEqual(sources,originals);
});
test('older copies missing a baseline image do not delete it or fabricate new approval',()=>{
 const b=baseline();b.build.foundations={visualArtifacts:[artifact('one')],acceptedVisualArtifactIds:['one']};
 const r=reconcile(b,[saved(b,'working',[])]);assert.deepEqual(r.technicalBlockers,[]);assert.deepEqual(r.candidate.build.foundations.acceptedVisualArtifactIds,['one']);
});
test('same project revision chain retains older-only images and honors recorded unlock',()=>{
 const b=baseline(),old=saved(b,'working',[artifact('one'),artifact('two')],1),latest=saved(b,'working',[artifact('one',{reviewState:'draft'})],2);
 old.sourceKey='point:old';const r=reconcile(b,[old,latest]);assert.deepEqual(r.technicalBlockers,[]);assert.deepEqual(r.candidate.build.foundations.acceptedVisualArtifactIds,['two']);assert.equal(r.candidate.build.foundations.visualArtifacts.length,2);
});
test('independent approval disagreement and different bytes fail with readable explanations',()=>{
 const b=baseline(),a=saved(b,'a',[artifact('one')]),unlock=saved(b,'b',[artifact('one',{reviewState:'draft'})]);
 assert.match(reconcile(b,[a,unlock]).technicalBlockers.join(' '),/another unlocks/);
 const changed=saved(b,'b',[artifact('one',{assetUrl:'/api/local-ai/assets/other.webp'})]);assert.match(reconcile(b,[a,changed]).technicalBlockers.join(' '),/different image content/);
});
test('more than the old generation limit preserves every independently recorded approval',()=>{
 const b=baseline(),r=reconcile(b,[saved(b,'working',Array.from({length:116},(_,n)=>artifact('shot-'+n)))]);
 assert.deepEqual(r.technicalBlockers,[]);assert.equal(r.candidate.build.foundations.visualArtifacts.length,116);assert.equal(r.candidate.build.foundations.acceptedVisualArtifactIds.length,116);
});
test('missing saved acceptance is never automatically approved',()=>{
 const b=baseline(),s=saved(b,'working',[]);s.project.build.foundations.acceptedVisualArtifactIds=['missing'];assert.match(reconcile(b,[s]).technicalBlockers.join(' '),/approved image is missing/);
});
test('production normalizer retains consolidated collection across JSON save and reopen',async()=>{
 const {tsImport}=await import('tsx/esm/api');
 const {normalizeFoundationProject}=await tsImport('../core/project/project.ts',import.meta.url);
 const b=baseline(),images=Array.from({length:116},(_,n)=>artifact('shot-'+n,{prompt:'Original shot intention',createdAt:b.updatedAt,provider:'local',model:'test'}));
 const input=saved(b,'working',images).project;
 const normalized=normalizeFoundationProject(input);
 const reopened=normalizeFoundationProject(JSON.parse(JSON.stringify(normalized)));
 assert.equal(reopened.build.foundations.visualArtifacts.length,116);
 assert.deepEqual(reopened.build.foundations.acceptedVisualArtifactIds,input.build.foundations.acceptedVisualArtifactIds);
 assert.deepEqual(reopened.build.foundations.visualArtifacts,normalized.build.foundations.visualArtifacts);
});
