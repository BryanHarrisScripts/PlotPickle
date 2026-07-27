"use client";

import { useMemo, useState } from "react";
import type { PlotPickleProject } from "@/lib/project";
import { feedbackTargetOptions } from "@/lib/unified-feedback-store";
import {
  approveWritersRoomProposal,
  createWritersRoomProposal,
  createWritersRoomSession,
  updateWritersRoomSession,
  writersRoomSessions,
} from "@/lib/writers-room";
import styles from "./writers-room-panel.module.css";

type Props = { project: PlotPickleProject; onProjectChange: (project: PlotPickleProject) => void };

export default function WritersRoomPanel({ project, onProjectChange }: Props) {
  const sessions = useMemo(() => writersRoomSessions(project), [project]);
  const targets = useMemo(() => feedbackTargetOptions(project), [project]);
  const [selectedId, setSelectedId] = useState(sessions[0]?.session.id ?? "");
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [meetUrl, setMeetUrl] = useState("");
  const [calendarEventId, setCalendarEventId] = useState("");
  const [proposal, setProposal] = useState("");
  const [targetKey, setTargetKey] = useState("");
  const selected = sessions.find(({ session }) => session.id === selectedId)?.session ?? sessions[0]?.session;

  function createSession() {
    const next = createWritersRoomSession(project, { title, startsAt, meetUrl, calendarEventId });
    onProjectChange(next);
    setTitle(""); setStartsAt(""); setMeetUrl(""); setCalendarEventId("");
  }

  function patch(patchValue: Record<string, unknown>) {
    if (!selected) return;
    onProjectChange(updateWritersRoomSession(project, selected.id, (session) => ({ ...session, ...patchValue })));
  }

  function addProposal() {
    if (!selected || !proposal.trim()) return;
    const option = targets.find((item) => `${item.kind}:${item.target.targetId}` === targetKey) ?? targets[0];
    if (!option) return;
    patch({ proposals: [...selected.proposals, createWritersRoomProposal(option.target, proposal)] });
    setProposal("");
  }

  return (
    <section className={styles.room} aria-label="Writers’ Room sessions">
      <header>
        <div><p>Writers’ Room</p><h2>Plan the conversation. Preserve every decision.</h2></div>
        <span>Works locally. Google Meet and Calendar are optional.</span>
      </header>
      <div className={styles.create}>
        <label><span>Session title</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label><span>Date and time</span><input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
        <label><span>Meet link · optional</span><input value={meetUrl} onChange={(event) => setMeetUrl(event.target.value)} placeholder="https://meet.google.com/…" /></label>
        <label><span>Calendar event · optional</span><input value={calendarEventId} onChange={(event) => setCalendarEventId(event.target.value)} /></label>
        <button type="button" disabled={!title.trim()} onClick={createSession}>Plan session</button>
      </div>
      <div className={styles.layout}>
        <nav aria-label="Writers’ Room history">
          {sessions.map(({ session }) => <button type="button" key={session.id} aria-pressed={selected?.id === session.id} onClick={() => setSelectedId(session.id)}><strong>{session.title}</strong><span>{new Date(session.startsAt).toLocaleString()}</span></button>)}
          {!sessions.length ? <p>No sessions yet. Plan one without connecting Google.</p> : null}
        </nav>
        {selected ? <article className={styles.detail}>
          <div className={styles.links}>
            {selected.meetUrl ? <a href={selected.meetUrl} target="_blank" rel="noreferrer">Open Meet</a> : <span>No Meet link</span>}
            {selected.calendarEventId ? <button type="button" onClick={() => void navigator.clipboard?.writeText(selected.calendarEventId)}>Copy Calendar reference</button> : null}
          </div>
          <label><span>Agenda · one item per line</span><textarea rows={4} value={selected.agenda.join("\n")} onChange={(event) => patch({ agenda: event.target.value.split("\n").filter(Boolean) })} /></label>
          <label><span>Session notes</span><textarea rows={5} value={selected.notes} onChange={(event) => patch({ notes: event.target.value })} /></label>
          <label><span>Decisions · one per line</span><textarea rows={4} value={selected.decisions.join("\n")} onChange={(event) => patch({ decisions: event.target.value.split("\n").filter(Boolean) })} /></label>
          <label><span>Unresolved questions · one per line</span><textarea rows={4} value={selected.unresolvedQuestions.join("\n")} onChange={(event) => patch({ unresolvedQuestions: event.target.value.split("\n").filter(Boolean) })} /></label>
          <label><span>Session summary</span><textarea rows={4} value={selected.summary} onChange={(event) => patch({ summary: event.target.value })} /></label>
          <div className={styles.proposal}>
            <label><span>Proposal target</span><select value={targetKey} onChange={(event) => setTargetKey(event.target.value)}>{targets.map((item) => <option key={`${item.kind}:${item.target.targetId}`} value={`${item.kind}:${item.target.targetId}`}>{item.target.label}</option>)}</select></label>
            <label><span>Proposed project change</span><textarea rows={3} value={proposal} onChange={(event) => setProposal(event.target.value)} /></label>
            <button type="button" disabled={!proposal.trim()} onClick={addProposal}>Record proposal</button>
          </div>
          <div className={styles.proposals}>
            {selected.proposals.map((item) => <div key={item.id}><p>{item.summary}</p><span>{item.target.label} · {item.status}</span>{item.status === "proposed" ? <button type="button" onClick={() => onProjectChange(approveWritersRoomProposal(project, selected.id, item.id))}>Approve as feedback proposal</button> : null}</div>)}
          </div>
          <p className={styles.safety}>Approval records the decision as anchored feedback. It does not overwrite canonical story content.</p>
        </article> : null}
      </div>
    </section>
  );
}
