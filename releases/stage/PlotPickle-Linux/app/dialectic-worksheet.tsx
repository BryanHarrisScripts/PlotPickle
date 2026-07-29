"use client";

import { useState } from "react";
import type { PlotPickleProject } from "@/lib/project";
import styles from "./dialectic-worksheet.module.css";

export default function DialecticWorksheet({ project, onProjectChange }: { project: PlotPickleProject; onProjectChange: (project: PlotPickleProject) => void }) {
  const [thesis, setThesis] = useState(project.story.theme);
  const [antithesis, setAntithesis] = useState(project.story.antiTheme);
  const [synthesis, setSynthesis] = useState(project.development.foundations.transformation);
  const [endingProof, setEndingProof] = useState(project.development.foundations.endingProof);
  const [status, setStatus] = useState("Map the competing beliefs, then save the synthesis into the canonical project.");

  function save() {
    const now = new Date().toISOString();
    onProjectChange({
      ...project,
      metadata: { ...project.metadata, updatedAt: now },
      story: { ...project.story, theme: thesis.trim(), antiTheme: antithesis.trim() },
      development: {
        ...project.development,
        foundations: { ...project.development.foundations, transformation: synthesis.trim(), endingProof: endingProof.trim() },
      },
    });
    setStatus("Dialectic worksheet saved to Theme, Anti-theme, Transformation and Ending Proof.");
  }

  const evidence = [project.blocks[0], project.blocks[11], project.blocks[23]].filter(Boolean);
  return (
    <section className={styles.workspace} aria-labelledby="dialectic-title">
      <header><div><span>Theme argument worksheet</span><h2 id="dialectic-title">Thesis → Antithesis → Synthesis</h2><p>Turn theme into a dramatic argument expressed through choices and consequences, not a lesson delivered in dialogue.</p></div><button type="button" onClick={save}>Save worksheet</button></header>
      <div className={styles.columns}>
        <label><b>Thesis</b><span>The belief the story initially makes attractive or familiar.</span><textarea rows={7} value={thesis} onChange={(event) => setThesis(event.target.value)} placeholder="Connection requires trust, even when trust creates risk." /></label>
        <label><b>Antithesis</b><span>The opposing belief that gains real evidence and power.</span><textarea rows={7} value={antithesis} onChange={(event) => setAntithesis(event.target.value)} placeholder="Self-protection is the only reliable form of survival." /></label>
        <label><b>Synthesis</b><span>The harder truth reached through the protagonist’s changed strategy.</span><textarea rows={7} value={synthesis} onChange={(event) => setSynthesis(event.target.value)} placeholder="Trust becomes meaningful only when chosen with clear boundaries." /></label>
      </div>
      <label className={styles.proof}><b>Ending proof</b><span>What visible final choice proves the synthesis without explaining it?</span><textarea rows={5} value={endingProof} onChange={(event) => setEndingProof(event.target.value)} /></label>
      <div className={styles.evidence}><h3>Argument evidence in the current structure</h3>{evidence.map((block) => <article key={block.id}><span>Block {block.number}</span><strong>{block.title}</strong><p>{block.choice || block.emotionalTurn || block.summary || "No thematic choice recorded yet."}</p></article>)}</div>
      <p className={styles.status} role="status">{status}</p>
    </section>
  );
}
