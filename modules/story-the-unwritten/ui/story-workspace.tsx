"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./story-workspace.module.css";

type StoryPiece = {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly description: string;
};

type StoryChoice = {
  readonly id: string;
  readonly label: string;
  readonly mechanic: string;
  readonly consequence: string;
  readonly legal: boolean;
  readonly blockedReason: string | null;
};

type StoryHistory = {
  readonly turn: number;
  readonly sceneTitle: string;
  readonly choiceLabel: string;
  readonly mechanic: string;
  readonly consequence: string;
  readonly stateRevision: number;
  readonly acceptedOperationKinds: readonly string[];
};

type StoryWorkspaceProjection = {
  readonly world: { readonly id: string; readonly title: string };
  readonly game: { readonly id: string; readonly title: string };
  readonly session: {
    readonly id: string;
    readonly status: string;
    readonly sceneNumber: number;
    readonly sceneCount: number;
    readonly stateRevision: number;
  };
  readonly scene: {
    readonly id: string;
    readonly title: string;
    readonly pressure: string;
    readonly objectiveRefs: readonly string[];
    readonly unresolvedThreadRefs: readonly string[];
  } | null;
  readonly activeCharacter: StoryPiece | null;
  readonly activeLocation: StoryPiece | null;
  readonly conflict: StoryPiece | null;
  readonly secret: StoryPiece | null;
  readonly technique: StoryPiece | null;
  readonly availablePieces: readonly StoryPiece[];
  readonly choices: readonly StoryChoice[];
  readonly rules: readonly { readonly id: string; readonly title: string; readonly when: string; readonly enabled: boolean }[];
  readonly validation: { readonly launchAllowed: boolean; readonly findings: readonly { readonly severity: string; readonly code: string; readonly message?: string }[] };
  readonly history: readonly StoryHistory[];
  readonly openThreads: readonly string[];
  readonly gateOpen: boolean;
  readonly hasKey: boolean;
  readonly knowsGateName: boolean;
  readonly ending: string | null;
};

type StoryWorkspacePayload = {
  readonly workspace: StoryWorkspaceProjection;
  readonly choiceIds: readonly string[];
  readonly authority: string;
  readonly persistedServerSession: boolean;
};

function shortRef(value: string) {
  return value.split(":").at(-1)?.replaceAll("-", " ") || value;
}

async function readPayload(response: Response): Promise<StoryWorkspacePayload> {
  const value = await response.json().catch(() => ({})) as StoryWorkspacePayload & { readonly message?: string };
  if (!response.ok) throw new Error(value.message || "STORY could not resolve that move.");
  return value;
}

export default function StoryWorkspace({ onOpenLearn }: { readonly onOpenLearn: () => void }) {
  const [payload, setPayload] = useState<StoryWorkspacePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const open = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setPayload(await readPayload(await fetch("/api/story/workspace", { cache: "no-store" })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "STORY could not open the local game table.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void open();
  }, [open]);

  async function choose(choiceId: string) {
    if (!payload || busy) return;
    setBusy(true);
    setError("");
    try {
      setPayload(await readPayload(await fetch("/api/story/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "choose", choiceIds: payload.choiceIds, choiceId }),
      })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "STORY rejected that move.");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError("");
    try {
      setPayload(await readPayload(await fetch("/api/story/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "STORY could not reset the local game.");
    } finally {
      setBusy(false);
    }
  }

  if (!payload) {
    return (
      <main className={styles.loading} aria-label="STORY workspace loading">
        <strong>STORY: THE UNWRITTEN</strong>
        <span>{error || "Opening the local five-scene game…"}</span>
        {error ? <button type="button" onClick={() => void open()}>Retry</button> : null}
      </main>
    );
  }

  const view = payload.workspace;
  const complete = view.session.status === "completed";
  const lastTurn = view.history.at(-1) ?? null;
  const findings = view.validation.findings.filter((finding) => finding.severity !== "pass");

  return (
    <main className={styles.screen} aria-label="STORY: The Unwritten workspace" data-story-workspace="playable-v1">
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>STORY · THE UNWRITTEN</span>
          <h1>{view.world.title}</h1>
          <p>Five scenes. Visible mechanics. Your choices change authoritative state; prose does not.</p>
        </div>
        <div className={styles.sessionBadges} aria-label="STORY session status">
          <span>Scene <strong>{view.session.sceneNumber}/{view.session.sceneCount}</strong></span>
          <span>State <strong>r{view.session.stateRevision}</strong></span>
          <span className={view.validation.launchAllowed ? styles.pass : styles.blocked}>
            Validator <strong>{view.validation.launchAllowed ? "PASS" : "BLOCKED"}</strong>
          </span>
        </div>
      </header>

      <section className={styles.table}>
        <aside className={styles.rail} aria-label="Active STORY working set">
          <header><span>ACTIVE SET</span><strong>Only what matters now</strong></header>
          {[view.activeCharacter, view.activeLocation, view.conflict].filter(Boolean).map((piece) => (
            <article className={styles.piece} key={piece!.id}>
              <small>{piece!.type}</small>
              <strong>{piece!.title}</strong>
              <p>{piece!.description}</p>
            </article>
          ))}
          <section className={styles.factBox}>
            <span>Current state</span>
            <dl>
              <div><dt>Brass Key</dt><dd>{view.hasKey ? "Keeper" : "Key stone"}</dd></div>
              <div><dt>Gate name</dt><dd>{view.knowsGateName ? "Known" : "Unknown"}</dd></div>
              <div><dt>Gate</dt><dd>{view.gateOpen ? "Open" : "Sealed"}</dd></div>
            </dl>
          </section>
        </aside>

        <section className={styles.stage} aria-label="Active STORY scene">
          {complete ? (
            <div className={styles.ending}>
              <span>SESSION COMPLETE</span>
              <h2>{view.ending === "crossed" ? "The road is yours to continue." : "The road remains unwritten."}</h2>
              <p>Five choices were replayed through the deterministic STORY engine. Nothing here became PPF canon automatically.</p>
              <div className={styles.endingActions}>
                <button type="button" disabled={busy} onClick={() => void reset()}>Play again</button>
                <button type="button" className={styles.secondary} onClick={onOpenLearn}>Reflect with LEARN</button>
              </div>
            </div>
          ) : (
            <>
              <header className={styles.sceneHeader}>
                <span>SCENE {view.session.sceneNumber}</span>
                <h2>{view.scene?.title}</h2>
                <p>{view.scene?.pressure}</p>
              </header>

              <section className={styles.objective}>
                <span>OBJECTIVE</span>
                <strong>{view.scene?.objectiveRefs.map(shortRef).join(" · ")}</strong>
                {view.scene?.unresolvedThreadRefs.length ? <small>Open thread: {view.scene.unresolvedThreadRefs.map(shortRef).join(", ")}</small> : null}
              </section>

              <div className={styles.choices} aria-label="Available STORY actions">
                {view.choices.map((choice) => (
                  <button
                    type="button"
                    key={choice.id}
                    disabled={busy || !choice.legal}
                    onClick={() => void choose(choice.id)}
                    className={styles.choice}
                  >
                    <span>{choice.label}</span>
                    <small>{choice.mechanic}</small>
                    <em>{choice.legal ? choice.consequence : choice.blockedReason}</em>
                  </button>
                ))}
              </div>

              {error ? <p className={styles.error} role="alert">{error}</p> : null}
            </>
          )}

          {lastTurn && !complete ? (
            <aside className={styles.reflection} aria-label="Sage scene reflection">
              <span>SAGE · QUICK REFLECTION</span>
              <p><strong>{lastTurn.choiceLabel}</strong> changed the state through {lastTurn.acceptedOperationKinds.join(" + ")}. {lastTurn.consequence}</p>
              <button type="button" onClick={onOpenLearn}>Open LEARN</button>
            </aside>
          ) : null}
        </section>

        <aside className={styles.rail} aria-label="STORY mechanics and history">
          <header><span>MECHANICS</span><strong>Inspectable, not hidden</strong></header>
          <section className={styles.ruleBox}>
            <span>Rules</span>
            {view.rules.map((rule) => (
              <div key={rule.id}><strong>{rule.title}</strong><small>{rule.enabled ? "Enabled" : "Disabled"} · {rule.when}</small></div>
            ))}
          </section>
          <section className={styles.ruleBox}>
            <span>Validator</span>
            <strong>{view.validation.launchAllowed ? "Ready to play" : "Fix before play"}</strong>
            <small>{findings.length ? `${findings.length} finding${findings.length === 1 ? "" : "s"}` : "No blocking findings"}</small>
          </section>
          <section className={styles.history}>
            <span>Accepted history</span>
            {view.history.length ? view.history.map((turn) => (
              <article key={`${turn.turn}:${turn.choiceLabel}`}>
                <small>{turn.turn}. {turn.sceneTitle}</small>
                <strong>{turn.choiceLabel}</strong>
                <p>{turn.consequence}</p>
              </article>
            )) : <p>No accepted actions yet.</p>}
          </section>
          <footer className={styles.authority}>
            <span>{payload.authority}</span>
            <small>{payload.persistedServerSession ? "Server session" : "Replay-derived · no shadow session store"}</small>
          </footer>
        </aside>
      </section>
    </main>
  );
}
