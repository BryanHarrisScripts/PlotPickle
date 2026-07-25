"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AFTERGLOW_CURRENT_TITLE,
  AFTERGLOW_LEGACY_TITLE,
  CC_BY_SA_URL,
  afterglowCompactAttribution,
  afterglowFullAttribution,
  afterglowModificationClasses,
  afterglowPosterAsset,
  afterglowSourceClaims,
  afterglowVersionBlockMap,
  afterglowVersions,
  type AfterglowClaimStatus,
  type AfterglowRewriteAction,
} from "@/data/afterglow-reconciliation";
import styles from "./reconciliation.module.css";

const statusLabels: Record<AfterglowClaimStatus, string> = {
  confirmed: "Confirmed",
  candidate: "Candidate",
  historical: "Historical",
  superseded: "Superseded",
  conflict: "Conflict",
  unresolved: "Unresolved",
  "reference-only": "Reference only",
};

const actionLabels: Record<AfterglowRewriteAction, string> = {
  "keep-v9": "Keep v9",
  "start-from-v10": "Use v10 as starting point",
  "combine-selected": "Combine selected material",
  "write-new": "Write a new version",
  defer: "Defer decision",
};

export default function AfterglowReconciliationPage() {
  const [status, setStatus] = useState<AfterglowClaimStatus | "all">("all");
  const [selectedBlock, setSelectedBlock] = useState(1);
  const [actions, setActions] = useState<Record<number, AfterglowRewriteAction>>({});
  const [decisionNotes, setDecisionNotes] = useState<Record<number, string>>({});
  const visibleClaims = useMemo(() => status === "all" ? afterglowSourceClaims : afterglowSourceClaims.filter((claim) => claim.status === status), [status]);
  const mapping = afterglowVersionBlockMap[selectedBlock - 1];
  const unresolved = afterglowSourceClaims.filter((claim) => claim.status === "conflict" || claim.status === "unresolved").length;
  const confirmed = afterglowSourceClaims.filter((claim) => claim.status === "confirmed").length;

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span>Afterglow source-of-truth workspace</span>
          <h1>{AFTERGLOW_CURRENT_TITLE}</h1>
          <p>Reconcile the legacy folder, complete v9 baseline, partial v10 opening rewrite, current working draft, poster and CC attribution without silently changing canon.</p>
        </div>
        <nav><Link href="/">Open PlotPickle</Link><Link href="/about">About PlotPickle</Link><Link href="/legal">Rights and licensing</Link></nav>
      </header>

      <section className={styles.metrics}>
        <article><strong>{confirmed}</strong><span>confirmed source claims</span></article>
        <article><strong>{unresolved}</strong><span>conflicts or unresolved decisions</span></article>
        <article><strong>24</strong><span>current Blocks with baseline fallback</span></article>
        <article><strong>8</strong><span>Blocks attempted in v10</span></article>
      </section>

      <section className={styles.panel}>
        <header><span>Current identity</span><h2>Title and version boundaries</h2></header>
        <div className={styles.versionGrid}>{afterglowVersions.map((version) => <article key={version.id}><span>{version.status}</span><h3>{version.label}</h3><p>{version.scope}</p><small>{version.sourcePath}</small>{version.immutable ? <b>Immutable source</b> : <b>Writer-controlled working draft</b>}</article>)}</div>
        <p className={styles.notice}><strong>Legacy title:</strong> {AFTERGLOW_LEGACY_TITLE}. The durable project ID and source repository name remain backward-compatible.</p>
      </section>

      <section className={styles.panel}>
        <header><span>Source ledger</span><h2>Confirmed, candidate, historical and unresolved claims</h2><p>Filtering changes what is displayed, not the status of a claim.</p></header>
        <label className={styles.filter}>Status<select value={status} onChange={(event) => setStatus(event.target.value as AfterglowClaimStatus | "all")}><option value="all">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <div className={styles.claims}>{visibleClaims.map((claim) => <article key={claim.id} data-status={claim.status}><div><span>{statusLabels[claim.status]}</span><small>{claim.category} · {claim.sourcePath}</small></div><h3>{claim.claim}</h3><p><strong>Evidence:</strong> {claim.evidence}</p><p><strong>Decision boundary:</strong> {claim.decisionNote}</p><footer>Target: {claim.target}</footer></article>)}</div>
      </section>

      <section className={styles.panel}>
        <header><span>Afterglow Version Bridge</span><h2>Compare the complete baseline with the partial rewrite</h2><p>Block numbers are mappings, not automatic equivalence. Unready current sections continue displaying verified v9 baseline material.</p></header>
        <div className={styles.blockPicker}>{afterglowVersionBlockMap.map((block) => <button type="button" className={selectedBlock === block.currentBlock ? styles.active : ""} onClick={() => setSelectedBlock(block.currentBlock)} key={block.currentBlock}>{block.currentBlock}</button>)}</div>
        <div className={styles.compareGrid}>
          <article><span>v9 complete baseline</span><h3>{mapping.v9Heading}</h3><p>Available as fallback so the complete screenplay remains readable.</p></article>
          <article><span>v10 partial alternate</span><h3>{mapping.v10Heading}</h3><p>{selectedBlock <= 8 ? "Proposal source only. Nothing becomes canonical automatically." : "This Block was not attempted in v10; it is not missing or rejected."}</p></article>
          <article><span>Current Reflections rewrite</span><h3>Block {selectedBlock}</h3><p>Status: {mapping.status}</p><label>Decision<select value={actions[selectedBlock] ?? mapping.action} onChange={(event) => setActions((current) => ({ ...current, [selectedBlock]: event.target.value as AfterglowRewriteAction }))}>{Object.entries(actionLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Decision note<textarea value={decisionNotes[selectedBlock] ?? ""} onChange={(event) => setDecisionNotes((current) => ({ ...current, [selectedBlock]: event.target.value }))} placeholder="Record why this source choice serves the current screenplay." /></label></article>
        </div>
        {mapping.continuityEffects.length ? <div className={styles.notice}><strong>Continuity effects to recheck:</strong> {mapping.continuityEffects.join(", ")}.</div> : null}
        <p className={styles.safety}>This review surface does not rewrite screenplay text or save canon by itself. Approved replacements must preserve before/proposed/accepted text, source version, source range, Block, scene, mini-block, decision note and timestamp in normal revision/provenance records.</p>
      </section>

      <section className={styles.panel}>
        <header><span>Legacy key art</span><h2>{afterglowPosterAsset.title}</h2></header>
        <div className={styles.posterGrid}><div className={styles.posterPlaceholder}><strong>WebP derivatives</strong><code>{afterglowPosterAsset.image.full}</code><code>{afterglowPosterAsset.image.card}</code><code>{afterglowPosterAsset.image.thumb}</code></div><article><p>{afterglowPosterAsset.caption}</p><p><strong>Source:</strong> {afterglowPosterAsset.source.path}</p><p><strong>Blob SHA:</strong> <code>{afterglowPosterAsset.source.blobSha}</code></p><p><strong>Rights:</strong> {afterglowPosterAsset.source.rightsNote}</p><p><strong>Alt review:</strong> {afterglowPosterAsset.alt}</p></article></div>
      </section>

      <section className={styles.panel}>
        <header><span>Creative Commons attribution</span><h2>Attribution and AI provenance remain separate</h2></header>
        <p className={styles.compact}>{afterglowCompactAttribution}</p>
        <pre>{afterglowFullAttribution}</pre>
        <h3>Known modification classes</h3><ul>{afterglowModificationClasses.map((item) => <li key={item}>{item}</li>)}</ul>
        <p className={styles.notice}>Historical ChatGPT-4 assistance belongs in process provenance. It is not creator attribution and does not label later no-AI writing as AI-assisted.</p>
        <a href={CC_BY_SA_URL} target="_blank" rel="noreferrer">Creative Commons Attribution-ShareAlike 4.0 International</a>
      </section>
    </main>
  );
}
