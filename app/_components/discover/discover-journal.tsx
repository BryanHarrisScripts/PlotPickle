"use client";

import { useMemo, useState } from "react";
import catalogue from "../../../content/discover/editorial-catalog.json";
import {
  filterDiscover, normalizeDiscoverCatalog,
  type DiscoverCapability, type DiscoverJournalEntry,
} from "../../../modules/discover/model/discover-catalog";
import styles from "./discover-journal.module.css";

const source = normalizeDiscoverCatalog(catalogue);
const isVerified = (status: DiscoverCapability["status"]) =>
  status === "VERIFIED_NATIVE" || status === "VERIFIED_EQUIVALENT";

export default function DiscoverJournal({ onBackDashboard }: { readonly onBackDashboard: () => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const categories = useMemo(() => [...new Set([
    ...source.entries.map(item => item.category),
    ...source.capabilities.map(item => item.category),
  ])].sort((a, b) => a.localeCompare(b)), []);
  const results = filterDiscover(source, query, category);
  const selected: DiscoverJournalEntry | undefined =
    source.entries.find(item => item.id === selectedId);
  const today = new Date();
  const reviewDate = source.lastReviewed ? Date.parse(source.lastReviewed + "T00:00:00Z") : NaN;
  const stale = Number.isFinite(reviewDate) && today.getTime() - reviewDate > 90 * 86400000;
  return <main className={styles.workspace} aria-label="PlotPickle Discover journal" data-discover-authority="read-only" data-discover-version="1">
    <header className={styles.header}>
      <button type="button" className={styles.backDashboard} onClick={onBackDashboard}>Back to Dashboard</button>
      <p>EXPLORE / DISCOVER · LEARNING &amp; EVOLUTION</p>
      <h2>Discovery journal</h2>
      <p>Investigate filmmaking craft, tools and PlotPickle capabilities. Research suggestions are not approved lessons, installed tools or verified product features.</p>
    </header>

    <section className={styles.status} role="status" aria-live="polite">
      {source.lastReviewed
        ? stale ? `Editorial sources last reviewed ${source.lastReviewed}. This evidence may be stale.`
          : `Editorial catalogue reviewed ${source.lastReviewed}.`
        : "No Human-approved journal catalogue has been published yet. Research candidates remain pending editorial review."}
    </section>

    <div className={styles.filters} role="search" aria-label="Search discovery and capabilities">
      <label htmlFor="discover-search">Search craft, tools, sources or capabilities</label>
      <input id="discover-search" type="search" autoComplete="off" value={query}
        onChange={event => setQuery(event.target.value)} placeholder="e.g. lighting, screenplay, Blender" />
      <label htmlFor="discover-category">Category</label>
      <select id="discover-category" value={category}
        onChange={event => setCategory(event.target.value)}>
        <option value="all">All categories</option>
        {categories.map(item => <option value={item} key={item}>{item}</option>)}
      </select>
      {(query || category !== "all") && <button type="button" onClick={() => { setQuery(""); setCategory("all"); setSelectedId(null); }}>Clear filters</button>}
    </div>

    <div className={styles.columns}>
      <section className={styles.panel} aria-label="Human reviewed discovery entries">
        <div className={styles.panelHeader}>
          <h3>Journal</h3><span>{results.entries.length} reviewed entries</span>
        </div>
        {source.entries.length === 0
          ? <p className={styles.empty}>No approved discoveries yet. OSS RADAR research is available below for review, but it is not automatically published here.</p>
          : results.entries.length === 0
            ? <p className={styles.empty}>No reviewed journal entries match these filters.</p>
            : <ul className={styles.cards}>{results.entries.map(entry =>
              <li key={entry.id}>
                <button type="button" className={styles.entryButton} aria-pressed={selectedId === entry.id}
                  onClick={() => setSelectedId(entry.id)}>
                  <strong>{entry.title}</strong>
                  <span>{entry.category} · {entry.publisher} · checked {entry.checkedAt}</span>
                  <small>{entry.summary}</small>
                </button>
              </li>,
            )}</ul>}
        {selected && <aside className={styles.detail} aria-label="Discovery source details">
          <h4>{selected.title}</h4>
          <p>{selected.summary}</p>
          <p>Editorial decision: Human reviewed · Source checked {selected.checkedAt}</p>
          <p>Related areas: {selected.areas.length ? selected.areas.join(", ") : "None recorded"}</p>
          <a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">Open original source <span aria-hidden="true">↗</span></a>
        </aside>}
      </section>

      <section className={styles.panel} aria-label="Evidence-based PlotPickle capability map">
        <div className={styles.panelHeader}>
          <h3>Capability map</h3><span>{results.capabilities.length} listed</span>
        </div>
        {results.capabilities.length === 0
          ? <p className={styles.empty}>No capabilities match these filters. Unknown evidence must not be counted as a working feature.</p>
          : <ul className={styles.cards}>{results.capabilities.map(capability =>
            <li className={styles.capability} key={capability.id}>
              <div className={styles.capabilityHeading}>
                <strong>{capability.title}</strong>
                <span className={isVerified(capability.status) ? styles.verified : styles.unverified}
                  aria-label={`Evidence state ${capability.status.replaceAll("_", " ")}`}>
                  {isVerified(capability.status) ? "✓ " : ""}{capability.status.replaceAll("_", " ")}
                </span>
              </div>
              <p>{capability.category}</p><p>{capability.description}</p>
              {isVerified(capability.status) && capability.productEvidenceUrl
                ? <a href={capability.productEvidenceUrl} rel="noopener noreferrer" target="_blank">View product verification</a>
                : <small>Independent product proof not established here</small>}
            </li>,
          )}</ul>}
      </section>
    </div>

    <section className={styles.sources} aria-label="Research feeds awaiting Human review">
      <h3>Evidence feeds · review required</h3>
      <p>These are links to existing research and governing documentation, not published journal entries.</p>
      <ul>{source.feeds.map(feed => <li key={feed.url}>
        <a target="_blank" rel="noopener noreferrer" href={feed.url}>{feed.title} ↗</a>
        <span> · {feed.state.replaceAll("_", " ").toLowerCase()}</span>
      </li>)}</ul>
      <p>Updates to lessons, agents, stories and installed tools require separate Human approval and Software Factory verification.</p>
    </section>
  </main>;
}
