/**
 * #3302 Lane A reviewer: cryptographic verification of an externally issued
 * enrollment. NOT a key generator, Windows SID attestor or live reviewer.
 * The independent registrar, key store, author ledger and execution monitor
 * MUST live outside the coding/PR process.
 */
import {createHash,createPublicKey,verify} from 'node:crypto';

const ID=/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const SID=/^S-1-(?:[0-9]+-){2,}[0-9]+$/;
const SIGNATURE=/^[A-Za-z0-9+/]{86}==$/;
const CAPABILITY='catalogue-admission-review-only';
const ENROLLMENT_FIELDS=[
  'schemaVersion','enrollmentId','roleAlias','actorId','reviewerPrincipal',
  'reviewerSid','hostId','keyId','publicKeyPem','challengeNonce',
  'registrarId','registrarPrincipal','processTokenEvidenceDigest',
  'privateKeyAclEvidenceDigest','evidenceRefs','capabilities','issuedAtUtc',
  'expiresAtUtc','possessionSignatureBase64'
];
const ENROLLMENT_RECEIPT_FIELDS=new Set([...ENROLLMENT_FIELDS,'registrarSignatureBase64']);
const POSSESSION_FIELDS=[
  'schemaVersion','enrollmentId','roleAlias','actorId','reviewerPrincipal',
  'reviewerSid','hostId','keyId','publicKeyFingerprint','challengeNonce'
];
const bytesFor=(obj,fields)=>{
 const out={};
 for(const field of fields){
  if(!Object.hasOwn(obj,field))throw new Error('MISSING_FIELD:'+field);
  out[field]=obj[field];
 }
 return Buffer.from(JSON.stringify(out),'utf8');
};
const deny=(code)=>({verified:false,code,productionActivated:false,mayAdmit:false,mayCode:false,mayMerge:false});

export const enrollmentPayload=(record)=>bytesFor(record,ENROLLMENT_FIELDS);
export function possessionPayload(record){
 const key=createPublicKey(record.publicKeyPem);
 if(key.asymmetricKeyType!=='ed25519')throw new Error('REVIEWER_KEY_TYPE_INVALID');
 return bytesFor({
  schemaVersion:'PP-LANE-A-POSSESSION-V1',
  enrollmentId:record.enrollmentId,
  roleAlias:record.roleAlias,
  actorId:record.actorId,
  reviewerPrincipal:record.reviewerPrincipal,
  reviewerSid:record.reviewerSid,
  hostId:record.hostId,
  keyId:record.keyId,
  publicKeyFingerprint:createHash('sha256').update(key.export({format:'der',type:'spki'})).digest('hex'),
  challengeNonce:record.challengeNonce
 },POSSESSION_FIELDS);
}

export function verifyReviewerEnrollment(record,{
 trustedRegistrars,expectedRegistrarId,expectedRegistrarPrincipal,
 expectedHostId,expectedReviewerSid,expectedReviewerPrincipal,expectedCodingSid,
 expectedChallengeNonce,alreadyUsedChallenges,now=Date.now()
}={}){
 if(!record||record.schemaVersion!=='PP-LANE-A-ENROLL-V1')return deny('SCHEMA_INVALID');
 if(Array.isArray(record)||Object.keys(record).some(field=>!ENROLLMENT_RECEIPT_FIELDS.has(field)))return deny('UNSIGNED_EXTENSION_REJECTED');
 if(![record.enrollmentId,record.actorId,record.keyId,record.registrarId].every(x=>typeof x==='string'&&ID.test(x)))return deny('ID_INVALID');
 if(record.roleAlias!=='PP-F00-LA-W0001'||record.actorId!=='PP-F00-D02-W0001')return deny('ROLE_MISMATCH');
 if(![record.reviewerPrincipal,record.registrarPrincipal,record.hostId].every(x=>typeof x==='string'&&x.length>2&&x.length<192))return deny('PRINCIPAL_INVALID');
 if(record.reviewerPrincipal===record.registrarPrincipal)return deny('REGISTRAR_NOT_SEPARATE');
 if(!expectedReviewerPrincipal||record.reviewerPrincipal!==expectedReviewerPrincipal)return deny('REVIEWER_PRINCIPAL_MISMATCH');
 if(!SID.test(record.reviewerSid||'')||record.reviewerSid!==expectedReviewerSid)return deny('WINDOWS_IDENTITY_MISMATCH');
 if(!SID.test(expectedCodingSid||''))return deny('CODING_IDENTITY_UNATTESTED');
 if(record.reviewerSid===expectedCodingSid)return deny('SAME_WINDOWS_PRINCIPAL_AS_CODER');
 if(record.hostId!==expectedHostId||!expectedHostId)return deny('HOST_MISMATCH');
 if(!expectedChallengeNonce||record.challengeNonce!==expectedChallengeNonce||!ID.test(record.challengeNonce||''))return deny('CHALLENGE_MISMATCH');
 if(!Array.isArray(alreadyUsedChallenges))return deny('CHALLENGE_LEDGER_UNAVAILABLE');
 if(alreadyUsedChallenges.includes(record.challengeNonce))return deny('CHALLENGE_REPLAY');
 if(![record.processTokenEvidenceDigest,record.privateKeyAclEvidenceDigest].every(x=>typeof x==='string'&&DIGEST.test(x)))return deny('ATTESTATION_EVIDENCE_MISSING');
 if(!Array.isArray(record.evidenceRefs)||record.evidenceRefs.length<2||record.evidenceRefs.some(x=>typeof x!=='string'||!x.trim()||x.length>256))return deny('EVIDENCE_REFS_MISSING');
 if(!Array.isArray(record.capabilities)||record.capabilities.length!==1||record.capabilities[0]!==CAPABILITY)return deny('SCOPE_INVALID');
 const issued=Date.parse(record.issuedAtUtc||''),expires=Date.parse(record.expiresAtUtc||'');
 if(!Number.isFinite(now)||!Number.isFinite(issued)||!Number.isFinite(expires)||issued>now+60000||expires<=now||expires<=issued||expires-issued>86400000)return deny('ENROLLMENT_TIME_INVALID');
 if(record.registrarId!==expectedRegistrarId||record.registrarPrincipal!==expectedRegistrarPrincipal)return deny('REGISTRAR_NOT_AUTHORIZED');
 if(!trustedRegistrars||!Object.hasOwn(trustedRegistrars,record.registrarId))return deny('REGISTRAR_NOT_TRUSTED');
 const registrar=trustedRegistrars[record.registrarId];
 if(!registrar||registrar.revoked||registrar.principal!==record.registrarPrincipal)return deny('REGISTRAR_NOT_TRUSTED');
 if(!SIGNATURE.test(record.registrarSignatureBase64||'')||!SIGNATURE.test(record.possessionSignatureBase64||''))return deny('SIGNATURE_FORMAT_INVALID');
 let reviewerKey,registrarKey,signatureValid=false,possessionValid=false;
 try{
  reviewerKey=createPublicKey(record.publicKeyPem);
  registrarKey=createPublicKey(registrar.publicKeyPem);
  if(reviewerKey.asymmetricKeyType!=='ed25519'||registrarKey.asymmetricKeyType!=='ed25519')return deny('KEY_TYPE_INVALID');
  signatureValid=verify(null,enrollmentPayload(record),registrarKey,Buffer.from(record.registrarSignatureBase64,'base64'));
  possessionValid=verify(null,possessionPayload(record),reviewerKey,Buffer.from(record.possessionSignatureBase64,'base64'));
 }catch{return deny('SIGNATURE_OR_KEY_INVALID');}
 if(!signatureValid)return deny('REGISTRAR_SIGNATURE_INVALID');
 if(!possessionValid)return deny('REVIEWER_POSSESSION_INVALID');
 const keyFingerprint=createHash('sha256').update(reviewerKey.export({format:'der',type:'spki'})).digest('hex');
 return {
  verified:true,code:'SIGNED_ENROLLMENT_CANDIDATE',
  actorId:record.actorId,roleAlias:record.roleAlias,
  reviewerPrincipal:record.reviewerPrincipal,reviewerSid:record.reviewerSid,
  keyId:record.keyId,keyFingerprint,
  candidateRegistryEntry:{principal:record.reviewerPrincipal,publicKeyPem:record.publicKeyPem,revoked:false,actorId:record.actorId},
  productionActivated:false,mayAdmit:false,mayCode:false,mayMerge:false,
  requiresExternalWindowsAclAndPrincipalObservation:true
 };
}
