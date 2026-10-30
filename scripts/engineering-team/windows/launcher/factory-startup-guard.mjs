#!/usr/bin/env node
/**
 * #3268: read-only launch boundary. Normal PlotPickle may coexist with the
 * Factory but must never fast-forward or repair the shared runtime while the
 * independent supervisor, Factory test app or engineering MCP is active.
 * No PID/port takeover and no STOP or lock deletion.
 */
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { supervisorStatus } from '../supervisor/unattended-supervisor.mjs';

const PORTS=Object.freeze([
  Object.freeze({name:'factory-test',host:'localhost',port:4174}),
  Object.freeze({name:'factory-tunnel',host:'127.0.0.1',port:43115}),
]);
const state=(code,protectedRuntime,observations)=>Object.freeze({
  code,protectedRuntime,sourceUpdateAllowed:!protectedRuntime,
  sharedRuntimeMutationAllowed:!protectedRuntime,
  mustNotStopForeignProcess:true,observations,
});
export async function observeStartupPort({host,port,timeoutMs=900}={}){
  return new Promise(resolve=>{
    let socket,done=false;
    const finish=value=>{if(done)return;done=true;socket?.destroy();resolve(value);};
    try{
      socket=net.connect({host,port});
      socket.once('connect',()=>finish('OCCUPIED'));
      socket.once('error',e=>finish(e?.code==='ECONNREFUSED'?'FREE':'UNKNOWN'));
      socket.setTimeout(timeoutMs,()=>finish('UNKNOWN'));
    }catch{finish('UNKNOWN');}
  });
}
export async function assessFactoryStartupBoundary({
  supervisor=supervisorStatus,probe=observeStartupPort,
}={}){
  let s;
  try{s=await supervisor();}
  catch{return state('SUPERVISOR_INSPECTION_UNVERIFIABLE',true,{supervisor:'UNKNOWN'});}
  const observed=typeof s?.state==='string'?s.state:'UNKNOWN';
  // OFF is the only state that rules out owner-held supervisor authority.
  // PAUSED, STOP_REQUESTED, BLOCKED and OFFLINE preserve evidence and runtime.
  if(observed!=='OFF'&&observed!=='NOT_INSTALLED')
    return state('SUPERVISOR_AUTHORITY_PRESENT',true,{supervisor:observed});
  const observations={supervisor:observed};
  for(const p of PORTS){
    let o;
    try{o=await probe(p);}catch{o='UNKNOWN';}
    observations[p.name]=o;
    if(o!=='FREE')return state(o==='OCCUPIED'?
      'FACTORY_ENDPOINT_IN_USE':'FACTORY_ENDPOINT_UNVERIFIABLE',true,observations);
  }
  return state('SAFE_TO_UPDATE',false,observations);
}
export async function main(args=process.argv.slice(2)){
  if(args.length!==1||args[0]!=='--update-check'){
    process.stdout.write(JSON.stringify(state('EXACT_READ_ONLY_COMMAND_REQUIRED',true,{}))+'\n');
    return 12;
  }
  const result=await assessFactoryStartupBoundary();
  process.stdout.write(JSON.stringify(result)+'\n');
  return result.protectedRuntime?10:0;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().then(code=>{process.exitCode=code;}).catch(()=>{
    process.stdout.write(JSON.stringify(state('STARTUP_BOUNDARY_UNVERIFIABLE',true,{}))+'\n');
    process.exitCode=12;
  });
