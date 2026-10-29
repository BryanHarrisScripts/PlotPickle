/**
 * #3302 independent registrar trust policy verifier.
 * This verifies an independently signed delegation, but does NOT provision
 * Windows keys, consume a nonce, qualify F00, sign W8/W9, or grant admission.
 *
 * Independent policy root material must be loaded from an OS/vendor-protected
 * trust store outside the candidate Git checkout. An author-provided "root"
 * is not evidence of trusted provenance; verification outputs CANDIDATE ONLY.
 */
import {createHash,createPublicKey,verify} from 'node:crypto';

const SHA=/^[a-f0-9]{64}$/;
const SHA1=/^[a-f0-9]{40}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9_-]{2,95}$/;
const SIGN=/^[A-Za-z0-9+/]{86}==$/;
const FIELDS=[
 'schemaVersion','policyId','publisherPrincipal','registrarPrincipal',
 'registrarKeyId','registrarPublicKeyPem','candidateHead',
 'allowedCapabilities','issuedAtUtc','expiresAtUtc'
];
const ALLOWED=new Set([...FIELDS,'signatureBase64']);
const REQUIRED_CAP='reviewer-enrollment-only';
const deny=code=>Object.freeze({
 status:'BLOCKED',code,signedPolicyValid:false,
 independentlyAnchored:false,productionActivated:false,
 mayEnroll:false,mayAdmit:false,mayEditCatalogue:false,mayMerge:false
});
const digestKey=pem=>{
 const k=createPublicKey(pem);
 if(k.asymmetricKeyType!=='ed25519')throw Error('ED25519_REQUIRED');
 return createHash('sha256').update(k.export({type:'spki',format:'der'})).digest('hex');
};
export function registrarPolicyPayload(item){
 const body={};
 for(const field of FIELDS){
  if(!Object.hasOwn(item,field))throw Error('MISSING_FIELD:'+field);
  body[field]=item[field];
 }
 return Buffer.from(JSON.stringify(body),'utf8');
}
export function inspectSignedRegistrarPolicy({
 signedPolicy,externalRoot,stopMarkerState,nowMs
}={}){
 if(stopMarkerState!=='ABSENT')return deny(stopMarkerState==='PRESENT'?'INTENTIONAL_STOP':'STOP_UNVERIFIABLE');
 if(!externalRoot||externalRoot.origin!=='owner-or-vendor-protected'||
  externalRoot.revoked!==false||!SHA.test(externalRoot.pinnedPublicKeyFingerprint||'')||
  typeof externalRoot.publicKeyPem!=='string')
  return deny('PROTECTED_ROOT_NOT_OBSERVED');
 if(!signedPolicy||typeof signedPolicy!=='object'||Array.isArray(signedPolicy)||
  Object.keys(signedPolicy).some(k=>!ALLOWED.has(k))||
  signedPolicy.schemaVersion!=='PP-LANE-A-REGISTRAR-POLICY-V1'||
  !ID.test(signedPolicy.policyId||'')||
  !ID.test(signedPolicy.registrarKeyId||'')||
  !ID.test(signedPolicy.registrarPrincipal||'')||
  !ID.test(signedPolicy.publisherPrincipal||'')||
  signedPolicy.publisherPrincipal===signedPolicy.registrarPrincipal||
  !SHA1.test(signedPolicy.candidateHead||'')||
  !Array.isArray(signedPolicy.allowedCapabilities)||
  signedPolicy.allowedCapabilities.length!==1||
  signedPolicy.allowedCapabilities[0]!==REQUIRED_CAP)
  return deny('POLICY_SCOPE_OR_SCHEMA_INVALID');
 if(!SIGN.test(signedPolicy.signatureBase64||''))
  return deny('POLICY_SIGNATURE_MISSING');
 if(!Number.isSafeInteger(nowMs)||nowMs<0)return deny('TRUSTED_CLOCK_UNAVAILABLE');
 const issued=Date.parse(signedPolicy.issuedAtUtc);
 const expires=Date.parse(signedPolicy.expiresAtUtc);
 const goodDate=v=>typeof v==='string'&&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(v)&&
  Number.isFinite(Date.parse(v))&&
  new Date(Date.parse(v)).toISOString().slice(0,19)===v.slice(0,19);
 if(!goodDate(signedPolicy.issuedAtUtc)||!goodDate(signedPolicy.expiresAtUtc)||
  issued>nowMs+60_000||expires<=nowMs||
  expires<=issued||expires-issued>7*86_400_000)
  return deny('POLICY_EXPIRED_OR_TIME_INVALID');
 let rootKey,registrarKey,rootFP,regFP;
 try{
  rootKey=createPublicKey(externalRoot.publicKeyPem);
  registrarKey=createPublicKey(signedPolicy.registrarPublicKeyPem);
  rootFP=digestKey(externalRoot.publicKeyPem);
  regFP=digestKey(signedPolicy.registrarPublicKeyPem);
  if(rootFP!==externalRoot.pinnedPublicKeyFingerprint)
   return deny('PROTECTED_ROOT_FINGERPRINT_MISMATCH');
  if(rootFP===regFP)return deny('ROOT_REGISTRAR_KEY_COLLAPSE');
  if(!verify(null,registrarPolicyPayload(signedPolicy),rootKey,
      Buffer.from(signedPolicy.signatureBase64,'base64')))
   return deny('REGISTRAR_POLICY_SIGNATURE_INVALID');
 }catch{return deny('REGISTRAR_POLICY_SIGNATURE_INVALID');}
 return Object.freeze({
  status:'SIGNED_POLICY_CANDIDATE_ONLY',
  code:'EXTERNALLY_PINNED_REGISTRAR_DELEGATION_CRYPTOGRAPHICALLY_VALID',
  signedPolicyValid:true,independentlyAnchored:false,
  registrarKeyFingerprint:regFP,
  publisherKeyFingerprint:rootFP,
  requiresOutOfBandRootCustodyWitness:true,
  requiresIndependentWindowsIdentityObservation:true,
  requiresAtomicNonceConsumption:true,
  requiresReviewerQualification:true,
  requiresSeparateCatalogueMaintainer:true,
  productionActivated:false,
  mayEnroll:false,mayAdmit:false,mayEditCatalogue:false,mayMerge:false
 });
}
