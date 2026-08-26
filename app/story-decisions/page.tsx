"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authenticatedProfileFetch } from "@/core/auth/profile-request-browser";
import { loadFoundationProject } from "@/core/storage/foundation-project-browser";
import styles from "./story-decisions.module.css";

type Decision = {
  decisionId: string; projectId: string; baseRevision: string; decisionClass: string;
  severity: "low" | "medium" | "high"; priority: number; targetRefs: string[]; curriculumRefs: string[];
  evidenceRefs: string[]; question: string; whyHuman: string; proposedChange: string; alternatives: string[];
  predictedImpactRefs: string[]; visualContext: Record<string, unknown> | null; status: string; createdAt: string; updatedAt: string;
  provenance: { councilSummary: string; transcriptRef: string }; integrity: { writesCanon: false; requiresWorkbenchValidation: true };
};
type ListResponse = { ok?: boolean; decisions?: Decision[]; attentionCount?: number; message?: string };
type ActionResponse = { ok?: boolean; decision?: Decision; message?: string; refreshRequired?: boolean };

function currentProject() {
  try { const project = loadFoundationProject(); return { id: project.id, revision: String(project.revision), title: project.title }; }
  catch { return { id: "", revision: "", title: "No active story" }; }
}
function date(value: string) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "Not recorded" : parsed.toLocaleString(); }
function safeVisual(value: unknown) { return typeof value === "string" && (value.startsWith("/assets/") || value.startsWith("/api/local-ai/assets/")) ? value : ""; }

export default function StoryDecisionsPage() {
  const [project, setProject] = useState(currentProject());
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState("Loading Story Decisions…");
  const [busy, setBusy] = useState(false);
  const [replacement, setReplacement] = useState("");
  const [rationale, setRationale] = useState("");
  const [paused, setPaused] = useState(false);

  const selected = useMemo(() => decisions.find((item) => item.decisionId === selectedId) || decisions[0] || null, [decisions, selectedId]);
  const attentionCount = useMemo(() => decisions.filter((item) => ["new", "reviewing", "deferred"].includes(item.status)).length, [decisions]);

  const refresh = useCallback(async () => {
    const nextProject = currentProject(); setProject(nextProject);
    const query = nextProject.id ? `?projectId=${encodeURIComponent(nextProject.id)}` : "";
    const response = await authenticatedProfileFetch(`/api/story-decisions${query}`, { cache: "no-store" });
    const body = await response.json() as ListResponse;
    if (!response.ok) throw new Error(body.message || "Story Decisions could not be loaded.");
    const next = body.decisions || [];
    setDecisions(next);
    setSelectedId((current) => next.some((item) => item.decisionId === current) ? current : next[0]?.decisionId || "");
    setNotice(next.length ? "" : "No Story Decisions need your attention right now.");
  }, []);

  useEffect(() => { void refresh().catch((error) => setNotice(error instanceof Error ? error.message : "Story Decisions could not be loaded.")); }, [refresh]);

  async function respond(responseClass: string, extra: Record<string, unknown> = {}) {
    if (!selected || busy) return;
    setBusy(true); setNotice("");
    try {
      const latest = currentProject(); setProject(latest);
      const response = await authenticatedProfileFetch("/api/story-decisions", {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "respond", decisionId: selected.decisionId,
          response: { responseClass, currentRevision: latest.revision, replacementContent: replacement, rationale, ...extra },
        }),
      });
      const body = await response.json() as ActionResponse;
      if (!response.ok) {
        if (body.refreshRequired) { setNotice("Story changed since this question was created. PlotPickle marked it stale; refresh the workflow before deciding."); await refresh(); return; }
        throw new Error(body.message || "That Story Decision could not be recorded.");
      }
      setReplacement(""); setRationale("");
      setNotice(responseClass === "defer" ? "Decision deferred. It remains in your Story Decision channel." : responseClass === "request-alternatives" ? "Alternative request recorded for the workflow." : "Decision recorded. It is ready for Story Workbench validation; canon has not changed.");
      await refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "That Story Decision could not be recorded."); }
    finally { setBusy(false); }
  }

  const visualUrl = safeVisual(selected?.visualContext?.assetUrl);
  return <main className={styles.page}>
    <header className={styles.hero}>
      <div><p>Story / Decisions</p><h1>{attentionCount === 1 ? "1 Story Decision needs you" : `${attentionCount} Story Decisions need you`}</h1><span>Only questions that require writer/editor judgment appear here. Agent chatter, routine checks and locked future frontiers stay out.</span></div>
      <div className={styles.heroActions}><button type="button" onClick={() => { setPaused((value) => !value); }}>{paused ? "Resume interruptions" : "Do not interrupt me now"}</button><button type="button" onClick={() => void refresh()}>Refresh</button><Link href="/?workspace=dashboard">Back to Dashboard</Link></div>
    </header>
    {paused ? <p className={styles.pause}>Interruptions paused. Decisions remain stored locally and nothing is discarded.</p> : null}
    <div className={styles.layout}>
      <aside className={styles.list} aria-label="Story Decisions"><header><strong>{project.title}</strong><small>Current revision {project.revision || "unavailable"}</small></header>{decisions.map((item) => <button key={item.decisionId} aria-current={selected?.decisionId === item.decisionId ? "true" : undefined} data-status={item.status} onClick={() => { setSelectedId(item.decisionId); setReplacement(""); setRationale(""); }}><span><b>{item.status === "new" ? "Needs you" : item.status}</b><small>{item.question}</small></span><em>{item.severity}</em></button>)}{!decisions.length ? <p>No Human judgment is currently required.</p> : null}</aside>
      <section className={styles.detail} aria-live="polite">{selected ? <>
        <header className={styles.cardHeader} data-severity={selected.severity}><div><span>{selected.decisionClass.replaceAll("-", " ")}</span><h2>{selected.question}</h2><p>{selected.whyHuman}</p></div><b>{selected.status}</b></header>
        {selected.status === "stale" || selected.baseRevision !== project.revision ? <div className={styles.stale}><strong>Story changed since this question was created.</strong><p>This Decision was created against revision {selected.baseRevision}; the active story is revision {project.revision}. Refresh the workflow before answering.</p></div> : null}
        {visualUrl ? <figure className={styles.visual}><img src={visualUrl} alt={String(selected.visualContext?.alt || "Affected story visual")} /><figcaption>{String(selected.visualContext?.label || "Current affected story visual")}</figcaption></figure> : null}
        <div className={styles.columns}><section><h3>Recommendation</h3><p>{selected.proposedChange || "No single recommendation is being forced. Review the alternatives and evidence."}</p></section><section><h3>If you do nothing</h3><p>{selected.predictedImpactRefs.length ? `These downstream areas may remain blocked or uncertain: ${selected.predictedImpactRefs.slice(0, 5).join(", ")}.` : "The current story remains unchanged; the workflow keeps this decision unresolved."}</p></section></div>
        {selected.alternatives.length ? <section><h3>Alternatives</h3><div className={styles.alternatives}>{selected.alternatives.map((alternative, index) => <button type="button" key={`${index}-${alternative}`} disabled={busy || selected.status === "stale" || selected.baseRevision !== project.revision} onClick={() => void respond("select-alternative", { selectedAlternativeId: `alternative-${index + 1}`, replacementContent: alternative })}><b>Option {index + 1}</b><span>{alternative}</span></button>)}</div></section> : null}
        <section><h3>Your response</h3><div className={styles.actions}><button disabled={busy || !selected.proposedChange || selected.status === "stale" || selected.baseRevision !== project.revision} onClick={() => void respond("accept-proposal")}>Accept recommendation</button><button disabled={busy || selected.status === "stale" || selected.baseRevision !== project.revision} onClick={() => void respond("keep-current")}>Reject / keep current story</button><button disabled={busy || selected.status === "stale" || selected.baseRevision !== project.revision} onClick={() => void respond("request-alternatives")}>Ask for alternatives</button><button disabled={busy} onClick={() => void respond("defer")}>Defer</button><Link href="/?workspace=build">Open in story</Link></div>
          <label className={styles.field}><span>Modify or write your own answer</span><textarea rows={4} value={replacement} onChange={(event) => setReplacement(event.target.value)} placeholder="Write the story choice you want PlotPickle to validate…" /></label>
          <label className={styles.field}><span>Optional note</span><input value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Why this choice fits your story" /></label>
          <button className={styles.primary} disabled={busy || !replacement.trim() || selected.status === "stale" || selected.baseRevision !== project.revision} onClick={() => void respond(selected.proposedChange ? "modify-proposal" : "freeform-decision")}>{busy ? "Recording…" : "Send to Story Workbench"}</button>
        </section>
        <details className={styles.evidence}><summary>Evidence, provenance and impact</summary><p><b>Created</b> {date(selected.createdAt)}</p><p><b>Base revision</b> {selected.baseRevision}</p><p><b>Story targets</b> {selected.targetRefs.join(", ") || "None recorded"}</p><p><b>Curriculum</b> {selected.curriculumRefs.join(", ") || "None recorded"}</p><p><b>Evidence</b> {selected.evidenceRefs.join(", ") || "None recorded"}</p><p><b>Council</b> {selected.provenance.councilSummary || "Structured Council result recorded."}</p>{selected.provenance.transcriptRef ? <p><b>Optional BUZZ transcript</b> {selected.provenance.transcriptRef}</p> : null}<p><b>Authority</b> Human response → Story Workbench validation. This channel does not write PPF canon.</p></details>
      </> : <div className={styles.empty}><h2>{notice || "No Story Decisions need you."}</h2><p>PlotPickle will only interrupt when evidence cannot responsibly resolve a meaningful creative choice.</p></div>}</section>
    </div>{notice && selected ? <p className={styles.notice}>{notice}</p> : null}
  </main>;
}
