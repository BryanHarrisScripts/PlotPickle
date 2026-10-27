/**
 * #3268 read-only inventory projection. This is NOT a second runtime
 * supervisor, credential store, worker admission service, or action API.
 * Existing sidecar + managed runtime manifests remain authoritative.
 */
import {createRuntimeServiceRegistry} from './service-registry.mjs';

const ID=/^[a-z0-9][a-z0-9-]{1,63}$/;
const SHA=/^[a-f0-9]{40}$/;
const MAX_AGE_MS=120_000;
const safeText=(x,max=100)=>typeof x==='string'?x.slice(0,max):null;
const freeze=x=>Object.freeze(x);
const GROUPS=freeze([
 {id:'independent-windows-supervisor',label:'Independent Windows Supervisor',group:'supervisors',state:'UNPROVEN'},
 {id:'factory-mcp-tunnel',label:'Authenticated Factory MCP Tunnel',group:'connections',state:'UNPROVEN'},
 {id:'lane-a-test-admission',label:'Lane A Independent Test Admission',group:'quality',state:'BLOCKED'},
 {id:'lane-b-qa-worker',label:'Lane B Independent QA Worker',group:'quality',state:'BLOCKED'},
 {id:'software-factory',label:'Software Factory',group:'factories',state:'BLOCKED'},
 {id:'learning-evolution-factory',label:'Learning & Evolution Factory',group:'factories',state:'PLANNED'},
 {id:'story-builder-factory',label:'Story Builder Factory',group:'factories',state:'PLANNED'},
 {id:'game-factory',label:'Game Factory — The Unwritten',group:'factories',state:'PLANNED'},
 {id:'semantic-story-coordinator',label:'Semantic Story Coordinator',group:'coordinator',state:'PLANNED'}
]);
const configured=(entry)=>freeze({
 id:entry.id,label:entry.label,group:entry.group,source:entry.source,
 enabled:entry.enabled,state:entry.state,
 // No registry item is ever an execution capability or an admission grant.
 canStart:false,canStop:false,canCode:false,canAdmit:false,canMerge:false
});
export function createUnifiedServiceRegistry(sidecarConfig,managedManifest){
 const sidecars=createRuntimeServiceRegistry(sidecarConfig);
 if(managedManifest?.schemaVersion!==1||managedManifest.authority!=='plotpickle-runtime-supervisor'||
  !Array.isArray(managedManifest.components))throw Error('MANAGED_MANIFEST_INVALID');
 const entries=[],seen=new Set();
 const add=(entry)=>{
  if(!ID.test(entry.id)||seen.has(entry.id))throw Error('UNIFIED_SERVICE_ID_INVALID_OR_DUPLICATE');
  if(typeof entry.label!=='string'||!entry.label.trim())throw Error('UNIFIED_SERVICE_LABEL_MISSING');
  seen.add(entry.id);entries.push(configured(entry));
 };
 for(const service of sidecars.services)add({
  id:service.id,label:service.label,group:'sidecars',source:'runtime-sidecars',
  enabled:service.defaultEnabled,state:service.defaultEnabled?'UNPROVEN':'DISABLED'
 });
 for(const component of managedManifest.components){
  if(!component||typeof component.enabled!=='boolean')throw Error('MANAGED_COMPONENT_INVALID');
  add({
   id:component.id,label:component.displayName,group:'managed-runtime',source:'runtime-manifest',
   enabled:component.enabled,state:component.enabled?'UNPROVEN':'DISABLED'
  });
 }
 for(const component of GROUPS)add({...component,source:'existing-owner-or-planned',enabled:component.state==='UNPROVEN'});
 return freeze({schemaVersion:1,mode:'READ_ONLY',services:freeze(entries),get(id){return entries.find(x=>x.id===id)||null;}});
}
function safeTimestamp(value,now){
 if(typeof value!=='string'||!(/^\d{4}-\d\d-\d\dT/.test(value)))return null;
 const timestamp=Date.parse(value);
 if(!Number.isFinite(timestamp)||timestamp>now+30_000||now-timestamp>MAX_AGE_MS)return null;
 return timestamp;
}
const STATES=new Set(['waiting','starting','ready','degraded','unavailable','failed','stopped']);
const safeReported=x=>typeof x==='string'&&STATES.has(x)?x:null;
export function projectUnifiedServiceInventory({
 registry,sidecarSnapshot,supervisorSnapshot,tunnelSnapshot,expectedHead,now=Date.now()
}={}){
 if(registry?.mode!=='READ_ONLY'||!Array.isArray(registry.services))throw Error('UNIFIED_REGISTRY_REQUIRED');
 if(!Number.isSafeInteger(now)||now<0)throw Error('OBSERVATION_TIME_INVALID');
 const diagnostics=[];
 const noProof={
  processOwnershipVerified:false,capabilityReady:false,remoteAuthenticated:null,
  independentlyVerified:false,workAuthorized:false,modelInvoked:false,
  canStart:false,canStop:false,canAdmit:false,canCode:false,canMerge:false
 };
 const sidecarKnown=registry.services.filter(x=>x.source==='runtime-sidecars').map(x=>x.id);
 const snapshots=new Map();
 let sidecarFresh=false;
 if(sidecarSnapshot?.schemaVersion===1&&Array.isArray(sidecarSnapshot.services)&&
    safeTimestamp(sidecarSnapshot.observedAt,now)!==null){
  sidecarFresh=true;
  for(const item of sidecarSnapshot.services){
   if(!item||typeof item.id!=='string'||!sidecarKnown.includes(item.id)){
    diagnostics.push('UNKNOWN_SIDECAR_OBSERVATION');continue;
   }
   if(snapshots.has(item.id)){diagnostics.push('DUPLICATE_SIDECAR_OBSERVATION');snapshots.set(item.id,null);continue;}
   snapshots.set(item.id,safeReported(item.state));
  }
 }else if(sidecarSnapshot){diagnostics.push('SIDECAR_STATUS_STALE_OR_INVALID');}
 const supervisorState=safeText(supervisorSnapshot?.state,32);
 const supervisorFresh=supervisorSnapshot?.heartbeatFresh===true&&
  SHA.test(expectedHead||'')&&supervisorSnapshot?.sourceHead===expectedHead;
 const services=registry.services.map(service=>{
  const result={...service,...noProof,observedState:null,observationSource:null,
   evidenceCode:service.state==='PLANNED'?'FACTORY_NOT_DEPLOYED':
    service.state==='BLOCKED'?'INDEPENDENT_GATES_PENDING':
    service.state==='DISABLED'?'DISABLED_BY_MANIFEST':'NO_TRUSTED_PROCESS_PROOF'};
  if(service.source==='runtime-sidecars'){
   const reported=sidecarFresh?snapshots.get(service.id):null;
   if(reported){result.observedState=reported;result.observationSource='sidecar-status-file';}
   if(sidecarSnapshot&&!sidecarFresh&&service.enabled){result.state='STALE';result.evidenceCode='SIDECAR_STATUS_STALE_OR_INVALID';}
  }
  if(service.id==='independent-windows-supervisor'){
   result.observedState=supervisorState;
   result.observationSource=supervisorState?'supervisor-heartbeat':null;
   result.evidenceCode=supervisorFresh?'HEARTBEAT_IS_NOT_PROCESS_OWNERSHIP':'SUPERVISOR_HEAD_OR_HEARTBEAT_UNVERIFIED';
   if(supervisorSnapshot&&!supervisorFresh)result.state='STALE';
   // Never take supervisor's self-reported "workerProcessVerified" as independent proof.
  }
  if(service.id==='factory-mcp-tunnel'){
   result.observedState=tunnelSnapshot?.localListenerObserved===true?'local-listener-observed':null;
   result.observationSource=result.observedState?'tunnel-local-probe':null;
   result.evidenceCode='REMOTE_CHATGPT_AUTHORIZATION_UNVERIFIED';
   // Remote authorization cannot come from an untrusted local observation.
  }
  return freeze(result);
 });
 return freeze({schemaVersion:1,mode:'READ_ONLY',observedAt:new Date(now).toISOString(),
  evidenceScope:'STATUS_PROJECTION_NOT_INDEPENDENT_ACCEPTANCE',sourceHead:SHA.test(expectedHead||'')?expectedHead:null,
  summary:freeze({registered:services.length,sidecars:sidecarKnown.length,
   planned:services.filter(x=>x.state==='PLANNED').length,
   provenOperational:0}),
  diagnostics:freeze(diagnostics),
  services:freeze(services),
  permissions:freeze({start:false,stop:false,coding:false,admission:false,merge:false,issuePromotion:false})
 });
}
