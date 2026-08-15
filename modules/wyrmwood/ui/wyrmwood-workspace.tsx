"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import { buildFundamentalsTrials, WYRMWOOD_FIRST_CAMPAIGN } from "../curriculum-bridge";
import {
  beginWyrmwoodRound,
  createWyrmwoodGameState,
  normalizeWyrmwoodGameState,
  WYRMWOOD_STORAGE_KEY,
} from "../engine";
import type { WyrmwoodGameState } from "../contracts";
import styles from "./wyrmwood-workspace.module.css";

const NAV_ITEMS = [
  { id: "learn", label: "Learn", detail: "Guides", selectable: true },
  { id: "plan", label: "Plan", detail: "Design", selectable: true },
  { id: "build", label: "Build", detail: "Assemble", selectable: false },
  { id: "sketch", label: "Sketch", detail: "Visualize", selectable: false },
  { id: "visualize", label: "Visualize", detail: "Pages", selectable: false },
  { id: "write", label: "Write", detail: "Draft", selectable: false },
  { id: "edit", label: "Edit", detail: "Polish", selectable: false },
  { id: "feedback", label: "Feedback", detail: "Review", selectable: false },
  { id: "refine", label: "Refine", detail: "Decide", selectable: false },
  { id: "reports", label: "Reports", detail: "Deliver", selectable: false },
  { id: "wyrmwood", label: "Play", detail: "Wyrmwood", selectable: true },
] as const;

function loadState() {
  try {
    const saved = localStorage.getItem(WYRMWOOD_STORAGE_KEY);
    return saved ? normalizeWyrmwoodGameState(JSON.parse(saved)) : createWyrmwoodGameState();
  } catch {
    return createWyrmwoodGameState();
  }
}

export default function WyrmwoodWorkspace({
  curriculum,
  onOpenLearn,
  onOpenPlan,
}: {
  readonly curriculum: readonly CurriculumLesson[];
  readonly onOpenLearn: () => void;
  readonly onOpenPlan: () => void;
}) {
  const trials = useMemo(() => buildFundamentalsTrials(curriculum), [curriculum]);
  const [state, setState] = useState<WyrmwoodGameState | null>(null);
  const [practiceResponse, setPracticeResponse] = useState("");

  useEffect(() => {
    setState(loadState());
  }, []);

  function saveState(next: WyrmwoodGameState) {
    localStorage.setItem(WYRMWOOD_STORAGE_KEY, JSON.stringify(next));
    setState(next);
  }

  function openNav(id: (typeof NAV_ITEMS)[number]["id"]) {
    if (id === "learn") onOpenLearn();
    if (id === "plan") onOpenPlan();
  }

  if (!state || !trials.length) {
    return <main className={styles.loading}>Opening Wyrmwood…</main>;
  }

  const boundedIndex = Math.min(state.trialIndex, trials.length - 1);
  const trial = trials[boundedIndex];
  const words = practiceResponse.trim() ? practiceResponse.trim().split(/\s+/).length : 0;
  const active = state.roundStatus === "active";

  return (
    <div className={styles.screen} data-hide-agent-settings-anchor="true">
      <nav className={styles.topNav} aria-label="PlotPickle workflow and plugins">
        <ol>
          {NAV_ITEMS.map((item) => (
            <li className={item.id === "wyrmwood" ? styles.current : undefined} key={item.id}>
              <button
                aria-current={item.id === "wyrmwood" ? "page" : undefined}
                disabled={!item.selectable || item.id === "wyrmwood"}
                onClick={() => openNav(item.id)}
                type="button"
              >
                {item.id === "wyrmwood" ? (
                  <Image alt="" aria-hidden="true" height={42} src="/brand/favicon/plotpickle-ouroboros-v2-128.png" width={42} />
                ) : <span aria-hidden="true" className={styles.navRune}>✦</span>}
                <span><strong>{item.label}</strong><small>{item.detail}</small></span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <main className={styles.workspace}>
        <aside className={styles.campaignRail}>
          <header>
            <small>PLAY · WYRMwOOD</small>
            <h1>The Plot-Weaver&apos;s Duel</h1>
            <p>{WYRMWOOD_FIRST_CAMPAIGN.description}</p>
          </header>
          <section className={styles.resources} aria-label="Wyrmwood player resources">
            <div><span>Spotlight</span><strong>{state.spotlight}</strong></div>
            <div><span>Brine Coins</span><strong>{state.brineCoins}</strong></div>
            <div><span>XP</span><strong>{state.xp}</strong></div>
          </section>
          <nav aria-label="Fundamentals trials" className={styles.trialList}>
            {trials.map((candidate, index) => (
              <button
                aria-current={index === boundedIndex ? "step" : undefined}
                className={index === boundedIndex ? styles.activeTrial : undefined}
                key={candidate.id}
                onClick={() => saveState({ ...state, trialIndex: index, roundStatus: "ready" })}
                type="button"
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{candidate.lessonTitle}</strong>
              </button>
            ))}
          </nav>
        </aside>

        <article className={styles.duelPanel}>
          <header className={styles.duelHeader}>
            <div>
              <small>CAMPAIGN I · {WYRMWOOD_FIRST_CAMPAIGN.title.toUpperCase()}</small>
              <h2>{trial.lessonTitle}</h2>
              <p>Trial {boundedIndex + 1} of {trials.length} · built directly from LEARN → Foundations.</p>
            </div>
            <div className={styles.wyrm} data-spotlight={state.spotlight}>
              <Image alt="The Plot-Wyrm" height={116} priority src="/brand/favicon/plotpickle-ouroboros-v2-128.png" width={116} />
              <small>{state.spotlight >= 75 ? "COMMANDING" : state.spotlight >= 50 ? "STABLE" : state.spotlight >= 25 ? "UNRAVELING" : "CHAOTIC"}</small>
            </div>
          </header>

          <section className={styles.lessonBridge}>
            <small>WHAT LEARN TAUGHT YOU</small>
            <p>{trial.lessonReminder}</p>
            <ul>
              {trial.learningTargets.map((target) => <li key={target}>{target}</li>)}
            </ul>
          </section>

          <section className={styles.phaseCard}>
            <small>PHASE 1 · THE KNOT</small>
            <h3>Curriculum-bound challenge seed</h3>
            <p>{trial.pickleSeed}</p>
            {!active ? (
              <button onClick={() => saveState(beginWyrmwoodRound(state))} type="button">Enter this trial</button>
            ) : (
              <div className={styles.practiceArea}>
                <label htmlFor="wyrmwood-practice">Spellscribe response · practical logic only</label>
                <textarea
                  id="wyrmwood-practice"
                  maxLength={1200}
                  onChange={(event) => setPracticeResponse(event.target.value)}
                  placeholder="Use what the lesson taught. Solve the contradiction with established information, cause-and-effect and practical action."
                  rows={8}
                  value={practiceResponse}
                />
                <div className={styles.practiceFooter}>
                  <small className={words > 150 ? styles.overLimit : undefined}>{words} / 150 words</small>
                  <button disabled type="button">Rival duel + judgment arrives in Phase 2</button>
                </div>
              </div>
            )}
          </section>
        </article>

        <aside className={styles.debriefPanel}>
          <section>
            <small>WHY THIS EXISTS</small>
            <h2>LEARN it. Then survive it.</h2>
            <p>Wyrmwood does not invent a separate curriculum. The campaign translates the same lesson objectives into playable narrative pressure.</p>
          </section>
          <section>
            <small>PHASED BUILD</small>
            <ol>
              <li><strong>Phase 1</strong><span>Plugin shell, isolated state, Foundations curriculum bridge and PLAY workspace.</span></li>
              <li><strong>Phase 2</strong><span>Master Oaken-Vague, five rival trope performances and player turn execution.</span></li>
              <li><strong>Phase 3</strong><span>Structured curriculum scoring, Spotlight movement, Brine rewards and teaching debrief.</span></li>
              <li><strong>Phase 4</strong><span>Campaign progression, shop, ranks, daily Pickle and additional LEARN stages.</span></li>
            </ol>
          </section>
          <button className={styles.reviewLesson} onClick={onOpenLearn} type="button">Review this material in LEARN</button>
        </aside>
      </main>
    </div>
  );
}
