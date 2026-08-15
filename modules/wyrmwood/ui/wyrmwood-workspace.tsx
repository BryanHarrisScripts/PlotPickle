"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import { buildFundamentalsTrials, WYRMWOOD_FIRST_CAMPAIGN } from "../curriculum-bridge";
import {
  activateWyrmwoodRound,
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

const NAV_ITEMS = [
  { id: "learn", label: "Learn", detail: "Guides", selectable: true },
  { id: "plan", label: "Plan", detail: "Design", selectable: true },
  { id: "build", label: "Build", detail: "Assemble", selectable: false },
  { id: "sketch", label: "Storyboard", detail: "Sketch", selectable: false },
  { id: "visualize", label: "Previs", detail: "Visualize", selectable: false },
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

function countWords(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
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
  const [directorError, setDirectorError] = useState("");

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
  const directorTurn = state.currentDirectorTurn;
  const words = countWords(practiceResponse);
  const generating = state.roundStatus === "generating";
  const active = state.roundStatus === "active";
  const resolved = state.roundStatus === "resolved";
  const pickleNumber = state.pickleIndex + 1;
  const finalPickle = state.pickleIndex === WYRMWOOD_PICKLES_PER_MATCH - 1;

  async function generatePickle() {
    if (generating || active || resolved) return;
    setDirectorError("");
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

  function submitPlayerMove() {
    if (!directorTurn || !active || words < 1 || words > 150) return;
    saveState(submitWyrmwoodPlayerTurn(state, {
      trialId: trial.id,
      pickleId: directorTurn.pickle.id,
      pickleNumber: directorTurn.pickleNumber,
      response: practiceResponse,
      submittedAt: new Date().toISOString(),
    }));
  }

  function continuePlayerLoop() {
    if (!resolved) return;
    saveState(continueWyrmwoodLoop(state, trial.id, trials.length));
    setPracticeResponse("");
    setDirectorError("");
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
            <small>PLAY · WYRmWOOD</small>
            <h1>The Plot-Weaver&apos;s Duel</h1>
            <p>{WYRMWOOD_FIRST_CAMPAIGN.description}</p>
          </header>
          <section className={styles.resources} aria-label="Wyrmwood player resources">
            <div><span>Spotlight</span><strong>{state.spotlight}</strong></div>
            <div><span>Brine Coins</span><strong>{state.brineCoins}</strong></div>
            <div><span>XP</span><strong>{state.xp}</strong></div>
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
            <small>PHASE 2 · THE PICKLE</small>
            {!directorTurn ? (
              <>
                <h3>Master Oaken-Vague is waiting</h3>
                <p>Generate one fresh lesson-bound Pickle. Oaken-Vague will stage the problem and direct all five trope rivals in a single local inference; the game engine keeps every score and progress value under deterministic control.</p>
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
                    disabled={resolved}
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

                {resolved ? (
                  <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(53,201,184,.25)" }}>
                    <strong style={{ color: "#91e7dc" }}>Move sealed.</strong>
                    <p>Your response is now part of Wyrmwood&apos;s isolated turn history. Phase 3 will add structured curriculum judgment, Spotlight movement and rewards; Phase 2 deliberately does not let the AI mutate those values.</p>
                    <button onClick={continuePlayerLoop} type="button">
                      {finalPickle ? "Finish this match and open the next trial" : `Continue to Pickle ${pickleNumber + 1}`}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </article>

        <aside className={styles.debriefPanel}>
          <section>
            <small>RIVAL DIRECTOR</small>
            <h2>Master Oaken-Vague</h2>
            <p>Oaken-Vague is Wyrmwood&apos;s impartial context manager and chaos director. He is separate from Sage: a different role, playbook and memory boundary. One local inference creates the Pickle and all five rival performances.</p>
          </section>
          <section>
            <small>WHY THIS EXISTS</small>
            <h2>LEARN it. Then survive it.</h2>
            <p>Wyrmwood does not invent a separate curriculum. The campaign translates the same lesson objectives into playable narrative pressure.</p>
          </section>
          <section>
            <small>PHASED BUILD</small>
            <ol>
              <li><strong>Phase 1</strong><span>Plugin shell, isolated state, Foundations curriculum bridge and PLAY workspace.</span></li>
              <li><strong>Phase 2 · LIVE</strong><span>Master Oaken-Vague, five trope rivals, generated Pickles and the complete 150-word player-turn loop.</span></li>
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