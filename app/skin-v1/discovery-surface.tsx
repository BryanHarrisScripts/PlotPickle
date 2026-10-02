"use client";

/* eslint-disable @next/next/no-img-element -- Character roster renders project-owned local/example media references. */

import { useEffect, useMemo, useState } from "react";
import { plotPickleCurriculum } from "../../adapters/curriculum/current-catalog";
import { type DiscoveryAct } from "../../core/contracts/discovery";
import { createCanonicalCharacterTruth } from "../../core/contracts/character-truth-evidence";
import {
  WORLD_MAP_CHARACTER_VIEWS,
  lockWorldMapCharacterVisualVersion,
  saveWorldMapCharacterVisualVersion,
  type WorldMapCharacterView,
  type WorldMapCharacterVisualReference,
} from "../../core/contracts/world-map";
import {
  LEARN_TOPIC_SPINE,
  type LearnTopicSpineId,
} from "../../modules/learn/model/story-learning-context";
import {
  buildStoryDevelopmentFields,
  storyDevelopmentFieldPageCount,
  storyDevelopmentFieldPageForId,
  storyDevelopmentFieldStorageId,
  storyDevelopmentFieldsForAct,
  storyDevelopmentFieldsForPage,
  type StoryDevelopmentFieldDefinition,
} from "../../modules/learn/model/story-development-fields";
import { relevantProjectContextForField } from "../../modules/learn/model/relevant-project-context";
import {
  mindMapCharacterRoster,
  mindMapCharacterVisualGenerationPlan,
  mindMapCharacterVisualPrompt,
} from "../../modules/learn/model/mind-map-character-roster";
import {
  acceptStoryDevelopmentFieldProposal,
  storyDevelopmentFieldView,
  writeStoryDevelopmentFieldProposal,
  writeStoryDevelopmentFieldValue,
} from "../../core/project/story-development";
import { mindMapFieldNote } from "../../core/storage/library-project";
import {
  hasActiveLibraryProject,
  saveActiveLibraryProject,
  saveDetachedLibraryProjectAs,
  type LibraryPPFProject,
} from "../../core/storage/project-library-browser";
import { handleStoryActShortcut, STORY_ACTS } from "./story-act-rail";
import StoryDevelopmentSurfaceHeader from "./story-development-surface-header";
import styles from "./discovery-surface.module.css";

type AgentResponse = {
  readonly text?: string;
  readonly message?: string;
};

type ImageGenerationResponse = {
  readonly assetUrl?: string;
  readonly revisedPrompt?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly message?: string;
};

type ProfileStatus = {
  readonly authenticated?: boolean;
  readonly profile?: { readonly displayName?: string } | null;
};


function fieldScopeLabel(field: StoryDevelopmentFieldDefinition, act: DiscoveryAct) {
  if (field.scope === "project-wide") return "PROJECT-WIDE";
  if (field.scope === "act-specific") return `ACT ${field.validActs.join(" / ")} ONLY`;
  return `ACT ${act}`;
}

function compactProjectContext(project: LibraryPPFProject, act: DiscoveryAct, characterId?: string | null) {
  const blockNumbers = new Set(project.structure.blocks.filter((block) => block.actNumber === act).map((block) => block.number));
  return {
    project: { id: project.id, title: project.title, revision: project.revision },
    foundationsBrief: project.foundations.brief.content.slice(0, 2400),
    worldBrief: project.world.brief.content.slice(0, 1800),
    blocks: project.structure.blocks
      .filter((block) => block.actNumber === act)
      .map((block) => ({
        id: block.id,
        number: block.number,
        act: block.actNumber,
        title: block.title,
        note: block.note.slice(0, 400),
      })),
    writing: project.writing.entries
      .filter((entry) => blockNumbers.has(entry.blockNumber))
      .slice(-24)
      .map((entry) => ({
        block: entry.blockNumber,
        mini: entry.miniBlockNumber,
        text: entry.text.slice(0, 500),
      })),
    screenplay: (project.sourceEvidence.screenplay?.passages ?? [])
      .filter((passage) => blockNumbers.has(passage.blockNumber))
      .slice(0, 30)
      .map((passage) => ({
        id: passage.id,
        block: passage.blockNumber,
        mini: passage.miniBlockNumber,
        text: passage.text.slice(0, 300),
      })),
    characterTruth: (project.sourceEvidence.characterTruth?.claims ?? [])
      .filter((claim) => claim.reviewState === "human-approved" && claim.handling === "writer-reference" && claim.kind !== "sensitive-source")
      .filter((claim) => !characterId || claim.characterIds.includes(characterId))
      .slice(0, 36)
      .map((claim) => ({
        characters: claim.characterIds,
        kind: claim.kind,
        summary: claim.summary.slice(0, 300),
      })),
  };
}

export default function DiscoverySurface({
  project,
  initialTopic = "foundations",
  initialFieldId = null,
  initialAct = 1,
  onOpenLearn,
  onBackDashboard,
}: {
  readonly project: LibraryPPFProject | null;
  readonly initialTopic?: LearnTopicSpineId;
  readonly initialFieldId?: string | null;
  readonly initialAct?: DiscoveryAct;
  readonly onOpenLearn: (topic: LearnTopicSpineId, lessonId: string, act: DiscoveryAct) => void;
  readonly onBackDashboard: () => void;
}) {
  const [selectedAct, setSelectedAct] = useState<DiscoveryAct>(initialAct);
  const [selectedTopic, setSelectedTopic] = useState<LearnTopicSpineId>(initialTopic);
  const [selectedFieldPage, setSelectedFieldPage] = useState(1);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(initialFieldId);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [newCharacterName, setNewCharacterName] = useState("");
  const [selectedCharacterView, setSelectedCharacterView] = useState<WorldMapCharacterView>(WORLD_MAP_CHARACTER_VIEWS[0].id);
  const [generatingCharacterId, setGeneratingCharacterId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [developingFieldId, setDevelopingFieldId] = useState<string | null>(null);
  const [fieldDrafts, setFieldDrafts] = useState<Readonly<Record<string, string>>>({});
  const [proposalDrafts, setProposalDrafts] = useState<Readonly<Record<string, string>>>({});
  const [humanDisplayName, setHumanDisplayName] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Readonly<Record<string, string>>>({});
  const [savedNoteTexts, setSavedNoteTexts] = useState<Readonly<Record<string, string>>>({});
  const canonicalFields = useMemo(() => buildStoryDevelopmentFields(plotPickleCurriculum), []);
  const characterRoster = useMemo(() => project ? mindMapCharacterRoster(project) : [], [project]);

  useEffect(() => {
    setSelectedAct(initialAct);
    setSelectedTopic(initialTopic);
    setSelectedFieldPage(1);
    setSelectedFieldId(initialFieldId);
  }, [initialAct, initialFieldId, initialTopic]);

  useEffect(() => {
    if (selectedTopic !== "character") return;
    setSelectedCharacterId((current) => (
      current && characterRoster.some((character) => character.id === current)
        ? current
        : characterRoster[0]?.id ?? null
    ));
  }, [characterRoster, selectedTopic]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/profile", { credentials: "same-origin", cache: "no-store" }).then(
      async (response) => {
        if (!response.ok || cancelled) return;
        const status = await response.json() as ProfileStatus;
        if (cancelled) return;
        setHumanDisplayName(status.authenticated ? status.profile?.displayName?.trim() || "" : "");
      },
      () => {
        if (!cancelled) setHumanDisplayName("");
      },
    );
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!initialFieldId || selectedTopic !== initialTopic) return;
    const topicFields = canonicalFields.filter((field) => field.topicId === selectedTopic);
    const initialField = topicFields.find((field) => field.canonicalId === initialFieldId);
    if (initialField && !initialField.validActs.includes(selectedAct)) {
      const firstValidAct = initialField.validActs[0];
      if (firstValidAct !== undefined && firstValidAct !== selectedAct) {
        setSelectedAct(firstValidAct);
        return;
      }
    }
    const actFields = storyDevelopmentFieldsForAct(topicFields, selectedAct);
    const targetPage = storyDevelopmentFieldPageForId(actFields, initialFieldId);
    if (selectedFieldPage !== targetPage) {
      setSelectedFieldPage(targetPage);
      return;
    }
    setSelectedFieldId(initialFieldId);
    window.requestAnimationFrame(() => {
      const target = Array.from(document.querySelectorAll<HTMLElement>("[data-canonical-field-id]"))
        .find((element) => element.dataset.canonicalFieldId === initialFieldId);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    });
  }, [canonicalFields, initialFieldId, initialTopic, selectedAct, selectedFieldPage, selectedTopic]);

  useEffect(() => {
    if (!project) {
      setFieldDrafts({});
      setProposalDrafts({});
      setNoteDrafts({});
      setSavedNoteTexts({});
      return;
    }
    const scopedFieldViews = canonicalFields.flatMap((field) => STORY_ACTS
      .filter((act) => field.validActs.includes(act))
      .map((act) => {
        const storageId = storyDevelopmentFieldStorageId(field, act);
        return [storageId, storyDevelopmentFieldView(project, field, act)] as const;
      }));
    setFieldDrafts(Object.fromEntries(scopedFieldViews.map(([storageId, view]) => [
      storageId,
      view.value,
    ])));
    setProposalDrafts(Object.fromEntries(scopedFieldViews
      .map(([storageId, view]) => [storageId, view.proposal] as const)
      .filter(([, proposal]) => Boolean(proposal))));
    const incomingNotes = Object.fromEntries([
      ...Object.entries(project.mindMapNotes.fields).map(([key, note]) => [key, note.text] as const),
      ...canonicalFields.map((field) => [
        field.canonicalId,
        mindMapFieldNote(project.mindMapNotes, field.canonicalId).text,
      ] as const),
    ]);
    setNoteDrafts((current) => Object.fromEntries(Object.entries(incomingNotes).map(([key, incoming]) => {
      const currentDraft = current[key];
      const wasDirty = currentDraft !== undefined && currentDraft !== (savedNoteTexts[key] ?? "");
      return [key, wasDirty ? currentDraft : incoming];
    })));
    setSavedNoteTexts(incomingNotes);
  }, [project?.id, project?.revision, canonicalFields]);

  const selectedTopicFields = canonicalFields.filter((field) => field.topicId === selectedTopic);
  const selectedCanonicalFields = storyDevelopmentFieldsForAct(selectedTopicFields, selectedAct);
  const selectedFieldPageCount = storyDevelopmentFieldPageCount(selectedCanonicalFields);
  const visibleCanonicalFields = storyDevelopmentFieldsForPage(selectedCanonicalFields, selectedFieldPage);
  const selectedField = visibleCanonicalFields.find((field) => field.canonicalId === selectedFieldId)
    ?? visibleCanonicalFields[0]
    ?? null;
  const selectedCharacter = characterRoster.find((character) => character.id === selectedCharacterId)
    ?? characterRoster[0]
    ?? null;
  const activeCharacterId = selectedTopic === "character" ? selectedCharacter?.id ?? null : null;
  const selectedFieldContextCount = selectedCanonicalFields.reduce(
    (total, field) => total + relevantProjectContextForField(project, field, selectedAct, field.topicId === "character" ? activeCharacterId : null).length,
    0,
  );
  const selectedTopicLabel = LEARN_TOPIC_SPINE.find((topic) => topic.id === selectedTopic)?.label ?? selectedTopic;
  const selectedFieldNoteKey = selectedField
    ? selectedTopic === "character" && selectedCharacter
      ? `${selectedField.canonicalId}::character-${selectedCharacter.id}`
      : selectedField.canonicalId
    : null;
  const persistedFieldNote = project && selectedFieldNoteKey
    ? mindMapFieldNote(project.mindMapNotes, selectedFieldNoteKey)
    : { text: "", updatedAt: null };
  const selectedFieldNoteDraft = selectedFieldNoteKey
    ? noteDrafts[selectedFieldNoteKey] ?? persistedFieldNote.text
    : "";
  const notesDirty = selectedFieldNoteKey
    ? selectedFieldNoteDraft !== (savedNoteTexts[selectedFieldNoteKey] ?? persistedFieldNote.text)
    : false;
  const notesOwnerLabel = humanDisplayName ? `${humanDisplayName}’s Notes` : "My Notes";

  function changeAct(act: DiscoveryAct) {
    setSelectedAct(act);
    setSelectedFieldPage(1);
    setSelectedFieldId(null);
    setNotice("");
  }

  function changeTopic(topic: LearnTopicSpineId) {
    setSelectedTopic(topic);
    setSelectedFieldPage(1);
    setSelectedFieldId(null);
    setNotice("");
  }

  function openSelectedFieldInLearn() {
    if (!selectedField) return;
    onOpenLearn(selectedField.topicId, selectedField.lessonId, selectedAct);
  }

  function persistCanonicalProject(next: LibraryPPFProject) {
    if (!project) return null;
    if (!hasActiveLibraryProject()) {
      const suggested = project.title === "Untitled Story" ? "" : project.title;
      const title = window.prompt("Save as New Project", suggested)?.trim() ?? "";
      if (!title) {
        setNotice("Save cancelled. The blank workspace was not added to Library.");
        return null;
      }
      return saveDetachedLibraryProjectAs(next, { title, format: "Feature" });
    }
    return saveActiveLibraryProject(next);
  }

  function createCharacter() {
    if (!project) return;
    const characterName = newCharacterName.trim();
    if (!characterName) {
      setNotice("Enter a character name before creating the character.");
      return;
    }
    const now = new Date().toISOString();
    const created = createCanonicalCharacterTruth(project.sourceEvidence.characterTruth ?? null, {
      projectId: project.id,
      characterName,
      occurredAt: now,
    });
    if (!created) {
      setNotice("Character creation needs a valid name and active project.");
      return;
    }
    const next: LibraryPPFProject = {
      ...project,
      revision: project.revision + 1,
      updatedAt: now,
      sourceEvidence: {
        ...project.sourceEvidence,
        characterTruth: created.evidence,
      },
    };
    const saved = persistCanonicalProject(next);
    if (!saved) return;
    setNewCharacterName("");
    setSelectedCharacterId(created.characterId);
    setNotice(`${characterName} created as canonical Character Truth and selected for development.`);
  }

  async function generateCharacterVisual() {
    if (!project || !selectedCharacter || generatingCharacterId) return;
    const now = new Date().toISOString();
    const plan = mindMapCharacterVisualGenerationPlan(project, selectedCharacter.id, now);
    if (!plan.versionId) {
      setNotice(plan.blockedReason ?? "Character visual generation is unavailable.");
      return;
    }
    const prompt = mindMapCharacterVisualPrompt(project, selectedCharacter.id, selectedCharacterView);
    if (!prompt) {
      setNotice("Character visual generation needs canonical Character Truth.");
      return;
    }
    const billingAcknowledged = window.confirm(
      `Generate one ${WORLD_MAP_CHARACTER_VIEWS.find((item) => item.id === selectedCharacterView)?.label ?? selectedCharacterView} reference for ${selectedCharacter.name}? A configured cloud image provider may charge the API account saved by this user.`,
    );
    if (!billingAcknowledged) {
      setNotice("Character visual generation was cancelled. No provider request was made.");
      return;
    }

    setGeneratingCharacterId(selectedCharacter.id);
    setNotice(`Generating ${selectedCharacter.name} · ${selectedCharacterView}…`);
    try {
      const response = await fetch("/api/local-ai/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          characterId: selectedCharacter.id,
          assetId: `mind-map-character-${selectedCharacter.id}-${selectedCharacterView}-${Date.now()}`,
          aspect: "portrait",
          referenceImages: plan.approvedReferenceImages,
          identityLock: {
            characterId: selectedCharacter.id,
            source: "world-map-locked-character-reference",
            approvedReferences: plan.approvedReferenceImages,
          },
          requestCount: 1,
          billingAcknowledged,
        }),
      });
      const result = await response.json() as ImageGenerationResponse;
      if (!response.ok || !result.assetUrl) throw new Error(result.message || "The image provider returned no image.");

      const generatedAt = new Date().toISOString();
      const reference: WorldMapCharacterVisualReference = {
        id: `mind-map-${selectedCharacter.id}-${selectedCharacterView}-${Date.now()}`,
        versionId: plan.versionId,
        characterId: selectedCharacter.id,
        characterName: selectedCharacter.name,
        view: selectedCharacterView,
        assetUrl: result.assetUrl,
        prompt: result.revisedPrompt?.trim() || prompt,
        provider: result.provider?.trim() || "configured-image-route",
        model: result.model?.trim() || "configured-image-model",
        createdAt: generatedAt,
        reviewState: "draft",
      };
      const references = [
        ...plan.existingReferences.filter((item) => item.view !== selectedCharacterView),
        reference,
      ];
      const worldMap = saveWorldMapCharacterVisualVersion(project.worldMap, {
        characterId: selectedCharacter.id,
        characterName: selectedCharacter.name,
        versionId: plan.versionId,
        references,
        savedAt: generatedAt,
      });
      const next: LibraryPPFProject = {
        ...project,
        revision: project.revision + 1,
        updatedAt: generatedAt,
        worldMap,
      };
      const saved = persistCanonicalProject(next);
      if (!saved) return;
      setNotice(`${selectedCharacter.name} ${selectedCharacterView} generated as a saved draft visual. Existing locked/approved references were not replaced.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Character visual generation failed.");
    } finally {
      setGeneratingCharacterId(null);
    }
  }

  function lockCharacterVisualVersion(versionId: string) {
    if (!project || !selectedCharacter) return;
    const now = new Date().toISOString();
    const worldMap = lockWorldMapCharacterVisualVersion(project.worldMap, selectedCharacter.id, versionId, now);
    if (worldMap === project.worldMap) {
      setNotice("Only a complete eight-view Character visual version can be locked.");
      return;
    }
    const next: LibraryPPFProject = {
      ...project,
      revision: project.revision + 1,
      updatedAt: now,
      worldMap,
    };
    const saved = persistCanonicalProject(next);
    if (!saved) return;
    setNotice(`${selectedCharacter.name} visual version ${versionId} locked and approved for downstream use.`);
  }

  function saveCanonicalField(field: StoryDevelopmentFieldDefinition) {
    if (!project) return;
    const storageId = storyDevelopmentFieldStorageId(field, selectedAct);
    const value = fieldDrafts[storageId] ?? storyDevelopmentFieldView(project, field, selectedAct).value;
    const next = writeStoryDevelopmentFieldValue({
      project,
      field,
      value,
      source: "human",
      act: selectedAct,
    });
    const saved = persistCanonicalProject(next);
    if (!saved) return;
    setFieldDrafts((current) => ({
      ...current,
      [storageId]: storyDevelopmentFieldView(saved, field, selectedAct).value,
    }));
    setNotice(`${field.lessonTitle} saved for ${field.scope === "project-wide" ? "the project" : `Act ${selectedAct}`}.`);
  }

  function saveSelectedFieldNotes() {
    if (!project || !selectedField || !selectedFieldNoteKey) return;
    const now = new Date().toISOString();
    const text = selectedFieldNoteDraft.slice(0, 24_000);
    const next: LibraryPPFProject = {
      ...project,
      revision: project.revision + 1,
      updatedAt: now,
      mindMapNotes: {
        ...project.mindMapNotes,
        fields: {
          ...project.mindMapNotes.fields,
          [selectedFieldNoteKey]: { text, updatedAt: now },
        },
      },
    };
    const saved = persistCanonicalProject(next);
    if (!saved) return;
    const savedNote = mindMapFieldNote(saved.mindMapNotes, selectedFieldNoteKey);
    setNoteDrafts((current) => ({ ...current, [selectedFieldNoteKey]: savedNote.text }));
    setSavedNoteTexts((current) => ({ ...current, [selectedFieldNoteKey]: savedNote.text }));
    const target = selectedTopic === "character" && selectedCharacter ? ` for ${selectedCharacter.name}` : "";
    setNotice(`${selectedField.lessonTitle} notes${target} saved with this project.`);
  }

  async function createCanonicalFieldProposal(field: StoryDevelopmentFieldDefinition) {
    if (!project || developingFieldId) return;
    setDevelopingFieldId(field.canonicalId);
    setNotice("Asking Agent for a suggestion…");
    try {
      const response = await fetch("/api/writing-assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "creative-director",
          modelRole: "quality",
          tone: "direct",
          conversationMode: true,
          message: [
            "MIND_MAP_CANONICAL_FIELD_PROPOSAL",
            `Create one proposal for ${field.canonicalId}.`,
            `Craft prompt: ${field.prompt}`,
            "Use only the supplied project evidence. Do not claim the proposal is accepted canon. Return only the proposed field value, without JSON, headings, scoring or process notes.",
            JSON.stringify({
              topic: field.topicId,
              lessonId: field.lessonId,
              fieldId: field.fieldId,
              currentValue: fieldDrafts[storyDevelopmentFieldStorageId(field, selectedAct)]
                ?? storyDevelopmentFieldView(project, field, selectedAct).value,
              characterTarget: field.topicId === "character" && selectedCharacter
                ? { id: selectedCharacter.id, name: selectedCharacter.name }
                : null,
              context: compactProjectContext(project, selectedAct, field.topicId === "character" ? selectedCharacter?.id : null),
            }),
          ].join("\n\n"),
        }),
      });
      const payload = await response.json() as AgentResponse;
      const proposal = payload.text?.trim() ?? "";
      if (!response.ok || !proposal) throw new Error(payload.message || "Creative Director returned no proposal.");

      const storageId = storyDevelopmentFieldStorageId(field, selectedAct);
      setProposalDrafts((current) => ({ ...current, [storageId]: proposal }));
      if (hasActiveLibraryProject()) {
        saveActiveLibraryProject(writeStoryDevelopmentFieldProposal({
          project,
          field,
          proposal,
          sourceRef: `agent:creative-director:mind-map:${field.canonicalId}:act-${selectedAct}`,
          act: selectedAct,
        }));
      }
      setNotice(`${field.lessonTitle} Agent Suggestion is ready for Human review.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Agent suggestion failed.");
    } finally {
      setDevelopingFieldId(null);
    }
  }

  function useCanonicalFieldProposal(field: StoryDevelopmentFieldDefinition) {
    if (!project) return;
    const storageId = storyDevelopmentFieldStorageId(field, selectedAct);
    const proposal = (proposalDrafts[storageId] ?? storyDevelopmentFieldView(project, field, selectedAct).proposal).trim();
    if (!proposal) return;
    const withProposal = writeStoryDevelopmentFieldProposal({
      project,
      field,
      proposal,
      sourceRef: `agent:creative-director:mind-map:${field.canonicalId}:act-${selectedAct}`,
      act: selectedAct,
    });
    const next = acceptStoryDevelopmentFieldProposal({ project: withProposal, field, act: selectedAct });
    const saved = persistCanonicalProject(next);
    if (!saved) return;
    const value = storyDevelopmentFieldView(saved, field, selectedAct).value;
    setFieldDrafts((current) => ({ ...current, [storageId]: value }));
    setProposalDrafts((current) => ({ ...current, [storageId]: "" }));
    setNotice(`${field.lessonTitle} suggestion accepted into ${field.scope === "project-wide" ? "project-wide" : `Act ${selectedAct}`} Project Value and remains editable.`);
  }

  if (!project) {
    return (
      <main
        className={styles.surface}
        data-discovery-surface="canonical-authoring"
        data-mind-map-surface="true"
        onKeyDown={(event) => handleStoryActShortcut(event, changeAct)}
      >
        <StoryDevelopmentSurfaceHeader
          surfaceId="mind-map"
          title="MIND MAP"
          activeAct={selectedAct}
          activeTopic={selectedTopic}
          onActChange={changeAct}
          onTopicChange={changeTopic}
          onBackDashboard={onBackDashboard}
          actChoiceDataAttribute="data-mind-map-act-choice"
        />
        <section className={styles.workRegion} data-story-development-work-region="mind-map">
          <div className={styles.workRegionHeader}>
            <div>
              <small>CANONICAL AUTHORING</small>
              <strong>NO ACTIVE STORY</strong>
            </div>
          </div>
          <p>Load or create a story in Library before editing Mind Map material.</p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.surface} data-discovery-surface="canonical-authoring" data-mind-map-surface="true" data-discovery-project={project.id} data-mind-map-act={selectedAct} data-mind-map-topic={selectedTopic} onKeyDown={(event) => handleStoryActShortcut(event, changeAct)}>
      <StoryDevelopmentSurfaceHeader
        surfaceId="mind-map"
        title="MIND MAP"
        activeAct={selectedAct}
        activeTopic={selectedTopic}
        onActChange={changeAct}
        onTopicChange={changeTopic}
        onBackDashboard={onBackDashboard}
        actChoiceDataAttribute="data-mind-map-act-choice"
      />

      <section className={styles.workRegion} data-story-development-work-region="mind-map">
        <header className={styles.workRegionHeader}>
          <div>
            <small>ACT {selectedAct} · {selectedTopicLabel} · CANONICAL AUTHORING</small>
            <strong>{project.title}</strong>
          </div>
          <div className={styles.scoreboard} aria-label={`Act ${selectedAct} Mind Map authoring summary`}>
            <span>FIELDS <strong>{selectedCanonicalFields.length}</strong></span>
            <span>CONTEXT <strong>{selectedFieldContextCount}</strong></span>
            <span>NOTES <strong>{notesDirty ? "UNSAVED" : persistedFieldNote.text ? "SAVED" : "EMPTY"}</strong></span>
          </div>
        </header>
        <p className={styles.workRegionHelp}>
          Human Notes support thinking. Project Value is story truth. Agent Suggestions remain separate until the Human chooses Use Suggestion.
        </p>

        {selectedFieldPageCount > 1 ? (
          <nav className={styles.fieldPager} aria-label={`${selectedTopicLabel} field pages`} data-mind-map-field-pager={selectedTopic}>
            {Array.from({ length: selectedFieldPageCount }, (_, index) => index + 1).map((page) => (
              <button
                type="button"
                key={page}
                aria-current={selectedFieldPage === page ? "page" : undefined}
                data-mind-map-field-page={page}
                onClick={() => {
                  setSelectedFieldPage(page);
                  setSelectedFieldId(null);
                  setNotice("");
                }}
              >
                {page}
              </button>
            ))}
          </nav>
        ) : null}

      {selectedTopic === "character" ? (
        <section className={styles.characterWorkspace} data-mind-map-character-workspace="true">
          <header className={styles.characterWorkspaceHeader}>
            <div>
              <small>CANONICAL CHARACTER ROSTER</small>
              <h3>Characters</h3>
              <p>Roster identity comes from saved Character Truth. Visual history comes from the existing World Map character resource store.</p>
            </div>
            <span>{characterRoster.length} {characterRoster.length === 1 ? "CHARACTER" : "CHARACTERS"}</span>
          </header>
          <form
            className={styles.characterCreate}
            data-mind-map-create-character="true"
            onSubmit={(event) => {
              event.preventDefault();
              createCharacter();
            }}
          >
            <label>
              <span>NEW CHARACTER</span>
              <input
                type="text"
                maxLength={300}
                value={newCharacterName}
                onChange={(event) => setNewCharacterName(event.target.value)}
                placeholder="Character name"
              />
            </label>
            <button type="submit" disabled={!newCharacterName.trim()}>Create Character</button>
          </form>
          {!characterRoster.length ? (
            <p className={styles.emptyActFields} data-mind-map-character-roster-empty="true">No canonical characters are established for this project yet.</p>
          ) : (
            <div className={styles.characterRoster} data-mind-map-character-roster-count={characterRoster.length}>
              {characterRoster.map((character) => (
                <article
                  className={styles.characterCard}
                  data-mind-map-character-id={character.id}
                  data-selected-character={selectedCharacter?.id === character.id ? "true" : "false"}
                  key={character.id}
                >
                  <button
                    type="button"
                    className={styles.characterSelect}
                    aria-pressed={selectedCharacter?.id === character.id}
                    onClick={() => {
                      setSelectedCharacterId(character.id);
                      setNotesOpen(false);
                      setNotice("");
                    }}
                  >
                    {character.previewUrl ? <img src={character.previewUrl} alt={`${character.name} visual reference`} /> : <span className={styles.characterMissingVisual}>NO SAVED VISUAL</span>}
                    <span>
                      <strong>{character.name}</strong>
                      <small>{character.id}</small>
                      <small>{character.references.length} saved visual {character.references.length === 1 ? "reference" : "references"} · {character.visualVersions.length} {character.visualVersions.length === 1 ? "version" : "versions"}</small>
                    </span>
                    {selectedCharacter?.id === character.id ? <b>SELECTED</b> : null}
                  </button>
                  <details className={styles.characterVisualHistory}>
                    <summary>Saved visual resources · {character.references.length}</summary>
                    {!character.visualVersions.length ? <p>No saved/generated character visual resources yet.</p> : null}
                    {character.visualVersions.map((version) => (
                      <section data-character-visual-version={version.id} key={version.id}>
                        <header>
                          <strong>{version.locked ? "LOCKED" : "SAVED"} · {version.id}</strong>
                          <span>{version.references.length} / 8 views · {version.complete ? "COMPLETE" : "INCOMPLETE"}</span>
                          {!version.locked ? (
                            <button type="button" disabled={!version.complete} onClick={() => lockCharacterVisualVersion(version.id)}>
                              Lock Complete Version
                            </button>
                          ) : null}
                        </header>
                        <div className={styles.characterVisualGrid}>
                          {version.references.map((reference) => (
                            <figure data-character-visual-reference={reference.id} key={reference.id}>
                              <img src={reference.assetUrl} alt={`${character.name} · ${reference.view}`} />
                              <figcaption>{reference.view} · {reference.reviewState}</figcaption>
                            </figure>
                          ))}
                        </div>
                      </section>
                    ))}
                  </details>
                </article>
              ))}
            </div>
          )}
          {selectedCharacter ? (
            <section className={styles.characterGeneration} data-mind-map-character-generation={selectedCharacter.id}>
              <div>
                <small>SELECTED CHARACTER VISUAL</small>
                <strong>{selectedCharacter.name}</strong>
                <p>Generation uses Human-approved Character Truth plus permitted project context. Locked approved references are supplied for identity continuity and are never overwritten by generation.</p>
              </div>
              <label>
                <span>REFERENCE VIEW</span>
                <select value={selectedCharacterView} onChange={(event) => setSelectedCharacterView(event.target.value as WorldMapCharacterView)}>
                  {WORLD_MAP_CHARACTER_VIEWS.map((view) => <option value={view.id} key={view.id}>{view.label}</option>)}
                </select>
              </label>
              <button
                type="button"
                disabled={generatingCharacterId !== null}
                onClick={() => void generateCharacterVisual()}
              >
                {generatingCharacterId === selectedCharacter.id ? "Generating Character Visual…" : "Generate Character Visual"}
              </button>
            </section>
          ) : null}
        </section>
      ) : null}

      {selectedField ? (
        <section className={styles.contextualActions} data-mind-map-selected-field-actions={selectedField.canonicalId} aria-label="Selected Mind Map field actions">
          <div>
            <small>SELECTED FIELD</small>
            <strong>{selectedField.lessonTitle}</strong>
            <span data-selected-field-scope={selectedField.scope}>{fieldScopeLabel(selectedField, selectedAct)}</span>
            {selectedTopic === "character" && selectedCharacter ? <span data-mind-map-character-target={selectedCharacter.id}>CHARACTER TARGET · {selectedCharacter.name}</span> : null}
            <code>{selectedField.canonicalId}</code>
          </div>
          <div className={styles.contextualActionButtons}>
            <button type="button" onClick={() => saveCanonicalField(selectedField)}>Save Changes</button>
            <button type="button" disabled={developingFieldId !== null} onClick={() => void createCanonicalFieldProposal(selectedField)}>
              {developingFieldId === selectedField.canonicalId ? "Asking Agent…" : selectedField.actionLabel}
            </button>
            <button
              type="button"
              aria-expanded={notesOpen}
              data-mind-map-human-notes-toggle={selectedFieldNoteKey ?? selectedField.canonicalId}
              onClick={() => setNotesOpen((current) => !current)}
            >
              {notesOwnerLabel}
            </button>
            <button type="button" onClick={openSelectedFieldInLearn}>Open in Learn</button>
          </div>
        </section>
      ) : null}

      {notesOpen && selectedField ? (
        <section className={styles.humanNotes} data-mind-map-human-notes={selectedFieldNoteKey ?? selectedField.canonicalId} aria-label={`${selectedField.lessonTitle} Human notes`}>
          <header>
            <div>
              <small>HUMAN WORKING NOTES · NON-CANON</small>
              <h3>{selectedField.lessonTitle} · {notesOwnerLabel}</h3>
              {selectedTopic === "character" && selectedCharacter ? <strong>CHARACTER TARGET · {selectedCharacter.name}</strong> : null}
              <code>{selectedFieldNoteKey ?? selectedField.canonicalId}</code>
            </div>
            <span data-notes-save-state={notesDirty ? "unsaved" : "saved"}>{notesDirty ? "UNSAVED CHANGES" : "SAVED"}</span>
          </header>
          <p>Private working notes for the selected field. Saving notes does not change Project Value or accept an Agent Suggestion.</p>
          <textarea
            rows={6}
            value={selectedFieldNoteDraft}
            onChange={(event) => selectedFieldNoteKey && setNoteDrafts((current) => ({ ...current, [selectedFieldNoteKey]: event.target.value }))}
            placeholder={`Write notes for ${selectedField.lessonTitle}…`}
          />
          <div className={styles.fieldActions}>
            <button type="button" disabled={!notesDirty} onClick={saveSelectedFieldNotes}>Save Notes</button>
          </div>
        </section>
      ) : null}

      <section className={styles.fieldWorkspace} aria-label={`${LEARN_TOPIC_SPINE.find((topic) => topic.id === selectedTopic)?.label} canonical story fields`}>
        <header className={styles.fieldWorkspaceHeader}>
          <div>
            <small>SELECTED PAGE</small>
            <h3>Canonical project fields</h3>
          </div>
          <span>PAGE {selectedFieldPage} OF {selectedFieldPageCount} · {visibleCanonicalFields.length} VISIBLE / {selectedCanonicalFields.length} {selectedCanonicalFields.length === 1 ? "FIELD" : "FIELDS"}</span>
        </header>
        <p className={styles.fieldWorkspaceHelp}>Write directly or ask the Agent for a suggestion. A suggestion never replaces Project Value until you choose Use Suggestion.</p>
        {!selectedCanonicalFields.length ? (
          <p className={styles.emptyActFields} data-mind-map-empty-act-fields={selectedTopic}>
            No {selectedTopicLabel} fields require separate Act {selectedAct} input.
          </p>
        ) : null}
        <div className={styles.fieldGrid}>
          {visibleCanonicalFields.map((field) => {
            const storageId = storyDevelopmentFieldStorageId(field, selectedAct);
            const persisted = storyDevelopmentFieldView(project, field, selectedAct);
            const proposal = proposalDrafts[storageId] ?? persisted.proposal;
            const relevantContext = relevantProjectContextForField(
              project,
              field,
              selectedAct,
              field.topicId === "character" ? selectedCharacter?.id : null,
            );
            return (
              <article
                className={styles.fieldCard}
                data-canonical-field-id={field.canonicalId}
                data-field-classification={field.classification}
                data-field-scope={field.scope}
                data-field-storage-id={storageId}
                data-field-valid-acts={field.validActs.join(",")}
                data-selected-field={selectedField?.canonicalId === field.canonicalId ? "true" : "false"}
                key={field.canonicalId}
                tabIndex={0}
                onClick={() => setSelectedFieldId(field.canonicalId)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  setSelectedFieldId(field.canonicalId);
                }}
              >
                <header>
                  <div>
                    <strong>{field.lessonTitle}</strong>
                    <small>{fieldScopeLabel(field, selectedAct)} · {field.canonicalId}</small>
                  </div>
                  <div className={styles.fieldStatus}>
                    {selectedField?.canonicalId === field.canonicalId ? <strong>SELECTED</strong> : null}
                    <span>{persisted.acceptedSource === "agent-proposal" ? "AGENT-ASSISTED" : persisted.value ? "SAVED" : "OPEN"}</span>
                  </div>
                </header>
                <p>{field.prompt}</p>
                <label className={styles.projectValue}>
                  <span>PROJECT VALUE</span>
                  <textarea
                    rows={4}
                    value={fieldDrafts[storageId] ?? persisted.value}
                    onChange={(event) => setFieldDrafts((current) => ({ ...current, [storageId]: event.target.value }))}
                    placeholder="Write the project decision or application note…"
                  />
                </label>
                {proposal ? <div className={styles.fieldProposal} data-canonical-field-proposal={field.canonicalId}>
                  <label>
                    <span>AGENT SUGGESTION · editable before use</span>
                    <textarea
                      rows={4}
                      value={proposal}
                      onChange={(event) => setProposalDrafts((current) => ({ ...current, [storageId]: event.target.value }))}
                    />
                  </label>
                  <button type="button" onClick={() => useCanonicalFieldProposal(field)}>Use Suggestion</button>
                </div> : null}
                {relevantContext.length ? (
                  <details className={styles.fieldContext} data-relevant-project-context={field.canonicalId}>
                    <summary>
                      <span>RELEVANT PROJECT CONTEXT</span>
                      <strong>{relevantContext.length}</strong>
                    </summary>
                    <p>Read-only evidence selected by explicit PlotPickle rules for this field. It does not change Project Value.</p>
                    <div className={styles.fieldContextList}>
                      {relevantContext.map((item) => (
                        <article key={item.id} data-relevant-context-item={item.id}>
                          <header><strong>{item.label}</strong><span>READ ONLY</span></header>
                          <p>{item.text}</p>
                          <small>{item.reason}</small>
                          <div className={styles.evidenceRefs} aria-label="Evidence references">
                            {item.evidenceRefs.map((ref) => <code key={ref}>{ref}</code>)}
                          </div>
                        </article>
                      ))}
                    </div>
                  </details>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

        {notice ? <p className={styles.notice} aria-live="polite">{notice}</p> : null}
      </section>
    </main>
  );
}
