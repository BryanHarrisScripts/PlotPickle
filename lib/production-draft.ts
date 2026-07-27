import { createRevisionSnapshot } from "./core-model";
import {
  createBlankProductionDraftState,
  type PlotPickleProject,
  type ProductionDraftAnnotation,
  type ProductionDraftPageAssignment,
  type ProductionDraftRevisionSet,
  type RevisionColour,
  type ScreenplayDocument,
  type ScreenplayDraftElement,
} from "./project";
import { syncDraft } from "./screenplay-draft";

type ProductionRevisionColour = Exclude<RevisionColour, "none">;

function id(prefix: string) {
  return globalThis.crypto?.randomUUID?.()
    ? `${prefix}-${globalThis.crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function elementLines(element: ScreenplayDraftElement) {
  const width = element.type === "dialogue" ? 34 : element.type === "action" ? 58 : 45;
  return Math.max(1, Math.ceil(element.text.length / width)) + 1;
}

function paginate(elements: ScreenplayDraftElement[], lockedAt: string): ProductionDraftPageAssignment[] {
  let page = 1;
  let lines = 0;
  return elements.map((element) => {
    const nextLines = elementLines(element);
    if (lines && (element.type === "page-break" || lines + nextLines > 55)) {
      page += 1;
      lines = 0;
    }
    const assignment = { elementId: element.id, pageLabel: String(page), basePage: page, lockedAt };
    lines += nextLines;
    return assignment;
  });
}

function initialSceneNumbers(elements: ScreenplayDraftElement[]) {
  return elements.filter((element) => element.type === "scene-heading").map((element, index) => ({
    sceneId: element.sceneId || element.id,
    elementId: element.id,
    number: String(index + 1),
    omitted: element.omitted,
  }));
}

function approval(action: PlotPickleProject["screenplay"]["productionDraft"]["approvalHistory"][number]["action"], summary: string, authorizedBy: string, createdAt: string) {
  return { id: id("production-approval"), action, summary, authorizedBy, createdAt };
}

export function convertToProductionDraft(project: PlotPickleProject, authorizedBy = "Project owner"): PlotPickleProject {
  if (project.screenplay.productionDraft.mode === "production") return project;
  const now = new Date().toISOString();
  const withBaseline = createRevisionSnapshot(
    project,
    "Writer draft before production conversion",
    "Automatic recoverable baseline created before Shooting Script numbering and locked pagination.",
  );
  const writerBaselineRevisionId = withBaseline.revisions.at(-1)?.id ?? "";
  return {
    ...withBaseline,
    metadata: { ...withBaseline.metadata, status: "Production draft", updatedAt: now },
    screenplay: {
      ...withBaseline.screenplay,
      productionDraft: {
        ...createBlankProductionDraftState(),
        mode: "production",
        convertedAt: now,
        writerBaselineRevisionId,
        sceneNumbers: initialSceneNumbers(withBaseline.screenplay.draftElements),
        approvalHistory: [approval("converted", "Converted the writer draft into a production draft without changing screenplay text.", authorizedBy, now)],
      },
    },
  };
}

export function lockProductionPagination(project: PlotPickleProject, authorizedBy = "Project owner"): PlotPickleProject {
  const productionDraft = project.screenplay.productionDraft;
  if (productionDraft.mode !== "production" || productionDraft.paginationLocked) return project;
  const now = new Date().toISOString();
  return {
    ...project,
    metadata: { ...project.metadata, updatedAt: now },
    screenplay: {
      ...project.screenplay,
      productionDraft: {
        ...productionDraft,
        paginationLocked: true,
        paginationLockedAt: now,
        pageAssignments: paginate(project.screenplay.draftElements, now),
        approvalHistory: [
          ...productionDraft.approvalHistory,
          approval("pagination-locked", "Locked production pagination and preserved the current page assignments.", authorizedBy, now),
        ],
      },
    },
  };
}

export function startProductionRevision(
  project: PlotPickleProject,
  input: { label: string; colour: ProductionRevisionColour; date?: string; marks?: string; notes?: string; authorizedBy?: string },
): PlotPickleProject {
  const productionDraft = project.screenplay.productionDraft;
  if (productionDraft.mode !== "production") return project;
  const now = new Date().toISOString();
  const authorizedBy = input.authorizedBy?.trim() || "Project owner";
  const revision: ProductionDraftRevisionSet = {
    id: id("production-revision"),
    label: input.label.trim() || `${input.colour[0].toUpperCase()}${input.colour.slice(1)} revision`,
    colour: input.colour,
    date: input.date || now.slice(0, 10),
    marks: input.marks?.trim() || "*",
    notes: input.notes?.trim() || "",
    authorizedBy,
    changedElementIds: [],
    changedPageLabels: [],
    createdAt: now,
  };
  return {
    ...project,
    metadata: { ...project.metadata, updatedAt: now },
    screenplay: {
      ...project.screenplay,
      productionDraft: {
        ...productionDraft,
        revisionSets: [...productionDraft.revisionSets, revision],
        activeRevisionSetId: revision.id,
        approvalHistory: [
          ...productionDraft.approvalHistory,
          approval("revision-started", `Started ${revision.label} (${revision.colour}).`, authorizedBy, now),
        ],
      },
    },
  };
}

export function closeProductionRevision(project: PlotPickleProject, authorizedBy = "Project owner"): PlotPickleProject {
  const productionDraft = project.screenplay.productionDraft;
  const active = productionDraft.revisionSets.find((revision) => revision.id === productionDraft.activeRevisionSetId);
  if (!active) return project;
  const now = new Date().toISOString();
  return {
    ...project,
    metadata: { ...project.metadata, updatedAt: now },
    screenplay: {
      ...project.screenplay,
      productionDraft: {
        ...productionDraft,
        activeRevisionSetId: "",
        approvalHistory: [
          ...productionDraft.approvalHistory,
          approval("revision-closed", `Closed ${active.label} with ${active.changedPageLabels.length} changed page(s).`, authorizedBy, now),
        ],
      },
    },
  };
}

function elementChanged(left: ScreenplayDraftElement | undefined, right: ScreenplayDraftElement | undefined) {
  if (!left || !right) return true;
  return left.type !== right.type
    || left.text !== right.text
    || left.sceneId !== right.sceneId
    || left.sceneNumber !== right.sceneNumber
    || left.omitted !== right.omitted
    || left.blockNumber !== right.blockNumber
    || left.miniBlockNumber !== right.miniBlockNumber;
}

function nextLetterSuffix(existing: string[], basePage: number) {
  const suffixes = existing.flatMap((label) => {
    const match = new RegExp(`^${basePage}([A-Z])$`).exec(label);
    return match ? [match[1].charCodeAt(0) - 64] : [];
  });
  return String.fromCharCode(65 + Math.max(0, ...suffixes));
}

function reconcilePages(
  previous: ProductionDraftPageAssignment[],
  elements: ScreenplayDraftElement[],
  lockedAt: string,
) {
  if (!previous.length) return paginate(elements, lockedAt);
  const previousById = new Map(previous.map((page) => [page.elementId, page]));
  const labels = previous.map((page) => page.pageLabel);
  let insertedGroup: ProductionDraftPageAssignment | undefined;
  return elements.map((element, index) => {
    const saved = previousById.get(element.id);
    if (saved) {
      insertedGroup = undefined;
      return saved;
    }
    if (insertedGroup) return { ...insertedGroup, elementId: element.id };
    const prior = [...elements.slice(0, index)].reverse().map((item) => previousById.get(item.id)).find(Boolean);
    const following = elements.slice(index + 1).map((item) => previousById.get(item.id)).find(Boolean);
    const basePage = prior?.basePage ?? following?.basePage ?? 1;
    const needsInsertedPage = Boolean(prior && following && following.basePage > prior.basePage);
    const pageLabel = needsInsertedPage ? `${basePage}${nextLetterSuffix(labels, basePage)}` : prior?.pageLabel ?? following?.pageLabel ?? "1";
    labels.push(pageLabel);
    insertedGroup = { elementId: element.id, pageLabel, basePage, lockedAt };
    return insertedGroup;
  });
}

function nextSceneNumber(
  elements: ScreenplayDraftElement[],
  index: number,
  existingByElement: Map<string, { number: string }>,
  existingNumbers: string[],
) {
  const prior = [...elements.slice(0, index)].reverse().map((item) => existingByElement.get(item.id)).find(Boolean);
  const following = elements.slice(index + 1).map((item) => existingByElement.get(item.id)).find(Boolean);
  const priorBase = Math.max(0, Number.parseInt(prior?.number ?? "0", 10) || 0);
  const followingBase = Number.parseInt(following?.number ?? "", 10);
  if (!prior) return followingBase > 1 ? `${followingBase - 1}A` : "A1";
  if (!following || followingBase > priorBase + 1) return String(priorBase + 1);
  const suffixes = existingNumbers.flatMap((number) => {
    const match = new RegExp(`^${priorBase}([A-Z])$`).exec(number);
    return match ? [match[1].charCodeAt(0) - 64] : [];
  });
  return `${priorBase}${String.fromCharCode(65 + Math.max(0, ...suffixes))}`;
}

export function reconcileProductionDraft(
  document: ScreenplayDocument,
  nextElements: ScreenplayDraftElement[],
  authorizedBy = "Project owner",
): ScreenplayDocument {
  const synchronized = syncDraft(document, nextElements);
  const productionDraft = document.productionDraft;
  if (productionDraft.mode !== "production") return synchronized;
  const now = new Date().toISOString();
  const priorElements = new Map(document.draftElements.map((element) => [element.id, element]));
  const priorOrder = new Map(document.draftElements.map((element, index) => [element.id, index]));
  const nextById = new Map(nextElements.map((element) => [element.id, element]));
  const changedElementIds = unique([
    ...document.draftElements.filter((element) => elementChanged(element, nextById.get(element.id))).map((element) => element.id),
    ...nextElements.filter((element) => elementChanged(priorElements.get(element.id), element)).map((element) => element.id),
    ...nextElements.filter((element, index) => priorOrder.has(element.id) && priorOrder.get(element.id) !== index).map((element) => element.id),
  ]);
  const pageAssignments = productionDraft.paginationLocked
    ? reconcilePages(productionDraft.pageAssignments, nextElements, productionDraft.paginationLockedAt || now)
    : productionDraft.pageAssignments;
  const pageByElement = new Map(pageAssignments.map((page) => [page.elementId, page.pageLabel]));
  const previousPageByElement = new Map(productionDraft.pageAssignments.map((page) => [page.elementId, page.pageLabel]));
  const changedPageLabels = unique(changedElementIds.flatMap((elementId) => [
    pageByElement.get(elementId) ?? "",
    previousPageByElement.get(elementId) ?? "",
  ]));

  const existingSceneByElement = new Map(productionDraft.sceneNumbers.map((scene) => [scene.elementId, scene]));
  const existingNumbers = productionDraft.sceneNumbers.map((scene) => scene.number);
  const activeSceneNumbers = nextElements.flatMap((element, index) => {
    if (element.type !== "scene-heading") return [];
    const existing = existingSceneByElement.get(element.id);
    return [{
      sceneId: element.sceneId || existing?.sceneId || element.id,
      elementId: element.id,
      number: existing?.number || nextSceneNumber(nextElements, index, existingSceneByElement, existingNumbers),
      omitted: element.omitted,
    }];
  });
  const removedScenes = productionDraft.sceneNumbers
    .filter((scene) => !nextById.has(scene.elementId))
    .map((scene) => ({ ...scene, omitted: true }));
  const sceneNumbers = [...activeSceneNumbers, ...removedScenes];

  const activeRevision = productionDraft.revisionSets.find((revision) => revision.id === productionDraft.activeRevisionSetId);
  const revisionSets = activeRevision ? productionDraft.revisionSets.map((revision) => revision.id === activeRevision.id ? {
    ...revision,
    changedElementIds: unique([...revision.changedElementIds, ...changedElementIds]),
    changedPageLabels: unique([...revision.changedPageLabels, ...changedPageLabels]),
  } : revision) : productionDraft.revisionSets;
  const revisionColour = activeRevision?.colour;
  const markedElements = revisionColour && changedElementIds.length
    ? synchronized.draftElements.map((element) => changedElementIds.includes(element.id) ? { ...element, revisionColour, updatedAt: now } : element)
    : synchronized.draftElements;

  return {
    ...synchronized,
    draftElements: markedElements,
    productionDraft: {
      ...productionDraft,
      pageAssignments,
      sceneNumbers,
      revisionSets,
      approvalHistory: changedElementIds.length && !activeRevision ? [
        ...productionDraft.approvalHistory,
        approval("direct-edit", `Authorized direct production edit affecting ${changedElementIds.length} screenplay element(s).`, authorizedBy, now),
      ] : productionDraft.approvalHistory,
    },
  };
}

export function addProductionAnnotation(
  project: PlotPickleProject,
  input: Pick<ProductionDraftAnnotation, "targetType" | "targetId" | "department" | "body"> & { author?: string },
): PlotPickleProject {
  if (project.screenplay.productionDraft.mode !== "production" || !input.targetId || !input.body.trim()) return project;
  const now = new Date().toISOString();
  const annotation: ProductionDraftAnnotation = {
    id: id("production-annotation"),
    targetType: input.targetType,
    targetId: input.targetId,
    department: input.department.trim(),
    body: input.body.trim(),
    author: input.author?.trim() || "Project owner",
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...project,
    metadata: { ...project.metadata, updatedAt: now },
    screenplay: {
      ...project.screenplay,
      productionDraft: {
        ...project.screenplay.productionDraft,
        annotations: [...project.screenplay.productionDraft.annotations, annotation],
      },
    },
  };
}

export function productionPageLabel(document: ScreenplayDocument, elementId: string) {
  return document.productionDraft.pageAssignments.find((page) => page.elementId === elementId)?.pageLabel ?? "";
}

export function productionSceneLabel(document: ScreenplayDocument, element: ScreenplayDraftElement) {
  return document.productionDraft.sceneNumbers.find((scene) => (
    scene.elementId === element.id || (element.sceneId && scene.sceneId === element.sceneId)
  ))?.number ?? String(element.sceneNumber);
}

function html(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function productionDraftHtml(project: PlotPickleProject, changedOnly = false, revisionId = "") {
  const productionDraft = project.screenplay.productionDraft;
  const revision = productionDraft.revisionSets.find((item) => item.id === (revisionId || productionDraft.activeRevisionSetId))
    ?? productionDraft.revisionSets.at(-1);
  const changedPages = new Set(revision?.changedPageLabels ?? []);
  const pages = new Map<string, ScreenplayDraftElement[]>();
  project.screenplay.draftElements.forEach((element) => {
    const pageLabel = productionPageLabel(project.screenplay, element.id) || "Unnumbered";
    if (changedOnly && !changedPages.has(pageLabel)) return;
    pages.set(pageLabel, [...(pages.get(pageLabel) ?? []), element]);
  });
  const body = [...pages.entries()].map(([pageLabel, elements]) => `<section class="page">
  <header><span>${html(project.metadata.title)}</span><b>${html(pageLabel)}</b></header>
  ${elements.map((element) => {
    const sceneNumber = element.type === "scene-heading" ? productionSceneLabel(project.screenplay, element) : "";
    return `<p class="${element.type} ${element.omitted ? "omitted" : ""}">${sceneNumber ? `<i>${html(sceneNumber)}</i>` : ""}${html(element.text)}</p>`;
  }).join("\n  ")}
  <footer>${revision ? `${html(revision.colour.toUpperCase())} REVISIONS · ${html(revision.date)} · ${html(revision.marks)}` : "PRODUCTION DRAFT"}</footer>
</section>`).join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${html(project.metadata.title)} — ${changedOnly ? "Changed Pages" : "Production Draft"}</title><style>
@page{size:letter;margin:.55in .75in}*{box-sizing:border-box}body{margin:0;background:#ddd;color:#111;font:12pt Courier New,monospace}.page{position:relative;width:8.5in;min-height:11in;margin:.2in auto;padding:.45in .75in .65in;background:#fff;page-break-after:always}.page>header{display:flex;justify-content:space-between;margin-bottom:.35in}.page>header b{font-size:14pt}.page p{position:relative;margin:0 0 10pt;white-space:pre-wrap}.page .scene-heading,.page .transition{text-transform:uppercase;font-weight:700}.page .character{width:45%;margin-left:38%;text-transform:uppercase}.page .dialogue,.page .parenthetical{width:45%;margin-left:28%}.page .parenthetical{padding-left:8%}.page p i{position:absolute;left:-.55in;font-style:normal}.page .omitted{text-decoration:line-through;opacity:.65}.page>footer{position:absolute;right:.75in;bottom:.35in;font-size:9pt}@media print{body{background:#fff}.page{margin:0;box-shadow:none}}</style></head><body>${body || `<section class="page"><p>No ${changedOnly ? "changed" : "production"} pages are available.</p></section>`}</body></html>`;
}

export function productionDraftReport(project: PlotPickleProject) {
  const productionDraft = project.screenplay.productionDraft;
  const active = productionDraft.revisionSets.find((revision) => revision.id === productionDraft.activeRevisionSetId);
  const latest = active ?? productionDraft.revisionSets.at(-1);
  return {
    mode: productionDraft.mode,
    convertedAt: productionDraft.convertedAt,
    paginationLocked: productionDraft.paginationLocked,
    pages: new Set(productionDraft.pageAssignments.map((page) => page.pageLabel)).size,
    scenes: productionDraft.sceneNumbers.filter((scene) => !scene.omitted).length,
    omittedScenes: productionDraft.sceneNumbers.filter((scene) => scene.omitted).length,
    revisionSets: productionDraft.revisionSets.length,
    activeRevision: active?.label ?? "",
    latestRevision: latest?.label ?? "",
    changedPages: latest?.changedPageLabels.length ?? 0,
    annotations: productionDraft.annotations.length,
    approvals: productionDraft.approvalHistory.length,
    writerBaselineRevisionId: productionDraft.writerBaselineRevisionId,
  };
}
