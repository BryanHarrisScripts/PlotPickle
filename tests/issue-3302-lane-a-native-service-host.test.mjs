import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root=new URL('../scripts/engineering-team/windows/verification/',import.meta.url);
const read=async name=>readFile(new URL(name,root),'utf8');

test('native ServiceBase implements fixed inert Windows SCM lifecycle, no keys or network',async()=>{
 const source=await read('PlotPickleLaneAService.cs');
 for(const expected of [
  'class LaneAService : ServiceBase','ServiceBase.Run(new LaneAService());',
  'ServiceName = FixedName;','CanStop = true;','CanPauseAndContinue = false;',
  'WindowsIdentity.GetCurrent()','configured.Equals(identity.User)',
  'NT SERVICE\\PlotPickleLaneA','LANE_A_SERVICE_TOKEN_MISMATCH',
  'PP-LANE-A-SCM-HOST-V1:INERT_SELF_TEST_ONLY'
 ])assert.ok(source.includes(expected),expected);
 for(const forbidden of [
  'Process.Start','HttpClient','TcpListener','new Socket','PrivateKey',
  'File.WriteAll','File.ReadAll','Environment.SetEnvironmentVariable',
  'ServiceController.Start','CreateService','OpenAI'
 ])assert.equal(source.includes(forbidden),false,forbidden);
});
test('native service host binary builder defaults to a plan and cannot install a service',async()=>{
 const ps=await read('Build-PlotPickleLaneAService.ps1');
 assert.match(ps,/\[switch\]\$Build/);
 assert.ok(ps.includes("mode='PLAN_ONLY'"));
 assert.ok(ps.includes("'Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe'"));
 assert.ok(ps.includes("INERT_SELF_TEST_PASSED"));
 assert.ok(ps.includes("BUILD_INSIDE_REPOSITORY_FORBIDDEN"));
 assert.ok(ps.includes("BUILD_OUTPUT_ALREADY_EXISTS"));
 for(const forbidden of ['New-Service','Start-Service','sc.exe create','ConvertTo-SecureString','New-LocalUser'])
  assert.equal(ps.includes(forbidden),false,forbidden);
});
test('installer defaults read-only and refuses unsigned, mismatched, user-writable or preexisting service',async()=>{
 const ps=await read('Install-PlotPickleLaneAService.ps1');
 for(const check of [
  "[switch]$Apply","result='PLAN_ONLY'","configuredStart='demand'",
  "ELEVATED_WINDOWS_INSTALLER_REQUIRED","Get-AuthenticodeSignature",
  "REVIEWED_BINARY_SHA_MISMATCH","REVIEWED_BINARY_SIGNATURE_UNTRUSTED",
  "INSTALL_DIRECTORY_REPARSE_OR_FILE_REJECTED",
  "INSTALL_DIRECTORY_BROAD_WRITE_ACCESS","REVIEWER_SERVICE_ALREADY_EXISTS_NO_OVERWRITE",
  "SCM_RESTRICTED_SERVICE_SID_FAILED","INERT_SERVICE_INSTALLED_NOT_STARTED"
 ])assert.ok(ps.includes(check),check);
 assert.ok(ps.includes("'start=' 'demand'"));
 assert.ok(ps.includes("'obj=' $account"));
 assert.ok(ps.includes("sidtype $serviceName restricted"));
 for(const forbidden of ['Start-Service','sc.exe start','Set-ExecutionPolicy','New-LocalUser','New-Item -ItemType User','GenerateKeyPair','New-Object System.Net.WebClient'])
  assert.equal(ps.includes(forbidden),false,forbidden);
});
test('read-only SCM inspector cannot grant independent admission',async()=>{
 const ps=await read('Inspect-PlotPickleLaneAService.ps1');
 assert.ok(ps.includes("Get-CimInstance -ClassName Win32_Service"));
 assert.ok(ps.includes("Invoke-CimMethod -InputObject $process -MethodName GetOwnerSid"));
 assert.ok(ps.includes("independentlyAttested = $false"));
 assert.ok(ps.includes("canAdmit = $false"));
});
test('native diagnostic wrapper refuses to equate compiler or SCM configuration with review admission',async()=>{
 const ps=await read('Test-PlotPickleLaneAHost.ps1');
 for(const expected of [
  '[switch]$RunNativeCompile', "nativeCompile='NOT_REQUESTED'",
  "w8w9TestAdmission='UNPROVEN'", "signingKeyProvisioned='UNPROVEN'",
  "independentTokenWitness='UNPROVEN'","canAdmit=$false",
  "'Inspect-PlotPickleLaneAService.ps1'","'INERT_SELF_TEST_PASSED'"
 ])assert.ok(ps.includes(expected),expected);
 for(const forbidden of ['Start-Service','New-Service','New-LocalUser',
  'New-Item -ItemType User','Set-Service','sc.exe start','git push'])
  assert.equal(ps.includes(forbidden),false,forbidden);
});
test('ephemeral SCM canary cannot be mistaken for an owner Windows or admitted reviewer service',async()=>{
 const ps=await read('Test-PlotPickleLaneAScmCanary.CI.ps1');
 for(const term of [
  "EPHEMERAL_WINDOWS_CI_ONLY",
  "$env:GITHUB_ACTIONS -ne 'true'",
  "$env:RUNNER_OS -ne 'Windows'",
  "$env:PLOTPICKLE_LANE_A_EPHEMERAL_CI -ne '1'",
  "EXISTING_SERVICE_MUST_NOT_BE_TOUCHED",
  "'obj=' $account",
  "sidtype $name restricted",
  "GetOwnerSid","CANARY_REAL_PROCESS_SID_UNVERIFIED",
  "scmStartStopVerified=$true",
  "reviewerKeyProvisioned=$false","w8w9Admitted=$false",
  "mayAdmit=$false","mayMerge=$false",
  "delete $name"
 ])assert.ok(ps.includes(term),term);
 for(const forbidden of ["Import-PfxCertificate","ConvertTo-SecureString","GenerateKeyPair",
  "New-LocalUser","New-Item -ItemType User","Set-ExecutionPolicy"])
  assert.equal(ps.includes(forbidden),false,forbidden);
});
test('owner-machine acceptance collector is strictly read-only, externally pinned and blocks on STOP',async()=>{
 const ps=await read('Inspect-PlotPickleLaneAOwnerAcceptance.ps1');
 for(const expected of [
  "EXTERNAL_POLICY_PINS_REQUIRED","OWNER_STOP_PRESENT_OR_UNREADABLE",
  "SOURCE_EDITION_NOT_OBSERVED","SOURCE_EDITION_UNVERIFIED",
  "REVIEWER_SERVICE_NOT_INSTALLED","REVIEWER_IMAGE_NOT_RELEASE_TRUSTED",
  "REVIEWER_PROCESS_ACCOUNT_MISMATCH","LOCAL_SCM_CANDIDATE_ONLY",
  "Get-AuthenticodeSignature","Get-FileHash","GetOwnerSid",
  "ownerStopMarker='UNKNOWN'","independentRegistrar='UNPROVEN'",
  "gitCommand.Source -C $root status --porcelain --untracked-files=no",
  "w8w9Admission='UNPROVEN'","canStart=$false","canAdmit=$false","canMerge=$false"
 ])assert.ok(ps.includes(expected),expected);
 for(const forbidden of ["New-Service","Start-Service","Stop-Service",
  "Set-Service","sc.exe create","sc.exe start","sc.exe delete",
  "New-LocalUser","ConvertTo-SecureString","New-SelfSignedCertificate",
  "Import-PfxCertificate","git checkout","git reset","git fetch"])
  assert.equal(ps.includes(forbidden),false,forbidden);
});
test('separately pinned Windows trust-root registry observation is read only and never grants signing',async()=>{
 const ps=await read('Inspect-PlotPickleLaneATrustRoot.ps1');
 for(const required of [
  'EXTERNAL_ROOT_PIN_REQUIRED','ROOT_NOT_INSTALLED',
  'ROOT_FINGERPRINT_MISMATCH','TRUST_ROOT_BROAD_WRITE_ACCESS',
  'LOCAL_TRUST_ROOT_CANDIDATE_ONLY',
  'publisherKeyFingerprintMatch=$false',
  'independentPublisherAttestation=','canEnroll=$false',
  'canAdmit=$false','canEditCatalogue=$false','canMerge=$false',
  'HKEY_LOCAL_MACHINE\\SOFTWARE\\PlotPickle\\ServiceManager\\Trust\\LaneA'
 ])assert.ok(ps.includes(required),required);
 for(const forbidden of ['Set-ItemProperty','New-ItemProperty','Remove-ItemProperty',
  'New-Service','Start-Service','New-LocalUser',
  'Import-PfxCertificate','ConvertTo-SecureString'])
  assert.equal(ps.includes(forbidden),false,forbidden);
});
test('Windows native C# compile and smoke test are opt-in, never an independent reviewer proof',{
 skip:process.platform!=='win32'||process.env.PLOTPICKLE_LANE_A_NATIVE_TEST!=='1'
},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'plotpickle-lane-a-native-'));
 try{
  const script=fileURLToPath(new URL('Build-PlotPickleLaneAService.ps1',root));
  const result=execFileSync('powershell.exe',
   ['-NoProfile','-NonInteractive','-File',decodeURIComponent(script),
    '-Build','-OutputDirectory',dir],
   {encoding:'utf8',timeout:120000,maxBuffer:16384});
  const outcome=JSON.parse(result.trim());
  assert.equal(outcome.mode,'NATIVE_BUILD_SELF_TEST');
  assert.equal(outcome.result,'INERT_SELF_TEST_PASSED');
  assert.equal(outcome.signedForProduction,false);
  assert.equal(outcome.independentlyAttested,false);
  assert.equal(outcome.canAdmit,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
