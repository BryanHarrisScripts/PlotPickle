"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./demo-experience.module.css";

type DemoProjection = {
  readonly scenario: {
    readonly title: string;
    readonly summary: string;
    readonly scenes: ReadonlyArray<{
      readonly id: string;
      readonly title: string;
      readonly decisions: ReadonlyArray<{ readonly id: string; readonly label: string }>;
    }>;
  };
  readonly session: { readonly currentSceneId: string | null; readonly status: string };
  readonly scenes: ReadonlyArray<{ readonly id: string; readonly status: string }>;
  readonly evidence: {
    readonly turns: number;
    readonly maraLocation: string;
    readonly maraRowanRelationship: number;
    readonly brassKeyCustody: string;
  };
  readonly decisionHistory: ReadonlyArray<{
    readonly decisionId: string;
    readonly consequenceKinds: ReadonlyArray<string>;
  }>;
};

type DemoExperienceProps = {
  readonly onExit: () => void;
  readonly onEnterPlotPickle: () => void;
};

async function requestDemoWorld(body?: Record<string, unknown>) {
  const result = await fetch("/api/demo/story", {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await result.json().catch(() => ({})) as DemoProjection & { readonly message?: string };
  if (!result.ok) throw new Error(payload.message || "The local PlotPickle DEMO could not start.");
  return payload;
}

function humanizeConsequence(kind: string) {
  const labels: Record<string, string> = {
    "move-character": "location changed",
    "grant-knowledge": "private knowledge changed",
    "adjust-relationship": "relationship changed",
    "transfer-object": "object custody changed",
    "resolve-thread": "story thread resolved",
    "open-thread": "new story thread opened",
    "adjust-number": "turn advanced",
  };
  return labels[kind] || kind.replaceAll("-", " ");
}

export default function DemoExperience({ onExit, onEnterPlotPickle }: DemoExperienceProps) {
  const [world, setWorld] = useState<DemoProjection | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setError("");
    try {
      setWorld(await requestDemoWorld());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const currentScene = useMemo(
    () => world?.scenario.scenes.find((scene) => scene.id === world.session.currentSceneId) || null,
    [world],
  );
  const lastDecision = world?.decisionHistory.at(-1) || null;
  const completed = world?.session.status === "completed";

  async function choose(decisionId: string) {
    if (!world || busy) return;
    setBusy(true);
    setError("");
    try {
      setWorld(await requestDemoWorld({
        action: "choose",
        decisionIds: world.decisionHistory.map((decision) => decision.decisionId),
        decisionId,
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      setWorld(await requestDemoWorld({ action: "reset" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.demo} data-demo-runtime="synthetic-demo-runtime" data-demo-storage="demo-owned-disposable">
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>PlotPickle DEMO</p>
            <h1>{world?.scenario.title || "The Lantern at the Fork"}</h1>
            <p>{world?.scenario.summary || "Preparing the disposable synthetic STORY world."}</p>
          </div>
          <div className={styles.safety} aria-label="DEMO privacy boundary">
            <strong>Disposable synthetic world</strong>
            <span>No profile, provider, BUZZ, GitHub, Google, Internet, or private project access.</span>
          </div>
        </header>

        {world ? (
          <div className={styles.progress} aria-label="Demo progress">
            {world.scenario.scenes.map((scene, index) => {
              const runtimeScene = world.scenes.find((item) => item.id === scene.id);
              const active = scene.id === world.session.currentSceneId;
              return <span key={scene.id} data-state={active ? "active" : runtimeScene?.status || "ready"}>{index + 1}. {scene.title}</span>;
            })}
          </div>
        ) : null}

        <section className={styles.story} aria-live="polite">
          {!world ? (
            <>
              <p className={styles.eyebrow}>Local deterministic DEMO</p>
              <h2>{busy ? "Preparing STORY…" : "DEMO could not start"}</h2>
              <p>{error || "Loading the prepared five-scene synthetic world through PlotPickle's local STORY runtime."}</p>
              {!busy ? <div className={styles.actions}><button type="button" onClick={() => void load()}>Retry DEMO</button><button type="button" onClick={onExit}>Exit DEMO</button></div> : null}
            </>
          ) : completed ? (
            <>
              <p className={styles.eyebrow}>Five scenes resolved</p>
              <h2>You just used PlotPickle's STORY engine</h2>
              <p>Your choices changed deterministic story state while the DEMO stayed inside its disposable synthetic boundary.</p>
              <div className={styles.actions}>
                <button type="button" disabled={busy} onClick={() => void reset()}>Reset DEMO</button>
                <button type="button" onClick={onEnterPlotPickle}>Enter PlotPickle</button>
                <button type="button" onClick={onExit}>Exit DEMO</button>
              </div>
            </>
          ) : currentScene ? (
            <>
              <p className={styles.eyebrow}>Scene {world.decisionHistory.length + 1} of 5</p>
              <h2>{currentScene.title}</h2>
              <p>Choose what happens. STORY will resolve the consequence locally and advance the prepared world.</p>
              <div className={styles.choices}>
                {currentScene.decisions.map((decision) => (
                  <button type="button" disabled={busy} key={decision.id} onClick={() => void choose(decision.id)}>{decision.label}</button>
                ))}
              </div>
            </>
          ) : null}
          {world && error ? <p role="alert" className={styles.error}>{error}</p> : null}
        </section>

        {world ? (
          <aside className={styles.evidence} aria-label="STORY consequence evidence">
            <div>
              <span>Turns resolved</span>
              <strong>{world.evidence.turns} / 5</strong>
            </div>
            <div>
              <span>Mara location</span>
              <strong>{world.evidence.maraLocation}</strong>
            </div>
            <div>
              <span>Mara and Rowan</span>
              <strong>{world.evidence.maraRowanRelationship}</strong>
            </div>
            <div>
              <span>Brass key</span>
              <strong>{world.evidence.brassKeyCustody}</strong>
            </div>
            {lastDecision ? <p className={styles.change}>Latest consequence: {lastDecision.consequenceKinds.filter((kind) => kind !== "adjust-number").map(humanizeConsequence).join(", ")}.</p> : <p className={styles.change}>Make a choice to see deterministic state change.</p>}
          </aside>
        ) : null}

        {world && !completed ? <footer className={styles.footer}><button type="button" disabled={busy} onClick={() => void reset()}>Reset DEMO</button><button type="button" onClick={onExit}>Exit DEMO</button></footer> : null}
      </section>
    </main>
  );
}
