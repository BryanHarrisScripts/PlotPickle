import test from 'node:test';
import assert from 'node:assert/strict';
import {planAfterglowConsolidation,reviewAfterglowConsolidationDecisions} from '../modules/library/afterglow-consolidation.mjs';
import {listAfterglowReviewRecords,applyAfterglowRecordChoices,afterglowCreativeDecisions} from '../modules/library/master/afterglow-record-review.mjs';
import {reconcileAfterglowTechnicalRecords,afterglowCollidingMediaUrls} from '../modules/library/master/afterglow-technical-reconciliation.mjs';
const image=(id='poster',extra={})=>({id,assetUrl:'/api/local-ai/assets/'+id+'.webp',reviewState:'accepted',workflow:'storyboard-frame-webp-v2',sourceDecisionKeys:['storyboard-local-save:v1'],narrativeIntention:'Poster',...extra});
const project=(id,artifacts=[])=>({id,format:'2.0-foundation',sourceEvidence:{referenceFixture:{sourceId:'afterglow-v9-complete-baseline'}},revision:1,updatedAt:'2026-10-10T00:00:00Z',learning:{activeLessonId:'original'},build:{foundations:{visualArtifacts:artifacts,acceptedVisualArtifactIds:artifacts.filter(a=>a.reviewState==='accepted').map(a=>a.id)},world:{visualArtifacts:[],acceptedVisualArtifactIds:[]}}});
function setup(){const baseline=project('base',[image()]);const sources=[{sourceKey:'point:a',project:project('a',[image()])},{sourceKey:'point:b',project:project('b',[image('poster',{reviewState:'draft',assetUrl:'/api/local-ai/assets/missing.webp'})])}];const plan=planAfterglowConsolidation({baseline,sources});return {baseline,sources,plan};}
function choose(input,decisions){const reviewed=applyAfterglowRecordChoices({...input,decisions,reviewed:reviewAfterglowConsolidationDecisions(input.plan,afterglowCreativeDecisions(decisions))});return reconcileAfterglowTechnicalRecords({...input,reviewed});}
test('source-bound Save resolves approval disagreement without inventing approval',()=>{
 const input=setup(),before=structuredClone(input),record=listAfterglowReviewRecords(input)[0];
 assert.equal(record.versions.length,2);assert.equal(record.versions[0].sources.length,2);
 const kept=choose(input,{[record.key]:0});assert.deepEqual(kept.technicalBlockers,[]);assert.deepEqual(kept.candidate.build.foundations.acceptedVisualArtifactIds,['poster']);
 const draft=choose(input,{[record.key]:1});assert.deepEqual(draft.technicalBlockers,[]);assert.deepEqual(draft.candidate.build.foundations.acceptedVisualArtifactIds,[]);
 assert.deepEqual(input,before);
});
test('Not required excludes images and skips only their unselected aliases',()=>{
 const input=setup(),record=listAfterglowReviewRecords(input)[0],decisions={[record.key]:'baseline'};
 const result=choose(input,decisions);assert.deepEqual(result.technicalBlockers,[]);assert.deepEqual(result.candidate.build.foundations.visualArtifacts,[]);assert.deepEqual(result.candidate.build.foundations.acceptedVisualArtifactIds,[]);
 assert.deepEqual(afterglowCollidingMediaUrls({...input,decisions}),[]);assert.equal(afterglowCollidingMediaUrls(input).length,2);
});
test('one image card deduplicates sixteen identical saved copies; ordering is stable',()=>{
 const input=setup();input.sources=Array.from({length:16},(_,n)=>({sourceKey:"point:"+n,project:project('save'+n,[image()])}));input.plan=planAfterglowConsolidation(input);
 const records=listAfterglowReviewRecords(input);assert.equal(records.length,1);assert.equal(records[0].versions.length,1);assert.equal(records[0].versions[0].sources.length,17);
 assert.deepEqual(listAfterglowReviewRecords({...input,sources:[...input.sources].reverse()}),records);
});
test('remaining scalar and structural alternatives can be saved or left out',()=>{
 const baseline=project('base'),sources=[{project:project('one')},{project:project('two')}];sources[0].project.learning.activeLessonId='one';sources[1].project.learning.activeLessonId='two';
 sources[0].project.production={timelineMotionShots:[{id:'shot-1',prompt:'original saved shot'}]};
 sources[1].project.production={timelineMotionShots:[{id:'shot-1',prompt:'alternative saved shot'}]};
 const input={baseline,sources,plan:planAfterglowConsolidation({baseline,sources})},records=listAfterglowReviewRecords(input),decisions=Object.fromEntries(records.map(r=>[r.key,'baseline']));
 const result=choose(input,decisions);assert.deepEqual(result.technicalBlockers,[]);assert.equal(result.candidate.learning.activeLessonId,'original');assert.equal(result.candidate.production,undefined);
});
test('unknown and out-of-range choices fail; existing creative decisions remain separate',()=>{
 const input=setup(),record=listAfterglowReviewRecords(input)[0];assert.throws(()=>choose(input,{[record.key]:999}),/recorded alternative/);assert.throws(()=>choose(input,{'/afterglow-record-review/fake':0}),/outside/);
 assert.deepEqual(afterglowCreativeDecisions({[record.key]:0,'/storyDevelopment/fields/story':1}),{'/storyDevelopment/fields/story':1});
});
test('removing a selected original requires resolving its derived image',()=>{
 const input=setup();input.baseline.build.foundations.visualArtifacts.push(image('child',{parentArtifactId:'poster'}));input.baseline.build.foundations.acceptedVisualArtifactIds.push('child');input.plan=planAfterglowConsolidation(input);
 const record=listAfterglowReviewRecords(input).find(r=>r.path.endsWith('@id:poster'));assert.match(choose(input,{[record.key]:'baseline'}).technicalBlockers.join(' '),/original image was left out/);
});
test('selected saved acceptance still requires its saved-image proof',()=>{
 const input=setup();input.baseline.build.foundations.visualArtifacts[0].sourceDecisionKeys=[];input.plan=planAfterglowConsolidation(input);const record=listAfterglowReviewRecords(input)[0];assert.match(choose(input,{[record.key]:0}).technicalBlockers.join(' '),/no confirmed saved image/);
});
import {prepareVerifiedAfterglowMaster,shaAfterglowSnapshot} from '../modules/library/master/afterglow-master-authority.mjs';
test('authenticated master authority recomputes saved record choices and rejects changed sources',()=>{
 const input=setup(),record=listAfterglowReviewRecords(input)[0];
 input.baseline.world={lessons:{genres:{answers:{genre:""}}}};
 for(const source of input.sources)source.project.world={lessons:{genres:{answers:{genre:"science fiction"}}}};
 const fields=[{topicId:"world",lessonId:"genres",fieldId:"genre",canonicalId:"world:genres:genre",lessonTitle:"Genres",validActs:[1,2,3,4],scope:"project-wide",prompt:"What genre?"}];
 const request={...input,fields,questions:{"world:genres:genre":"What genre?"},manifest:{assets:[]},selections:{decisions:{[record.key]:'baseline'},confirmedCurrent:{'/world/lessons/genres/answers/genre':true},exclusions:[],imageChoices:{}},expectedSources:input.sources.map(s=>({key:s.sourceKey,digest:shaAfterglowSnapshot(s.project)}))};
 const verified=prepareVerifiedAfterglowMaster(request);assert.deepEqual(verified.candidate.build.foundations.visualArtifacts,[]);
 assert.throws(()=>prepareVerifiedAfterglowMaster({...request,expectedSources:[]}),/source snapshots changed/);
});

import {normalizeAfterglowReviewDraft} from '../modules/library/master/afterglow-review-draft.mjs';
test('new choices survive the durable draft format alongside all ninety previous confirmations',()=>{
 const input=setup(),record=listAfterglowReviewRecords(input)[0];
 const confirmedCurrent=Object.fromEntries(Array.from({length:90},(_,n)=>['/existing/'+n,true]));
 const selections={decisions:{[record.key]:'baseline'},confirmedCurrent,exclusions:[],imageChoices:{}};
 const draft=normalizeAfterglowReviewDraft({version:1,sourceFingerprint:'sha256:'+'a'.repeat(64),selections});
 const reopened=normalizeAfterglowReviewDraft(JSON.parse(JSON.stringify(draft)));
 assert.deepEqual(reopened.selections,selections);assert.equal(Object.keys(reopened.selections.confirmedCurrent).length,90);
});
import {afterglowUncoveredImageChoices} from '../modules/library/master/afterglow-record-review.mjs';
test('complete character version overrides only its old image selections without erasing the ninety stored choices',()=>{
 const choices={amy:'keep',ren:'exclude',unknown:'keep'},items=[{key:'amy',characterId:'Amy'},{key:'ren',characterId:'Ren'}],before=structuredClone(choices);
 const filtered=afterglowUncoveredImageChoices({items,choices,resolvedRecordPaths:['/worldMap/characterVisuals/@character:Amy']});
 assert.deepEqual(filtered,{ren:'exclude',unknown:'keep'});assert.deepEqual(choices,before);
});

import {applyAfterglowImageChoices} from '../modules/library/afterglow-image-review.mjs';
test('saved complete character version survives a conflicting prior per-image keep',()=>{
 const reference={id:'frame',versionId:'version',assetUrl:'/api/local-ai/assets/selected.webp'};
 const candidate={worldMap:{characterVisuals:[{characterId:'Amy',references:[reference],lockedVersionId:null}]}};
 const items=[{key:'prior',characterId:'Amy',id:'frame',url:'/api/local-ai/assets/prior.webp',reference:{...reference,assetUrl:'/api/local-ai/assets/prior.webp'},conflictingSourceMetadata:false}],choices={prior:'keep'};
 assert.throws(()=>applyAfterglowImageChoices({candidate,items,choices}),/different image holds/);
 const filtered=afterglowUncoveredImageChoices({items,choices,resolvedRecordPaths:['/worldMap/characterVisuals/@character:Amy']});
 assert.deepEqual(applyAfterglowImageChoices({candidate,items,choices:filtered}).candidate,candidate);
 assert.deepEqual(choices,{prior:'keep'});
});
