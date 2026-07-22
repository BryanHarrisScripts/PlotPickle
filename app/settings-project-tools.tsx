"use client";

import { useMemo, useState } from "react";
import type { PlotPickleProject } from "@/lib/project";
import { createCharacterDialogueReport, type CharacterDialogueReport } from "@/lib/screenplay-reports";
import { screenplayTermCategories, screenplayTerms, type ScreenplayTermCategory } from "@/lib/screenplay-terms";
import styles from "./settings-panel.module.css";

type ReportSort = "words" | "lines" | "scenes" | "name";

function speakingTime(seconds: number) {
  if (!seconds) return "0 sec";
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes} min ${remainder} sec` : `${minutes} min`;
}

function compareReports(a: CharacterDialogueReport, b: CharacterDialogueReport, sort: ReportSort) {
  if (sort === "name") return a.name.localeCompare(b.name);
  if (sort === "lines") return b.dialogueLines - a.dialogueLines || b.wordCount - a.wordCount;
  if (sort === "scenes") return b.sceneNumbers.length - a.sceneNumbers.length || b.wordCount - a.wordCount;
  return b.wordCount - a.wordCount || b.dialogueLines - a.dialogueLines;
}

export function ScreenplayReports({ project }: { project: PlotPickleProject }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ReportSort>("words");
  const report = useMemo(() => createCharacterDialogueReport(project), [project]);
  const characters = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return report.characters
      .filter((character) => !needle || `${character.name} ${character.role} ${character.description}`.toLowerCase().includes(needle))
      .sort((a, b) => compareReports(a, b, sort));
  }, [query, report.characters, sort]);

  return (
    <>
      <div className={styles.sectionHeading}>
        <div><p>Reports</p><h2>See the screenplay from an actor&apos;s point of view.</h2><span>Compare role size, dialogue, spoken words, scene coverage, and estimated speaking time. The report updates as the script changes.</span></div>
        <button type="button" className={styles.printButton} onClick={() => window.print()}>Print report</button>
      </div>

      <div className={styles.reportSummary}>
        <article><span>Story threads</span><strong>{project.storyThreads.length}</strong></article>
        <article><span>Arc checkpoints</span><strong>{project.characters.reduce((total, character) => total + (character.arcMatrix?.checkpoints.length ?? 0), 0)}</strong></article>
        <article><span>Sources & AI records</span><strong>{project.rights.attributions.length + project.rights.aiProvenance.length}</strong></article>
        <article><span>Revision snapshots</span><strong>{project.revisions.length}</strong></article>
        <article><span>Speaking characters</span><strong>{report.summary.charactersWithDialogue}</strong></article>
        <article><span>Dialogue lines</span><strong>{report.summary.dialogueLines.toLocaleString()}</strong></article>
        <article><span>Spoken words</span><strong>{report.summary.spokenWords.toLocaleString()}</strong></article>
        <article><span>Script scenes</span><strong>{report.summary.scenes}</strong></article>
      </div>

      <div className={styles.reportControls}>
        <label><span>Find a character</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, role, or description" /></label>
        <label><span>Rank characters by</span><select value={sort} onChange={(event) => setSort(event.target.value as ReportSort)}><option value="words">Most spoken words</option><option value="lines">Most dialogue lines</option><option value="scenes">Most scenes</option><option value="name">Character name</option></select></label>
      </div>

      {report.characters.length ? (
        <div className={styles.reportTableWrap}>
          <table className={styles.reportTable}>
            <thead><tr><th>Character</th><th>Role</th><th>Dialogue lines</th><th>Words</th><th>Scenes</th><th>Speaking time</th></tr></thead>
            <tbody>{characters.map((character) => (
              <tr key={character.id}>
                <td><strong>{character.name}</strong>{character.description ? <small>{character.description}</small> : null}</td>
                <td>{character.role || "Not yet described"}</td>
                <td>{character.dialogueLines.toLocaleString()}</td>
                <td>{character.wordCount.toLocaleString()}</td>
                <td>{character.sceneNumbers.length}{character.firstScene ? <small>Scenes {character.firstScene}{character.lastScene !== character.firstScene ? `–${character.lastScene}` : ""}</small> : null}</td>
                <td>{speakingTime(character.estimatedSpeakingSeconds)}</td>
              </tr>
            ))}</tbody>
          </table>
          {!characters.length ? <p className={styles.noResults}>No characters match that search.</p> : null}
        </div>
      ) : (
        <div className={styles.empty}><p>No character report is available yet.</p><span>Write dialogue in Screenplay or import a TXT, Fountain, or Final Draft FDX screenplay. Characters with no dialogue will also appear once they are added to the project.</span></div>
      )}

      {characters.some((character) => character.sceneHeadings.length) ? (
        <div className={styles.sceneBreakdown}>
          <h3>Scene breakdown by character</h3>
          {characters.filter((character) => character.sceneHeadings.length).map((character) => (
            <details key={character.id}><summary><strong>{character.name}</strong><span>{character.sceneNumbers.length} scene{character.sceneNumbers.length === 1 ? "" : "s"}</span></summary><ol>{character.sceneHeadings.map((scene) => <li key={`${character.id}-${scene.number}`}><b>Scene {scene.number}</b><span>{scene.heading}</span></li>)}</ol></details>
          ))}
        </div>
      ) : null}
      <p className={styles.reportNote}>“Dialogue lines” counts dialogue entries, not visual word-wrapped lines on a printed page. Speaking time is estimated at 130 words per minute and excludes pauses, action, and rehearsal choices.</p>
    </>
  );
}

export function TerminologyIndex() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ScreenplayTermCategory | "All">("All");
  const terms = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return screenplayTerms.filter((item) => (category === "All" || item.category === category)
      && (!needle || `${item.term} ${item.category} ${item.definition} ${item.example ?? ""}`.toLowerCase().includes(needle)));
  }, [category, query]);

  return (
    <>
      <div className={styles.sectionHeading}><div><p>Terminology Index</p><h2>Understand the language of screenwriting.</h2><span>Search plain-language definitions for screenplay formatting, story structure, character work, production, and PlotPickle&apos;s 24/96 method.</span></div></div>
      <div className={styles.termSearch}><label><span>Search terms</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try slugline, subtext, Ghost, or V.O." /></label></div>
      <div className={styles.termCategories} aria-label="Terminology categories">
        <button type="button" className={category === "All" ? styles.selectedCategory : ""} onClick={() => setCategory("All")}>All</button>
        {screenplayTermCategories.map((item) => <button type="button" key={item} className={category === item ? styles.selectedCategory : ""} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
      <div className={styles.termCount}>{terms.length} term{terms.length === 1 ? "" : "s"}</div>
      <div className={styles.termList}>{terms.map((item) => (
        <article key={item.term}><div><h3>{item.term}</h3><span>{item.category}</span></div><p>{item.definition}</p>{item.example ? <small>Example: {item.example}</small> : null}</article>
      ))}</div>
      {!terms.length ? <p className={styles.noResults}>No terminology matches that search.</p> : null}
    </>
  );
}
