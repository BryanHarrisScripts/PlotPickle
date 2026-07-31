export type BuzzManagedLifecycle =
  | "unconfigured"
  | "available"
  | "prerequisite-required"
  | "configuring"
  | "stopped"
  | "starting"
  | "running"
  | "stopping"
  | "degraded"
  | "repair-required"
  | "unavailable";

export type BuzzManagedRuntimeState = {
  bundleAvailable: boolean;
  dockerAvailable: boolean;
  installed: boolean;
  configured: boolean;
  running: boolean;
  reachable: boolean;
  backups: number;
  lifecycle: BuzzManagedLifecycle | string;
};

export type BuzzManagedRuntimeActions = {
  install: boolean;
  start: boolean;
  stop: boolean;
  restart: boolean;
  repair: boolean;
  update: boolean;
  backup: boolean;
  remove: boolean;
};

export function getBuzzManagedRuntimeActions(state: BuzzManagedRuntimeState): BuzzManagedRuntimeActions {
  const prerequisitesReady = state.bundleAvailable && state.dockerAvailable;
  const transitional = ["configuring", "starting", "stopping"].includes(state.lifecycle);
  const repairState = ["degraded", "repair-required"].includes(state.lifecycle);

  return {
    install: prerequisitesReady && !state.installed && !transitional,
    start: prerequisitesReady && state.installed && state.configured && !state.running && !transitional,
    stop: state.installed && state.running && !transitional,
    restart: prerequisitesReady && state.installed && state.running && !transitional,
    repair: prerequisitesReady && state.installed && !state.running && repairState && !transitional,
    update: prerequisitesReady && state.installed && !state.running && !transitional,
    backup: state.installed && state.running && state.reachable && !transitional,
    remove: state.installed && !state.running && !transitional,
  };
}

export function describeBuzzManagedRuntime(state: BuzzManagedRuntimeState) {
  if (!state.bundleAvailable) {
    return {
      title: "Pinned bundle unavailable",
      tone: "Neutral · unavailable",
      detail: "PlotPickle cannot install managed Buzz until the packaged manifest and checksums are available.",
    };
  }
  if (!state.dockerAvailable) {
    return {
      title: "Docker prerequisite required",
      tone: "Yellow · prerequisite",
      detail: "Install and start Docker Desktop or Docker Engine with Compose v2 before managing the local relay.",
    };
  }
  if (!state.installed) {
    return {
      title: "Ready to install",
      tone: "Blue · available",
      detail: "The pinned local-only Buzz bundle passed its static packaging gate.",
    };
  }
  if (state.running && state.reachable) {
    return {
      title: "Managed Buzz running",
      tone: "Green · healthy",
      detail: "The local containers are running and the relay answered its latest health check.",
    };
  }
  if (state.running) {
    return {
      title: "Managed Buzz degraded",
      tone: "Yellow · degraded",
      detail: "The containers are running, but the local relay did not pass its latest health check.",
    };
  }
  if (["degraded", "repair-required"].includes(state.lifecycle)) {
    return {
      title: "Repair required",
      tone: "Yellow · repair",
      detail: "The runtime is stopped and can be repaired after its pinned bundle and Docker prerequisites pass validation.",
    };
  }
  return {
    title: "Managed Buzz stopped",
    tone: "Neutral · stopped",
    detail: "The runtime is installed but no Buzz containers are running.",
  };
}
