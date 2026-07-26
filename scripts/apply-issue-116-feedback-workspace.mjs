import { readFileSync, writeFileSync } from "node:fs";

function update(path, transform) {
  const source = readFileSync(path, "utf8");
  const next = transform(source);
  if (next === source) throw new Error(`${path} was not changed.`);
  writeFileSync(path, next, "utf8");
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing integration anchor: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous integration anchor: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

update("app/feedback-workspace.tsx", (source) => replaceOnce(
  source,
  "event.target.value as typeof ROLE_OPTIONS[number]",
  "event.target.value as (typeof ROLE_OPTIONS)[number]",
  "Feedback role indexed type",
));

update("lib/product-direction.ts", (source) => {
  source = replaceOnce(
    source,
    '  { id: "planner", label: "Plan", description: "Simple Start and story planning", zone: "workflow" },\n  { id: "script", label: "Write", description: "Outline and write", zone: "workflow" },',
    '  { id: "planner", label: "Plan", description: "Simple Start and story planning", zone: "workflow" },\n  { id: "build", label: "Build", description: "Arrange 24 Blocks and 96 mini-blocks", zone: "workflow" },\n  { id: "script", label: "Write", description: "Outline and write", zone: "workflow" },',
    "Build primary navigation",
  );
  return replaceOnce(
    source,
    '  { id: "engines", label: "Refine", description: "Refine the story", zone: "workflow" },\n  { id: "reports", label: "Reports", description: "Understand the screenplay", zone: "workflow" },',
    '  { id: "engines", label: "Refine", description: "Refine the story", zone: "workflow" },\n  { id: "feedback", label: "Feedback", description: "Review notes, proposals and decisions", zone: "workflow" },\n  { id: "reports", label: "Reports", description: "Understand the screenplay", zone: "workflow" },',
    "Feedback primary navigation",
  );
});

update("app/page.tsx", (source) => {
  source = replaceOnce(
    source,
    'import BuildWorkspace from "./build-workspace";\n',
    'import BuildWorkspace from "./build-workspace";\nimport FeedbackWorkspace from "./feedback-workspace";\nimport FeedbackContextBadge from "./feedback-context-badge";\n',
    "Feedback component imports",
  );
  source = replaceOnce(
    source,
    'import { PRODUCT_COMPONENTS, type ProductNavigationId } from "@/lib/product-direction";\n',
    'import { PRODUCT_COMPONENTS, type ProductNavigationId } from "@/lib/product-direction";\nimport { createStoredFeedbackModel } from "@/lib/unified-feedback-store";\nimport type { FeedbackTargetReference } from "@/lib/unified-feedback";\n',
    "Feedback model imports",
  );
  source = replaceOnce(
    source,
    '  const [selectedMiniBlockNumber, setSelectedMiniBlockNumber] = useState(1);\n',
    '  const [selectedMiniBlockNumber, setSelectedMiniBlockNumber] = useState(1);\n  const [feedbackTargetId, setFeedbackTargetId] = useState("");\n',
    "Feedback target state",
  );
  source = replaceOnce(
    source,
    '  const selectedBlock = project.blocks.find((block) => block.number === selectedBlockNumber) ?? project.blocks[0];\n',
    '  const selectedBlock = project.blocks.find((block) => block.number === selectedBlockNumber) ?? project.blocks[0];\n  const feedbackModel = useMemo(() => createStoredFeedbackModel(project), [project]);\n  const selectedBlockFeedbackCount = feedbackModel.badges.get(`block:${selectedBlock.id}`) ?? 0;\n',
    "Feedback badge model",
  );
  source = replaceOnce(
    source,
    '  function openBlock(number: number, destination: MainTab = "planner") {\n    setSelectedBlockNumber(number);\n    setSelectedMiniBlockNumber(1);\n    setActiveTab(destination);\n    setActiveSection(destination === "planner" ? "blocks" : "storyboard");\n  }\n\n  return (',
    '  function openBlock(number: number, destination: MainTab = "planner") {\n    setSelectedBlockNumber(number);\n    setSelectedMiniBlockNumber(1);\n    setActiveTab(destination);\n    setActiveSection(destination === "planner" ? "blocks" : "storyboard");\n  }\n\n  function openFeedback(targetId: string) {\n    setFeedbackTargetId(targetId);\n    setActiveTab("feedback");\n  }\n\n  function openFeedbackTarget(target: FeedbackTargetReference) {\n    setFeedbackTargetId(target.targetId);\n    const block = project.blocks.find((candidate) => candidate.id === target.blockId)\n      ?? project.blocks.find((candidate) => candidate.scenes.some((scene) => scene.id === target.sceneId || scene.miniBlocks.some((mini) => mini.id === target.miniBlockId)));\n    if (block) setSelectedBlockNumber(block.number);\n    if (target.miniBlockId && block) {\n      const mini = block.scenes.flatMap((scene) => scene.miniBlocks).find((candidate) => candidate.id === target.miniBlockId);\n      if (mini) setSelectedMiniBlockNumber(mini.number);\n    }\n    if (target.characterId) setSelectedCharacterId(target.characterId);\n    if (target.workspace === "build") setActiveTab("build");\n    else if (target.workspace === "write") setActiveTab("script");\n    else if (target.workspace === "storyboard") setActiveTab("visuals");\n    else if (target.workspace === "refine") setActiveTab("engines");\n    else if (target.workspace === "reports") setActiveTab("reports");\n    else if (target.workspace === "dashboard") setActiveTab("dashboard");\n    else if (target.workspace === "plan") {\n      setActiveTab("planner");\n      setActiveSection(target.characterId ? "characters" : target.kind === "world" ? "world" : block ? "blocks" : "overview");\n    } else setActiveTab("feedback");\n  }\n\n  return (',
    "Feedback navigation handlers",
  );
  source = replaceOnce(
    source,
    '          <BuildWorkspace\n            project={project}\n            onProjectChange={commit}\n            onOpenBlock={(number) => openBlock(number, "planner")}\n          />',
    '          <BuildWorkspace\n            project={project}\n            onProjectChange={commit}\n            onOpenBlock={(number) => openBlock(number, "planner")}\n            onOpenFeedback={openFeedback}\n          />',
    "Build Feedback callback",
  );
  source = replaceOnce(
    source,
    '        {activeTab === "script" ? (\n          <ScriptWorkspace\n            project={project}\n            mode={writerMode}\n            onModeChange={setWriterMode}\n            onChange={(screenplay) => commit({ ...project, screenplay })}\n            onProjectChange={commit}\n            onOpenBlock={(number) => openBlock(number, "planner")}\n          />\n        ) : null}',
    '        {activeTab === "script" ? (\n          <>\n            <FeedbackContextBadge count={selectedBlockFeedbackCount} label={`Block ${selectedBlock.number} · ${selectedBlock.title}`} onOpen={() => openFeedback(selectedBlock.id)} />\n            <ScriptWorkspace\n              project={project}\n              mode={writerMode}\n              onModeChange={setWriterMode}\n              onChange={(screenplay) => commit({ ...project, screenplay })}\n              onProjectChange={commit}\n              onOpenBlock={(number) => openBlock(number, "planner")}\n            />\n          </>\n        ) : null}',
    "Write Feedback badge",
  );
  source = replaceOnce(
    source,
    '            <VisualStoryboard\n              project={project}\n              initialBlockNumber={selectedBlock.number}\n              visualAct={visualAct}\n              onVisualActChange={setVisualAct}\n              onOpenPlannerBlock={(number) => openBlock(number, "planner")}\n              onChange={commit}\n            />',
    '            <div>\n              <FeedbackContextBadge count={selectedBlockFeedbackCount} label={`Block ${selectedBlock.number} · ${selectedBlock.title}`} onOpen={() => openFeedback(selectedBlock.id)} />\n              <VisualStoryboard\n                project={project}\n                initialBlockNumber={selectedBlock.number}\n                visualAct={visualAct}\n                onVisualActChange={setVisualAct}\n                onOpenPlannerBlock={(number) => openBlock(number, "planner")}\n                onChange={commit}\n              />\n            </div>',
    "Storyboard Feedback badge",
  );
  return replaceOnce(
    source,
    '        {activeTab === "engines" ? <EngineHub /> : null}\n\n        {activeTab === "reports" ? <ScreenplayReports project={project} /> : null}',
    '        {activeTab === "engines" ? <EngineHub /> : null}\n\n        {activeTab === "feedback" ? (\n          <FeedbackWorkspace project={project} onProjectChange={commit} onOpenTarget={openFeedbackTarget} initialTargetId={feedbackTargetId} />\n        ) : null}\n\n        {activeTab === "reports" ? <ScreenplayReports project={project} /> : null}',
    "Feedback workspace mount",
  );
});

update("app/build-workspace.tsx", (source) => {
  source = replaceOnce(source, 'import MiniBlockWall from "./mini-block-wall";\n', 'import MiniBlockWall from "./mini-block-wall";\nimport FeedbackContextBadge from "./feedback-context-badge";\n', "Build badge import");
  source = replaceOnce(source, 'import type { PlotPickleProject } from "@/lib/project";\n', 'import type { PlotPickleProject } from "@/lib/project";\nimport { createStoredFeedbackModel } from "@/lib/unified-feedback-store";\n', "Build Feedback model import");
  source = replaceOnce(source, '  onOpenBlock: (number: number) => void;\n};', '  onOpenBlock: (number: number) => void;\n  onOpenFeedback: (targetId: string) => void;\n};', "Build Feedback prop");
  source = replaceOnce(source, '  onMove,\n}: {\n  card: BuildBlockCard;\n  selected: boolean;\n  onSelect: () => void;\n  onMove: (sourceId: string, targetNumber: number) => void;\n}) {', '  onMove,\n  feedbackCount,\n}: {\n  card: BuildBlockCard;\n  selected: boolean;\n  onSelect: () => void;\n  onMove: (sourceId: string, targetNumber: number) => void;\n  feedbackCount: number;\n}) {', "Block card Feedback count");
  source = replaceOnce(source, '      <span className={styles.cardMeta}>{card.sceneCount} scenes · {card.miniBlockCount} mini-blocks</span>\n', '      <span className={styles.cardMeta}>{card.sceneCount} scenes · {card.miniBlockCount} mini-blocks</span>\n      {feedbackCount ? <span className={styles.feedbackBadge}>{feedbackCount} feedback</span> : null}\n', "Block card Feedback label");
  source = replaceOnce(source, '  onMove,\n}: {\n  cards: BuildBlockCard[];\n  selectedId: string;\n  onSelect: (id: string) => void;\n  onMove: (sourceId: string, targetNumber: number) => void;\n}) {', '  onMove,\n  feedbackBadges,\n}: {\n  cards: BuildBlockCard[];\n  selectedId: string;\n  onSelect: (id: string) => void;\n  onMove: (sourceId: string, targetNumber: number) => void;\n  feedbackBadges: Map<string, number>;\n}) {', "Card grid Feedback map");
  source = replaceOnce(source, '          onMove={onMove}\n        />', '          onMove={onMove}\n          feedbackCount={feedbackBadges.get(`block:${card.id}`) ?? 0}\n        />', "Card grid Feedback value");
  source = replaceOnce(source, 'export default function BuildWorkspace({ project, onProjectChange, onOpenBlock }: BuildWorkspaceProps) {', 'export default function BuildWorkspace({ project, onProjectChange, onOpenBlock, onOpenFeedback }: BuildWorkspaceProps) {', "Build function Feedback prop");
  source = replaceOnce(source, '  const labels = useMemo(() => [...new Set(model.cards.flatMap((card) => card.labels))].sort(), [model.cards]);\n', '  const labels = useMemo(() => [...new Set(model.cards.flatMap((card) => card.labels))].sort(), [model.cards]);\n  const feedbackModel = useMemo(() => createStoredFeedbackModel(project), [project]);\n  const selectedBlockFeedbackCount = selectedBlock ? feedbackModel.badges.get(`block:${selectedBlock.id}`) ?? 0 : 0;\n', "Build Feedback memo");
  source = replaceOnce(source, '      return <MiniBlockWall project={project} onProjectChange={onProjectChange} onOpenBlock={onOpenBlock} />;', '      return <MiniBlockWall project={project} onProjectChange={onProjectChange} onOpenBlock={onOpenBlock} feedbackBadges={feedbackModel.badges} onOpenFeedback={onOpenFeedback} />;', "Mini wall Feedback props");
  source = source.replaceAll(' onSelect={setSelectedBlockId} onMove={moveBlock} />', ' onSelect={setSelectedBlockId} onMove={moveBlock} feedbackBadges={feedbackModel.badges} />');
  source = replaceOnce(source, '                onMove={moveBlock}\n              />', '                onMove={moveBlock}\n                feedbackCount={feedbackModel.badges.get(`block:${card.id}`) ?? 0}\n              />', "Film map Feedback count");
  source = replaceOnce(source, '            <button type="button" className={styles.primaryAction} onClick={() => onOpenBlock(selectedBlock.number)}>Open full Block editor in Plan</button>', '            <FeedbackContextBadge count={selectedBlockFeedbackCount} label={`Block ${selectedBlock.number} · ${selectedBlock.title}`} onOpen={() => onOpenFeedback(selectedBlock.id)} />\n            <button type="button" className={styles.primaryAction} onClick={() => onOpenBlock(selectedBlock.number)}>Open full Block editor in Plan</button>', "Build inspector Feedback badge");
  return source;
});

update("app/build-workspace.module.css", (source) => `${source}\n.feedbackBadge{display:inline-flex;width:max-content;padding:3px 6px;border-radius:999px;background:#e7f4f0;color:#2f7566;font-size:.6rem;font-weight:850}\n`);

update("app/mini-block-wall.tsx", (source) => {
  source = replaceOnce(source, 'import styles from "./mini-block-wall.module.css";\n', 'import styles from "./mini-block-wall.module.css";\nimport FeedbackContextBadge from "./feedback-context-badge";\n', "Mini wall badge import");
  source = replaceOnce(source, '  onOpenBlock: (number: number) => void;\n};', '  onOpenBlock: (number: number) => void;\n  feedbackBadges: Map<string, number>;\n  onOpenFeedback: (targetId: string) => void;\n};', "Mini wall Feedback props");
  source = replaceOnce(source, 'export default function MiniBlockWall({ project, onProjectChange, onOpenBlock }: MiniBlockWallProps) {', 'export default function MiniBlockWall({ project, onProjectChange, onOpenBlock, feedbackBadges, onOpenFeedback }: MiniBlockWallProps) {', "Mini wall function props");
  source = replaceOnce(source, '  const anchor = selectedCard ?? model.cards[0];\n', '  const anchor = selectedCard ?? model.cards[0];\n  const selectedFeedbackCount = selectedCard ? feedbackBadges.get(`mini-block:${selectedCard.id}`) ?? 0 : 0;\n', "Mini wall Feedback count");
  return replaceOnce(source, '            <button type="button" className={styles.primary} onClick={() => onOpenBlock(selected.block.number)}>Open Block {selected.block.number} in Plan</button>', '            <FeedbackContextBadge count={selectedFeedbackCount} label={`Mini ${selectedCard.globalNumber} · ${selected.miniBlock.label || selected.miniBlock.id}`} onOpen={() => onOpenFeedback(selected.miniBlock.id)} />\n            <button type="button" className={styles.primary} onClick={() => onOpenBlock(selected.block.number)}>Open Block {selected.block.number} in Plan</button>', "Mini wall inspector Feedback badge");
});

console.log("Issue #116 Feedback workspace integration applied.");
