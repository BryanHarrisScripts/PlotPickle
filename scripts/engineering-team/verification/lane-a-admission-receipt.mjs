/** #3302 Lane A: verify signed admission receipts. No signing key, review or admission power here. */
import {createHash,createPublicKey,verify} from 'node:crypto';
const hex=/^[a-f0-9]{64}$/;
const commit=/^[a-f0-9]{40}$/;
const id=/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/;
const verdicts=new Set(['ADMIT','FIX','REJECT','UNPROVEN']);
// A signed review is not perpetual authority: the independent caller must
// supply a trusted observation clock. Never infer freshness from the signer.
const MAX_RECEIPT_AGE_MS=86_400_000;
const MAX_FUTURE_SKEW_MS=60_000;
const SIGNED_FIELDS=['schemaVersion','reviewId','reviewerPrincipal','authorPrincipal','credentialKeyId','candidateHead','testDigests','inputDigests','truthRefs','findings','disposition','evidence','timestampUtc'];
const RECEIPT_FIELDS=new Set([...SIGNED_FIELDS,'signatureBase64']);
export function canonicalPayload(receipt){
 const body={};
 for(const field of SIGNED_FIELDS){if(!Object.hasOwn(receipt,field))throw new Error('MISSING_FIELD:'+field);body[field]=receipt[field];}
 return Buffer.from(JSON.stringify(body),'utf8');
}
export function verifyAdmissionReceipt(receipt,{trustedReviewers,expectedHead,expectedTestDigests,expectedInputDigests,allowedTruthRefs,expectedAuthorPrincipal,observedAtMs}){
 const deny=(code)=>({accepted:false,code,mayUpdateCatalogue:false,mayRunLaneB:false});
 if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)||receipt.schemaVersion!=='PP-TEST-ADMISSION-V1')return deny('SCHEMA_INVALID');
 if(Object.keys(receipt).some(field=>!RECEIPT_FIELDS.has(field)))return deny('UNSIGNED_EXTENSION_REJECTED');
 if(!id.test(receipt.reviewId||'')||!id.test(receipt.reviewerPrincipal||'')||!id.test(receipt.authorPrincipal||''))return deny('IDENTITY_INVALID');
 if(receipt.reviewerPrincipal===receipt.authorPrincipal)return deny('SELF_REVIEW');
 if(!id.test(expectedAuthorPrincipal||'')||receipt.authorPrincipal!==expectedAuthorPrincipal)return deny('AUTHOR_NOT_ATTESTED');
 if(!verdicts.has(receipt.disposition))return deny('DISPOSITION_INVALID');
 if(!commit.test(receipt.candidateHead||'')||receipt.candidateHead!==expectedHead)return deny('HEAD_MISMATCH');
 const equalDigests=(actual,expected)=>actual&&expected&&typeof actual==='object'&&!Array.isArray(actual)&&typeof expected==='object'&&!Array.isArray(expected)&&Object.keys(expected).length>0&&Object.keys(actual).length===Object.keys(expected).length&&Object.entries(expected).every(([k,v])=>typeof v==='string'&&hex.test(v)&&Object.hasOwn(actual,k)&&actual[k]===v);
 if(!equalDigests(receipt.testDigests,expectedTestDigests)||!equalDigests(receipt.inputDigests,expectedInputDigests))return deny('EDITION_MISMATCH');
 if(!Array.isArray(receipt.truthRefs)||!receipt.truthRefs.length||!Array.isArray(allowedTruthRefs)||!receipt.truthRefs.every(x=>typeof x==='string'&&allowedTruthRefs.includes(x)))return deny('TRUTH_REF_UNAPPROVED');
 const validEvidenceList=(items)=>Array.isArray(items)&&items.length>0&&items.length<=128&&items.every(x=>typeof x==='string'&&x.trim().length>0&&x.length<=2048);
 if(!validEvidenceList(receipt.findings)||!validEvidenceList(receipt.evidence))return deny('EVIDENCE_MISSING');
 const timestamp=receipt.timestampUtc;
 const parsed=typeof timestamp==='string'?Date.parse(timestamp):NaN;
 if(typeof timestamp!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(timestamp)||!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,19)!==timestamp.slice(0,19))return deny('TIMESTAMP_INVALID');
 if(!Number.isSafeInteger(observedAtMs)||observedAtMs<0||
  !Number.isFinite(new Date(observedAtMs).getTime()))return deny('TRUSTED_CLOCK_UNAVAILABLE');
 if(parsed>observedAtMs+MAX_FUTURE_SKEW_MS||
  observedAtMs-parsed>MAX_RECEIPT_AGE_MS)return deny('RECEIPT_OUTSIDE_TIME_WINDOW');
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
 return {accepted:true,code:receipt.disposition==='ADMIT'?'ADMISSION_RECEIPT_VALID':'NON_ADMIT_VERDICT_VALID',disposition:receipt.disposition,receiptDigest:digest,mayUpdateCatalogue:false,mayRunLaneB:false,requiresSeparateCatalogueMaintainer:receipt.disposition==='ADMIT'};
}
