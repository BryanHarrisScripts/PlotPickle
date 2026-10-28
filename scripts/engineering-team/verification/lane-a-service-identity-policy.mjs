/**
 * #3302 F00 Lane A: installer-managed Windows reviewer identity boundary.
 * READ ONLY: does not provision a service/SID, create keys, accept test truth,
 * grant permissions or run a reviewer. Windows observations are not attestations.
 */
const SID=/^S-1-(?:[0-9]+-){2,}[0-9]+$/;
const SHA256=/^[a-f0-9]{64}$/;
const SHA1=/^[a-f0-9]{40}$/;
const SERVICE='PlotPickleLaneA';
const ACCOUNT='NT SERVICE\\PlotPickleLaneA';
const MANAGER='PlotPickleServiceManager';

export const laneAReviewerServiceProfile=Object.freeze({
 schemaVersion:1,serviceName:SERVICE,serviceAccount:ACCOUNT,
 managerService:MANAGER,actorId:'PP-F00-D02-W0001',
 roleAlias:'PP-F00-LA-W0001',factory:'F00',
 execution:'windows-noninteractive-service-token',
 installationChoice:'always-on',
 defaultEnabled:false, // Observation alone cannot graduate or start reviewer.
 keyOwner:'reviewer-service-identity-only',
 keyHandling:'external-restricted-key-store',
 operationalScope:Object.freeze(['read-immutable-repo-editions','read-approved-truth','write-signed-review-receipt']),
 prohibitedScope:Object.freeze(['edit-source','edit-tests','edit-test-catalogue','invoke-paid-coder','merge-pull-request','clear-stop','start-lane-b'])
});
const blocked=(code)=>Object.freeze({
 status:'BLOCKED',code,identityCandidate:false,independentAttestation:false,
 canStart:false,canAdmit:false,canEditCatalogue:false,canCode:false,canMerge:false
});

/**
 * A status adapter may report observations; only a separate registrar can
 * authenticate the owner Windows token and ACL, and enrol a public key.
 * This function intentionally never returns an operational grant or ADMIT.
 */
export function inspectLaneAServiceIdentity(observation,{
 expectedHead,expectedReviewerSid,expectedCodingSid,
 expectedBinarySha256,expectedRegistrarObservationDigest,
 stopMarkerState
}={}){
 if(!observation||observation.schemaVersion!==1)return blocked('SERVICE_OBSERVATION_MISSING');
 if(stopMarkerState!=='ABSENT')return blocked(stopMarkerState==='PRESENT'?'INTENTIONAL_STOP':'STOP_UNVERIFIABLE');
 if(observation.serviceName!==SERVICE||observation.managerService!==MANAGER||
    observation.serviceAccount!==ACCOUNT)return blocked('SERVICE_ACCOUNT_OR_OWNER_MISMATCH');
 if(observation.roleAlias!=='PP-F00-LA-W0001'||observation.actorId!=='PP-F00-D02-W0001')
  return blocked('ROLE_MISMATCH');
 if(observation.installationChoice!=='always-on'||observation.interactive!==false)
  return blocked('NONINTERACTIVE_INSTALL_REQUIRED');
 if(!SHA1.test(expectedHead||'')||observation.sourceHead!==expectedHead)
  return blocked('SOURCE_HEAD_UNATTESTED');
 if(!SHA256.test(expectedBinarySha256||'')||observation.binarySha256!==expectedBinarySha256)
  return blocked('SERVICE_BINARY_EDITION_UNATTESTED');
 if(!SID.test(expectedReviewerSid||'')||!SID.test(expectedCodingSid||''))
  return blocked('EXTERNAL_WINDOWS_SIDS_MISSING');
 if(expectedReviewerSid===expectedCodingSid)return blocked('CODER_REVIEWER_SID_NOT_SEPARATE');
 if(observation.processTokenSid!==expectedReviewerSid||observation.codingProcessSid!==expectedCodingSid)
  return blocked('OBSERVED_PROCESS_SID_MISMATCH');
 if(observation.processRunning!==true||!Number.isSafeInteger(observation.pid)||observation.pid<1)
  return blocked('REVIEWER_PROCESS_NOT_OBSERVED');
 if(!SHA256.test(expectedRegistrarObservationDigest||'')||
  observation.registrarObservationDigest!==expectedRegistrarObservationDigest)
  return blocked('EXTERNAL_REGISTRAR_EVIDENCE_MISSING');
 if(observation.privateKeyOwnerSid!==expectedReviewerSid||
  observation.privateKeyReadAccessibleToCoder!==false||
  observation.privateKeyAclInherited!==false)
  return blocked('KEY_ACL_ISOLATION_UNPROVEN');
 if(observation.githubWriteGranted!==false||
  observation.catalogueEditGranted!==false||
  observation.mergeGranted!==false||
  observation.paidCodingGranted!==false)
  return blocked('REVIEWER_OVERPRIVILEGED');
 return Object.freeze({
  status:'CANDIDATE_ONLY',code:'SERVICE_IDENTITY_OBSERVATIONS_MATCH_EXPECTATIONS',
  serviceName:SERVICE,actorId:'PP-F00-D02-W0001',
  identityCandidate:true,independentAttestation:false,
  requirements:Object.freeze(['registrar-signature-on-actual-windows-token-and-acl',
   'durable-nonce-consumption','trusted-public-key-installation',
   'separate-reviewer-qualification','approved-test-truth-binding']),
  canStart:false,canAdmit:false,canEditCatalogue:false,canCode:false,canMerge:false
 });
}
