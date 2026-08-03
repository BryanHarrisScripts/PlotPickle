"use client";

import { useMemo, useState } from "react";
import {
  PRODUCT_FEEDBACK_KINDS,
  buildProductFeedbackIssue,
  safeProductDiagnostics,
  type ProductFeedbackKind,
} from "@/lib/product-feedback";
import styles from "./suggest-report-workspace.module.css";

function diagnosticContext() {
  if (typeof navigator === "undefined") return safeProductDiagnostics({});
  return safeProductDiagnostics({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    timestamp: new Date().toISOString(),
  });
}

export default function SuggestReportWorkspace() {
  const [kind, setKind] = useState<ProductFeedbackKind>("feature");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reproduction, setReproduction] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [notice, setNotice] = useState("");

  const issue = useMemo(() => buildProductFeedbackIssue({
    kind,
    title,
    description,
    reproduction,
    expected,
    actual,
    safeDiagnostics: includeDiagnostics ? diagnosticContext() : "",
    privacyConfirmed,
  }), [actual, description, expected, includeDiagnostics, kind, privacyConfirmed, reproduction, title]);

  const selectedKind = PRODUCT_FEEDBACK_KINDS.find((entry) => entry.id === kind) ?? PRODUCT_FEEDBACK_KINDS[0];
  const bugNeedsSteps = kind === "bug" && !reproduction.trim();
  const complete = Boolean(title.trim() && description.trim() && privacyConfirmed && !bugNeedsSteps);

  function openIssue() {
    if (!complete) {
      setNotice(bugNeedsSteps
        ? "Add reproduction steps and complete the privacy confirmation before opening GitHub."
        : "Add a title and summary, then complete the privacy confirmation before opening GitHub.");
      return;
    }
    const opened = window.open(issue.url, "_blank", "noopener,noreferrer");
    setNotice(opened
      ? "GitHub opened with a sanitized draft. Review it once more, then choose Submit new issue."
      : "Your browser blocked the GitHub window. Use the Open GitHub Issue button again after allowing pop-ups for this local PlotPickle page.");
  }

  return (
    <section className={styles.workspace} aria-labelledby="suggest-report-title">
      <header className={styles.hero}>
        <div>
          <span>PlotPickle product feedback</span>
          <h1 id="suggest-report-title">Suggest a feature or report a flaw</h1>
          <p>This is separate from story Feedback. It prepares a structured issue for the official PlotPickle GitHub repository so Bryan can accept, defer or reject it.</p>
        </div>
        <div className={styles.boundary}>
          <strong>Human triage only</strong>
          <p>Opening an issue never approves code, changes story canon or starts an automatic development task.</p>
        </div>
      </header>

      <div className={styles.kindGrid} role="radiogroup" aria-label="Feedback type">
        {PRODUCT_FEEDBACK_KINDS.map((entry) => (
          <button
            type="button"
            role="radio"
            aria-checked={kind === entry.id}
            data-active={kind === entry.id}
            key={entry.id}
            onClick={() => { setKind(entry.id); setNotice(""); }}
          >
            <strong>{entry.label}</strong>
            <span>{entry.description}</span>
          </button>
        ))}
      </div>

      <div className={styles.layout}>
        <form className={styles.form} onSubmit={(event) => { event.preventDefault(); openIssue(); }}>
          <div className={styles.formHeading}>
            <span>{selectedKind.label}</span>
            <h2>Describe the smallest useful issue</h2>
            <p>Do not paste API keys, tokens, private repository details or unpublished story material.</p>
          </div>

          <label>
            <span>Concise title</span>
            <input value={title} required maxLength={180} onChange={(event) => setTitle(event.target.value)} placeholder="What should Bryan see in the issue list?" />
          </label>

          <label>
            <span>{kind === "feature" ? "Need and proposed behavior" : "What happened?"}</span>
            <textarea value={description} required onChange={(event) => setDescription(event.target.value)} rows={6} placeholder={kind === "feature" ? "Explain the problem first, then the smallest useful outcome." : "Describe the visible problem without including private story content."} />
          </label>

          <label>
            <span>{kind === "bug" ? "Reproduction steps (required)" : "Steps or affected workflow (optional)"}</span>
            <textarea value={reproduction} required={kind === "bug"} onChange={(event) => setReproduction(event.target.value)} rows={5} placeholder={kind === "bug" ? "1. Open…\n2. Select…\n3. Observe…" : "Where in PlotPickle does this occur?"} />
          </label>

          <div className={styles.twoColumn}>
            <label>
              <span>{kind === "feature" ? "Desired outcome" : "Expected behavior"}</span>
              <textarea value={expected} onChange={(event) => setExpected(event.target.value)} rows={4} />
            </label>
            <label>
              <span>{kind === "feature" ? "Current limitation" : "Actual behavior"}</span>
              <textarea value={actual} onChange={(event) => setActual(event.target.value)} rows={4} />
            </label>
          </div>

          <label className={styles.checkRow}>
            <input type="checkbox" checked={includeDiagnostics} onChange={(event) => setIncludeDiagnostics(event.target.checked)} />
            <span><strong>Include safe technical context</strong><small>Version, browser and platform only. PlotPickle does not attach the active story, project title, local paths or credentials.</small></span>
          </label>

          <label className={styles.checkRow}>
            <input type="checkbox" required checked={privacyConfirmed} onChange={(event) => setPrivacyConfirmed(event.target.checked)} />
            <span><strong>I removed private material</strong><small>I reviewed my text and removed credentials, personal information, private repository details and unpublished story content.</small></span>
          </label>

          <div className={styles.actions}>
            <button type="submit" disabled={!complete}>Open GitHub Issue</button>
            <a href="https://github.com/BryanHarrisScripts/PlotPickle/issues" target="_blank" rel="noreferrer">Review existing issues first</a>
          </div>
          {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
        </form>

        <aside className={styles.preview} aria-label="GitHub issue preview">
          <div className={styles.previewHeading}>
            <span>Sanitized preview</span>
            <strong>{issue.title}</strong>
            <small>Labels: {issue.labels.join(", ")}</small>
          </div>
          <pre>{issue.body}</pre>
          <div className={styles.previewBoundary}>
            <strong>Before submission</strong>
            <p>GitHub opens a draft, not a completed issue. The user must review it and explicitly choose Submit new issue.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
