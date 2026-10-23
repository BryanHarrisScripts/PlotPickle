"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  PROJECT_LIBRARY_ACTIVE_PROFILE_KEY,
  PROJECT_LIBRARY_CHANGED_EVENT,
  loadLibraryProjectSnapshot,
  sessionActiveProjectId,
} from "../../core/storage/project-library-browser";
import { profilePrivateBrowserReadyFor } from "../../core/storage/profile-private-browser";
import {
  observeHollywoodProductionReadiness,
  type HollywoodReadinessResult,
} from "../../modules/intent/model/hollywood-production-readiness";
import { interpretReadOnlyCreatorIntent, type ReadOnlyCreatorIntent } from "../../modules/intent/model/read-only-creator-intent";
import styles from "./continue-this-film.module.css";

type CurrentObservation = Readonly<{
  projectTitle: string | null;
  revision: number | null;
  result: HollywoodReadinessResult | null;
  status: "NO_PROFILE" | "NO_PROJECT" | "PROJECT_UNAVAILABLE" | "OBSERVED" | "BLOCKED";
}>;

function observeCurrentSelection(): CurrentObservation {
  // The Dashboard is a consumer of the same current-session Library authority
  // as Reports. A detached foundation project must never be treated as selected.
  try {
    const profileId = window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY)?.trim() || "";
    if (!profileId || !profilePrivateBrowserReadyFor(profileId)) {
      return { projectTitle: null, revision: null, result: null, status: "NO_PROFILE" };
    }
    const selectedId = sessionActiveProjectId();
    if (!selectedId) {
      return { projectTitle: null, revision: null, result: null, status: "NO_PROJECT" };
    }
    const project = loadLibraryProjectSnapshot(selectedId);
    if (!project || project.id !== selectedId) {
      return { projectTitle: null, revision: null, result: null, status: "PROJECT_UNAVAILABLE" };
    }
    const result = observeHollywoodProductionReadiness({
      capability: "project-status.observe",
      profileId,
      projectId: selectedId,
      projectRevision: project.revision,
      providerPolicy: "LOCAL_READ_ONLY",
    }, {
      activeProfileId: profileId,
      activeProject: project,
    });
    return {
      projectTitle: project.title,
      revision: project.revision,
      result,
      status: result.state === "OBSERVED" ? "OBSERVED" : "BLOCKED",
    };
  } catch {
    return { projectTitle: null, revision: null, result: null, status: "PROJECT_UNAVAILABLE" };
  }
}

export default function ContinueThisFilm({
  onOpenLibrary,
  onOpenOutline,
}: Readonly<{
  onOpenLibrary: () => void;
  onOpenOutline: (blockNumber: number) => void;
}>) {
  const [observation, setObservation] = useState<CurrentObservation | null>(null);
  const [intentText, setIntentText] = useState("Where am I?");
  const [intent, setIntent] = useState<ReadOnlyCreatorIntent>("WHERE_AM_I");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(() => setObservation(observeCurrentSelection()), []);

  useEffect(() => {
    refresh();
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [refresh]);

  function submitIntent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = interpretReadOnlyCreatorIntent(intentText);
    if (selected.state !== "SUPPORTED" || !selected.kind) {
      setNotice("This first release can answer ‘Where am I?’ and ‘Review film readiness’. It has not executed any other request.");
      return;
    }
    setNotice("");
    setIntent(selected.kind);
    refresh();
  }

  const result = observation?.result;
  const observed = observation?.status === "OBSERVED" && result?.state === "OBSERVED";
  const evidenced = observed ? result.stages.filter((stage) => stage.state === "OBSERVED").length : 0;
  const block = observed && result.nextDecision?.kind === "REVIEW_BLOCK_SOURCE_EVIDENCE"
    ? result.nextDecision.blockNumber : null;
  const status = observation?.status ?? "CHECKING";
  const nextDecision = observed
    ? block !== null
      ? `Human review of source support for Block ${block}.`
      : "Human review of the screenplay source and production plan."
    : "Select or restore the active Library story before continuing.";
  const now = status === "CHECKING" ? "Checking the current Library selection."
    : status === "NO_PROFILE" ? "Current Human profile is not ready."
      : status === "NO_PROJECT" ? "No saved Library story selected."
        : status === "PROJECT_UNAVAILABLE" ? "The selected Library story cannot be read."
          : status === "BLOCKED" ? `Observation blocked: ${result?.code || "UNKNOWN"}.`
            : `Selected PPF revision ${observation?.revision}; this is a read-only observation.`;

  return (
    <section className={styles.root} aria-label="Continue This Film" data-continue-film-status={status}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>INTENT · CURRENT LIBRARY PPF · READ ONLY</span>
          <h2>Continue This Film</h2>
          <p>{observation?.projectTitle || "No active film"}{observation?.revision != null ? ` · Revision ${observation.revision}` : ""}</p>
        </div>
        <span className={styles.status} data-continue-film-evidence-state={observed ? "OBSERVED" : "UNKNOWN"}>
          {observed ? "OBSERVED" : "NOT VERIFIED"}
        </span>
      </header>
      <form className={styles.intent} onSubmit={submitIntent}>
        <label htmlFor="plotpickle-creator-intent">What would you like to know about this film?</label>
        <div className={styles.intentControls}>
          <input id="plotpickle-creator-intent" value={intentText} onChange={(event) => setIntentText(event.target.value)}
            maxLength={120} autoComplete="off" aria-describedby="plotpickle-supported-intents" />
          <button type="submit">Inspect</button>
        </div>
        <small id="plotpickle-supported-intents">Try “Where am I?” or “Review film readiness”. Read-only; no agent or provider runs.</small>
        {notice ? <p role="status">{notice}</p> : null}
      </form>
      <div className={styles.columns} aria-live="polite">
        <div><strong>NOW</strong><p>{now}</p></div>
        <div><strong>EVIDENCE</strong><p>{observed
          ? intent === "REVIEW_FILM"
            ? `${evidenced} of 10 production stages have retained PPF metadata; none is certified film-ready.`
            : `${result.stages.length} stages assessed, ${evidenced} with retained metadata. Not independent product verification.`
          : "No project-bound production evidence can be shown."}</p></div>
        <div><strong>NEXT HUMAN DECISION</strong><p>{nextDecision}</p></div>
      </div>
      <div className={styles.actions}>
        {observed && block !== null ? <button type="button" onClick={() => onOpenOutline(block)}>Review Block {block} in Outline</button> : null}
        <button type="button" onClick={onOpenLibrary}>Open Library</button>
        <button type="button" onClick={refresh}>Refresh evidence</button>
      </div>
      <small className={styles.disclaimer}>No creative approval, Save & Lock, paid generation, project switch, or production-readiness certification.</small>
    </section>
  );
}
