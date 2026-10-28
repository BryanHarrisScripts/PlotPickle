import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createUnifiedServiceRegistry,projectUnifiedServiceInventory}
 from '../core/sidecars/runtime/unified-service-inventory.mjs';
import {inspectLocalServiceInventory}
 from '../scripts/engineering-team/windows/services/inspect-unified-services.mjs';

const SHA='a'.repeat(40);
const NOW=Date.parse('2026-10-27T23:00:00Z');
const sidecars={schemaVersion:1,startupPolicy:'after-core-ready',statusFile:'node/runtime/sidecars/status.json',
 services:[{id:'dsdd',label:'Headless DSDD',entrypoint:'scripts/sidecars/dsdd-service.mjs',defaultEnabled:true,requiredForCore:false},
 {id:'media-runtime',label:'Media Runtime',entrypoint:'scripts/sidecars/media-runtime-service.mjs',defaultEnabled:true,requiredForCore:false}]};
const manifest={schemaVersion:1,authority:'plotpickle-runtime-supervisor',components:[
 {id:'plotpickle-app-runtime',displayName:'PlotPickle Application Runtime',enabled:true},
 {id:'plotpickle-node-service',displayName:'PlotPickle Compute Node Service',enabled:false}
]};
const registry=()=>createUnifiedServiceRegistry(sidecars,manifest);
const snapshot=(updates={})=>({schemaVersion:1,observedAt:new Date(NOW-5000).toISOString(),
 services:[{id:'dsdd',state:'ready'},{id:'media-runtime',state:'degraded'}],...updates});
const project=options=>projectUnifiedServiceInventory({registry:registry(),now:NOW,...options});
const get=(result,id)=>result.services.find(x=>x.id===id);

test('inventory composes existing registries with F00 quality and four factories, without enabling them',()=>{
 const x=registry();
 for(const id of ['dsdd','media-runtime','plotpickle-app-runtime',
  'independent-windows-supervisor','factory-mcp-tunnel','lane-a-test-admission',
  'lane-b-qa-worker','software-factory','learning-evolution-factory',
  'story-builder-factory','game-factory','semantic-story-coordinator']){
  assert.ok(x.get(id),id);
  assert.equal(x.get(id).canStart,false);
 }
 assert.equal(x.get('plotpickle-node-service').state,'DISABLED');
 assert.equal(x.get('game-factory').state,'PLANNED');
 assert.equal(x.get('lane-a-test-admission').state,'BLOCKED');
 assert.equal(x.get('semantic-story-coordinator').group,'coordinator');
 assert.equal(x.get('unknown-executable'),null);
});
test('missing evidence cannot claim READY, authenticating tunnel, work or merge',()=>{
 const result=project();
 assert.equal(result.summary.provenOperational,0);
 assert.equal(get(result,'dsdd').state,'UNPROVEN');
 assert.equal(get(result,'factory-mcp-tunnel').remoteAuthenticated,null);
 assert.equal(get(result,'software-factory').workAuthorized,false);
 assert.deepEqual(result.permissions,{start:false,stop:false,coding:false,admission:false,merge:false,issuePromotion:false});
});
test('fresh sidecar ready is reported observation, never independent readiness',()=>{
 const result=project({sidecarSnapshot:snapshot()});
 assert.equal(get(result,'dsdd').observedState,'ready');
 assert.equal(get(result,'dsdd').state,'UNPROVEN');
 assert.equal(get(result,'dsdd').capabilityReady,false);
 assert.equal(get(result,'media-runtime').observedState,'degraded');
 assert.equal(result.summary.provenOperational,0);
});
test('a self-reported healthy independent supervisor cannot prove Windows process ownership',()=>{
 const result=project({expectedHead:SHA,supervisorSnapshot:{
  state:'RUNNING',heartbeatFresh:true,sourceHead:SHA,
  workerProcessVerified:true,independentWindowsAcceptance:true,automaticMergeEnabled:true
 }});
 const supervisor=get(result,'independent-windows-supervisor');
 assert.equal(supervisor.state,'UNPROVEN');
 assert.equal(supervisor.observedState,'RUNNING');
 assert.equal(supervisor.processOwnershipVerified,false);
 assert.equal(supervisor.independentlyVerified,false);
 assert.equal(supervisor.canMerge,false);
 assert.equal(supervisor.evidenceCode,'HEARTBEAT_IS_NOT_PROCESS_OWNERSHIP');
});
test('wrong source head and stale heartbeat never promote supervisor status',()=>{
 assert.equal(get(project({expectedHead:SHA,supervisorSnapshot:{
  state:'RUNNING',heartbeatFresh:true,sourceHead:'b'.repeat(40)
 }}),'independent-windows-supervisor').state,'STALE');
 assert.equal(get(project({expectedHead:SHA,supervisorSnapshot:{
  state:'RUNNING',heartbeatFresh:false,sourceHead:SHA
 }}),'independent-windows-supervisor').state,'STALE');
 assert.equal(get(project({supervisorSnapshot:{
  state:'RUNNING',heartbeatFresh:true,sourceHead:SHA
 }}),'independent-windows-supervisor').state,'UNPROVEN');
});
test('forged local tunnel remote authorization is never accepted',()=>{
 const tunnel=get(project({tunnelSnapshot:{localListenerObserved:true,remoteAuthenticated:true,
  workerVerified:true,canPublish:true}}),'factory-mcp-tunnel');
 assert.equal(tunnel.observedState,'local-listener-observed');
 assert.equal(tunnel.remoteAuthenticated,null);
 assert.equal(tunnel.canCode,false);
 assert.equal(tunnel.evidenceCode,'REMOTE_CHATGPT_AUTHORIZATION_UNVERIFIED');
});
test('stale/malformed sidecar documents remain stale or unproven',()=>{
 const old=snapshot({observedAt:new Date(NOW-300000).toISOString()});
 const result=project({sidecarSnapshot:old});
 assert.equal(get(result,'dsdd').state,'STALE');
 assert.equal(get(result,'dsdd').observedState,null);
 assert.ok(result.diagnostics.includes('SIDECAR_STATUS_STALE_OR_INVALID'));
 assert.equal(get(project({sidecarSnapshot:{schemaVersion:1,services:[]}}),'dsdd').state,'STALE');
});
test('unknown/duplicate sidecar snapshots cannot register or certify new services',()=>{
 const result=project({sidecarSnapshot:snapshot({services:[
  {id:'dsdd',state:'ready'},{id:'dsdd',state:'ready'},
  {id:'attacker',state:'ready'}]})});
 assert.equal(get(result,'dsdd').observedState,null);
 assert.ok(result.diagnostics.includes('DUPLICATE_SIDECAR_OBSERVATION'));
 assert.ok(result.diagnostics.includes('UNKNOWN_SIDECAR_OBSERVATION'));
 assert.equal(result.services.some(x=>x.id==='attacker'),false);
});
test('duplicate, non-string and invalid managed IDs are rejected',()=>{
 assert.throws(()=>createUnifiedServiceRegistry(sidecars,{...manifest,components:[
  {id:'dsdd',displayName:'Collision',enabled:true}]}),/DUPLICATE/);
 assert.throws(()=>createUnifiedServiceRegistry(sidecars,{...manifest,components:[
  {id:undefined,displayName:'Invalid',enabled:true}]}),/ID_INVALID/);
 assert.throws(()=>createUnifiedServiceRegistry(sidecars,{...manifest,components:[
  {id:'../escape',displayName:'Invalid',enabled:true}]}),/ID_INVALID/);
});
test('source registry still refuses unsafe sidecar execution entrypoints',()=>{
 assert.throws(()=>createUnifiedServiceRegistry({...sidecars,services:[
  {...sidecars.services[0],entrypoint:'../../bad.mjs'}]},manifest),/unsafe entrypoint/);
 assert.throws(()=>createUnifiedServiceRegistry(sidecars,{...manifest,authority:'self-issued'}),/MANAGED_MANIFEST_INVALID/);
});
test('local inspection reads only named sources and never declares operating workers',async()=>{
 const calls=[];
 const readJson=async filename=>{
  calls.push(filename.replaceAll('\\','/'));
  if(filename.endsWith('runtime-sidecars.json'))return sidecars;
  if(filename.endsWith('runtime-manifest.json'))return manifest;
  if(filename.endsWith('status.json'))return snapshot();
  if(filename.endsWith('heartbeat.json'))return {state:'RUNNING',sourceHead:SHA,at:NOW-1000};
  throw Error('unexpected path');
 };
 const result=await inspectLocalServiceInventory({
  repo:'/repo',home:'/home',appData:'/local',now:NOW,readJson
 });
 assert.equal(calls.length,4);
 assert.equal(result.permissions.start,false);
 assert.equal(get(result,'independent-windows-supervisor').state,'UNPROVEN');
 assert.ok(result.diagnostics.includes('REMOTE_TUNNEL_AUTHENTICATION_NOT_INSPECTED'));
 assert.ok(result.diagnostics.includes('SERVICE_MANAGER_NOT_INSTALLED_OR_ATTESTED'));
});
test('inspection refuses a rewritten path and returns diagnostics for absent source snapshots',async()=>{
 const noStatus=async filename=>filename.endsWith('runtime-sidecars.json')?sidecars:
  filename.endsWith('runtime-manifest.json')?manifest:null;
 const result=await inspectLocalServiceInventory({
  repo:'/repo',home:'/home',appData:'/local',now:NOW,readJson:noStatus
 });
 assert.ok(result.diagnostics.includes('SUPERVISOR_HEARTBEAT_UNAVAILABLE'));
 assert.ok(result.diagnostics.includes('SIDECAR_STATUS_UNAVAILABLE'));
 assert.equal(get(result,'software-factory').state,'BLOCKED');
 await assert.rejects(()=>inspectLocalServiceInventory({
  repo:'/repo',home:'/home',appData:'/local',now:NOW,
  readJson:async filename=>filename.endsWith('runtime-sidecars.json')?
   {...sidecars,statusFile:'../secrets.json'}:
   filename.endsWith('runtime-manifest.json')?manifest:null
 }),/FIXED_SIDECAR_STATUS_PATH_REQUIRED/);
});
test('real canonical source registries are read without adding new launchers or factory claims',async()=>{
 const [sidecarText,manifestText]=await Promise.all([
  readFile(new URL('../config/runtime-sidecars.json',import.meta.url),'utf8'),
  readFile(new URL('../config/runtime-manifest.json',import.meta.url),'utf8')
 ]);
 const actual=createUnifiedServiceRegistry(JSON.parse(sidecarText),JSON.parse(manifestText));
 assert.equal(actual.services.filter(x=>x.group==='sidecars').length,6);
 assert.equal(actual.services.filter(x=>x.group==='factories').length,4);
 assert.equal(actual.services.filter(x=>x.group==='coordinator').length,1);
 assert.equal(actual.services.filter(x=>x.source==='runtime-manifest').length,5);
 assert.ok(actual.services.every(x=>x.canStart===false&&x.canMerge===false));
});

test('unknown or malicious heartbeat content never leaks into a published observation',()=>{
 const secret='RUNNING token=abc123 user-private';
 const result=project({expectedHead:SHA,supervisorSnapshot:{
  state:secret,heartbeatFresh:true,sourceHead:SHA
 }});
 const observed=get(result,'independent-windows-supervisor');
 assert.equal(observed.observedState,null);
 assert.equal(JSON.stringify(result).includes('token=abc123'),false);
 assert.equal(observed.independentlyVerified,false);
});
