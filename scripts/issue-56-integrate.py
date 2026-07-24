from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"Expected marker not found in {path}: {old[:180]!r}")
    target.write_text(text.replace(old, new, 1))


workspace = "app/pitch-review-workspace.tsx"
replace(workspace, 'import DialecticWorksheet from "./dialectic-worksheet";\nimport LoglineRubric from "./logline-rubric";', 'import DialecticWorksheet from "./dialectic-worksheet";\nimport LoglineLab from "./logline-lab";')
replace(workspace, '''  addReviewComment,
  approveLoglineCandidate,
  buildGuidedLoglineCandidate,
  buildPitchPackageHtml,''', '''  addReviewComment,
  buildPitchPackageHtml,''')
replace(workspace, '''  removeReviewThread,
  saveLoglineCandidate,
  updatePitchPackage,''', '''  removeReviewThread,
  updatePitchPackage,''')
replace(workspace, '''  updateReviewThreadStatus,
  type LoglineWorkshopAnswers,
} from "@/lib/pitch-review";''', '''  updateReviewThreadStatus,
} from "@/lib/pitch-review";''')
replace(workspace, '''const workshopSteps: Array<{ key: keyof LoglineWorkshopAnswers; title: string; question: string; placeholder: string }> = [
  { key: "protagonist", title: "Protagonist", question: "Who carries the film?", placeholder: "Name or defining role" },
  { key: "identity", title: "Identity", question: "What makes them immediately specific?", placeholder: "A reluctant archivist with a forbidden memory" },
  { key: "disruption", title: "Disruption", question: "What breaks the ordinary world?", placeholder: "The catalytic event" },
  { key: "goal", title: "Goal", question: "What must they actively achieve?", placeholder: "A visible, playable objective" },
  { key: "opposition", title: "Opposition", question: "What force makes that difficult?", placeholder: "Person, system, environment or inner pattern" },
  { key: "stakes", title: "Stakes", question: "What happens if they fail?", placeholder: "Personal and external cost" },
  { key: "distinction", title: "Distinction", question: "What makes this film unlike the obvious version?", placeholder: "Irony, world rule, relationship or signature move" },
];

''', '')
replace(workspace, '''  const [view, setView] = useState<View>("logline");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<LoglineWorkshopAnswers>({
    protagonist: project.development.foundations.protagonist,
    identity: "",
    disruption: project.story.catalyst,
    goal: project.development.foundations.objective,
    opposition: project.development.foundations.opposition,
    stakes: project.story.stakes,
    distinction: project.development.pickle.signatureMove,
  });
  const [candidatePreview, setCandidatePreview] = useState("");''', '''  const [view, setView] = useState<View>("logline");''')
replace(workspace, '''  function createCandidate() {
    const next = buildGuidedLoglineCandidate(active, answers);
    setCandidatePreview(next);
  }

  function keepCandidate() {
    if (!candidatePreview) return;
    onProjectChange(saveLoglineCandidate(active, candidatePreview));
    setCandidatePreview("");
  }

''', '')
replace(workspace, '["logline", "Logline Workshop"]', '["logline", "Logline Lab"]')
replace(workspace, '''      {view === "logline" ? <><div className={styles.twoColumn}>
        <section className={styles.panel}>
          <div className={styles.panelTitle}><div><span>Step {step + 1} of {workshopSteps.length}</span><h2>{workshopSteps[step].title}</h2></div><small>One concrete decision at a time</small></div>
          <p className={styles.question}>{workshopSteps[step].question}</p>
          <textarea value={answers[workshopSteps[step].key]} placeholder={workshopSteps[step].placeholder} onChange={(event) => setAnswers({ ...answers, [workshopSteps[step].key]: event.target.value })} />
          <div className={styles.actions}><button type="button" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>Previous</button>{step < workshopSteps.length - 1 ? <button type="button" className={styles.primary} onClick={() => setStep(step + 1)}>Next question</button> : <button type="button" className={styles.primary} onClick={createCandidate}>Build logline candidate</button>}</div>
          {candidatePreview ? <div className={styles.preview}><span>Review before saving</span><p>{candidatePreview}</p><div className={styles.actions}><button type="button" onClick={() => setCandidatePreview("")}>Discard</button><button type="button" className={styles.primary} onClick={keepCandidate}>Save candidate</button></div></div> : null}
        </section>
        <section className={styles.panel}>
          <div className={styles.panelTitle}><div><span>Candidate library</span><h2>Compare and approve</h2></div><small>Approval updates the canonical logline</small></div>
          <div className={styles.stack}>{active.review.loglineCandidates.length ? active.review.loglineCandidates.map((candidate) => <article className={candidate.selected ? styles.selectedCard : styles.card} key={candidate.id}><span>{candidate.source} · {new Date(candidate.createdAt).toLocaleString()}</span><p>{candidate.text}</p><button type="button" disabled={candidate.selected} onClick={() => onProjectChange(approveLoglineCandidate(active, candidate.id))}>{candidate.selected ? "Current approved logline" : "Approve this logline"}</button></article>) : <p className={styles.empty}>No saved candidates yet. Complete the guided questions to create the first one.</p>}</div>
        </section>
      </div><LoglineRubric project={active} text={candidatePreview || active.story.logline || active.development.pitch.oneSentence} /></> : null}''', '''      {view === "logline" ? <LoglineLab project={active} onProjectChange={onProjectChange} /> : null}''')

studio = "app/learning-studio.tsx"
replace(studio, 'import { learningModules, learningPaths, moduleSearchText, type LearningModule } from "./learning-library";', 'import { learningModules, learningPaths, moduleSearchText, type LearningModule } from "./learning-library";\nimport { loglinesThatCarryTheMovie } from "./learning-loglines-that-carry-the-movie";')
replace(studio, '''const courseModules: CourseModule[] = [
  ...learningModules,''', '''const courseModules: CourseModule[] = [
  ...learningModules,
  loglinesThatCarryTheMovie,''')

package = "package.json"
replace(package, 'tests/issue-55-core-curriculum-router.test.mjs tests/phase-one-core-schema.test.mjs', 'tests/issue-55-core-curriculum-router.test.mjs tests/issue-56-purpose-aware-logline-lab.test.mjs tests/phase-one-core-schema.test.mjs')
