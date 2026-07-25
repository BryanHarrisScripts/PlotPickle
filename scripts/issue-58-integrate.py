from pathlib import Path
import json


def replace(path, old, new):
    target = Path(path)
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"Missing marker in {path}: {old[:100]!r}")
    target.write_text(text.replace(old, new, 1))

# Project Overview
replace("app/project-overview.tsx", 'import styles from "./project-overview.module.css";', 'import AfterglowLegacyVisuals from "./afterglow-legacy-visuals";\nimport styles from "./project-overview.module.css";')
replace("app/project-overview.tsx", '''      <section className={styles.identityGrid} aria-label="Project identity">
        <article><span>Format</span><strong>{project.metadata.format || "Not set"}</strong></article>
        <article><span>Target runtime</span><strong>{project.metadata.targetMinutes || 0} minutes</strong></article>
        <article><span>Status</span><strong>{project.metadata.status || "Not set"}</strong></article>
        <article><span>Last updated</span><strong>{readableDate(project.metadata.updatedAt)}</strong></article>
      </section>''', '''      <section className={styles.identityGrid} aria-label="Project identity">
        <article><span>Format</span><strong>{project.metadata.format || "Not set"}</strong></article>
        <article><span>Target runtime</span><strong>{project.metadata.targetMinutes || 0} minutes</strong></article>
        <article><span>Status</span><strong>{project.metadata.status || "Not set"}</strong></article>
        <article><span>Last updated</span><strong>{readableDate(project.metadata.updatedAt)}</strong></article>
      </section>

      <AfterglowLegacyVisuals project={project} mode="overview" />''')

# Specialist Labs
replace("app/specialist-labs.tsx", 'import VisualReferenceLibrary from "./visual-reference-library";', 'import VisualReferenceLibrary from "./visual-reference-library";\nimport AfterglowLegacyVisuals from "./afterglow-legacy-visuals";\nimport { legacyVisualProposalText, type AfterglowLegacyVisual, type AfterglowVisualDecision } from "@/lib/afterglow-legacy-visuals";')
replace("app/specialist-labs.tsx", 'const [visualMode, setVisualMode] = useState<"project" | "library">("project");', 'const [visualMode, setVisualMode] = useState<"project" | "afterglow" | "library">("project");')
replace("app/specialist-labs.tsx", '''  async function buildVisualSuggestion() {''', '''  function prepareLegacyVisualDecision(visual: AfterglowLegacyVisual, decision: AfterglowVisualDecision) {
    setReview(createSpecialistSuggestion({
      lab: "visual",
      title: `Legacy visual decision · ${visual.title}`,
      summary: "Writer-controlled decision for a bundled legacy Afterglow source visual.",
      target: `${decision.scope}:${decision.target}`,
      before: "The legacy image remains historical source material and is not approved for current use.",
      after: legacyVisualProposalText(visual, decision),
      prompt: decision.writerNote || "Writer-selected legacy visual decision.",
      generated: false,
      metadata: {
        collection: "Legacy Afterglow Visuals",
        referenceId: visual.id,
        sourceFilename: visual.source.originalFilename,
        sourceSha: visual.source.originalSha,
        mappingStatus: visual.mappingStatus,
        proposedBlocks: visual.proposedBlockNumbers.join(", "),
        action: decision.action,
        scope: decision.scope,
        provenance: "Bundled legacy source visual; not a new AI generation event.",
        approvalBoundary: "Nothing changes until the writer approves this specialist pass.",
      },
    }));
    setStatus("Legacy visual decision is ready for review. No Block cover, pitch asset or project reference has changed.");
  }

  async function buildVisualSuggestion() {''')
replace("app/specialist-labs.tsx", '''            <div className={styles.actions}><button type="button" className={visualMode === "project" ? styles.primary : ""} onClick={() => setVisualMode("project")}>Project Mood Board</button><button type="button" className={visualMode === "library" ? styles.primary : ""} onClick={() => setVisualMode("library")}>Reference Library</button></div>
            {visualMode === "project" ? <>
              <div className={styles.assetGrid}>{generatedAssets.length ? generatedAssets.map((asset) => <article key={`${asset.kind}-${asset.id}`}><img src={asset.src} alt={asset.label} /><div><span>{asset.kind}</span><strong>{asset.label}</strong>{asset.prompt ? <small>{asset.prompt}</small> : null}</div></article>) : <p className={styles.empty}>Add character, location or storyboard images to populate the Project Mood Board.</p>}</div>
              <label>Visual direction to explore<textarea rows={7} value={visualDirection} onChange={(event) => setVisualDirection(event.target.value)} placeholder="Define lighting, contrast, texture, recurring shapes, camera distance and continuity rules." /></label>
              <button type="button" className={styles.primary} disabled={!visualDirection.trim() || aiState === "working"} onClick={buildVisualSuggestion}>{aiState === "working" ? "Generating…" : "Generate Visual Bible proposal"}</button>
            </> : <VisualReferenceLibrary project={project} onPrepareSuggestion={(suggestion) => setReview(suggestion)} onStatus={setStatus} />}''', '''            <div className={styles.actions}><button type="button" className={visualMode === "project" ? styles.primary : ""} onClick={() => setVisualMode("project")}>Project Mood Board</button><button type="button" className={visualMode === "afterglow" ? styles.primary : ""} onClick={() => setVisualMode("afterglow")}>Legacy Afterglow Visuals</button><button type="button" className={visualMode === "library" ? styles.primary : ""} onClick={() => setVisualMode("library")}>Reference Library</button></div>
            {visualMode === "project" ? <>
              <div className={styles.assetGrid}>{generatedAssets.length ? generatedAssets.map((asset) => <article key={`${asset.kind}-${asset.id}`}><img src={asset.src} alt={asset.label} /><div><span>{asset.kind}</span><strong>{asset.label}</strong>{asset.prompt ? <small>{asset.prompt}</small> : null}</div></article>) : <p className={styles.empty}>Add character, location or storyboard images to populate the Project Mood Board.</p>}</div>
              <label>Visual direction to explore<textarea rows={7} value={visualDirection} onChange={(event) => setVisualDirection(event.target.value)} placeholder="Define lighting, contrast, texture, recurring shapes, camera distance and continuity rules." /></label>
              <button type="button" className={styles.primary} disabled={!visualDirection.trim() || aiState === "working"} onClick={buildVisualSuggestion}>{aiState === "working" ? "Generating…" : "Generate Visual Bible proposal"}</button>
            </> : visualMode === "afterglow" ? <><AfterglowLegacyVisuals project={project} mode="gallery" onPrepareDecision={prepareLegacyVisualDecision} /><details><summary>Pitch & Vision legacy boards</summary><AfterglowLegacyVisuals project={project} mode="pitch" onPrepareDecision={prepareLegacyVisualDecision} /></details></> : <VisualReferenceLibrary project={project} onPrepareSuggestion={(suggestion) => setReview(suggestion)} onStatus={setStatus} />}''')

# Visual Storyboard
replace("app/visual-storyboard.tsx", 'import styles from "./visual-storyboard.module.css";', 'import AfterglowLegacyVisuals from "./afterglow-legacy-visuals";\nimport styles from "./visual-storyboard.module.css";')
replace("app/visual-storyboard.tsx", '''        <aside className={styles.inspector}>''', '''        <aside className={styles.inspector}>
          <p><strong>Current approved storyboard</strong> frames remain separate from historical source art.</p>
          <AfterglowLegacyVisuals project={project} mode="block" blockNumber={block.number} />''')

# Learning Studio
replace("app/learning-studio.tsx", 'import { moodColourVisualLanguage } from "./learning-mood-colour-visual-language";', 'import { moodColourVisualLanguage } from "./learning-mood-colour-visual-language";\nimport { earlyVisualDevelopmentLesson, earlyVisualDevelopmentSearchText } from "./learning-early-visual-development";')
replace("app/learning-studio.tsx", '''  moodColourVisualLanguage,
  ...twentyFourBlocksLessons,''', '''  moodColourVisualLanguage,
  earlyVisualDevelopmentLesson,
  ...twentyFourBlocksLessons,''')
replace("app/learning-studio.tsx", '''  const coreGuide = coreGuideFor(module.id);''', '''  if (module.id === earlyVisualDevelopmentLesson.id) return `${base} ${earlyVisualDevelopmentSearchText()}`;
  const coreGuide = coreGuideFor(module.id);''')

# Test runner
package = Path("package.json")
data = json.loads(package.read_text())
needle = "tests/issue-57-visual-reference-library.test.mjs"
insert = f"{needle} tests/issue-58-afterglow-legacy-visuals.test.mjs"
if "tests/issue-58-afterglow-legacy-visuals.test.mjs" not in data["scripts"]["test"]:
    data["scripts"]["test"] = data["scripts"]["test"].replace(needle, insert)
package.write_text(json.dumps(data, indent=2) + "\n")
