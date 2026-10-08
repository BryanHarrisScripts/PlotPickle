"use client";
import { useCallback, useEffect, useState } from "react";
import { authenticatedComputeFetch as fetch } from "../../core/auth/profile-request-browser";
type Event = { id: string; at: string; capability: string; route: string; runtime: string; provider: string; stage: string; code: string; jobId: string };
export default function CapabilityDiagnosticsLog() {
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/ai-routing/diagnostics", { cache: "no-store" });
      if (!response.ok) throw new Error("Diagnostics unavailable. Unlock your profile or retry.");
      const body = await response.json(); setEvents(body.events || []); setError("");
    } catch (failure) { setEvents([]); setError(failure instanceof Error ? failure.message : "Diagnostics unavailable."); }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 10000);
    const update = () => { void refresh(); };
    window.addEventListener("plotpickle:setup-status-refresh", update);
    return () => { window.clearInterval(timer); window.removeEventListener("plotpickle:setup-status-refresh", update); };
  }, [refresh]);
  return <details style={{ marginTop: 16 }}><summary>Connectivity diagnostics</summary>
    <p>Read-only operational history for the current profile. Provider keys and story text are excluded.</p>
    <button type="button" onClick={() => void refresh()}>Refresh diagnostics</button>
    {error ? <p role="status">{error}</p> : null}
    <div role="log" aria-label="Capability routing diagnostic history" style={{ maxHeight: 240, overflow: "auto" }}>
      {events.length ? events.map((event) => <p key={event.id}>{new Date(event.at).toLocaleTimeString()} · {event.capability} · {event.route} · runtime {event.runtime} · provider {event.provider} · {event.stage} · {event.code.replaceAll("-", " ")}{event.jobId ? ` · job ${event.jobId}` : ""}</p>) : <p>No routing events recorded.</p>}
    </div>
  </details>;
}
