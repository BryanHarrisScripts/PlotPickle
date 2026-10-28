#!/usr/bin/env node
/**
 * #3268: inspect *only* fixed, already-owned PlotPickle status sources.
 * No service installation, process spawning, connector access or credentials.
 * A status report is never an independent Windows acceptance receipt.
 */
import {lstat,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {createUnifiedServiceRegistry,projectUnifiedServiceInventory}
 from '../../../../core/sidecars/runtime/unified-service-inventory.mjs';

const REPO=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const STATUS_PATH='node/runtime/sidecars/status.json';
const MAX_BYTES=131072;
async function guardedJson(file){
 try{
  const stat=await lstat(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<2||stat.size>MAX_BYTES)return null;
  return JSON.parse(await readFile(file,'utf8'));
 }catch{return null;}
}
/** Marker existence blocks activity even if its contents are invalid or a symlink.
 * Only ENOENT is proven absent; access errors are UNKNOWN, never permission. */
async function observeStopMarker(file){
 try{await lstat(file);return 'PRESENT';}
 catch(error){return error?.code==='ENOENT'?'ABSENT':'UNKNOWN';}
}
export async function inspectLocalServiceInventory({
 repo=REPO,
 home=path.resolve(process.env.PLOTPICKLE_HOME||
   path.join(process.env.LOCALAPPDATA||process.env.USERPROFILE||os.homedir(),'PlotPickle')),
 appData=path.resolve(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local')),
 now=Date.now(),readJson=guardedJson,readStopMarker=observeStopMarker
}={}){
 const sidecarConfig=await readJson(path.join(repo,'config/runtime-sidecars.json'));
 const managedManifest=await readJson(path.join(repo,'config/runtime-manifest.json'));
 if(sidecarConfig?.statusFile!==STATUS_PATH)throw Error('FIXED_SIDECAR_STATUS_PATH_REQUIRED');
 const registry=createUnifiedServiceRegistry(sidecarConfig,managedManifest);
 const supervisorDir=path.join(appData,'PlotPickle','engineering-team','supervisor');
 const [sidecarSnapshot,heartbeat,rawStopMarkerState]=await Promise.all([
  readJson(path.join(home,STATUS_PATH)),
  readJson(path.join(supervisorDir,'heartbeat.json')),
  readStopMarker(path.join(supervisorDir,'stop-request.json'))
 ]);
 // Only an explicit ABSENT result can clear a local STOP observation.
 // Malformed or unsupported observer results must fail closed.
 const stopMarkerState=rawStopMarkerState==='PRESENT'||rawStopMarkerState==='ABSENT'
  ?rawStopMarkerState:'UNKNOWN';
 const supervisorSnapshot=heartbeat&&typeof heartbeat==='object'?{
  state:heartbeat.state,sourceHead:heartbeat.sourceHead,stopMarkerState,
  heartbeatFresh:Number.isSafeInteger(heartbeat.at)&&
   heartbeat.at<=now+30000&&now-heartbeat.at<=120000
 }:stopMarkerState==='ABSENT'?null:
  {state:null,sourceHead:null,heartbeatFresh:false,stopMarkerState};
 const result=projectUnifiedServiceInventory({
  registry,sidecarSnapshot,supervisorSnapshot,now
 });
 return Object.freeze({...result,
  // Read errors and unknown tunnel authentication are never transformed into ready.
  diagnostics:Object.freeze([...result.diagnostics,
   ...(!sidecarSnapshot?['SIDECAR_STATUS_UNAVAILABLE']:[]),
   ...(!heartbeat?['SUPERVISOR_HEARTBEAT_UNAVAILABLE']:[]),
   'REMOTE_TUNNEL_AUTHENTICATION_NOT_INSPECTED',
   'SERVICE_MANAGER_NOT_INSTALLED_OR_ATTESTED'
  ])
 });
}
const THIS=fileURLToPath(import.meta.url);
if(process.argv[1]&&path.resolve(process.argv[1])===THIS){
 if(process.argv.length!==3||process.argv[2]!=='--status'){
  process.stderr.write('UNIFIED_SERVICES_STATUS_ONLY\n');process.exitCode=2;
 }else{
  inspectLocalServiceInventory().then(
   report=>process.stdout.write(JSON.stringify(report,null,2)+'\n'),
   ()=>{process.stderr.write('UNIFIED_SERVICE_INVENTORY_UNAVAILABLE\n');process.exitCode=1;}
  );
 }
}
