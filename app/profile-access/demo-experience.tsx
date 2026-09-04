"use client";

import { useMemo, useState } from "react";
import { createDemoBoundary } from "@/core/demo-onboarding/demo-boundary.mjs";
import {
  DEMO_STORY_SCENARIO_ID,
  DEMO_STORY_SEED,
  applyStoryDemoDecision,
  createStoryDemoWorld,
  listStoryDemoDecisions,
  resetStoryDemoWorld,
} from "@/modules/story-the-unwritten/demo/world.mjs";
import styles from "./demo-experience.module.css";

type DemoExperienceProps = {
  readonly onExit: () => void;
  readonly onEnterPlotPickle: () => void;
};

function createWorld() {
  const boundary = createDemoBoundary({ demoId: DEMO_STORY_SCENARIO_ID, seed: DEMO_STORY_SEED });
  return createStoryDemoWorld({ boundary });
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
  const [world, setWorld] = useState(createWorld);
  const [error, setError] = useState("");
  const currentScene = useMemo(
    () => world.scenario.scenes.find((scene: { id: string }) => scene.id === world.runtime.session.currentSceneId) || null,
    [world],
  );
  const decisions = listStoryDemoDecisions(world);
  const lastDecision = world.decisionHistory.at(-1) || null;
  const completed = world.runtime.session.status === "completed";

  function choose(decisionId: string) {
    setError("");
    try {
      setWorld((current: ReturnType<typeof createWorld>) => applyStoryDemoDecision(current, decisionId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  function reset() {
    setError("");
    setWorld((current: ReturnType<typeof createWorld>) => resetStoryDemoWorld(current));
  }

  return (
    <main className={styles.demo} data-demo-runtime="synthetic-demo-runtime" data-demo-storage="demo-owned-disposable">
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>PlotPickle DEMO</p>
            <h1>{world.scenario.title}</h1>
            <p>{world.scenario.summary}</p>
          </div>
          <div className={styles.safety} aria-label="DEMO privacy boundary">
            <strong>Disposable synthetic world</strong>
            <span>No profile, provider, BUZZ, GitHub, Google, Internet, or private project access.</span>
          </div>
        </header>

        <div className={styles.progress} aria-label="Demo progress">
          {world.scenario.scenes.map((scene: { id: string; title: string }, index: number) => {
            const runtimeScene = world.runtime.scenes[index];
            const active = scene.id === world.runtime.session.currentSceneId;
            return <span key={scene.id} data-state={active ? "active" : runtimeScene.status}>{index + 1}. {scene.title}</span>;
          })}
        </div>

        <section className={styles.story} aria-live="polite">
          {completed ? (
            <>
              <p className={styles.eyebrow}>Five scenes resolved</p>
              <h2>You just used PlotPickle's STORY engine</h2>
              <p>Your choices changed deterministic story state while the DEMO stayed inside its disposable synthetic boundary.</p>
              <div className={styles.actions}>
                <button type="button" onClick={reset}>Reset DEMO</button>
                <button type="button" onClick={onEnterPlotPickle}>Enter PlotPickle</button>
                <button type="button" onClick={onExit}>Exit DEMO</button>
              </div>
            </>
          ) : currentScene ? (
            <>
              <p className={styles.eyebrow}>Scene {world.decisionHistory.length + 1} of 5</p>
              <h2>{currentScene.title}</h2>
              <p>Choose what happens. STORY will resolve the consequence and advance the prepared world.</p>
              <div className={styles.choices}>
                {decisions.map((decision: { id: string; label: string }) => (
                  <button type="button" key={decision.id} onClick={() => choose(decision.id)}>{decision.label}</button>
                ))}
              </div>
            </>
          ) : null}
          {error ? <p role="alert" className={styles.error}>{error}</p> : null}
        </section>

        <aside className={styles.evidence} aria-label="STORY consequence evidence">
          <div>
            <span>Turns resolved</span>
            <strong>{world.state.values["demo:value:turns"]} / 5</strong>
          </div>
          <div>
            <span>Mara location</span>
            <strong>{String(world.state.characterLocations["demo:character:mara"] || "unknown").replace("demo:location:", "").replaceAll("-", " ")}</strong>
          </div>
          <div>
            <span>Mara and Rowan</span>
            <strong>{world.state.relationships["demo:relationship:mara-rowan"]}</strong>
          </div>
          <div>
            <span>Brass key</span>
            <strong>{String(world.state.objectCustody["demo:object:brass-key"] || "unknown").replace(/^demo:(?:character|location):/u, "").replaceAll("-", " ")}</strong>
          </div>
          {lastDecision ? <p className={styles.change}>Latest consequence: {lastDecision.consequenceKinds.filter((kind: string) => kind !== "adjust-number").map(humanizeConsequence).join(", ")}.</p> : <p className={styles.change}>Make a choice to see deterministic state change.</p>}
        </aside>

        {!completed ? <footer className={styles.footer}><button type="button" onClick={reset}>Reset DEMO</button><button type="button" onClick={onExit}>Exit DEMO</button></footer> : null}
      </section>
    </main>
  );
}
