"use client";

import { useMemo, useState } from "react";
import {
  PRODUCT_FEEDBACK_KINDS,
  buildProductFeedbackDraft,
  safeProductDiagnostics,
  type ProductFeedbackKind,
} from "@/lib/product-feedback";
import styles from "./dashboard-review-surface.module.css";

function diagnosticContext() {
  if (typeof navigator === "undefined") return safeProductDiagnostics({});
  return safeProductDiagnostics({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    timestamp: new Date().toISOString(),
  });
}

export default function HelpIssueLogSkinPanel() {
  const [kind, setKind] = useState<ProductFeedbackKind>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reproduction, setReproduction] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [notice, setNotice] = useState("");

  const draft = useMemo(() => buildProductFeedbackDraft({
    kind,
    title,
    description,
    reproduction,
    expected,
    actual,
    safeDiagnostics: includeDiagnostics ? diagnosticContext() : "",
    privacyConfirmed,
  }), [actual, description, expected, includeDiagnostics, kind, privacyConfirmed, reproduction, title]);

  const bugNeedsSteps = kind === "bug" && !reproduction.trim();
  const complete = Boolean(title.trim() && description.trim() && privacyConfirmed && !bugNeedsSteps);

  async function copyDraft() {
    if (!complete) {
      setNotice(bugNeedsSteps
        ? "Add reproduction steps and confirm privacy before preparing this issue."
        : "Add a title and summary, then confirm privacy before preparing this issue.");
      return;
    }
    const text = `${draft.title}\n\nLabels: ${draft.labels.join(", ")}\n\n${draft.body}`;
    if (!navigator.clipboard?.writeText) {
      setNotice("Clipboard access is unavailable in this browser. The sanitized issue draft remains visible on this screen for manual copy.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Sanitized issue draft copied. Nothing was uploaded or submitted from PlotPickle.");
    } catch {
      setNotice("The browser did not allow clipboard access. The sanitized issue draft remains visible for manual copy.");
    }
  }

  return (
    <div className={styles.surface} data-help-issue-log-panel="review">
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Help · product problems · suggestions</p>
        <h2>Prepare a clear PlotPickle issue without leaving PlotPickle.</h2>
        <p>Describe the smallest useful problem or request. PlotPickle sanitizes obvious credentials and local paths before showing the issue draft. It does not attach your active story or project.</p>
      </header>

      <section className={styles.boundary} aria-label="Issue submission status">
        <strong>Issue submission is not connected in this review build.</strong>
        <p>You can prepare and copy a safe issue draft here. Nothing is sent to GitHub, a cloud service or a support queue. PlotPickle will not claim a ticket exists until a real in-app submission boundary is implemented.</p>
      </section>

      <div className={styles.layout}>
        <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void copyDraft(); }}>
          <label>
            <span className={styles.fieldLabel}>Issue type</span>
            <select value={kind} onChange={(event) => { setKind(event.target.value as ProductFeedbackKind); setNotice(""); }}>
              {PRODUCT_FEEDBACK_KINDS.map((entry) => <option value={entry.id} key={entry.id}>{entry.label}</option>)}
            </select>
            <small className={styles.helper}>{PRODUCT_FEEDBACK_KINDS.find((entry) => entry.id === kind)?.description}</small>
          </label>

          <label>
            <span className={styles.fieldLabel}>Short title</span>
            <input value={title} required maxLength={180} onChange={(event) => setTitle(event.target.value)} placeholder="What needs attention?" />
          </label>

          <label>
            <span className={styles.fieldLabel}>{kind === "feature" ? "Need and proposed behavior" : "What happened?"}</span>
            <textarea value={description} required onChange={(event) => setDescription(event.target.value)} rows={5} placeholder="Describe the visible problem without private story material." />
          </label>

          <label>
            <span className={styles.fieldLabel}>{kind === "bug" ? "Reproduction steps" : "Steps or affected workflow"}</span>
            <textarea value={reproduction} required={kind === "bug"} onChange={(event) => setReproduction(event.target.value)} rows={4} placeholder={kind === "bug" ? "1. Open…\n2. Select…\n3. Observe…" : "Where in PlotPickle does this occur?"} />
          </label>

          <label>
            <span className={styles.fieldLabel}>{kind === "feature" ? "Desired outcome" : "Expected behavior"}</span>
            <textarea value={expected} onChange={(event) => setExpected(event.target.value)} rows={3} />
          </label>

          <label>
            <span className={styles.fieldLabel}>{kind === "feature" ? "Current limitation" : "Actual behavior"}</span>
            <textarea value={actual} onChange={(event) => setActual(event.target.value)} rows={3} />
          </label>

          <label className={styles.checkRow}>
            <input type="checkbox" checked={includeDiagnostics} onChange={(event) => setIncludeDiagnostics(event.target.checked)} />
            <span><strong>Include safe technical context</strong><small>PlotPickle version, browser, platform and language only. No active project, project title, credentials or local paths are attached.</small></span>
          </label>

          <label className={styles.checkRow}>
            <input type="checkbox" required checked={privacyConfirmed} onChange={(event) => setPrivacyConfirmed(event.target.checked)} />
            <span><strong>I removed private material</strong><small>I reviewed my text and removed credentials, personal information, private repository details and unpublished story content.</small></span>
          </label>

          <div className={styles.actions}>
            <button className={styles.action} type="submit" disabled={!complete}>Copy Issue Draft</button>
          </div>
          {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
        </form>

        <aside className={styles.preview} aria-label="Sanitized issue draft">
          <span className={styles.status}>Draft only</span>
          <h3>{draft.title}</h3>
          <small>Labels: {draft.labels.join(", ")}</small>
          <pre>{draft.body}</pre>
        </aside>
      </div>
    </div>
  );
}
