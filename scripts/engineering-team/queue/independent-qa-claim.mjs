/** #3302 local QA queue: exclusive immutable claim; no worker execution or signing authority. */
import { mkdir,open,readFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
const sha = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const ID=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/;
function valid(id){if(typeof id!=='string'||!ID.test(id))throw new Error('INVALID_ID');return id;}
async function writeOnce(path,record){
 let h;
 try{h=await open(path,'wx',0o600);await h.writeFile(JSON.stringify(record)+'\n');await h.sync();return true;}
 catch(e){if(e?.code==='EEXIST')return false;throw e;}
 finally{await h?.close();}
}
export async function claimReview({root,jobId,workerId,head,expectedHead,stop=false}){
 valid(jobId);valid(workerId);
 if(stop)return {status:'BLOCKED',code:'STOP_ACTIVE'};
 if(head!==expectedHead)return {status:'BLOCKED',code:'HEAD_MISMATCH'};
 const directory=resolve(root,'claims');await mkdir(directory,{recursive:true,mode:0o700});
 const claim={schemaVersion:1,kind:'QA_CLAIM',jobId,workerId,head,nonce:randomUUID(),createdAt:new Date().toISOString()};
 const ok=await writeOnce(join(directory,jobId+'.json'),claim);
 if(!ok)return {status:'BLOCKED',code:'ALREADY_CLAIMED'};
 return {status:'CLAIMED',claim,claimDigest:sha(claim),executionAuthorized:false};
}
export async function readClaim({root,jobId}){
 valid(jobId);
 try{return JSON.parse(await readFile(join(resolve(root,'claims'),jobId+'.json'),'utf8'));}
 catch(e){if(e?.code==='ENOENT')return null;throw e;}
}
export async function appendReviewObservation({root,jobId,workerId,claimNonce,claimDigest,observationId,disposition,evidence}){
 valid(jobId);valid(workerId);valid(observationId);
 if(!['FIX','BLOCKED','UNPROVEN'].includes(disposition))throw new Error('PASS_REQUIRES_INDEPENDENT_SIGNED_VERIFIER');
 const claim=await readClaim({root,jobId});
 if(!claim||claim.workerId!==workerId||claim.nonce!==claimNonce||sha(claim)!==claimDigest)throw new Error('CLAIM_IDENTITY_MISMATCH');
 if(!Array.isArray(evidence)||evidence.some(x=>typeof x!=='string'||x.length>2048))throw new Error('INVALID_EVIDENCE');
 const directory=resolve(root,'observations');await mkdir(directory,{recursive:true,mode:0o700});
 const observation={schemaVersion:1,kind:'QA_OBSERVATION',jobId,workerId,claimDigest,observationId,disposition,evidence,createdAt:new Date().toISOString(),independentSignedPass:false};
 const ok=await writeOnce(join(directory,jobId+'-'+observationId+'.json'),observation);
 return ok?{status:'RECORDED',observationDigest:sha(observation),independentSignedPass:false}:{status:'BLOCKED',code:'OBSERVATION_EXISTS'};
}
