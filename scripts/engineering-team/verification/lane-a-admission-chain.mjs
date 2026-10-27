/** #3302: DRY RUN ONLY. Real Lane A requires independent Windows identity activation. */
import {verifyReviewerEnrollment} from './lane-a-reviewer-enrollment.mjs';
import {verifyAdmissionReceipt} from './lane-a-admission-receipt.mjs';

export function inspectLaneAAdmissionChain({
 enrollment,receipt,registrationAuthority,receiptExpectations
}={}){
 const safe=(code,extra={})=>({
  status:'BLOCKED',code,mayAdmit:false,mayEditCatalogue:false,mayStartLaneB:false,mayCode:false,mayMerge:false,
  ...extra
 });
 const identity=verifyReviewerEnrollment(enrollment,registrationAuthority);
 if(!identity.verified)return safe('REVIEWER_IDENTITY_'+identity.code);
 if(receipt?.reviewerPrincipal!==identity.reviewerPrincipal||receipt?.credentialKeyId!==identity.keyId)return safe('RECEIPT_KEY_IDENTITY_MISMATCH');
 const result=verifyAdmissionReceipt(receipt,{
  ...receiptExpectations,
  trustedReviewers:{[identity.keyId]:identity.candidateRegistryEntry}
 });
 if(!result.accepted)return safe('ADMISSION_'+result.code);
 return safe('SIGNED_CHAIN_CRYPTOGRAPHICALLY_VALID_ACTIVATION_PENDING',{
  status:'CRYPTOGRAPHIC_DRY_RUN',
  reviewerActorId:identity.actorId,
  reviewerPublicKeyFingerprint:identity.keyFingerprint,
  reviewerWindowsSidClaim:identity.reviewerSid,
  disposition:result.disposition,
  receiptDigest:result.receiptDigest,
  simulated:true,
  missing:['independently-verified-windows-process-token','private-key-acl-proof','trusted-registrar-activation','durable-challenge-consumption','separately-approved-test-truth-admission']
 });
}
