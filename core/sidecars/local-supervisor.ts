import { spawn, type ChildProcess } from "node:child_process";
import type { SidecarEvidence, SidecarState, SidecarStatus } from "./contract";

export type SidecarMessage = Readonly<{
  kind: "status" | "request" | "result";
  state?: SidecarState;
  evidence?: readonly SidecarEvidence[];
  target?: string;
  source?: string;
  request?: unknown;
  result?: unknown;
}>;

export type SidecarSpec = Readonly<{
  id: string;
  command: string;
  args?: readonly string[];
  enabled?: boolean;
  ipc?: boolean;
  onMessage?: (message: SidecarMessage) => void;
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
    return this.states.get(id) ?? { id, state: "unavailable", evidence: [] };
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
        const message = raw as SidecarMessage;
        if (message.kind === "status" && isSidecarState(message.state)) {
          this.mark(spec.id, message.state, normalizeEvidence(message.evidence));
        }
        spec.onMessage?.(message);
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

  send(id: string, message: SidecarMessage): boolean {
    const child = this.children.get(id);
    if (!child?.connected) return false;
    child.send(message);
    return true;
  }

  stop(id: string): void {
    this.children.get(id)?.kill();
    this.children.delete(id);
    this.states.set(id, { id, state: "stopped", evidence: [] });
  }
}
