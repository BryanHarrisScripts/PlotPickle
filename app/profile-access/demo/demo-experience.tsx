"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type ShowMeView = "change" | "knowledge" | "relationships" | "authority";

type ShowMeProjection = {
  readonly kind: ShowMeView;
  readonly title: string;
  readonly summary: string;
  readonly changes?: ReadonlyArray<{ readonly label: string; readonly before: string; readonly after: string }>;
  readonly groups?: ReadonlyArray<{ readonly title: string; readonly items: ReadonlyArray<string> }>;
  readonly edges?: ReadonlyArray<{ readonly from: string; readonly relation: string; readonly to: string }>;
  readonly boundaries?: ReadonlyArray<{ readonly area: string; readonly status: string; readonly detail: string }>;
};

type DemoExperienceProps = {
  readonly onExit: () => void;
  readonly onEnterPlotPickle: () => void;
  readonly onMakeThisMine: (decisionIds: ReadonlyArray<string>) => void;
};

const SHOW_ME_OPTIONS: ReadonlyArray<{ readonly id: ShowMeView; readonly label: string }> = [
  { id: "change", label: "What changed?" },
  { id: "knowledge", label: "Who knows what?" },
  { id: "relationships", label: "Story map" },
  { id: "authority", label: "What is allowed?" },
];

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

async function requestShowMe(decisionIds: ReadonlyArray<string>, view: ShowMeView) {
  const result = await fetch("/api/demo/story", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "show-me", decisionIds, view }),
  });
  const payload = await result.json().catch(() => ({})) as { readonly showMe?: ShowMeProjection; readonly message?: string };
  if (!result.ok || !payload.showMe) throw new Error(payload.message || "Sage could not open that Show Me view.");
  return payload.showMe;
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

function ShowMeCanvas({ projection }: { readonly projection: ShowMeProjection | null }) {
  if (!projection) return <p className={styles.showMeEmpty}>Choose a view and Sage will explain only the current synthetic STORY projection.</p>;
  return (
    <div className={styles.showMeCanvas} data-show-me-kind={projection.kind}>
      <h3>{projection.title}</h3>
      <p>{projection.summary}</p>
      {projection.changes?.length ? (
        <div className={styles.showMeRows}>
          {projection.changes.map((change) => (
            <div key={change.label}><span>{change.label}</span><strong>{change.before} → {change.after}</strong></div>
          ))}
        </div>
      ) : null}
      {projection.kind === "change" && !projection.changes?.length ? <p className={styles.showMeNote}>The before-and-after view will appear after your first decision.</p> : null}
      {projection.groups ? (
        <div className={styles.showMeGroups}>
          {projection.groups.map((group) => (
            <div key={group.title}><strong>{group.title}</strong>{group.items.length ? <ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul> : <span>Nothing private here.</span>}</div>
          ))}
        </div>
      ) : null}
      {projection.edges ? (
        <div className={styles.showMeEdges}>
          {projection.edges.map((edge, index) => <div key={`${edge.from}-${edge.relation}-${edge.to}-${index}`}><strong>{edge.from}</strong><span>{edge.relation}</span><strong>{edge.to}</strong></div>)}
        </div>
      ) : null}
      {projection.boundaries ? (
        <div className={styles.showMeRows}>
          {projection.boundaries.map((boundary) => (
            <div key={boundary.area} data-authority-status={boundary.status}><span><strong>{boundary.area}</strong><small>{boundary.detail}</small></span><b>{boundary.status}</b></div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function DemoExperience({ onExit, onEnterPlotPickle, onMakeThisMine }: DemoExperienceProps) {
  const [world, setWorld] = useState<DemoProjection | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showMe, setShowMe] = useState<ShowMeProjection | null>(null);
  const [showMeView, setShowMeView] = useState<ShowMeView>("authority");
  const [showMeBusy, setShowMeBusy] = useState(false);
  const [showMeError, setShowMeError] = useState("");
  const showMeRequest = useRef(0);

  async function explain(current: DemoProjection, view: ShowMeView) {
    const requestNumber = ++showMeRequest.current;
    setShowMeView(view);
    setShowMeBusy(true);
    setShowMeError("");
    try {
      const projection = await requestShowMe(current.decisionHistory.map((decision) => decision.decisionId), view);
      if (showMeRequest.current === requestNumber) setShowMe(projection);
    } catch (cause) {
      if (showMeRequest.current === requestNumber) setShowMeError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (showMeRequest.current === requestNumber) setShowMeBusy(false);
    }
  }

  async function load() {
    setBusy(true);
    setError("");
    try {
      const next = await requestDemoWorld();
      setWorld(next);
      void explain(next, "authority");
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
      const next = await requestDemoWorld({
        action: "choose",
        decisionIds: world.decisionHistory.map((decision) => decision.decisionId),
        decisionId,
      });
      setWorld(next);
      void explain(next, "change");
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
      const next = await requestDemoWorld({ action: "reset" });
      setWorld(next);
      void explain(next, "authority");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.demo} data-demo-runtime="synthetic-demo-runtime" data-demo-storage="demo-owned-disposable" data-demo-story-status={completed ? "completed" : "playing"}>
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
          <div className={styles.progress} aria-label="Demo progress" data-demo-turns={world.evidence.turns}>
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
              {!busy ? <div className={styles.actions}><button type="button" onClick={() => void load()}>Retry DEMO</button><button type="button" data-demo-action="exit" onClick={onExit}>Exit DEMO</button></div> : null}
            </>
          ) : completed ? (
            <>
              <p className={styles.eyebrow}>Five scenes resolved</p>
              <h2>You just used PlotPickle's STORY engine</h2>
              <p>Your choices changed deterministic story state while the DEMO stayed inside its disposable synthetic boundary.</p>
              <div className={styles.actions}>
                <button type="button" data-demo-action="make-this-mine" disabled={busy} onClick={() => onMakeThisMine(world.decisionHistory.map((decision) => decision.decisionId))}>Make This Mine</button>
                <button type="button" data-demo-action="reset" disabled={busy} onClick={() => void reset()}>Reset DEMO</button>
                <button type="button" data-demo-action="enter-plotpickle" onClick={onEnterPlotPickle}>Enter PlotPickle</button>
                <button type="button" data-demo-action="exit" onClick={onExit}>Exit DEMO</button>
              </div>
            </>
          ) : currentScene ? (
            <>
              <p className={styles.eyebrow}>Scene {world.decisionHistory.length + 1} of 5</p>
              <h2>{currentScene.title}</h2>
              <p>Choose what happens. STORY will resolve the consequence locally and advance the prepared world.</p>
              <div className={styles.choices}>
                {currentScene.decisions.map((decision) => (
                  <button type="button" data-demo-decision={decision.id} disabled={busy} key={decision.id} onClick={() => void choose(decision.id)}>{decision.label}</button>
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

        {world ? (
          <section className={styles.showMe} aria-label="Sage Show Me read-only explanation" data-sage-show-me="read-only" aria-busy={showMeBusy}>
            <div className={styles.showMeHeader}>
              <div><p className={styles.eyebrow}>Sage Brinewick · Show Me</p><h2>See the smallest useful explanation</h2></div>
              <span>Read-only · no model or provider required</span>
            </div>
            <div className={styles.showMeControls} role="tablist" aria-label="Show Me views">
              {SHOW_ME_OPTIONS.map((option) => (
                <button type="button" role="tab" aria-selected={showMeView === option.id} disabled={showMeBusy} key={option.id} onClick={() => void explain(world, option.id)}>{option.label}</button>
              ))}
            </div>
            {showMeBusy ? <p className={styles.showMeEmpty}>Sage is opening that view…</p> : <ShowMeCanvas projection={showMe} />}
            {showMeError ? <p role="alert" className={styles.error}>{showMeError}</p> : null}
          </section>
        ) : null}

        {world && !completed ? <footer className={styles.footer}><button type="button" data-demo-action="reset" disabled={busy} onClick={() => void reset()}>Reset DEMO</button><button type="button" data-demo-action="exit" onClick={onExit}>Exit DEMO</button></footer> : null}
      </section>
    </main>
  );
}
