from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"Expected marker not found in {path}: {old[:120]!r}")
    target.write_text(text.replace(old, new, 1))


studio = "app/learning-studio.tsx"
replace(
    studio,
    'import { workingTogetherLessons, workingTogetherSearchText, type WorkingTogetherLesson } from "./learning-working-together";\nimport { learningModules, learningPaths, moduleSearchText, type LearningModule } from "./learning-library";',
    'import { workingTogetherLessons, workingTogetherSearchText, type WorkingTogetherLesson } from "./learning-working-together";\nimport { dialogueLessons, dialogueLessonSearchText, type DialogueLesson } from "./learning-dialogue-in-motion";\nimport { learningModules, learningPaths, moduleSearchText, type LearningModule } from "./learning-library";',
)
replace(
    studio,
    'type ViewMode = "workflow" | "guide" | "library" | "method" | "ai-revision" | "collaboration" | "working-together" | "characters";\ntype CourseModule = LearningModule | TwentyFourBlocksLesson | AiRevisionLesson | CollaborationOwnershipLesson | CharacterMotionLesson | WorkingTogetherLesson;',
    'type ViewMode = "workflow" | "guide" | "library" | "method" | "ai-revision" | "collaboration" | "working-together" | "characters" | "dialogue";\ntype CourseModule = LearningModule | TwentyFourBlocksLesson | AiRevisionLesson | CollaborationOwnershipLesson | CharacterMotionLesson | WorkingTogetherLesson | DialogueLesson;',
)
replace(
    studio,
    '  ...workingTogetherLessons,\n  ...characterMotionLessons,\n];',
    '  ...workingTogetherLessons,\n  ...characterMotionLessons,\n  ...dialogueLessons,\n];',
)
replace(
    studio,
    '''function isWorkingTogetherLesson(module: CourseModule): module is WorkingTogetherLesson {
  return "collection" in module && module.collection === "Working Together in PlotPickle";
}

function courseSearchText''',
    '''function isWorkingTogetherLesson(module: CourseModule): module is WorkingTogetherLesson {
  return "collection" in module && module.collection === "Working Together in PlotPickle";
}

function isDialogueLesson(module: CourseModule): module is DialogueLesson {
  return "collection" in module && module.collection === "Dialogue in Motion";
}

function courseSearchText''',
)
replace(
    studio,
    '  if (isWorkingTogetherLesson(module)) return `${base} ${workingTogetherSearchText(module)}`;\n  if (isCharacterMotionLesson(module)) return `${base} ${characterMotionSearchText(module)}`;',
    '  if (isWorkingTogetherLesson(module)) return `${base} ${workingTogetherSearchText(module)}`;\n  if (isDialogueLesson(module)) return `${base} ${dialogueLessonSearchText(module)}`;\n  if (isCharacterMotionLesson(module)) return `${base} ${characterMotionSearchText(module)}`;',
)
replace(
    studio,
    '''  const characterByMovement = miniBlockNumber === 1
    ? "characters-engine"
    : miniBlockNumber === 2
      ? "characters-choice-proof"
      : miniBlockNumber === 3
        ? "characters-conflict"
        : "characters-voiceprint";
  return [...new Set([characterByMovement, characterByStage, aiByMovement, aiByStage, byMovement, ...stage])].slice(0, 6);''',
    '''  const characterByMovement = miniBlockNumber === 1
    ? "characters-engine"
    : miniBlockNumber === 2
      ? "characters-choice-proof"
      : miniBlockNumber === 3
        ? "characters-conflict"
        : "characters-voiceprint";
  const dialogueByStage = blockNumber <= 6
    ? "dialogue-action"
    : blockNumber <= 12
      ? "dialogue-subtext"
      : blockNumber <= 18
        ? "dialogue-conflict"
        : "dialogue-revision";
  const dialogueByMovement = miniBlockNumber === 1
    ? "dialogue-exposition-genre"
    : miniBlockNumber === 2
      ? "dialogue-voiceprint"
      : miniBlockNumber === 3
        ? "dialogue-conflict"
        : "dialogue-exchange-turn";
  return [...new Set([dialogueByMovement, dialogueByStage, characterByMovement, characterByStage, aiByMovement, aiByStage, byMovement, ...stage])].slice(0, 8);''',
)
replace(
    studio,
    '''  function applyModule(module: CourseModule) {
    if (isAiRevisionLesson(module)) {''',
    '''  function openDialogueWorkspace(module: DialogueLesson) {
    const queryString = new URLSearchParams({ block: String(block.number), mini: String(mini.number), lesson: module.id });
    const section = module.workspaceSection ? `#${module.workspaceSection}` : "";
    window.location.assign(`${module.workspaceHref}?${queryString.toString()}${section}`);
  }

  function applyModule(module: CourseModule) {
    if (isAiRevisionLesson(module)) {''',
)
replace(
    studio,
    '''    if (isWorkingTogetherLesson(module)) {
      window.location.assign(module.workspaceHref);
      return;
    }
    if (module.apply === "Screenplay")''',
    '''    if (isWorkingTogetherLesson(module)) {
      window.location.assign(module.workspaceHref);
      return;
    }
    if (isDialogueLesson(module)) {
      openDialogueWorkspace(module);
      return;
    }
    if (module.apply === "Screenplay")''',
)
replace(
    studio,
    '      <button type="button" className={view === "characters" ? styles.active : ""} onClick={() => setView("characters")}>Characters in Motion</button>\n      <button type="button" className={view === "ai-revision" ? styles.active : ""} onClick={() => setView("ai-revision")}>AI-Assisted Revision</button>',
    '      <button type="button" className={view === "characters" ? styles.active : ""} onClick={() => setView("characters")}>Characters in Motion</button>\n      <button type="button" className={view === "dialogue" ? styles.active : ""} onClick={() => setView("dialogue")}>Dialogue in Motion</button>\n      <button type="button" className={view === "ai-revision" ? styles.active : ""} onClick={() => setView("ai-revision")}>AI-Assisted Revision</button>',
)
replace(
    studio,
    '''    </section> : view === "characters" ? <section className={styles.library}>
      <div className={styles.sectionIntro}><span>Behaviour-first character collection</span><h2>Characters in Motion</h2><p>Eight PlotPickled lessons connect character engine, choice evidence, flexible arc checkpoints, conflict, opposition, relationships, Voiceprint and cast design to the active story and Character Proof dashboard.</p></div>
      <main className={styles.moduleGrid}>{characterMotionLessons.map((module) => <ModuleCard module={module} complete={completed.has(module.id)} recommended={recommendedIds.includes(module.id)} onOpen={() => openModule(module.id)} onToggle={() => toggleComplete(module.id)} key={module.id} />)}</main>
    </section> : view === "ai-revision" ?''',
    '''    </section> : view === "characters" ? <section className={styles.library}>
      <div className={styles.sectionIntro}><span>Behaviour-first character collection</span><h2>Characters in Motion</h2><p>Eight PlotPickled lessons connect character engine, choice evidence, flexible arc checkpoints, conflict, opposition, relationships, Voiceprint and cast design to the active story and Character Proof dashboard.</p></div>
      <main className={styles.moduleGrid}>{characterMotionLessons.map((module) => <ModuleCard module={module} complete={completed.has(module.id)} recommended={recommendedIds.includes(module.id)} onOpen={() => openModule(module.id)} onToggle={() => toggleComplete(module.id)} key={module.id} />)}</main>
    </section> : view === "dialogue" ? <section className={styles.library}>
      <div className={styles.sectionIntro}><span>Playable screenplay dialogue collection</span><h2>Dialogue in Motion</h2><p>Eight PlotPickled lessons connect objectives, tactics, Voiceprint, subtext, conflict, action, silence, exposition, genre, scene turns, revision and table-read evidence to the active project.</p></div>
      <main className={styles.moduleGrid}>{dialogueLessons.map((module) => <ModuleCard module={module} complete={completed.has(module.id)} recommended={recommendedIds.includes(module.id)} onOpen={() => openModule(module.id)} onToggle={() => toggleComplete(module.id)} key={module.id} />)}</main>
    </section> : view === "ai-revision" ?''',
)
replace(
    studio,
    'placeholder="Search 24 Blocks, character journey, relationships, Voiceprint, Final Draft, ownership, GitHub, AI revision…"',
    'placeholder="Search 24 Blocks, playable dialogue, subtext, Voiceprint, table read, Final Draft, ownership, GitHub, AI revision…"',
)
replace(
    studio,
    '    {isWorkingTogetherLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}\n    {isCharacterMotionLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}',
    '    {isWorkingTogetherLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}\n    {isDialogueLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}\n    {isCharacterMotionLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}',
)
replace(
    studio,
    'isCollaborationLesson(module) || isWorkingTogetherLesson(module) || isCharacterMotionLesson(module) ? <span>{module.workspaceLabel}</span>',
    'isCollaborationLesson(module) || isWorkingTogetherLesson(module) || isDialogueLesson(module) || isCharacterMotionLesson(module) ? <span>{module.workspaceLabel}</span>',
)
replace(
    studio,
    'isMethodLesson(module) || isAiRevisionLesson(module) || isCollaborationLesson(module) || isWorkingTogetherLesson(module) || isCharacterMotionLesson(module) ? <small>{module.sourceNote}</small>',
    'isMethodLesson(module) || isAiRevisionLesson(module) || isCollaborationLesson(module) || isWorkingTogetherLesson(module) || isDialogueLesson(module) || isCharacterMotionLesson(module) ? <small>{module.sourceNote}</small>',
)
replace(
    studio,
    '        {isWorkingTogetherLesson(module) ? <section className={styles.example}><span>Direct application</span><h3>{module.workspaceLabel}</h3><p>Create a project-specific welcome card, contribution brief, proposal packet, anchored review note or decision record. Records stay local until the writer deliberately shares a proposal.</p></section> : null}\n        {isCharacterMotionLesson(module) ?',
    '        {isWorkingTogetherLesson(module) ? <section className={styles.example}><span>Direct application</span><h3>{module.workspaceLabel}</h3><p>Create a project-specific welcome card, contribution brief, proposal packet, anchored review note or decision record. Records stay local until the writer deliberately shares a proposal.</p></section> : null}\n        {isDialogueLesson(module) ? <section className={styles.example}><span>Direct application</span><h3>{module.workspaceLabel}</h3><p>The active Block and mini-block travel into the dialogue workspace. Blueprint, proof and table-read records remain reviewable evidence; no screenplay text is rewritten or applied automatically.</p></section> : null}\n        {isCharacterMotionLesson(module) ?',
)
replace(
    studio,
    'isCollaborationLesson(module) || isWorkingTogetherLesson(module) || isCharacterMotionLesson(module) ? module.workspaceLabel',
    'isCollaborationLesson(module) || isWorkingTogetherLesson(module) || isDialogueLesson(module) || isCharacterMotionLesson(module) ? module.workspaceLabel',
)

labs = "app/specialist-labs.tsx"
replace(
    labs,
    '} from "@/lib/ai-revision-playbooks";\nimport type { PlotPickleProject, ScreenplayDraftElement } from "@/lib/project";',
    '} from "@/lib/ai-revision-playbooks";\nimport { dialogueGuidedPasses } from "./learning-dialogue-in-motion";\nimport type { PlotPickleProject, ScreenplayDraftElement } from "@/lib/project";',
)
replace(
    labs,
    'const [dialogueDirection, setDialogueDirection] = useState("");\n  const selectedDialogue = dialogueElements.find((element) => element.id === dialogueElementId) ?? dialogueElements[0];',
    'const [dialogueDirection, setDialogueDirection] = useState("");\n  const [dialoguePassId, setDialoguePassId] = useState(dialogueGuidedPasses[0].id);\n  const selectedDialogue = dialogueElements.find((element) => element.id === dialogueElementId) ?? dialogueElements[0];\n  const selectedDialoguePass = dialogueGuidedPasses.find((pass) => pass.id === dialoguePassId) ?? dialogueGuidedPasses[0];',
)
replace(
    labs,
    '["dialogue", "action", "parenthetical"].includes(element.type)',
    '["dialogue", "dual-dialogue", "action", "parenthetical"].includes(element.type)',
)
replace(
    labs,
    '  async function buildDialogueSuggestion() {\n    if (!selectedDialogue || !dialogueDirection.trim()) return;',
    '  async function buildDialogueSuggestion() {\n    if (!selectedDialogue) return;',
)
replace(
    labs,
    '"Act as a dialogue editor. Return only the revised screenplay text. Preserve story facts and intention. Strengthen character-specific voice, subtext, status pressure and playable rhythm. Do not add facts not contained in the project context.",',
    '`Act as a screenplay dialogue editor. ${selectedDialoguePass.instruction} Preserve story facts, intention, formatting and locked continuity. Return a diagnosis when the pass is critique only; otherwise return only the proposed screenplay text. Do not add facts not contained in project context.`,',
)
replace(
    labs,
    'Writer direction: ${dialogueDirection.trim()}`',
    'Guided dialogue pass: ${selectedDialoguePass.label}\nPass instruction: ${selectedDialoguePass.instruction}\nFree-form writer direction: ${dialogueDirection.trim() || "No added direction; use the bounded pass only."}`',
)
replace(
    labs,
    '      prompt: dialogueDirection.trim(),\n      generated: true,\n      metadata: {},',
    '      prompt: dialogueDirection.trim() || selectedDialoguePass.instruction,\n      generated: true,\n      metadata: { guidedPass: selectedDialoguePass.label, passInstruction: selectedDialoguePass.instruction, approvalBoundary: "Original and proposed versions remain separate until explicit writer approval." },',
)
replace(
    labs,
    '''            <div className={styles.sectionHeading}><span>Dialogue Lab</span><h2>Hear the difference before replacing a line.</h2><p>Select one screenplay element, define the craft problem and compare the original with the suggestion.</p></div>
            {dialogueElements.length ? <>
              <label>Screenplay element<select value={selectedDialogue?.id || ""} onChange={(event) => setDialogueElementId(event.target.value)}>{dialogueElements.map((element) => <option value={element.id} key={element.id}>{lineLabel(element)}</option>)}</select></label>
              <label>Dialogue-pass direction<textarea rows={6} value={dialogueDirection} onChange={(event) => setDialogueDirection(event.target.value)} placeholder="Clarify the subtext, keep the refusal indirect and make the power shift audible." /></label>
              <button type="button" className={styles.primary} disabled={!dialogueDirection.trim() || aiState === "working"} onClick={buildDialogueSuggestion}>{aiState === "working" ? "Generating…" : "Generate dialogue comparison"}</button>
            </> :''',
    '''            <div className={styles.sectionHeading}><span>Dialogue Lab</span><h2>Hear the difference before replacing a line.</h2><p>Select one screenplay element, choose a bounded craft pass and compare the original with the suggestion. Manual writing and free-form direction remain available.</p><a href="/dialogue-in-motion">Open Dialogue Blueprint, proof and table-read workspace</a></div>
            {dialogueElements.length ? <>
              <label>Screenplay element<select value={selectedDialogue?.id || ""} onChange={(event) => setDialogueElementId(event.target.value)}>{dialogueElements.map((element) => <option value={element.id} key={element.id}>{lineLabel(element)}</option>)}</select></label>
              <label>Guided dialogue pass<select value={dialoguePassId} onChange={(event) => setDialoguePassId(event.target.value)}>{dialogueGuidedPasses.map((pass) => <option value={pass.id} key={pass.id}>{pass.label}</option>)}</select><small>{selectedDialoguePass.instruction}</small></label>
              <label>Free-form writer direction<textarea rows={6} value={dialogueDirection} onChange={(event) => setDialogueDirection(event.target.value)} placeholder="Optional: clarify the subtext, keep the refusal indirect and make the power shift audible." /></label>
              <button type="button" className={styles.primary} disabled={aiState === "working"} onClick={buildDialogueSuggestion}>{aiState === "working" ? "Generating…" : "Generate dialogue comparison"}</button>
            </> :''',
)
