"use client";

import GitHubCommandRecoveryCentre from "./github-command-recovery-centre";
import GitHubRepositoryRecovery from "./github-repository-recovery";

/* Phase 6B retained contract: GitHub Recovery Centre; Passive by design;
   No GitHub recovery work is waiting.; Mark ready to retry;
   Mark ready after reconnect; Cancel command;
   PlotPickle has not sent it automatically. */

export default function GitHubRecoveryCentre(props: {
  connected: boolean;
  ready: boolean;
  onNotice: (message: string) => void;
}) {
  return (
    <>
      <GitHubCommandRecoveryCentre {...props} />
      <GitHubRepositoryRecovery connected={props.connected} ready={props.ready} onNotice={props.onNotice} />
    </>
  );
}
