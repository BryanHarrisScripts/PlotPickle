#!/usr/bin/env node
/**
 * #3302 Lane A read-only automated work-order inspection entrypoint.
 *
 * This executable is deliberately NOT a signing service or W8/W9 admission
 * authority. JSON input is UNTRUSTED (including its alleged external policy).
 * A real restricted service must obtain policy and identity from independent
 * OS-protected channels and corroborate provenance out of process.
 *
 * No subprocesses, test execution, filesystem access, HTTP, model calls,
 * credential loading, source writes, catalogue edits or PR merges.
 */
import process from 'node:process';
import {inspectAutomatedLaneAReview} from './lane-a-automated-reviewer.mjs';

const MAX_INPUT_BYTES=3*1024*1024;
const MAX_PAYLOAD_BYTES=512*1024;
const BASE64=/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const denied=code=>({
 schemaVersion:'PP-LANE-A-AUTOMATED-REVIEW-V1',
 status:'BLOCKED',disposition:'UNPROVEN',code,
 independentlyVerified:false,mayAdmit:false,
 maySign:false,mayEditCatalogue:false,mayCode:false,mayMerge:false
});

export function inspectAutomatedLaneAJson(request){
 if(!request||typeof request!=='object'||Array.isArray(request)||
  Object.keys(request).some(x=>!['workOrder','independentlyPinnedPolicy','stopMarkerState','sourceBlobsBase64'].includes(x)))
  return denied('REQUEST_SCHEMA_INVALID');
 const sources=request.sourceBlobsBase64;
 if(!sources||typeof sources!=='object'||Array.isArray(sources))
  return denied('SOURCE_BLOBS_INVALID');
 const blobs=Object.create(null);
 let total=0;
 const entries=Object.entries(sources);
 if(entries.length>80)return denied('SOURCE_BLOB_COUNT_EXCEEDED');
 for(const [path,b64] of entries){
  if(typeof b64!=='string'||b64.length>Math.ceil(MAX_PAYLOAD_BYTES*4/3)+8||
   b64.length===0||!BASE64.test(b64))return denied('SOURCE_BLOB_ENCODING_INVALID');
  const bytes=Buffer.from(b64,'base64');
  if(bytes.length===0||bytes.length>MAX_PAYLOAD_BYTES||bytes.toString('base64')!==b64)
   return denied('SOURCE_BLOB_ENCODING_INVALID');
  total+=bytes.length;
  if(total>2*1024*1024)return denied('SOURCE_BLOB_BUDGET_EXCEEDED');
  Object.defineProperty(blobs,path,{value:bytes,enumerable:true,configurable:false,writable:false});
 }
 return inspectAutomatedLaneAReview({
  workOrder:request.workOrder,sourceBlobs:blobs,
  independentlyPinnedPolicy:request.independentlyPinnedPolicy,
  stopMarkerState:request.stopMarkerState
 });
}

async function main(){
 if(process.argv.length!==3||process.argv[2]!=='--inspect'){
  process.stderr.write('PP_LANE_A_READ_ONLY_INSPECT_ONLY\n');
  process.exitCode=2;
  return;
 }
 let input='';
 for await(const chunk of process.stdin){
  input+=chunk.toString('utf8');
  if(Buffer.byteLength(input,'utf8')>MAX_INPUT_BYTES){
   process.stdout.write(JSON.stringify(denied('REQUEST_SIZE_EXCEEDED'))+'\n');
   process.exitCode=2;
   return;
  }
 }
 let request;
 try{request=JSON.parse(input);}catch{
  process.stdout.write(JSON.stringify(denied('REQUEST_JSON_INVALID'))+'\n');
  process.exitCode=2;
  return;
 }
 const result=inspectAutomatedLaneAJson(request);
 process.stdout.write(JSON.stringify(result)+'\n');
 if(result.status==='BLOCKED')process.exitCode=2;
}

if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1].replace(/\\/g,'/')).href){
 main().catch(()=>{
  process.stdout.write(JSON.stringify(denied('REVIEWER_IO_ERROR'))+'\n');
  process.exitCode=2;
 });
}
