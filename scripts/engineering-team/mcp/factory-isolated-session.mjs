/**
 * #3222: second, fixed-origin Factory candidate session.
 *
 * The Human MAIN session remains at 127.0.0.1:4173 and is never touched by
 * this controller. Factory uses localhost:4174 (different cookie hostname)
 * and a fresh synthetic profile root. This is *process/profile separation*,
 * not an OS sandbox or evidence of independent product/browser acceptance.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { verificationSyntheticRuntime } from "../../full-verification-auth.mjs";
import { terminateVerificationProcessTree } from "../../full-verification-process.mjs";
import { readFactoryVerificationHead } from "./factory-named-tests.mjs";
import { prepareStagedHumanCandidate } from "./candidate/plotpickle-candidate-source.mjs";

export const FACTORY_SESSION_ENDPOINT = Object.freeze({
  host: "localhost", port: 4174, url: "http://localhost:4174/skin-v1",
});
const SHA = /^[0-9a-f]{40}$/u;
const RID = /^[0-9a-f]{32}$/u;
const START_TIMEOUT_MS = 65_000;
const alive = child => child?.pid > 0 && child.exitCode === null && child.signalCode === null;
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const receipt = (state,code,sourceHead=null,extra={}) => Object.freeze({
  state,code,sourceHead,modelInvoked:false,issueReserved:false,
  independentVerification:false,...extra,
});

/** Refuse to seize a listener if the loopback port is uncertain or occupied. */
export async function factorySessionPortOccupied() {
  return new Promise(resolve => {
    const socket = net.connect({host:FACTORY_SESSION_ENDPOINT.host,port:FACTORY_SESSION_ENDPOINT.port});
    let settled = false;
    const finish = occupied => {
      if(settled)return;
      settled=true;clearTimeout(timer);socket.destroy();resolve(occupied);
    };
    const timer=setTimeout(()=>finish(true),1500);
    socket.once("connect",()=>finish(true));
    socket.once("error",error=>finish(error?.code!=="ECONNREFUSED"));
  });
}

/** An HTTP 200 alone is NOT source identity. */
export async function probeFactorySession(head,prNumber) {
  try {
    const response=await fetch(FACTORY_SESSION_ENDPOINT.url,{
      cache:"no-store",signal:AbortSignal.timeout(4000),
      headers:{"X-PlotPickle-Startup-Probe":"warmup"},
    });
    if(!response.ok)return false;
    const html=await response.text();
    return html.includes(`plotpickle-startup-v4-${head}-normal-local-human-vite-source`) &&
      html.includes('data-plotpickle-launch-channel="PR_TEST"') &&
      html.includes(`data-plotpickle-launch-head="${head}"`) &&
      html.includes(`PR #${prNumber}`);
  }catch{return false;}
}

/**
 * Do not inherit API keys, Factory control tokens or provider credentials
 * into unmerged candidate code. It still executes under the owner Windows
 * account, so synthetic HOME is not a kernel-level sandbox.
 */
export function factorySessionEnvironment(runtime,head,prNumber,env=process.env) {
  const allowed=["PATH","Path","SystemRoot","WINDIR","PATHEXT","ComSpec","TEMP","TMP"];
  const safe=Object.fromEntries(allowed.filter(key=>typeof env[key]==="string")
    .map(key=>[key,env[key]]));
  return {
    ...safe,
    ...runtime.runtimeEnv,
    HOME:runtime.home,
    USERPROFILE:runtime.home,
    APPDATA:path.join(runtime.home,"appdata"),
    LOCALAPPDATA:path.join(runtime.home,"localappdata"),
    NODE_ENV:"development",
    PLOTPICKLE_PI_ALLOW_CLOUD:"0",
    PLOTPICKLE_LAUNCH_INTENT:"local-human",
    PLOTPICKLE_STARTUP_TESTING_MODE:"normal",
    PLOTPICKLE_STARTUP_CONTRACT:`plotpickle-startup-v4-${head}-normal-local-human-vite-source`,
    PLOTPICKLE_LAUNCH_CHANNEL:"pr-test",
    PLOTPICKLE_LAUNCH_SOURCE_HEAD:head,
    PLOTPICKLE_LAUNCH_PR_NUMBER:String(prNumber),
  };
}

export function createFactoryIsolatedSessionController({
  platform=process.platform,repoRoot,
  verifyHead=readFactoryVerificationHead,
  prepareCandidate=prepareStagedHumanCandidate,
  runtimeFor=verificationSyntheticRuntime,
  homeExists=existsSync,
  portOccupied=factorySessionPortOccupied,
  probe=probeFactorySession,launch=spawn,
  stopTree=terminateVerificationProcessTree,
  hasFile=existsSync,delay=wait,now=Date.now,
  startTimeoutMs=START_TIMEOUT_MS,
}={}) {
  let owned=null,busy=false;

  const status=async()=>{
    const occupied=await portOccupied();
    if(owned&&alive(owned.child)&&occupied) {
      const ready=await probe(owned.head,owned.candidatePrNumber);
      return Object.freeze({
        state:"OWNED_PROCESS_OBSERVED",channel:"FACTORY_PR_TEST",
        sourceHead:owned.head,candidatePrNumber:owned.candidatePrNumber,
        url:FACTORY_SESSION_ENDPOINT.url,ready,
        ownerVerified:true,independentVerification:false,
      });
    }
    return Object.freeze({
      state:occupied?"UNOWNED_PORT_OCCUPIED":"NOT_RUNNING",
      channel:"FACTORY_PR_TEST",sourceHead:null,candidatePrNumber:null,
      url:FACTORY_SESSION_ENDPOINT.url,ready:false,
      ownerVerified:false,independentVerification:false,
    });
  };

  const stop=async expectedHead=>{
    if(!owned||owned.authorityHead!==expectedHead||!alive(owned.child))
      return receipt("BLOCKED","APP_PROCESS_NOT_OWNED",expectedHead);
    const finishedHead=owned.head;
    try{await stopTree(owned.child,{stderr:{write(){}}});}
    catch{return receipt("BLOCKED","APP_STOP_UNVERIFIED",expectedHead);}
    if(alive(owned.child)||await portOccupied())
      return receipt("BLOCKED","APP_STOP_UNVERIFIED",expectedHead);
    owned=null;
    return receipt("TEST_PASSED","APP_STOPPED_VERIFIED",finishedHead);
  };

  return Object.freeze({
    status,
    async control({action,expectedHead,root,sourceRequestId,candidateHead,candidatePrNumber,stageReceipt}={}) {
      if(platform!=="win32")return receipt("BLOCKED","WINDOWS_ONLY");
      if(!["factory-start","factory-stop"].includes(action))
        return receipt("BLOCKED","APP_ACTION_INVALID");
      if(busy)return receipt("BLOCKED","APP_CONTROL_BUSY");
      busy=true;
      try{
        if(!SHA.test(expectedHead||"") || await verifyHead({repoRoot})!==expectedHead)
          return receipt("BLOCKED","EXACT_HEAD_MISMATCH");
        if(action==="factory-stop")return await stop(expectedHead);
        if(owned&&alive(owned.child))
          return receipt("BLOCKED","APP_ALREADY_RUNNING_OWNED",expectedHead);
        if(await portOccupied())
          return receipt("BLOCKED","APP_PORT_OCCUPIED",expectedHead);
        if(!RID.test(sourceRequestId||"")||!SHA.test(candidateHead||"")||
            !Number.isSafeInteger(candidatePrNumber)||candidatePrNumber<1||
            candidatePrNumber>9999999)
          return receipt("BLOCKED","APP_CANDIDATE_INVALID",expectedHead);

        const attestation={root,sourceRequestId,expectedHead,candidateHead,
          candidatePrNumber,stageReceipt,repoRoot,verifyHead,platform};
        const prepared=await prepareCandidate(attestation);
        if(prepared?.state!=="TEST_PASSED"||prepared.code!=="APP_CANDIDATE_PREPARED")
          return receipt("BLOCKED",prepared?.code||"APP_CANDIDATE_STAGE_INVALID",expectedHead);
        const runtime=runtimeFor(`factory-pr-${candidatePrNumber}-${sourceRequestId}`);
        if(typeof runtime?.home!=="string"||!path.isAbsolute(runtime.home)||
           runtime?.runtimeEnv?.PLOTPICKLE_HOME!==runtime.home||
           typeof runtime.runtimeEnv.PLOTPICKLE_AUTH_STATE_PATH!=="string"||
           !runtime.runtimeEnv.PLOTPICKLE_AUTH_STATE_PATH.startsWith(runtime.home+path.sep))
          return receipt("BLOCKED","APP_CANDIDATE_STAGE_INVALID",expectedHead);
        if(homeExists(runtime.home))
          return receipt("BLOCKED","APP_CANDIDATE_HOME_EXISTS",expectedHead);
        const entry=path.join(prepared.repoRoot,"node_modules","vite","bin","vite.js");
        if(!hasFile(entry))
          return receipt("BLOCKED","APP_DEPENDENCIES_UNAVAILABLE",expectedHead);
        const env=factorySessionEnvironment(runtime,candidateHead,candidatePrNumber);
        let child;
        try{
          child=launch(process.execPath,[entry,"--host",FACTORY_SESSION_ENDPOINT.host,
            "--port",String(FACTORY_SESSION_ENDPOINT.port),"--strictPort"],{
            cwd:prepared.repoRoot,env,windowsHide:true,shell:false,
            stdio:"ignore",detached:false,
          });
        }catch{return receipt("BLOCKED","APP_START_FAILED",expectedHead);}
        if(!child?.pid)return receipt("BLOCKED","APP_START_FAILED",expectedHead);
        child.on?.("error",()=>{});
        owned={child,head:candidateHead,authorityHead:expectedHead,
          candidatePrNumber,sourceRequestId,at:now()};
        const deadline=now()+startTimeoutMs;
        while(now()<deadline){
          if(!alive(child))return receipt("BLOCKED","APP_START_FAILED",expectedHead);
          if(await probe(candidateHead,candidatePrNumber)){
            const rechecked=await prepareCandidate(attestation);
            if(!alive(child)||rechecked?.code!=="APP_CANDIDATE_PREPARED"||
               await verifyHead({repoRoot})!==expectedHead){
              const stopped=await stop(expectedHead);
              return receipt("BLOCKED",stopped.code==="APP_STOPPED_VERIFIED"
                ?"APP_SOURCE_CHANGED":"APP_STOP_UNVERIFIED",expectedHead);
            }
            return receipt("TEST_PASSED","APP_CANDIDATE_STARTED_VERIFIED",
              candidateHead,{candidateHead,candidatePrNumber,sourceRequestId});
          }
          await delay(1000);
        }
        const stopped=await stop(expectedHead);
        return receipt("BLOCKED",stopped.code==="APP_STOPPED_VERIFIED"
          ?"APP_START_TIMEOUT":"APP_STOP_UNVERIFIED",expectedHead);
      }finally{busy=false;}
    },
  });
}
