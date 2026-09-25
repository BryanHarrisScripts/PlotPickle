                    </li>
                  ))}
                </ol>
              ) : <p>No generated takes are registered for this address.</p>}
            </section>
            <section className="pp-skin-v1-production-handoff-state" aria-label="Rough Cut revision state">
              <strong>{roughCut?.cuts.length ?? 0} cut revision{roughCut?.cuts.length === 1 ? "" : "s"}</strong>
              <p>{roughCut?.cuts[0] ? `Current revision: ${roughCut.cuts[0].id}. Earlier cuts remain recoverable.` : "No Rough Cut revision exists yet. Approved upstream work remains intact until a cut is explicitly assembled."}</p>
              <button type="button" onClick={createRoughCutRevision}>Create Rough Cut revision</button>
              <p aria-live="polite">{message}</p>
            </section>

            <section className="pp-skin-v1-production-handoff-state" aria-label="Provider-neutral production handoff state">
              <strong>{readiness.label}</strong>
              <p>{readiness.detail}</p>
              <small>{selectedAnchor.reason}</small>
            </section>
          </>
        ) : (
          <p>No production evidence exists for this selected story address.</p>
        )}
      </section>
    </div>
  );
}

export function SkinV1SoundReviewSurface({
  kind,
  address,
  onAddressChange,
}: {
  readonly kind: ProductionSoundCueKind;
  readonly address: PreproductionReviewAddress;
  readonly onAddressChange: (address: PreproductionReviewAddress) => void;
}) {
  const [project, setProject] = useState<PPFProject | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const normalized = normalizedAddress(address);
  const anchorRef = `storyboard-anchor:block:block-${String(normalized.blockNumber).padStart(2, "0")}:mini-${normalized.miniBlockNumber}`;

  useEffect(() => {
    const sync = () => {
      try {
        setProject(loadFoundationProject());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "The canonical project could not be opened.");
      }
    };
    const timer = window.setTimeout(sync, 0);
    window.addEventListener(FOUNDATION_PROJECT_SAVED_EVENT, sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(FOUNDATION_PROJECT_SAVED_EVENT, sync);
    };
  }, []);

  const shots = useMemo(
    () => project?.production.shots.filter((shot) => shot.anchorRef === anchorRef) ?? [],
    [anchorRef, project],
  );
  const cues = useMemo(
    () => (project?.production.soundCues ?? []).filter((cue) => cue.anchorRef === anchorRef && cue.kind === kind),
    [anchorRef, kind, project],
  );

  function createCue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project) return;
    const data = new FormData(event.currentTarget);
    const intent = String(data.get("intent") ?? "").trim();
    if (!intent) {
      setMessage("Describe the sound intent before saving. PlotPickle will not invent missing sound.");
      return;
    }
    const shotId = String(data.get("productionShotId") ?? "").trim();
    const startRaw = String(data.get("startSecond") ?? "").trim();
    const endRaw = String(data.get("endSecond") ?? "").trim();
    const startSecond = startRaw ? Number(startRaw) : null;
    const endSecond = endRaw ? Number(endRaw) : null;
    if ((startSecond !== null && (!Number.isFinite(startSecond) || startSecond < 0))
      || (endSecond !== null && (!Number.isFinite(endSecond) || endSecond < 0))
      || (startSecond !== null && endSecond !== null && endSecond <= startSecond)) {
      setMessage("Timing must be positive, and the end must be later than the start. Leave both blank to keep the cue untimed.");
      return;
    }
    const now = new Date().toISOString();
    const cueId = globalThis.crypto?.randomUUID?.() ?? `sound-${kind}-${Date.now()}`;
    const next = applyStoryCommand(project, {
      type: "production.sound.store",
      cue: {
        id: cueId,
        anchorRef,
        productionShotId: shotId || undefined,
        kind,
        intent,
        startSecond,
        endSecond,
        sourceRefs: shotId ? [`production-shot:${shotId}`] : [anchorRef],
        reviewState: "planned",
        createdAt: now,
        updatedAt: now,
      },
      occurredAt: now,
    });
    const saved = saveFoundationProject(next);
    setProject(saved);
    event.currentTarget.reset();
    setMessage(`${kind === "narration" ? "Narration" : kind === "music" ? "Music" : "Foley"} cue saved to ${normalized.blockNumber}.${normalized.miniBlockNumber} without changing story or Previs authority.`);
  }

  function removeCue(cueId: string) {
    if (!project) return;
    const now = new Date().toISOString();
    const next = applyStoryCommand(project, {
      type: "production.sound.remove",
      cueId,
      occurredAt: now,
    });
    setProject(saveFoundationProject(next));
    setMessage("Sound cue removed. Picture and Previs timing were unchanged.");
  }

  if (error) return <p role="alert">{error}</p>;
  if (!project) return <p role="status">Opening Sound intent…</p>;

  const label = kind === "narration" ? "Narration" : kind === "music" ? "Music" : "Foley";
  return (
    <div data-skin-v1-preproduction-review="sound" data-sound-kind={kind}>
      <div className="pp-skin-v1-preproduction-context" role="status">
        <strong>{label.toUpperCase()} · BLOCK {String(normalized.blockNumber).padStart(2, "0")} · MINI-BLOCK {normalized.miniBlockNumber}</strong>
        <span>Sound intent attaches to the same story/shot identity as Timeline and Rough Cut. Blank timing stays untimed rather than receiving an invented timestamp.</span>
      </div>
      <nav className="pp-skin-v1-preproduction-address-rail" aria-label={`${label} Mini-Block address`}>
        {[1, 2, 3, 4].map((miniBlockNumber) => (
          <button
            aria-current={miniBlockNumber === normalized.miniBlockNumber ? "step" : undefined}
            key={miniBlockNumber}
            onClick={() => onAddressChange({ blockNumber: normalized.blockNumber, miniBlockNumber })}
            type="button"
          >
            Mini {miniBlockNumber}
          </button>
        ))}
      </nav>
      <section className="pp-skin-v1-production-stage" aria-labelledby="sound-stage-title" data-production-stage="sound-intent">
        <header>
          <div><p>SOUND INTENT</p><h2 id="sound-stage-title">{label}</h2></div>
          <strong>{cues.length} cue{cues.length === 1 ? "" : "s"}</strong>
        </header>
        <form onSubmit={createCue}>
          <label>
            Intent
            <textarea name="intent" placeholder={kind === "narration" ? "What should be spoken or narrated?" : kind === "music" ? "What should the music do here?" : "What physical or environmental sound belongs here?"} />
          </label>
          <label>
            Attach to Shot
            <select name="productionShotId" defaultValue="">
              <option value="">Whole Mini-Block / story address</option>
              {shots.map((shot) => <option key={shot.id} value={shot.id}>Shot {shot.order} · {shot.reviewState}</option>)}
            </select>
          </label>
          <label>Start second <input min="0" name="startSecond" step="0.01" type="number" /></label>
          <label>End second <input min="0" name="endSecond" step="0.01" type="number" /></label>
          <button type="submit">Save {label} cue</button>
        </form>
        <section className="pp-skin-v1-production-shots" aria-label={`${label} cues`}>
          {cues.length ? (
            <ol>
              {cues.map((cue) => (
                <li key={cue.id}>
                  <strong>{label}</strong>
                  <span>{cue.reviewState}</span>
                  <span>{cue.startSecond !== null && cue.endSecond !== null ? `${cue.startSecond}s → ${cue.endSecond}s` : "Untimed"}</span>
                  <small>{cue.intent}</small>
                  <button type="button" onClick={() => removeCue(cue.id)}>Remove</button>
                </li>
              ))}
            </ol>
          ) : <p>No {label.toLowerCase()} intent is authored for this address. PlotPickle leaves the lane empty.</p>}
        </section>
        <p aria-live="polite">{message}</p>
      </section>
    </div>
  );
}

export function SkinV1ScreeningReviewSurface() {
  const [project, setProject] = useState<PPFProject | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setProject(loadFoundationProject());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "The canonical project could not be opened.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function createObservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project || !screening?.cut) return;
    const data = new FormData(event.currentTarget);
    const summary = String(data.get("summary") ?? "").trim();
    const productionShotId = String(data.get("productionShotId") ?? "").trim();
    const category = String(data.get("category") ?? "intent");
    const startRaw = String(data.get("startSecond") ?? "").trim();
    const endRaw = String(data.get("endSecond") ?? "").trim();
    const startSecond = startRaw ? Number(startRaw) : null;
    const endSecond = endRaw ? Number(endRaw) : null;
    if (!summary) {
      setMessage("Describe what was observed before saving a Screening note.");
      return;
    }
    if (!["intent", "picture", "timing", "continuity", "sound"].includes(category)) {
      setMessage("Choose a supported Screening observation category.");
      return;
    }
    if ((startSecond !== null && (!Number.isFinite(startSecond) || startSecond < 0))
      || (endSecond !== null && (!Number.isFinite(endSecond) || endSecond < 0))
      || (startSecond !== null && endSecond !== null && endSecond <= startSecond)) {
      setMessage("Screening timing must be positive and ordered, or left blank.");
      return;
    }
    const now = new Date().toISOString();
    const observationId = globalThis.crypto?.randomUUID?.() ?? `screening-${Date.now()}`;
    const next = applyStoryCommand(project, {
      type: "production.screening.store",
      observation: {
        id: observationId,
        roughCutId: screening.cut.id,
        productionShotId: productionShotId || undefined,
        startSecond,
        endSecond,
        category: category as "intent" | "picture" | "timing" | "continuity" | "sound",
        summary,
        evidenceRefs: productionShotId ? [`production-shot:${productionShotId}`, `rough-cut:${screening.cut.id}`] : [`rough-cut:${screening.cut.id}`],
        state: "observed",
        createdAt: now,
      },
      occurredAt: now,
    });
    setProject(saveFoundationProject(next));
    event.currentTarget.reset();
    setMessage("Screening observation saved as evidence. No story, shot, sound or media was changed automatically.");
  }

  function resolveObservation(observationId: string) {
    if (!project) return;
    const observation = (project.production.screeningObservations ?? []).find((candidate) => candidate.id === observationId);
    if (!observation) return;
    const now = new Date().toISOString();
    const next = applyStoryCommand(project, {
      type: "production.screening.store",
      observation: { ...observation, state: "resolved" },
      occurredAt: now,
    });
    setProject(saveFoundationProject(next));
    setMessage("Screening observation marked resolved. The underlying creative authorities remain unchanged.");
  }

  const screening = useMemo(() => project ? projectScreening({ production: project.production }) : null, [project]);

  if (error) return <p role="alert">{error}</p>;
  if (!project || !screening) return <p role="status">Opening Screening evidence…</p>;

  return (
    <div data-skin-v1-preproduction-review="screening">
      <div className="pp-skin-v1-preproduction-context" role="status">
        <strong>SCREENING · OBSERVED EVIDENCE</strong>
        <span>Screening compares the current Rough Cut with approved intent. Findings are evidence and do not automatically change canon or regenerate media.</span>
      </div>
      <section className="pp-skin-v1-production-stage" aria-labelledby="screening-stage-title" data-production-stage="screening-observation">
        <header>
          <div>
            <p>INTENDED VS OBSERVED</p>
            <h2 id="screening-stage-title">Current screening</h2>
          </div>
          <strong>{screening.cut ? screening.cut.id : "NO ROUGH CUT"}</strong>
        </header>
        {screening.cut ? (
          <>
            <div className="pp-skin-v1-production-evidence">
              <article><span>Cut revision</span><strong>{screening.cut.id}</strong><p>Source revision {screening.cut.sourceRevision}</p></article>
              <article><span>Placements</span><strong>{screening.cut.placements.length}</strong><p>Stable Production Shot identities.</p></article>
              <article><span>Observations</span><strong>{screening.observations.length}</strong><p>{screening.unresolved.length} unresolved.</p></article>
              <article><span>Authority</span><strong>HUMAN</strong><p>Observed evidence never self-promotes into canon.</p></article>
            </div>
            <section className="pp-skin-v1-production-handoff-state" aria-label="Add Screening observation">
              <strong>Add observed evidence</strong>
              <form onSubmit={createObservation}>
                <label>
                  Category
                  <select name="category" defaultValue="intent">
                    <option value="intent">Intent</option>
                    <option value="picture">Picture</option>
                    <option value="timing">Timing</option>
                    <option value="continuity">Continuity</option>
                    <option value="sound">Sound</option>
                  </select>
                </label>
                <label>
                  Production Shot
                  <select name="productionShotId" defaultValue="">
                    <option value="">Cut-level observation</option>
                    {screening.cut.placements.map((placement) => {
                      const shot = project.production.shots.find((candidate) => candidate.id === placement.productionShotId);
                      return <option key={placement.productionShotId} value={placement.productionShotId}>Shot {shot?.order ?? "?"} · {placement.productionShotId}</option>;
                    })}
                  </select>
                </label>
                <label>Start second <input min="0" name="startSecond" step="0.01" type="number" /></label>
                <label>End second <input min="0" name="endSecond" step="0.01" type="number" /></label>
                <label>Observation <textarea name="summary" placeholder="What did the current cut actually show or sound like?" /></label>
                <button type="submit">Save observation</button>
              </form>
              <p aria-live="polite">{message}</p>
            </section>
            <section className="pp-skin-v1-production-shots" aria-label="Screening observations">
              <header><h3>Observed evidence</h3><span>Bounded repair routes back to the owning surface</span></header>
              {screening.observations.length ? (
                <ol>
                  {screening.observations.map((observation) => (
                    <li key={observation.id}>
                      <strong>{observation.category.toUpperCase()}</strong>
                      <span>{observation.state}</span>
                      <span>{observation.productionShotId || observation.soundCueId || "cut-level"}</span>
                      <small>{observation.summary}</small>
                      {observation.state === "observed" ? <button type="button" onClick={() => resolveObservation(observation.id)}>Mark resolved</button> : null}
                    </li>
                  ))}
                </ol>
              ) : <p>No Screening observations exist for this Rough Cut. PlotPickle does not invent a quality score or failure to fill the surface.</p>}
            </section>
          </>
        ) : <p>No Rough Cut revision exists yet. Screening remains truthful and empty until there is something to watch and compare.</p>}
      </section>
    </div>
  );
}

export function SkinV1BuildReviewSurface({
  address,
  onOpenDashboard,
  onOpenOutline,
  onReturn,
  returnLabel,
}: {
  readonly address: PreproductionReviewAddress;
  readonly onOpenDashboard: () => void;
  readonly onOpenOutline: () => void;
  readonly onReturn: () => void;
  readonly returnLabel: "Outline" | "Storyboard" | "Previs";
}) {
  const normalized = normalizedAddress(address);
  return (
    <div data-skin-v1-preproduction-review="build">
      <div className="pp-skin-v1-preproduction-context" role="status">
        <strong>BUILD EVIDENCE · BLOCK {String(normalized.blockNumber).padStart(2, "0")} · MINI-BLOCK {normalized.miniBlockNumber}</strong>
        <span>This is the existing canonical Build authority projected inside the Skin V1 review flow.</span>
        <button type="button" data-preproduction-return onClick={onReturn}>Back to {returnLabel}</button>
      </div>
      <FoundationsBuildWorkspace
        curriculum={plotPickleCurriculum}
        onOpenDashboard={onOpenDashboard}
        onOpenPlan={onOpenOutline}
      />
    </div>
  );
}