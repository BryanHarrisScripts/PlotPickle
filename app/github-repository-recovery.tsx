"use client";

import { useState } from "react";
import type { GitHubRepositoryRecoveryDiagnosis } from "@/lib/github-repository-recovery";
import styles from "./github-recovery-centre.module.css";

const API = "/api/local-github-repository-recovery";

async function request(path = "", method: "GET" | "POST" = "GET", body?: object) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof value.message === "string" ? value.message : "GitHub repository recovery failed.");
  return value;
}

export default function GitHubRepositoryRecovery({
  connected,
  ready,
  onNotice,
}: {
  connected: boolean;
  ready: boolean;
  onNotice: (message: string) => void;
}) {
  const [diagnosis, setDiagnosis] = useState<GitHubRepositoryRecoveryDiagnosis | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function diagnose() {
    setWorking(true);
    try {
      const value = await request();
      setDiagnosis(value.diagnosis as GitHubRepositoryRecoveryDiagnosis);
      setError("");
      onNotice(String(value.message || "GitHub repository diagnosis completed."));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "GitHub repository diagnosis failed.";
      setError(message);
      onNotice(message);
    } finally { setWorking(false); }
  }

  async function recover(path: string, body: object, message: string) {
    setWorking(true);
    try {
      const value = await request(path, "POST", body);
      onNotice(`${message} Run the normal connection test and wait for the green Ready light before retrying GitHub work.`);
      setDiagnosis(value.diagnosis as GitHubRepositoryRecoveryDiagnosis);
      setError("");
    } catch (cause) {
      const next = cause instanceof Error ? cause.message : "GitHub repository recovery failed.";
      setError(next);
      onNotice(next);
    } finally { setWorking(false); }
  }

  return (
    <section className={styles.repositoryRecovery} aria-labelledby="github-repository-recovery-title">
      <div>
        <p>Guarded repository recovery</p>
        <h4 id="github-repository-recovery-title">Repository moves, missing branches and conflicts</h4>
        <span>Every change is verified by the local server. PlotPickle will never force-push, adopt a repository automatically or choose local versus remote content.</span>
      </div>
      <button type="button" disabled={working || !connected} onClick={() => void diagnose()}>Diagnose repository and branch</button>

      {error ? <p className={styles.error}>{error}</p> : null}
      {diagnosis ? (
        <div className={styles.diagnosis} data-state={diagnosis.state}>
          <div className={styles.diagnosisHeader}>
            <div><strong>{diagnosis.state.replaceAll("-", " ")}</strong><span>{diagnosis.message}</span></div>
            {diagnosis.repository ? <code>{diagnosis.repository} · {diagnosis.branch}</code> : null}
          </div>

          {diagnosis.canAdoptRepository ? (
            <div className={styles.recoveryChoice}>
              <div><strong>Verified moved repository</strong><span>{diagnosis.resolvedRepository}</span></div>
              <button type="button" disabled={working} onClick={() => void recover("/adopt-repository", { repository: diagnosis.resolvedRepository }, "The verified repository location was saved.")}>Project Lead: adopt repository</button>
            </div>
          ) : null}

          {diagnosis.verifiedBranches.length ? (
            <div className={styles.branchChoices}>
              <strong>Verified existing branches</strong>
              {diagnosis.verifiedBranches.map((branch) => (
                <button key={branch.name} type="button" disabled={working} onClick={() => void recover("/select-branch", { branch: branch.name }, `The verified ${branch.name} branch was selected.`)}>{branch.name} · {branch.commitSha.slice(0, 10)}</button>
              ))}
            </div>
          ) : null}

          {diagnosis.canRecreateBranch ? <button type="button" disabled={working} onClick={() => void recover("/recreate-branch", {}, "The approved branch was recreated from the last verified commit without force.")}>Project Lead: recreate approved branch</button> : null}

          {diagnosis.conflicts.length ? (
            <div className={styles.conflicts}>
              <strong>Conflict review candidates</strong>
              {diagnosis.conflicts.map((conflict) => (
                <article key={conflict.id}><div><b>{conflict.label}</b><span>{conflict.repository} · {conflict.branch}</span></div><p>{conflict.reason}</p><small>{conflict.nextAction}</small></article>
              ))}
            </div>
          ) : null}

          <small>Connection status: {ready ? "Ready before recovery" : "A new green Ready check is required after recovery"}.</small>
        </div>
      ) : null}
    </section>
  );
}
