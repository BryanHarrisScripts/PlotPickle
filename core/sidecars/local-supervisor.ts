import { spawn, type ChildProcess } from "node:child_process";
import type { SidecarEvidence, SidecarState, SidecarStatus } from "./contract";

export type SidecarStatusMessage = Readonly<{
  kind: "status";
  state: SidecarState;
  evidence?: readonly SidecarEvidence[];
}>;

export type SidecarSpec = Readonly<{
  id: string;
  command: string;
  args?: readonly string[];
  enabled?: boolean;
  ipc?: boolean;
}>;

function isSidecarState(value: unknown): value is SidecarState {
  return ["starting", "ready", "degraded", "unavailable", "failed", "stopped"].includes(String(value));
}

function normalizeEvidence(value: unknown): readonly SidecarEvidence[] {
  if (!Array.isArray(value)) return [];
  return Object.freeze(value.slice(0, 32).map((item) => Object.freeze({
    kind: String(item?.kind ?? "service-evidence").slice(0, 120),
    summary: String(item?.summary ?? "").slice(0, 1200),
    observedAt: String(item?.observedAt ?? new Date().toISOString()).slice(0, 80),
  })));
}

export class LocalSidecarSupervisor {
  private readonly children = new Map<string, ChildProcess>();
  private readonly states = new Map<string, SidecarStatus>();

  status(id: string): SidecarStatus {
    const status = this.states.get(id) ?? { id, state: "unavailable", evidence: [] };
    const pid = this.children.get(id)?.pid;
    return pid ? { ...status, pid } : status;
  }

  mark(id: string, state: SidecarStatus["state"], evidence: SidecarStatus["evidence"] = []): SidecarStatus {
    const status = Object.freeze({ id, state, evidence: Object.freeze([...evidence]) });
    this.states.set(id, status);
    return status;
  }

  start(spec: SidecarSpec): SidecarStatus {
    if (spec.enabled === false) return this.status(spec.id);
    this.states.set(spec.id, { id: spec.id, state: "starting", evidence: [] });
    const child = spawn(spec.command, [...(spec.args ?? [])], {
      stdio: spec.ipc ? ["ignore", "ignore", "ignore", "ipc"] : "ignore",
      windowsHide: true,
    });
    this.children.set(spec.id, child);
    child.once("spawn", () => {
      if (!spec.ipc) this.states.set(spec.id, { id: spec.id, state: "ready", evidence: [] });
    });
    if (spec.ipc) {
      child.on("message", (raw) => {
        if (!raw || typeof raw !== "object") return;
        const message = raw as SidecarStatusMessage;
        if (message.kind !== "status" || !isSidecarState(message.state)) return;
        this.mark(spec.id, message.state, normalizeEvidence(message.evidence));
      });
    }
    child.once("error", (error) => this.states.set(spec.id, {
      id: spec.id,
      state: "failed",
      evidence: [{ kind: "process-error", summary: error.message, observedAt: new Date().toISOString() }],
    }));
    child.once("exit", (code) => {
      this.children.delete(spec.id);
      const current = this.status(spec.id);
      if (current.state !== "failed") this.states.set(spec.id, { ...current, state: code === 0 ? "stopped" : "degraded" });
    });
    return this.status(spec.id);
  }

  stop(id: string): void {
    this.children.get(id)?.kill();
    this.children.delete(id);
    this.states.set(id, { id, state: "stopped", evidence: [] });
  }

  async stopAndWait(id: string, timeoutMs = 5000): Promise<SidecarStatus> {
    const child = this.children.get(id);
    if (!child) return this.mark(id, "stopped");
    if (child.pid === undefined && this.status(id).state === "failed") {
      this.children.delete(id);
      return this.mark(id, "stopped");
    }
    const exited = await new Promise<boolean>((resolve) => {
      let timer: ReturnType<typeof setTimeout>;
      const finish = (confirmed: boolean) => {
        clearTimeout(timer);
        child.removeListener("exit", onExit);
        child.removeListener("error", onError);
        resolve(confirmed);
      };
      const onExit = () => finish(true);
      const onError = () => finish(child.pid === undefined);
      child.once("exit", onExit);
      child.once("error", onError);
      timer = setTimeout(() => finish(false), Math.max(1, timeoutMs));
      if (child.exitCode !== null || child.signalCode !== null) finish(true);
      else child.kill();
    });
    if (exited) {
      this.children.delete(id);
      return this.mark(id, "stopped");
    }
    return this.mark(id, "failed", [{ kind: "shutdown-timeout", summary: "Owned service did not confirm exit within the shutdown window.", observedAt: new Date().toISOString() }]);
  }
}
