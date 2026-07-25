from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"Expected marker not found in {path}: {old[:180]!r}")
    target.write_text(text.replace(old, new, 1))


labs = "app/specialist-labs.tsx"
replace(labs, 'import { dialogueGuidedPasses } from "./learning-dialogue-in-motion";\nimport type { PlotPickleProject, ScreenplayDraftElement } from "@/lib/project";', 'import { dialogueGuidedPasses } from "./learning-dialogue-in-motion";\nimport VisualReferenceLibrary from "./visual-reference-library";\nimport type { PlotPickleProject, ScreenplayDraftElement } from "@/lib/project";')
replace(labs, '  const [visualDirection, setVisualDirection] = useState("");', '  const [visualDirection, setVisualDirection] = useState("");\n  const [visualMode, setVisualMode] = useState<"project" | "library">("project");')
replace(labs, '''          {activeTab === "visual" ? <section>
            <div className={styles.sectionHeading}><span>Visual Bible & Mood Boards</span><h2>Unify images into production rules.</h2><p>The mood board reads character, location and storyboard assets already attached to the canonical project.</p></div>
            <div className={styles.assetGrid}>{generatedAssets.length ? generatedAssets.map((asset) => <article key={`${asset.kind}-${asset.id}`}><img src={asset.src} alt={asset.label} /><div><span>{asset.kind}</span><strong>{asset.label}</strong>{asset.prompt ? <small>{asset.prompt}</small> : null}</div></article>) : <p className={styles.empty}>Add character, location or storyboard images to populate the mood board.</p>}</div>
            <label>Visual direction to explore<textarea rows={7} value={visualDirection} onChange={(event) => setVisualDirection(event.target.value)} placeholder="Define lighting, contrast, texture, recurring shapes, camera distance and continuity rules." /></label>
            <button type="button" className={styles.primary} disabled={!visualDirection.trim() || aiState === "working"} onClick={buildVisualSuggestion}>{aiState === "working" ? "Generating…" : "Generate Visual Bible proposal"}</button>
          </section> : null}''', '''          {activeTab === "visual" ? <section>
            <div className={styles.sectionHeading}><span>Visual Bible & Mood Boards</span><h2>Build an original visual system from project evidence and deliberate references.</h2><p>Bundled references remain separate from project-owned images. Nothing changes until the writer opens and approves a Visual Bible proposal.</p></div>
            <div className={styles.actions}><button type="button" className={visualMode === "project" ? styles.primary : ""} onClick={() => setVisualMode("project")}>Project Mood Board</button><button type="button" className={visualMode === "library" ? styles.primary : ""} onClick={() => setVisualMode("library")}>Reference Library</button></div>
            {visualMode === "project" ? <>
              <div className={styles.assetGrid}>{generatedAssets.length ? generatedAssets.map((asset) => <article key={`${asset.kind}-${asset.id}`}><img src={asset.src} alt={asset.label} /><div><span>{asset.kind}</span><strong>{asset.label}</strong>{asset.prompt ? <small>{asset.prompt}</small> : null}</div></article>) : <p className={styles.empty}>Add character, location or storyboard images to populate the Project Mood Board.</p>}</div>
              <label>Visual direction to explore<textarea rows={7} value={visualDirection} onChange={(event) => setVisualDirection(event.target.value)} placeholder="Define lighting, contrast, texture, recurring shapes, camera distance and continuity rules." /></label>
              <button type="button" className={styles.primary} disabled={!visualDirection.trim() || aiState === "working"} onClick={buildVisualSuggestion}>{aiState === "working" ? "Generating…" : "Generate Visual Bible proposal"}</button>
            </> : <VisualReferenceLibrary project={project} onPrepareSuggestion={(suggestion) => setReview(suggestion)} onStatus={setStatus} />}
          </section> : null}''')

studio = "app/learning-studio.tsx"
replace(studio, 'import { loglinesThatCarryTheMovie } from "./learning-loglines-that-carry-the-movie";', 'import { loglinesThatCarryTheMovie } from "./learning-loglines-that-carry-the-movie";\nimport { moodColourVisualLanguage } from "./learning-mood-colour-visual-language";')
replace(studio, '  loglinesThatCarryTheMovie,', '  loglinesThatCarryTheMovie,\n  moodColourVisualLanguage,')

package = "package.json"
replace(package, 'tests/issue-56-purpose-aware-logline-lab.test.mjs tests/phase-one-core-schema.test.mjs', 'tests/issue-56-purpose-aware-logline-lab.test.mjs tests/issue-57-visual-reference-library.test.mjs tests/phase-one-core-schema.test.mjs')
