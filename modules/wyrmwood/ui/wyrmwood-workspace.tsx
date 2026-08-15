"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import {
  buildFundamentalsTrials,
  buildWyrmwoodCurriculumProgress,
  WYRMWOOD_FIRST_CAMPAIGN,
} from "../curriculum-bridge";
import { evaluateWyrmwoodTurn } from "../curriculum-evaluator";
import {
  activateWyrmwoodRound,
  applyWyrmwoodEvaluation,
  beginWyrmwoodRound,
  continueWyrmwoodLoop,
  createWyrmwoodGameState,
  failWyrmwoodRoundGeneration,
  normalizeWyrmwoodGameState,
  openWyrmwoodTrial,
  submitWyrmwoodPlayerTurn,
  WYRMWOOD_PICKLES_PER_MATCH,
  WYRMWOOD_STORAGE_KEY,
} from "../engine";
import { directWyrmwoodTurn, WYRMWOOD_RIVALS } from "../rival-director";
import type { WyrmwoodGameState } from "../contracts";
import styles from "./wyrmwood-workspace.module.css";

const LEARN_PROJECT_STORAGE_KEY = "plotpickle.foundation.project.v1";

const NAV_ITEMS = [
  { id: "learn", relic: "/assets/workflow-relics/learn.webp", label: "Learn", detail: "Guides", selectable: true },
  { id: "plan", relic: "/assets/workflow-relics/plan.webp", label: "Plan", detail: "Design", selectable: true },
  { id: "build", relic: "/assets/workflow-relics/build.webp", label: "Build", detail: "Assemble", selectable: false },
  { id: "storyboard", relic: "/assets/workflow-relics/storyboard.webp", label: "Storyboard", detail: "Sketch", selectable: false },
  { id: "graphic-novel", relic: "/assets/workflow-relics/graphic-novel.webp", label: "Previs", detail: "Visualize", selectable: false },
  { id: "write", relic: "/assets/workflow-relics/write.webp", label: "Write", detail: "Draft", selectable: false },
  { id: "edit", relic: "/assets/workflow-relics/edit.webp", label: "Edit", detail: "Polish", selectable: false },
  { id: "feedback", relic: "/assets/workflow-relics/feedback.webp", label: "Feedback", detail: "Review", selectable: false },
  { id: "refine", relic: "/assets/workflow-relics/refine.webp", label: "Refine", detail: "Decide", selectable: false },
  { id: "reports", relic: "/assets/workflow-relics/reports.webp", label: "Reports", detail: "Deliver", selectable: false },
  { id: "wyrmwood", relic: "/assets/workflow-relics/game.webp", label: "Wyrmwood", detail: "Game", selectable: true },
] as const;

const DIMENSION_LABELS = [
  ["storyLogic", "Story Logic", 30],
  ["lessonApplication", "Lesson Application", 20],
  ["establishedElements", "Established Elements", 15],
  ["consequences", "Consequences", 15],
  ["rivalCounter", "Rival Counter", 10],
  ["clarity", "Clarity", 10],
] as const;

type LearnSnapshot = {
  readonly completedLessonIds: readonly string[];
  readonly activeLessonId: string;
};

function loadState() {
  try {
    const saved = localStorage.getItem(WYRMWOOD_STORAGE_KEY);
    return saved ? normalizeWyrmwoodGameState(JSON.parse(saved)) : createWyrmwoodGameState();
  } catch {
    return createWyrmwoodGameState();
  }
}

function loadLearnSnapshot(): LearnSnapshot {
  try {
    const saved = localStorage.getItem(LEARN_PROJECT_STORAGE_KEY);
    if (!saved) return { completedLessonIds: [], activeLessonId: "" };
    const project = JSON.parse(saved) as {
      readonly learning?: {
        readonly completedLessonIds?: unknown;
        readonly activeLessonId?: unknown;
      };
    };
    return {
      completedLessonIds: Array.isArray(project.learning?.completedLessonIds)
        ? project.learning.completedLessonIds.filter((id): id is string => typeof id === "string")
        : [],
      activeLessonId: typeof project.learning?.activeLessonId === "string" ? project.learning.activeLessonId : "",
    };
  } catch {
    return { completedLessonIds: [], activeLessonId: "" };
  }
}

function countWords(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
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
  const [learnSnapshot, setLearnSnapshot] = useState<LearnSnapshot>({ completedLessonIds: [], activeLessonId: "" });
  const [practiceResponse, setPracticeResponse] = useState("");
  const [directorError, setDirectorError] = useState("");
  const [evaluationError, setEvaluationError] = useState("");

  useEffect(() => {
    setState(loadState());
    setLearnSnapshot(loadLearnSnapshot());
  }, []);

  const curriculumProgress = useMemo(() => buildWyrmwoodCurriculumProgress(
    curriculum,
    learnSnapshot.completedLessonIds,
    learnSnapshot.activeLessonId,
  ), [curriculum, learnSnapshot]);

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
  const directorTurn = state.currentDirectorTurn;
  const resolution = state.lastResolution;
  const words = countWords(practiceResponse);
  const generating = state.roundStatus === "generating";
  const active = state.roundStatus === "active";
  const evaluating = state.roundStatus === "evaluating";
  const resolved = state.roundStatus === "resolved";
  const pickleNumber = state.pickleIndex + 1;
  const finalPickle = state.pickleIndex === WYRMWOOD_PICKLES_PER_MATCH - 1;
  const trialStudied = curriculumProgress.completedLessonIds.includes(trial.lessonId);
  const currentLearnLesson = curriculum.find((lesson) => lesson.id === curriculumProgress.activeLessonId)?.title ?? "No Foundations lesson currently open";

  async function generatePickle() {
    if (generating || active || evaluating || resolved) return;
    setDirectorError("");
    setEvaluationError("");
    setPracticeResponse("");
    const generatingState = beginWyrmwoodRound(state);
    saveState(generatingState);
    try {
      const turn = await directWyrmwoodTurn({ trial, pickleNumber });
      saveState(activateWyrmwoodRound(generatingState, turn));
    } catch (error) {
      saveState(failWyrmwoodRoundGeneration(generatingState));
      setDirectorError(error instanceof Error ? error.message : "Master Oaken-Vague could not prepare this Pickle.");
    }
  }

  async function evaluateSubmittedMove(submittedState: WyrmwoodGameState, playerResponse: string) {
    if (!directorTurn) return;
    setEvaluationError("");
    try {
      const evaluation = await evaluateWyrmwoodTurn({
        trial,
        director: directorTurn,
        playerResponse,
      });
      saveState(applyWyrmwoodEvaluation(submittedState, evaluation));
    } catch (error) {
      setEvaluationError(error instanceof Error ? error.message : "The Curriculum Evaluator could not judge this move.");
    }
  }

  async function submitPlayerMove() {
    if (!directorTurn || !active || words < 1 || words > 150) return;
    const submitted = submitWyrmwoodPlayerTurn(state, {
      trialId: trial.id,
      pickleId: directorTurn.pickle.id,
      pickleNumber: directorTurn.pickleNumber,
      response: practiceResponse,
      submittedAt: new Date().toISOString(),
    });
    saveState(submitted);
    await evaluateSubmittedMove(submitted, practiceResponse.trim());
  }

  async function retryEvaluation() {
    if (!directorTurn || !evaluating) return;
    const latest = state.turnHistory.at(-1);
    if (!latest) return;
    await evaluateSubmittedMove(state, latest.player.response);
  }

  function continuePlayerLoop() {
    if (!resolved || !resolution) return;
    saveState(continueWyrmwoodLoop(state, trial.id, trials.length));
    setPracticeResponse("");
    setDirectorError("");
    setEvaluationError("");
  }

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
                <Image
                  alt=""
                  aria-hidden="true"
                  className={styles.navRelic}
                  height={42}
                  src={item.relic}
                  width={42}
                />
                <span><strong>{item.label}</strong><small>{item.detail}</small></span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <main className={styles.workspace}>
        <aside className={styles.campaignRail}>
          <header>
            <strong className={styles.wyrmwoodTitle}>WYRMWOOD</strong>
            <small>PLAY · THE FOUNDATIONS TRIALS</small>
            <h1>The Plot-Weaver&apos;s Duel</h1>
            <p>{WYRMWOOD_FIRST_CAMPAIGN.description}</p>
          </header>
          <section className={styles.resources} aria-label="Wyrmwood player resources">
            <div><span>Spotlight</span><strong>{state.spotlight}</strong></div>
            <div><span>Brine Coins</span><strong>{state.brineCoins}</strong></div>
            <div><span>XP</span><strong>{state.xp}</strong></div>
          </section>
          <section style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
            <small style={{ color: "#8f8a81" }}>SPELLSCRIBE RANK</small>
            <strong style={{ display: "block", marginTop: 4, color: "#efe9dd" }}>Level {state.level} · {state.rank}</strong>
          </section>
          <section style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
            <small style={{ color: "#8f8a81" }}>LEARN BRIDGE · {curriculumProgress.stage.toUpperCase()}</small>
            <strong style={{ display: "block", marginTop: 4, color: "#efe9dd" }}>
              {curriculumProgress.completedInStage} of {curriculumProgress.totalInStage} lessons marked complete
            </strong>
            <span style={{ display: "block", marginTop: 5, color: "#aaa49a", fontSize: 11 }}>Current LEARN lesson: {currentLearnLesson}</span>
          </section>
          <section style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
            <small style={{ color: "#8f8a81" }}>CURRENT MATCH</small>
            <strong style={{ display: "block", marginTop: 4, color: "#efe9dd" }}>
              Pickle {pickleNumber} of {WYRMWOOD_PICKLES_PER_MATCH}
            </strong>
          </section>
          <nav aria-label="Fundamentals trials" className={styles.trialList}>
            {trials.map((candidate, index) => (
              <button
                aria-current={index === boundedIndex ? "step" : undefined}
                className={index === boundedIndex ? styles.activeTrial : undefined}
                key={candidate.id}
                onClick={() => {
                  saveState(openWyrmwoodTrial(state, index));
                  setPracticeResponse("");
                  setDirectorError("");
                  setEvaluationError("");
                }}
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
              <p>Trial {boundedIndex + 1} of {trials.length} · Pickle {pickleNumber} of {WYRMWOOD_PICKLES_PER_MATCH} · built directly from LEARN → Foundations.</p>
              <p style={{ color: trialStudied ? "#91e7dc" : "#cf9c50", fontSize: 12 }}>
                {trialStudied ? "✓ You marked this LEARN lesson complete." : "Uncharted knowledge — you can still play, then review the lesson in LEARN."}
              </p>
            </div>
            <div className={styles.wyrm} data-spotlight={state.spotlight}>
              <Image alt="Wyrmwood game emblem" height={116} priority src="/assets/workflow-relics/game.webp" width={116} />
              <small>{state.spotlight >= 75 ? "COMMANDING" : state.spotlight >= 50 ? "STABLE" : state.spotlight >= 25 ? "UNRAVELING" : "CHAOTIC"}</small>
            </div>
          </header>

          <section className={styles.lessonBridge}>
            <small>WHAT LEARN TAUGHT YOU</small>
            <p>{trial.lessonReminder}</p>
            <ul>
              {trial.learningTargets.map((target) => <li key={target}>{target}</li>)}
            </ul>
            {trial.keyConcepts.length ? (
              <p><strong>Key concepts:</strong> {trial.keyConcepts.join(" · ")}</p>
            ) : null}
          </section>

          <section className={styles.phaseCard}>
            <small>THE DUEL · PICKLE → RIVALS → SPELLSCRIBE → JUDGMENT</small>
            {!directorTurn ? (
              <>
                <h3>Master Oaken-Vague is waiting</h3>
                <p>Generate one fresh lesson-bound Pickle. Oaken-Vague will stage the problem and direct all five trope rivals in one local inference. After your move, a separate Curriculum Evaluator judges lesson application while the deterministic engine alone controls scores, Spotlight, XP, Brine Coins, and progression.</p>
                {directorError ? <p role="alert" style={{ color: "#ffb081" }}>{directorError}</p> : null}
                <button disabled={generating} onClick={generatePickle} type="button">
                  {generating ? "Master Oaken-Vague is setting the board…" : `Generate Pickle ${pickleNumber} of ${WYRMWOOD_PICKLES_PER_MATCH}`}
                </button>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 18, padding: "14px 16px", border: "1px solid rgba(53,201,184,.35)", background: "rgba(53,201,184,.045)" }}>
                  <small style={{ color: "#91e7dc" }}>MASTER OAKEN-VAGUE</small>
                  <p style={{ margin: "7px 0 0", fontStyle: "italic" }}>{directorTurn.oakenOpening}</p>
                </div>

                <h3>{directorTurn.pickle.title}</h3>
                <p>{directorTurn.pickle.situation}</p>
                <p><strong>Immediate goal:</strong> {directorTurn.pickle.goal}</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, margin: "18px 0" }}>
                  <div style={{ padding: 14, border: "1px solid rgba(255,255,255,.09)" }}>
                    <small>ESTABLISHED ELEMENTS</small>
                    <ul>{directorTurn.pickle.establishedElements.map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                  <div style={{ padding: 14, border: "1px solid rgba(255,255,255,.09)" }}>
                    <small>CONSTRAINTS</small>
                    <ul>{directorTurn.pickle.constraints.map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                </div>
                <p><strong>Failure pressure:</strong> {directorTurn.pickle.failurePressure}</p>

                <div style={{ marginTop: 24 }}>
                  <small style={{ color: "#cf9c50" }}>THE FIVE RIVALS MOVE FIRST</small>
                  <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                    {WYRMWOOD_RIVALS.map((rival) => {
                      const move = directorTurn.rivals[rival.id];
                      return (
                        <section key={rival.id} style={{ padding: "12px 14px", border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.018)" }}>
                          <strong>{rival.name} · {rival.trope}</strong>
                          <p style={{ margin: "6px 0 3px" }}>{move.action}</p>
                          <small style={{ color: "#b9a88a" }}>Complication: {move.complication}</small>
                        </section>
                      );
                    })}
                  </div>
                </div>

                <div className={styles.practiceArea} style={{ marginTop: 24 }}>
                  <label htmlFor="wyrmwood-practice">Spellscribe response · practical logic only</label>
                  <textarea
                    disabled={evaluating || resolved}
                    id="wyrmwood-practice"
                    maxLength={1200}
                    onChange={(event) => setPracticeResponse(event.target.value)}
                    placeholder="Use what the lesson taught. Counter the rivals by solving the actual problem with established information, cause-and-effect and practical action."
                    rows={8}
                    value={practiceResponse}
                  />
                  <div className={styles.practiceFooter}>
                    <small className={words > 150 ? styles.overLimit : undefined}>{words} / 150 words</small>
                    {active ? (
                      <button disabled={words < 1 || words > 150} onClick={submitPlayerMove} type="button">Commit my move</button>
                    ) : null}
                  </div>
                </div>

                {evaluating ? (
                  <div style={{ marginTop: 18, padding: 16, border: "1px solid rgba(207,156,80,.32)", background: "rgba(207,156,80,.04)" }}>
                    <strong style={{ color: "#e4bd7a" }}>Curriculum judgment in progress…</strong>
                    <p>The evaluator is checking your move against the active LEARN objectives and the established scene. PlotPickle will apply all game math only after the structured evidence returns.</p>
                    {evaluationError ? (
                      <>
                        <p role="alert" style={{ color: "#ffb081" }}>{evaluationError}</p>
                        <button onClick={retryEvaluation} type="button">Retry curriculum judgment</button>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {resolved && resolution ? (
                  <div style={{ marginTop: 22, paddingTop: 20, borderTop: "1px solid rgba(53,201,184,.3)" }}>
                    <small style={{ color: "#91e7dc" }}>SPOTLIGHT JUDGMENT · CURRICULUM DEBRIEF</small>
                    <h3 style={{ marginTop: 8 }}>{resolution.score} / 100</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, margin: "14px 0 18px" }}>
                      <div style={{ padding: 12, border: "1px solid rgba(255,255,255,.09)" }}><small>SPOTLIGHT</small><strong style={{ display: "block" }}>{signed(resolution.spotlightDelta)}</strong></div>
                      <div style={{ padding: 12, border: "1px solid rgba(255,255,255,.09)" }}><small>BRINE</small><strong style={{ display: "block" }}>+{resolution.brineCoinsEarned}</strong></div>
                      <div style={{ padding: 12, border: "1px solid rgba(255,255,255,.09)" }}><small>XP</small><strong style={{ display: "block" }}>+{resolution.xpGained}</strong></div>
                    </div>
                    {resolution.tropeCounterBonus ? <p style={{ color: "#cf9c50" }}><strong>Trope Counter Bonus:</strong> +25 Brine Coins for using or neutralizing rival chaos effectively.</p> : null}
                    {(resolution.levelAfter !== resolution.levelBefore || resolution.rankAfter !== resolution.rankBefore) ? (
                      <p style={{ color: "#91e7dc" }}><strong>Progression:</strong> Level {resolution.levelBefore} {resolution.rankBefore} → Level {resolution.levelAfter} {resolution.rankAfter}</p>
                    ) : null}

                    <div style={{ display: "grid", gap: 8, margin: "18px 0" }}>
                      {DIMENSION_LABELS.map(([key, label, maximum]) => (
                        <div key={key} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, paddingBottom: 7, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                          <span>{label}</span><strong>{resolution.dimensions[key]} / {maximum}</strong>
                        </div>
                      ))}
                    </div>

                    <section style={{ marginTop: 16 }}>
                      <small style={{ color: "#91e7dc" }}>WHAT WORKED</small>
                      <ul>{resolution.whatWorked.map((item) => <li key={item}>{item}</li>)}</ul>
                    </section>
                    <section style={{ marginTop: 16 }}>
                      <small style={{ color: "#cf9c50" }}>WHAT TO SHARPEN</small>
                      <ul>{resolution.whatNeedsWork.map((item) => <li key={item}>{item}</li>)}</ul>
                    </section>
                    <section style={{ marginTop: 16 }}>
                      <small>CONCEPT USED</small>
                      <p><strong>{resolution.conceptUsed}</strong></p>
                      <p>{resolution.teachingDebrief}</p>
                    </section>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
                      <button onClick={onOpenLearn} type="button">Review this material in LEARN</button>
                      <button onClick={continuePlayerLoop} type="button">
                        {finalPickle ? "Finish this match and open the next trial" : `Continue to Pickle ${pickleNumber + 1}`}
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </article>

        <aside className={styles.debriefPanel}>
          <section>
            <small>CURRICULUM BRIDGE</small>
            <h2>LEARN stays the source</h2>
            <p>Wyrmwood reads the current Foundations stage, lesson objectives, key concepts, and the lessons you marked complete. It never replaces or rewrites your LEARN record.</p>
          </section>
          <section>
            <small>CURRICULUM EVALUATOR</small>
            <h2>Judge the reasoning, not the prose</h2>
            <p>A separate local evaluator scores your response against the lesson and the scene. PlotPickle then deterministically calculates Spotlight, Brine Coins, XP, level, rank, and progression.</p>
          </section>
          <section>
            <small>PHASED BUILD</small>
            <ol>
              <li><strong>Phase 1</strong><span>Plugin shell, isolated state, Foundations curriculum bridge and PLAY workspace.</span></li>
              <li><strong>Phase 2</strong><span>Master Oaken-Vague, five trope rivals, generated Pickles and the complete 150-word player-turn loop.</span></li>
              <li><strong>Phase 3 · LIVE</strong><span>Curriculum scoring, deterministic Spotlight/XP/Brine progression, rank advancement and teaching debrief.</span></li>
              <li><strong>Phase 4</strong><span>Arcane Shop, daily Pickle, cosmetics, additional rivals and additional LEARN stages.</span></li>
            </ol>
          </section>
          <button className={styles.reviewLesson} onClick={onOpenLearn} type="button">Review this material in LEARN</button>
        </aside>
      </main>
    </div>
  );
}
