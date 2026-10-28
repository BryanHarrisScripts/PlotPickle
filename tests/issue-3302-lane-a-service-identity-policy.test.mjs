import test from 'node:test';
import assert from 'node:assert/strict';
import {laneAReviewerServiceProfile,inspectLaneAServiceIdentity} from '../scripts/engineering-team/verification/lane-a-service-identity-policy.mjs';
const HEAD='a'.repeat(40),BINARY='b'.repeat(64),REGISTRAR='c'.repeat(64);
const REVIEWER='S-1-5-21-101-102-103-1002',CODER='S-1-5-21-101-102-103-1001';
const expectations={
 expectedHead:HEAD,expectedBinarySha256:BINARY,expectedRegistrarObservationDigest:REGISTRAR,
 expectedReviewerSid:REVIEWER,expectedCodingSid:CODER,stopMarkerState:'ABSENT'
};
const observed={
 schemaVersion:1,serviceName:'PlotPickleLaneA',serviceAccount:'NT SERVICE\\PlotPickleLaneA',
 managerService:'PlotPickleServiceManager',actorId:'PP-F00-D02-W0001',roleAlias:'PP-F00-LA-W0001',
 installationChoice:'always-on',interactive:false,sourceHead:HEAD,
 binarySha256:BINARY,processRunning:true,pid:2468,
 processTokenSid:REVIEWER,codingProcessSid:CODER,
 registrarObservationDigest:REGISTRAR,privateKeyOwnerSid:REVIEWER,
 privateKeyReadAccessibleToCoder:false,privateKeyAclInherited:false,
 githubWriteGranted:false,catalogueEditGranted:false,
 mergeGranted:false,paidCodingGranted:false
};
const check=(delta={},options={})=>inspectLaneAServiceIdentity({...observed,...delta},{...expectations,...options});
test('profile is single always-on noninteractive service and has no write or merge powers',()=>{
 assert.equal(laneAReviewerServiceProfile.installationChoice,'always-on');
 assert.equal(laneAReviewerServiceProfile.defaultEnabled,false);
 assert.equal(laneAReviewerServiceProfile.serviceAccount,'NT SERVICE\\PlotPickleLaneA');
 assert.equal(laneAReviewerServiceProfile.prohibitedScope.includes('edit-test-catalogue'),true);
 assert.equal(laneAReviewerServiceProfile.prohibitedScope.includes('merge-pull-request'),true);
});
test('all matching synthetic observations remain non-operational candidates',()=>{
 const result=check();
 assert.equal(result.status,'CANDIDATE_ONLY');
 assert.equal(result.identityCandidate,true);
 assert.equal(result.independentAttestation,false);
 for(const permission of ['canStart','canAdmit','canEditCatalogue','canCode','canMerge'])assert.equal(result[permission],false);
});
test('persistent STOP and unreadable STOP block even valid candidates',()=>{
 assert.equal(check({}, {stopMarkerState:'PRESENT'}).code,'INTENTIONAL_STOP');
 assert.equal(check({}, {stopMarkerState:'UNKNOWN'}).code,'STOP_UNVERIFIABLE');
 assert.equal(check({}, {stopMarkerState:undefined}).code,'STOP_UNVERIFIABLE');
});
test('renamed service, shared manager owner, interactive login and wrong actor block',()=>{
 assert.equal(check({serviceName:'PlotPickleLaneB'}).code,'SERVICE_ACCOUNT_OR_OWNER_MISMATCH');
 assert.equal(check({managerService:'Unauthorized'}).code,'SERVICE_ACCOUNT_OR_OWNER_MISMATCH');
 assert.equal(check({interactive:true}).code,'NONINTERACTIVE_INSTALL_REQUIRED');
 assert.equal(check({installationChoice:'personal'}).code,'NONINTERACTIVE_INSTALL_REQUIRED');
 assert.equal(check({actorId:'PP-F01-D02-W0001'}).code,'ROLE_MISMATCH');
});
test('untrusted source and binary edition cannot masquerade as installed reviewer',()=>{
 assert.equal(check({sourceHead:'d'.repeat(40)}).code,'SOURCE_HEAD_UNATTESTED');
 assert.equal(check({binarySha256:'d'.repeat(64)}).code,'SERVICE_BINARY_EDITION_UNATTESTED');
 assert.equal(check({}, {expectedBinarySha256:undefined}).code,'SERVICE_BINARY_EDITION_UNATTESTED');
});
test('distinct real Windows SIDs must be externally expected',()=>{
 assert.equal(check({}, {expectedCodingSid:REVIEWER}).code,'CODER_REVIEWER_SID_NOT_SEPARATE');
 assert.equal(check({}, {expectedReviewerSid:undefined}).code,'EXTERNAL_WINDOWS_SIDS_MISSING');
 assert.equal(check({processTokenSid:CODER}).code,'OBSERVED_PROCESS_SID_MISMATCH');
 assert.equal(check({codingProcessSid:REVIEWER}).code,'OBSERVED_PROCESS_SID_MISMATCH');
});
test('missing worker process and missing registrar evidence cannot activate reviewer',()=>{
 assert.equal(check({pid:0}).code,'REVIEWER_PROCESS_NOT_OBSERVED');
 assert.equal(check({processRunning:false}).code,'REVIEWER_PROCESS_NOT_OBSERVED');
 assert.equal(check({}, {expectedRegistrarObservationDigest:undefined}).code,'EXTERNAL_REGISTRAR_EVIDENCE_MISSING');
 assert.equal(check({registrarObservationDigest:'d'.repeat(64)}).code,'EXTERNAL_REGISTRAR_EVIDENCE_MISSING');
});
test('private signing key must be isolated from coding identity',()=>{
 assert.equal(check({privateKeyOwnerSid:CODER}).code,'KEY_ACL_ISOLATION_UNPROVEN');
 assert.equal(check({privateKeyReadAccessibleToCoder:true}).code,'KEY_ACL_ISOLATION_UNPROVEN');
 assert.equal(check({privateKeyAclInherited:true}).code,'KEY_ACL_ISOLATION_UNPROVEN');
});
test('extra GitHub, catalogue, model or merge powers always fail closed',()=>{
 for(const key of ['githubWriteGranted','catalogueEditGranted','mergeGranted','paidCodingGranted'])
  assert.equal(check({[key]:true}).code,'REVIEWER_OVERPRIVILEGED');
 assert.equal(check({githubWriteGranted:undefined}).code,'REVIEWER_OVERPRIVILEGED');
});
test('invalid, uninstalled or missing observed contract is blocked',()=>{
 assert.equal(inspectLaneAServiceIdentity(null,expectations).code,'SERVICE_OBSERVATION_MISSING');
 assert.equal(check({schemaVersion:2}).code,'SERVICE_OBSERVATION_MISSING');
});
