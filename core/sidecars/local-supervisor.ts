import { spawn, type ChildProcess } from "node:child_process";
import type { SidecarStatus } from "./contract";

export type SidecarSpec = Readonly<{ id: string; command: string; args?: readonly string[]; enabled?: boolean }>;

export class LocalSidecarSupervisor {
  private readonly children = new Map<string, ChildProcess>();
  private readonly states = new Map<string, SidecarStatus>();

  status(id: string): SidecarStatus {
    return this.states.get(id) ?? { id, state: "unavailable", evidence: [] };
  }

  start(spec: SidecarSpec): SidecarStatus {
    if (spec.enabled === false) return this.status(spec.id);
    this.states.set(spec.id, { id: spec.id, state: "starting", evidence: [] });
    const child = spawn(spec.command, [...(spec.args ?? [])], { stdio: "ignore", windowsHide: true });
    this.children.set(spec.id, child);
    child.once("spawn", () => this.states.set(spec.id, { id: spec.id, state: "ready", evidence: [] }));
    child.once("error", (error) => this.states.set(spec.id, { id: spec.id, state: "failed", evidence: [{ kind: "process-error", summary: error.message, observedAt: new Date().toISOString() }] }));
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
}
