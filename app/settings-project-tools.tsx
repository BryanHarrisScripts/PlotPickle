"use client";

import { useMemo, useState } from "react";
import type { PlotPickleProject } from "@/lib/project";
import { createCharacterDialogueReport, type CharacterDialogueReport } from "@/lib/screenplay-reports";
import { screenplayTermCategories, screenplayTerms, type ScreenplayTermCategory } from "@/lib/screenplay-terms";
import panelStyles from "./settings-panel.module.css";
import styles from "./settings-project-tools.module.css";

type ReportSort = "words" | "lines" | "scenes" | "coverage" | "name";
type TermView = "concise" | "expanded";

function duration(seconds: number) {
  if (!seconds) return "0 sec";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours ? `${hours} hr` : "", minutes ? `${minutes} min` : "", !hours && remainder ? `${remainder} sec` : ""].filter(Boolean).join(" ");
}

function compareReports(a: CharacterDialogueReport, b: CharacterDialogueReport, sort: ReportSort) {
  if (sort === "name") return a.name.localeCompare(b.name);
  if (sort === "lines") return b.dialogueLines - a.dialogueLines || b.wordCount - a.wordCount;
  if (sort === "scenes") return b.sceneNumbers.length - a.sceneNumbers.length || b.wordCount - a.wordCount;
  if (sort === "coverage") return b.speakingSceneCoverage - a.speakingSceneCoverage || b.wordCount - a.wordCount;
  return b.wordCount - a.wordCount || b.dialogueLines - a.dialogueLines;
}

export function ScreenplayReports({ project }: { project: PlotPickleProject }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ReportSort>("words");
  const [showPopulation, setShowPopulation] = useState(true);
  const report = useMemo(() => createCharacterDialogueReport(project), [project]);
  const characters = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return report.characters
      .filter((character) => !needle || `${character.name} ${character.role} ${character.description}`.toLowerCase().includes(needle))
      .sort((a, b) => compareReports(a, b, sort));
  }, [query, report.characters, sort]);
  const complete = report.population.filter((item) => item.status === "complete").length;
  const partial = report.population.filter((item) => item.status === "partial").length;

  return (
    <>
      <div className={panelStyles.sectionHeading}>
        <div><p>Reports</p><h2>Live screenplay intelligence—no manual refresh.</h2><span>Every number is recalculated from the active canonical project whenever a screenplay is loaded, imported, normalized, replaced, or edited.</span></div>
        <button type="button" className={panelStyles.printButton} onClick={() => window.print()}>Print report</button>
      </div>

      <div className={styles.refreshState} role="status">
        <i aria-hidden="true" />
        <div><strong>Report is current</strong><span>Derived from the {report.source}. Project update: {report.refreshedAt || "not yet saved"}. Signature {report.signature.slice(-18)}.</span></div>
      </div>

      <div className={styles.summaryGrid}>
        <article><span>Pages</span><strong>{report.summary.pages}</strong><small>Estimated screenplay pages</small></article>
        <article><span>Scenes</span><strong>{report.summary.scenes}</strong><small>Detected scene coverage</small></article>
        <article><span>Speaking roles</span><strong>{report.summary.charactersWithDialogue}</strong><small>of {report.summary.characters} character records</small></article>
        <article><span>Dialogue entries</span><strong>{report.summary.dialogueEntries.toLocaleString()}</strong><small>{report.summary.dialogueLines.toLocaleString()} source lines</small></article>
        <article><span>Spoken words</span><strong>{report.summary.spokenWords.toLocaleString()}</strong><small>{duration(report.summary.estimatedSpeakingSeconds)} estimated speech</small></article>
        <article><span>Action</span><strong>{report.summary.actionParagraphs.toLocaleString()}</strong><small>visible action paragraphs</small></article>
        <article><span>Runtime</span><strong>{duration(report.summary.estimatedRuntimeSeconds)}</strong><small>project planning estimate</small></article>
        <article><span>Project hydration</span><strong>{complete}/{report.population.length}</strong><small>{partial} sections need review</small></article>
      </div>

      <section className={styles.auditCard}>
        <header><div><p>Import and metadata audit</p><h3>All current project sections are included</h3><span>This audit checks the latest schema fields, not a cached report object. “Complete” means every tracked field has a value; suggestions still require writer review.</span></div><button type="button" onClick={() => setShowPopulation((value) => !value)}>{showPopulation ? "Hide audit" : "Show audit"}</button></header>
        {showPopulation ? <div className={styles.auditGrid}>{report.population.map((item) => (
          <article key={item.id} className={styles[item.status]}>
            <div><strong>{item.label}</strong><span>{item.populated} of {item.total} populated</span></div>
            <b>{item.status === "complete" ? "Complete" : item.status === "partial" ? "Review" : "Empty"}</b>
            <i><em style={{ width: `${item.total ? Math.round((item.populated / item.total) * 100) : 0}%` }} /></i>
          </article>
        ))}</div> : null}
      </section>

      <div className={styles.controls}>
        <label><span>Find a character</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, role, or description" /></label>
        <label><span>Rank characters by</span><select value={sort} onChange={(event) => setSort(event.target.value as ReportSort)}><option value="words">Most spoken words</option><option value="lines">Most dialogue lines</option><option value="scenes">Most speaking scenes</option><option value="coverage">Highest scene coverage</option><option value="name">Character name</option></select></label>
      </div>

      {report.characters.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.reportTable}>
            <thead><tr><th>Character</th><th>Role</th><th>Dialogue</th><th>Words</th><th>Speaking scenes</th><th>Coverage</th><th>Speaking time</th></tr></thead>
            <tbody>{characters.map((character) => (
              <tr key={character.id}>
                <td><strong>{character.name}</strong>{character.description ? <small>{character.description}</small> : null}</td>
                <td>{character.role || "Not yet described"}</td>
                <td>{character.dialogueEntries.toLocaleString()}<small>{character.dialogueLines.toLocaleString()} source lines</small></td>
                <td>{character.wordCount.toLocaleString()}</td>
                <td>{character.sceneNumbers.length}{character.firstScene ? <small>Scenes {character.firstScene}{character.lastScene !== character.firstScene ? `–${character.lastScene}` : ""}</small> : null}</td>
                <td>{character.speakingSceneCoverage}%</td>
                <td>{duration(character.estimatedSpeakingSeconds)}</td>
              </tr>
            ))}</tbody>
          </table>
          {!characters.length ? <p className={styles.noResults}>No characters match that search.</p> : null}
        </div>
      ) : (
        <div className={panelStyles.empty}><p>No character report is available yet.</p><span>Write dialogue or import a TXT, Fountain, SPMD, or Final Draft FDX screenplay.</span></div>
      )}

      {characters.some((character) => character.sceneHeadings.length) ? (
        <div className={styles.sceneBreakdown}>
          <h3>Scene breakdown by character</h3>
          {characters.filter((character) => character.sceneHeadings.length).map((character) => (
            <details key={character.id}><summary><strong>{character.name}</strong><span>{character.sceneNumbers.length} scene{character.sceneNumbers.length === 1 ? "" : "s"} · {character.speakingSceneCoverage}% coverage</span></summary><ol>{character.sceneHeadings.map((scene) => <li key={`${character.id}-${scene.number}`}><b>Scene {scene.number}</b><span>{scene.heading}</span></li>)}</ol></details>
          ))}
        </div>
      ) : null}
      <p className={styles.note}>Dialogue entries count screenplay dialogue elements; source lines count deliberate line breaks. Speaking time uses 130 words per minute and excludes pauses, action, and performance choices. Revision snapshots remain available in Settings → Core Model for named before-and-after comparison.</p>
    </>
  );
}

export function TerminologyIndex() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ScreenplayTermCategory | "All">("All");
  const [view, setView] = useState<TermView>("concise");
  const terms = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return screenplayTerms.filter((item) => (category === "All" || item.category === category)
      && (!needle || `${item.term} ${item.category} ${item.concise} ${item.definition} ${item.example ?? ""} ${(item.related ?? []).join(" ")}`.toLowerCase().includes(needle)));
  }, [category, query]);
  const grouped = useMemo(() => screenplayTermCategories
    .map((group) => ({ group, terms: terms.filter((item) => item.category === group) }))
    .filter((entry) => entry.terms.length), [terms]);

  return (
    <>
      <div className={panelStyles.sectionHeading}><div><p>Terminology Index</p><h2>Scan quickly. Expand only when needed.</h2><span>Terms are grouped by writing, formatting, structure, character, production, revision, PlotPickle, and collaboration—with examples and direct workspace links.</span></div></div>
      <div className={styles.termToolbar}>
        <label><span>Search terms</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try slugline, subtext, pull request, or V.O." /></label>
        <div role="group" aria-label="Definition length"><button type="button" className={view === "concise" ? styles.active : ""} onClick={() => setView("concise")}>Concise</button><button type="button" className={view === "expanded" ? styles.active : ""} onClick={() => setView("expanded")}>Expanded</button></div>
      </div>
      <div className={styles.categoryBar} aria-label="Terminology categories">
        <button type="button" className={category === "All" ? styles.active : ""} onClick={() => setCategory("All")}>All <small>{screenplayTerms.length}</small></button>
        {screenplayTermCategories.map((item) => <button type="button" key={item} className={category === item ? styles.active : ""} onClick={() => setCategory(item)}>{item} <small>{screenplayTerms.filter((termItem) => termItem.category === item).length}</small></button>)}
      </div>
      <div className={styles.termCount}>{terms.length} term{terms.length === 1 ? "" : "s"}</div>
      <div className={styles.termGroups}>{grouped.map(({ group, terms: groupTerms }) => (
        <section key={group}>
          <header><div><span>{group}</span><h3>{groupTerms.length} matching term{groupTerms.length === 1 ? "" : "s"}</h3></div></header>
          <div className={styles.termGrid}>{groupTerms.map((item) => (
            <article key={item.term}>
              <div className={styles.termHeader}><h4>{item.term}</h4><span>{item.category}</span></div>
              <p>{view === "concise" ? item.concise : item.definition}</p>
              {view === "expanded" && item.example ? <blockquote><span>Example</span>{item.example}</blockquote> : null}
              {view === "expanded" && item.related?.length ? <div className={styles.related}>{item.related.map((related) => <span key={related}>{related}</span>)}</div> : null}
              {item.workspace ? <a href={item.workspace.href}>{item.workspace.label} →</a> : null}
            </article>
          ))}</div>
        </section>
      ))}</div>
      {!terms.length ? <p className={styles.noResults}>No terminology matches that search.</p> : null}
    </>
  );
}
