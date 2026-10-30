#!/usr/bin/env node
/**
 * Fixed-command AEGIS (F00) math preflight; isolated via stdin/stdout process boundary.
 * Has no FS/network/model/GitHub/owner-key APIs. OS service token isolation,
 * external trust root and qualified signer are NOT furnished by this CLI.
 */
import {inspectCrossFactoryTruth} from './cross-factory-math-review.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const blocked=code=>({schemaVersion:'PP-F00-CROSS-FACTORY-V1',status:'BLOCKED',
  code,mayAdmit:false,mayMerge:false,mayAdvance:false});
export async function runCrossFactoryInspect(input,argv=['--inspect']){
  if(argv.length!==1||argv[0]!=='--inspect')
    return blocked('READ_ONLY_INSPECT_COMMAND_REQUIRED');
  if(typeof input!=='string'||Buffer.byteLength(input,'utf8')>262144)
    return blocked('INPUT_OVERSIZED');
  try{
    const data=JSON.parse(input);
    if(data===null||typeof data!=='object'||Array.isArray(data)||
      Object.keys(data).length!==4||
      !['job','proofs','truthPolicy','stopMarkerState'].every(k=>Object.hasOwn(data,k)))
      return blocked('INPUT_SCHEMA_INVALID');
    return inspectCrossFactoryTruth(data);
  }catch{return blocked('INPUT_UNREADABLE');}
}
async function main(){
  const chunks=[];let total=0;
  for await(const chunk of process.stdin){
    total+=chunk.byteLength;
    if(total>262144){
      process.stdout.write(JSON.stringify(blocked('INPUT_OVERSIZED'))+'\n');
      process.exitCode=2;return;
    }
    chunks.push(chunk);
  }
  const result=await runCrossFactoryInspect(Buffer.concat(chunks).toString('utf8'),process.argv.slice(2));
  process.stdout.write(JSON.stringify(result)+'\n');
  if(result.status!=='REVIEW_PROPOSAL_ONLY')process.exitCode=2;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(()=>{process.stdout.write(JSON.stringify(blocked('REVIEW_RUNTIME_FAILED'))+'\n');process.exitCode=2;});
}
