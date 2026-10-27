/** #3302 Lane A: verify signed admission receipts. No signing key, review or admission power here. */
import {createHash,createPublicKey,verify} from 'node:crypto';
const hex=/^[a-f0-9]{64}$/;
const commit=/^[a-f0-9]{40}$/;
const id=/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/;
const verdicts=new Set(['ADMIT','FIX','REJECT','UNPROVEN']);
export function canonicalPayload(receipt){
 const fields=['schemaVersion','reviewId','reviewerPrincipal','authorPrincipal','credentialKeyId','candidateHead','testDigests','inputDigests','truthRefs','findings','disposition','evidence','timestampUtc'];
 const body={};
 for(const field of fields){if(!Object.hasOwn(receipt,field))throw new Error('MISSING_FIELD:'+field);body[field]=receipt[field];}
 return Buffer.from(JSON.stringify(body),'utf8');
}
export function verifyAdmissionReceipt(receipt,{trustedReviewers,expectedHead,expectedTestDigests,expectedInputDigests,allowedTruthRefs,expectedAuthorPrincipal}){
 const deny=(code)=>({accepted:false,code,mayUpdateCatalogue:false,mayRunLaneB:false});
 if(!receipt||receipt.schemaVersion!=='PP-TEST-ADMISSION-V1')return deny('SCHEMA_INVALID');
 if(!id.test(receipt.reviewId||'')||!id.test(receipt.reviewerPrincipal||'')||!id.test(receipt.authorPrincipal||''))return deny('IDENTITY_INVALID');
 if(receipt.reviewerPrincipal===receipt.authorPrincipal)return deny('SELF_REVIEW');
 if(!id.test(expectedAuthorPrincipal||'')||receipt.authorPrincipal!==expectedAuthorPrincipal)return deny('AUTHOR_NOT_ATTESTED');
 if(!verdicts.has(receipt.disposition))return deny('DISPOSITION_INVALID');
 if(!commit.test(receipt.candidateHead||'')||receipt.candidateHead!==expectedHead)return deny('HEAD_MISMATCH');
 const equalDigests=(actual,expected)=>actual&&expected&&typeof actual==='object'&&!Array.isArray(actual)&&!Array.isArray(expected)&&Object.keys(expected).length>0&&Object.keys(actual).length===Object.keys(expected).length&&Object.entries(expected).every(([k,v])=>hex.test(v)&&actual[k]===v);
 if(!equalDigests(receipt.testDigests,expectedTestDigests)||!equalDigests(receipt.inputDigests,expectedInputDigests))return deny('EDITION_MISMATCH');
 if(!Array.isArray(receipt.truthRefs)||!receipt.truthRefs.length||!Array.isArray(allowedTruthRefs)||!receipt.truthRefs.every(x=>typeof x==='string'&&allowedTruthRefs.includes(x)))return deny('TRUTH_REF_UNAPPROVED');
 if(!Array.isArray(receipt.findings)||!receipt.findings.length||!Array.isArray(receipt.evidence)||!receipt.evidence.length)return deny('EVIDENCE_MISSING');
 if(!/^\d{4}-\d{2}-\d{2}T/.test(receipt.timestampUtc||''))return deny('TIMESTAMP_INVALID');
 if(typeof receipt.credentialKeyId!=='string'||!id.test(receipt.credentialKeyId)||!trustedReviewers||!Object.hasOwn(trustedReviewers,receipt.credentialKeyId))return deny('REVIEWER_NOT_TRUSTED');
 const trusted=trustedReviewers[receipt.credentialKeyId];
 if(!trusted||trusted.principal!==receipt.reviewerPrincipal||trusted.revoked)return deny('REVIEWER_NOT_TRUSTED');
 if(typeof receipt.signatureBase64!=='string')return deny('SIGNATURE_MISSING');
 if(!/^[A-Za-z0-9+/]{86}==$/.test(receipt.signatureBase64))return deny('SIGNATURE_FORMAT_INVALID');
 let verified=false;
 try{
  const key=createPublicKey(trusted.publicKeyPem);
  if(key.asymmetricKeyType!=='ed25519')return deny('KEY_TYPE_INVALID');
  verified=verify(null,canonicalPayload(receipt),key,Buffer.from(receipt.signatureBase64,'base64'));
 }catch{return deny('SIGNATURE_INVALID');}
 if(!verified)return deny('SIGNATURE_INVALID');
 const digest=createHash('sha256').update(canonicalPayload(receipt)).digest('hex');
 return {accepted:true,code:receipt.disposition==='ADMIT'?'ADMISSION_RECEIPT_VALID':'NON_ADMIT_VERDICT_VALID',disposition:receipt.disposition,receiptDigest:digest,mayUpdateCatalogue:receipt.disposition==='ADMIT',mayRunLaneB:false};
}
