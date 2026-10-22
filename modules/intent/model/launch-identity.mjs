/**
 * #3222 Human-visible source/launch identity.
 * Only the exact MCP-injected launch contract may claim a channel. Unknown
 * standalone and packaged launchers must visibly say UNVERIFIED.
 */
const SHA=/^[a-f0-9]{40}$/u;
const PR=/^[1-9][0-9]{0,6}$/u;
export function plotpickleLaunchIdentity(env={}) {
  const head=String(env.PLOTPICKLE_LAUNCH_SOURCE_HEAD??"").toLowerCase();
  const contract=String(env.PLOTPICKLE_STARTUP_CONTRACT??"");
  const recognized=SHA.test(head)&&
    contract===`plotpickle-startup-v4-${head}-normal-local-human-vite-source`;
  const short=recognized?head.slice(0,12):null;
  const channel=String(env.PLOTPICKLE_LAUNCH_CHANNEL??"");
  const pr=String(env.PLOTPICKLE_LAUNCH_PR_NUMBER??"");
  if(recognized&&channel==="main"&&!pr)
    return Object.freeze({channel:"MAIN",label:`MAIN · MERGED · ${short}`,
      sourceHead:head,candidatePrNumber:null,verifiedContract:true});
  if(recognized&&channel==="pr-test"&&PR.test(pr))
    return Object.freeze({channel:"PR_TEST",
      label:`UAT · PR #${pr} · UNMERGED · ${short}`,
      sourceHead:head,candidatePrNumber:Number(pr),verifiedContract:true});
  return Object.freeze({channel:"UNVERIFIED",label:"SOURCE / VERSION UNVERIFIED",
    sourceHead:null,candidatePrNumber:null,verifiedContract:false});
}
