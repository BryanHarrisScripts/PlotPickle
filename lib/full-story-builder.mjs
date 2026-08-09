const BLOCK_TEMPLATES = [
  ["Hook, Introduction & Catalyst", "Open on a compelling image, establish the ordinary world, then disrupt it."],
  ["Problem, Stakes & Philosophy", "Define the problem, the cost of failure and the belief under pressure."],
  ["Anti-theme, Want & Choice", "Expose the opposing belief, clarify the conscious want and force a choice."],
  ["Initial Plan, Action & New Problem", "Turn the choice into action that creates a fresh complication."],
  ["Adaptation, Revised Plan & Raised Stakes", "Make the protagonist adapt while the cost rises."],
  ["Choice, Action & Antagonist Hint", "Close Act One with commitment and a clearer opposing force."],
  ["New World & Exploration", "Reveal the new situation, its opportunities and its dangers."],
  ["Action, Rising Tension & Problems", "Let the plan create movement, pressure and new obstacles."],
  ["Therefore, Choice & Adjusted Plan", "Connect consequence to a more informed decision."],
  ["Raised Stakes, Deeper Question & Action", "Increase urgency and deepen the dramatic question."],
  ["Revelation, Problem & Therefore", "Reveal information that changes the meaning of the conflict."],
  ["Midpoint Choice & Action", "Force a defining choice that changes the story's direction."],
  ["Consequences & Complications", "Make earlier choices generate tightening consequences."],
  ["Therefore, Choice & Adjusted Plan", "Use the complication to force meaningful adaptation."],
  ["Major Crisis & All Is Lost", "Collapse the plan and make the cost feel unavoidable."],
  ["Dark Night & Revelation", "Create doubt and the insight needed to move differently."],
  ["New Choice, Plan & Preparation", "Turn internal change into a plan for confrontation."],
  ["Action, Climax & Immediate Result", "Test the protagonist's growth through decisive action."],
  ["Fallout & New Normal", "Show the cost and the first shape of the changed world."],
  ["Remaining Questions & Actions", "Resolve lingering plot and relationship questions through action."],
  ["Final Choice & Last Attempt", "Demand a choice that proves who the protagonist has become."],
  ["Final Action & Ultimate Stakes", "Resolve the remaining external and internal conflict."],
  ["Resolution & New Equilibrium", "Settle the central conflict and reveal the lasting outcome."],
  ["Reflection & Closing Image", "Complete the theme with an image that answers the opening."],
];

const SEQUENCE_TEMPLATES = [
  ["Awakening", "Introduce the world, protagonist, disturbance and first live question."],
  ["Discovery", "Reveal the opportunity, cost or truth created by the disturbance."],
  ["Alliance", "Force commitment or threshold movement into the larger story."],
  ["Conflict", "Test the first approach against active opposition."],
  ["Struggle", "Complicate the plan until adaptation becomes unavoidable."],
  ["Pivot", "Deliver the midpoint reframe that changes direction."],
  ["Apex", "Make prior choices generate consequences and tighter pressure."],
  ["Turn", "Collapse the strategy and force deeper change."],
  ["Reveal", "Convert new understanding into preparation."],
  ["Fallout", "Show the immediate cost and unstable new condition."],
  ["Mending", "Resolve relationships and final tests of transformation."],
  ["Legacy", "Complete the final action, equilibrium and closing image."],
];

const LEARNING_EVIDENCE = [
  "pitch",
  "world-building",
  "characters",
  "structures",
  "24b-story-beats",
  "24b-dynamic-scenes",
  "dialogue-conflict",
  "essentials-screen-evidence",
  "ai-revision-scene-purpose-turn",
  "responsible-ai",
];

const MINI_LABELS = ["Promise", "Progress", "Pressure", "Payoff"];
const FIRST_NAMES = ["Mara", "Theo", "Inez", "Callum", "Asha", "Jonah", "Noor", "Elian"];
const SURNAMES = ["Vale", "Mercer", "Sato", "Quill", "Moreno", "Rook", "Avery", "Bell"];
const TITLE_FIRST = ["Glass", "Quiet", "Copper", "Winter", "Paper", "Hidden", "Salt", "Last"];
const TITLE_SECOND = ["Orchard", "Signal", "Harbour", "Atlas", "Lantern", "Current", "Garden", "Compass"];
const SETTINGS = ["a weather-beaten island observatory", "a lake town built around a silent mill", "a vertical city whose elevators remember every passenger", "a northern greenhouse settlement", "a coastal archive threatened by the tide", "a railway community at the end of its line"];

function clean(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 4_000) : fallback;
}

function integer(value, fallback, minimum, maximum) {
  const candidate = Number(value);
  return Number.isFinite(candidate) ? Math.min(maximum, Math.max(minimum, Math.round(candidate))) : fallback;
}

function hash(value) {
  let state = 2166136261;
  for (const character of String(value)) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  return state >>> 0;
}

function pick(values, seed, offset = 0) {
  return values[(seed + offset * 2654435761) % values.length];
}

function id(prefix, seed) {
  return `${prefix}-${hash(`${prefix}:${seed}`).toString(16).padStart(8, "0")}`;
}

function slug(value) {
  return clean(value, "untitled-story").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "untitled-story";
}

export function normalizeFullStoryBrief(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const seedText = clean(source.originalitySeed, `${Date.now()}-${Math.random()}`);
  const seed = hash(seedText);
  const protagonist = clean(source.protagonist, `${pick(FIRST_NAMES, seed)} ${pick(SURNAMES, seed, 1)}`);
  const title = clean(source.title, `The ${pick(TITLE_FIRST, seed, 2)} ${pick(TITLE_SECOND, seed, 3)}`);
  const setting = clean(source.setting, pick(SETTINGS, seed, 4));
  const goal = clean(source.protagonistGoal, "recover a stolen public memory before the community forgets why it exists");
  const opposition = clean(source.opposition, "a trusted civic keeper who believes forgetting is the only way the community can survive");
  const theme = clean(source.theme, "A shared future requires the courage to remember together, not the comfort of choosing the past for others.");
  const premise = clean(source.premise, `In ${setting}, ${protagonist}, a practical outsider with a private reason to avoid the past, must ${goal} while ${opposition} closes every route forward.`);
  return {
    title,
    premise,
    genre: clean(source.genre, "Character-driven speculative mystery"),
    tone: clean(source.tone, "Tense, intimate and visually tactile, with earned warmth"),
    protagonist,
    protagonistGoal: goal,
    opposition,
    theme,
    setting,
    visualLanguage: clean(source.visualLanguage, "Matte charcoal interiors, weathered brass, hard window light, handmade maps and restrained amber accents"),
    audience: clean(source.audience, "Adult and crossover audiences who enjoy emotional mystery and grounded speculative drama"),
    contentRating: clean(source.contentRating, "PG-13"),
    language: clean(source.language, "English"),
    projectOwner: clean(source.projectOwner, "Project owner"),
    originalitySeed: seedText,
  };
}

function character({ seed, name, role, description, want, need, ghost, flaw, strengths, arc, voice }) {
  const characterId = id("character", `${seed}:${name}`);
  return {
    id: characterId, name, role, pronouns: "they/them", description, want, need, ghost, fatalFlaw: flaw, strengths, arc, voice,
    originEnvironment: "Raised inside the story world and shaped by its unwritten rules.",
    socialContext: "Moves between institutional power and people who live with its consequences.",
    educationExpertise: "Practical field knowledge; notices material detail before abstract explanation.",
    worldviewBoundaries: "Distrusts certainty that asks other people to surrender their agency.",
    rhythmSentenceShape: "Short observations under pressure; longer sentences only when honesty finally wins.",
    vocabularyMetaphors: "Uses weather, maps, mechanisms and physical thresholds.",
    verbalFingerprints: "Answers a difficult question with one precise counter-question.",
    emotionalAccess: "Names facts first, feelings second and fear last.",
    statusShift: "Speech becomes quieter and more exact as authority grows.",
    persuasionStrategy: "Offers a concrete test instead of demanding belief.",
    arcMatrix: {
      startingState: description, consciousWant: want, underlyingNeed: need, protectiveLie: ghost,
      emergingTruth: arc, midpointShift: "Accepts that neutrality protects the stronger side.",
      crisisChoice: "Risks belonging to reveal the truth publicly.", climaxChoice: "Gives the final decision back to the community.",
      endingState: "Able to remember without being governed by memory.", relationshipImpact: "Learns to share authorship of the future.", checkpoints: [],
    },
    image: "", relationships: [],
  };
}

function draftElement({ id: elementId, type, text, blockNumber = 1, miniBlockNumber = 1, sceneNumber = 1, sceneId = "", threadIds = [], now }) {
  return {
    id: elementId, type, text, blockNumber, miniBlockNumber, sceneNumber, sceneId, threadIds,
    omitted: false, locked: false, revisionColour: "none", sourceAttributionIds: [], aiProvenanceIds: ["full-story-builder-local"],
    createdAt: now, updatedAt: now,
  };
}

function screenplayMovement({ block, mini, scene, protagonist, ally, opponent, location, threadIds, now }) {
  const position = `${block.number}.${mini.number}`;
  const pressure = mini.number === 1 ? "a visible condition that makes the objective urgent" : mini.number === 2 ? "evidence that the first plan can work, but not safely" : mini.number === 3 ? "a contradiction that forces the hidden cost into view" : "a choice whose consequence opens the next movement";
  const action = `${protagonist.name} studies the physical evidence in ${location.name}. The smallest detail refuses the official explanation. ${ally.name} tests the claim against what they witnessed, while ${opponent.name}'s influence arrives through a practical obstacle rather than a speech. The scene stays playable: hands move, doors close, a map changes and every new fact requires a decision.`;
  const exchange = `We can keep calling it protection, or we can ask who gets protected.`;
  const counter = `Ask the question if you are willing to live with the answer.`;
  const close = `The answer changes the immediate plan. ${protagonist.name} leaves with less safety, more responsibility and one specific action that cannot be postponed.`;
  const elements = [
    draftElement({ id: `element-${position}-heading`, type: "scene-heading", text: `INT. ${location.name.toUpperCase()} - ${block.number % 3 === 0 ? "NIGHT" : "DAY"}`, blockNumber: block.number, miniBlockNumber: mini.number, sceneNumber: scene.number, sceneId: scene.id, threadIds, now }),
    draftElement({ id: `element-${position}-action-1`, type: "action", text: `${action} The movement begins with ${pressure}.`, blockNumber: block.number, miniBlockNumber: mini.number, sceneNumber: scene.number, sceneId: scene.id, threadIds, now }),
    draftElement({ id: `element-${position}-character-1`, type: "character", text: protagonist.name.toUpperCase(), blockNumber: block.number, miniBlockNumber: mini.number, sceneNumber: scene.number, sceneId: scene.id, threadIds, now }),
    draftElement({ id: `element-${position}-dialogue-1`, type: "dialogue", text: exchange, blockNumber: block.number, miniBlockNumber: mini.number, sceneNumber: scene.number, sceneId: scene.id, threadIds, now }),
    draftElement({ id: `element-${position}-action-2`, type: "action", text: `${ally.name} does not reassure them. A distant mechanism starts, turning the location itself into a clock. The next choice has to be shown, not explained.`, blockNumber: block.number, miniBlockNumber: mini.number, sceneNumber: scene.number, sceneId: scene.id, threadIds, now }),
    draftElement({ id: `element-${position}-character-2`, type: "character", text: opponent.name.toUpperCase(), blockNumber: block.number, miniBlockNumber: mini.number, sceneNumber: scene.number, sceneId: scene.id, threadIds, now }),
    draftElement({ id: `element-${position}-dialogue-2`, type: "dialogue", text: counter, blockNumber: block.number, miniBlockNumber: mini.number, sceneNumber: scene.number, sceneId: scene.id, threadIds, now }),
    draftElement({ id: `element-${position}-action-3`, type: "action", text: close, blockNumber: block.number, miniBlockNumber: mini.number, sceneNumber: scene.number, sceneId: scene.id, threadIds, now }),
  ];
  const fountain = [elements[0].text, "", elements[1].text, "", protagonist.name.toUpperCase(), exchange, "", elements[4].text, "", opponent.name.toUpperCase(), counter, "", close].join("\n");
  return { elements, fountain };
}

function emptyProductionDraft() {
  return { mode: "writer", convertedAt: "", writerBaselineRevisionId: "", paginationLocked: false, paginationLockedAt: "", sceneNumbers: [], pageAssignments: [], revisionSets: [], activeRevisionSetId: "", annotations: [], approvalHistory: [] };
}

export function createFullStoryProject(input = {}, options = {}) {
  const brief = normalizeFullStoryBrief(input);
  const now = clean(options.now, new Date().toISOString());
  const jobId = clean(options.jobId, id("job", `${brief.originalitySeed}:${now}`));
  const seed = hash(brief.originalitySeed);
  const projectId = id("project", `${brief.title}:${brief.originalitySeed}`);
  const protagonist = character({ seed, name: brief.protagonist, role: "Protagonist", description: `A resourceful field conservator who arrives in ${brief.setting} intending to complete a contained job and leave.`, want: brief.protagonistGoal, need: "to trust other people with the truth instead of treating responsibility as solitary punishment", ghost: "They once exposed a truth without protecting the people who had to survive it.", flaw: "Controls information to prevent another mistake.", strengths: "Pattern recognition, patience, moral courage and practical improvisation.", arc: "Moves from private control to shared stewardship.", voice: "Concrete, dry and observant; emotion arrives through what they choose to notice." });
  const ally = character({ seed: seed + 1, name: `${pick(FIRST_NAMES, seed, 5)} ${pick(SURNAMES, seed, 6)}`, role: "Ally and relationship mirror", description: "A local repairer who knows how the community's systems fail and why people keep them alive anyway.", want: "keep the community intact through the coming season", need: "accept that peace maintained by silence is already a form of loss", ghost: "Their family benefited from the official version of the past.", flaw: "Confuses loyalty with protection from consequences.", strengths: "Humour, mechanical fluency, social memory and the courage to stay.", arc: "Moves from careful accommodation to accountable solidarity.", voice: "Warm, elliptical and funny until the subject becomes personal." });
  const opponent = character({ seed: seed + 2, name: `${pick(FIRST_NAMES, seed, 7)} ${pick(SURNAMES, seed, 8)}`, role: "Principal opposition", description: "The elected keeper of the community archive, admired for guiding people through an earlier disaster.", want: "complete a controlled erasure before old divisions return", need: "admit that safety imposed without consent becomes domination", ghost: "They watched an earlier truth tear the community apart.", flaw: "Treats other people's agency as an unacceptable variable.", strengths: "Discipline, empathy, institutional knowledge and strategic patience.", arc: "Is forced to see that benevolent control still steals the future.", voice: "Calm, inclusive language that quietly removes alternatives." });
  const witness = character({ seed: seed + 3, name: `${pick(FIRST_NAMES, seed, 9)} ${pick(SURNAMES, seed, 10)}`, role: "Witness and catalyst", description: "A young courier who remembers an event the archive says never happened.", want: "prove their memory belongs to them", need: "separate being believed from being used as evidence", ghost: "Every adult explanation has required them to doubt their own senses.", flaw: "Turns danger into a test of whether anyone truly listens.", strengths: "Curiosity, speed, lateral thinking and emotional precision.", arc: "Moves from demanding validation to choosing how their story may be shared.", voice: "Direct questions, unexpected comparisons and no patience for institutional euphemism." });
  const characters = [protagonist, ally, opponent, witness];
  protagonist.relationships = [{ characterId: ally.id, label: "Uneasy partners", description: "Trust grows through shared practical risk." }, { characterId: opponent.id, label: "Ethical adversaries", description: "Both fear the damage truth can cause; they disagree about who owns the choice." }];
  ally.relationships = [{ characterId: protagonist.id, label: "Uneasy partners", description: "Each can do what the other cannot." }, { characterId: witness.id, label: "Protective older friend", description: "Protection must mature into respect for agency." }];
  opponent.relationships = [{ characterId: protagonist.id, label: "Ethical adversaries", description: "Recognition makes their conflict more dangerous, not less." }];
  witness.relationships = [{ characterId: ally.id, label: "Chosen family", description: "Affection survives when protection stops becoming control." }];

  const locationNames = ["Tide Archive", "North Pump House", "Glass Market", "Abandoned Signal Tower", "Council Reservoir", "Cliffside Memory Garden"];
  const locations = locationNames.map((name, index) => ({ id: `location-${index + 1}`, name, description: `${name} carries visible layers of repair, civic ritual and suppressed history. Its practical function creates action while its changing light supports the story's visual argument.`, image: "" }));
  const threadDefinitions = [
    ["The missing public memory", "main", "What was removed, who authorized it and who has the right to restore it?", 24],
    ["Trust between outsider and community", "relationship", "Can responsibility be shared without surrendering hard-won independence?", 23],
    ["The witness's impossible recollection", "mystery", "Why can one person remember what the archive erased?", 20],
    ["Safety versus agency", "theme", "Who gets to decide which truth is too dangerous for everyone else?", 24],
  ];
  const storyThreads = threadDefinitions.map(([name, kind, question, resolution], index) => ({
    id: `thread-${index + 1}`, name, kind, status: "resolved", summary: question, question, characterIds: index === 0 ? characters.map((item) => item.id) : [protagonist.id, index === 1 ? ally.id : index === 2 ? witness.id : opponent.id], sceneIds: [], introducedBlockNumber: 1, resolvedBlockNumber: resolution, milestones: [], notes: "Generated as an editable structural draft.", createdAt: now, updatedAt: now,
  }));

  const draftElements = [draftElement({ id: "title-page", type: "title-page", text: `${brief.title}\nWritten as an original PlotPickle Full Story Builder draft`, now })];
  const fountainSections = [`Title: ${brief.title}`, `Credit: Original story draft`, "", "===", ""];
  const blocks = BLOCK_TEMPLATES.map(([templateTitle, purpose], blockIndex) => {
    const number = blockIndex + 1;
    const act = Math.floor(blockIndex / 6) + 1;
    const sequenceNumber = Math.floor(blockIndex / 2) + 1;
    const location = locations[blockIndex % locations.length];
    const stageProtagonist = number <= 6 ? "protects the work by controlling it" : number <= 12 ? "tests collaboration while keeping an exit open" : number <= 18 ? "sees the human cost of private control" : "shares authority and accepts an uncertain collective answer";
    const blockGoal = number <= 6 ? "identify the first verifiable gap in the archive" : number <= 12 ? "trace the mechanism that makes public memory editable" : number <= 18 ? "keep the recovered account from being destroyed or weaponized" : "return the final decision to the people affected by it";
    const blockConflict = `${opponent.name}'s protective system makes every useful fact costly, while ${protagonist.name} ${stageProtagonist}.`;
    const sceneIds = [`block-${String(number).padStart(2, "0")}-scene-1`, `block-${String(number).padStart(2, "0")}-scene-2`];
    const scenes = [1, 2].map((sceneNumber) => {
      const sceneId = sceneIds[sceneNumber - 1];
      const miniNumbers = sceneNumber === 1 ? [1, 2] : [3, 4];
      const minis = miniNumbers.map((miniNumber) => {
        const movement = miniNumber === 1 ? "establishes the immediate objective and visual question" : miniNumber === 2 ? "creates progress that reveals a hidden dependency" : miniNumber === 3 ? "turns pressure into a contradiction that cannot be ignored" : "forces a consequence and a new story direction";
        return {
          id: `block-${String(number).padStart(2, "0")}-mini-${miniNumber}`, number: miniNumber, label: MINI_LABELS[miniNumber - 1], function: movement,
          purpose: `Make Block ${number} ${movement}.`, characterId: protagonist.id, objective: blockGoal,
          resistance: blockConflict, action: `${protagonist.name} uses a material clue and another person's knowledge to test the official story.`,
          revelation: `The evidence in ${location.name} proves the apparent solution would transfer the danger rather than remove it.`,
          turn: `A choice in ${number}.${miniNumber} changes who controls the next move.`, visualBeat: `A precise ${brief.visualLanguage.toLowerCase()} image turns a practical object into evidence.`,
          dialogueIntention: `${protagonist.name} seeks actionable truth; ${opponent.name} reframes control as care.`, entryState: `The team enters ${location.name} believing one narrow task will be enough.`, exitState: "They leave with a more dangerous fact and less room to remain neutral.",
          setup: `Set up the Block ${number} consequence through a repeated map mark, brass key and interrupted civic ritual.`, payoff: `Pay off this movement no later than Block ${Math.min(24, number + 4)}.`, estimatedSeconds: 75, beatTarget: 4, shotTarget: 16, notes: "Review dialogue specificity and location continuity before locking.", shortScenes: [],
        };
      });
      const scene = {
        id: sceneId, number: sceneNumber, title: sceneNumber === 1 ? `${location.name} — Approach` : `${location.name} — Reversal`, sceneType: sceneNumber === 1 ? "dialogue" : "action",
        purpose: sceneNumber === 1 ? `Establish Block ${number}'s objective and complicate the first approach.` : `Force Block ${number}'s irreversible choice and consequence.`,
        entryCondition: `The previous movement leaves ${protagonist.name} with an incomplete answer.`, exitCondition: `The Block ${number} consequence makes the next action necessary.`, characterIds: [protagonist.id, ally.id, opponent.id], locationIds: [location.id], charactersEntering: [protagonist.id, ally.id], charactersLeaving: sceneNumber === 2 ? [protagonist.id, ally.id] : [], objective: blockGoal, opposition: blockConflict, conflict: blockConflict, action: `The team tests the archive through the physical systems inside ${location.name}.`, reversal: `The useful discovery also advances ${opponent.name}'s plan.`, turn: `Control of the evidence changes hands.`, resolution: "No one receives the complete answer, but the next choice becomes unavoidable.", outcome: `Block ${number} exits on a concrete action rather than explanation.`, estimatedSeconds: 150, pageEstimate: 2.5, order: sceneNumber - 1, threadIds: storyThreads.map((item) => item.id), status: "draft", revisionColour: "none", locked: false, miniBlocks: minis,
      };
      for (const mini of minis) {
        const movement = screenplayMovement({ block: { number }, mini, scene, protagonist, ally, opponent, location, threadIds: scene.threadIds, now });
        draftElements.push(...movement.elements);
        fountainSections.push(movement.fountain, "", "===", "");
        for (const thread of storyThreads) {
          thread.sceneIds.push(sceneId);
          if (mini.number === 1 && [1, 7, 12, 15, 18, 21, 24].includes(number)) thread.milestones.push({ id: `${thread.id}-block-${number}`, sceneId, blockNumber: number, kind: number === 1 ? "setup" : number >= (thread.resolvedBlockNumber || 24) ? "resolution" : number === 12 ? "reveal" : number >= 18 ? "payoff" : "turn", summary: `${thread.name} changes direction during Block ${number}.`, resolved: number >= (thread.resolvedBlockNumber || 24) });
        }
      }
      return scene;
    });
    const visuals = [1, 2, 3, 4].map((miniBlockNumber) => ({
      id: `block-${String(number).padStart(2, "0")}-mini-${miniBlockNumber}-primary`, miniBlockNumber, src: "", alt: `Storyboard direction for ${brief.title}, Block ${number}.${miniBlockNumber}.`, caption: `${templateTitle} — ${MINI_LABELS[miniBlockNumber - 1]}`, prompt: `${brief.visualLanguage}. Cinematic 16:9 storyboard frame in ${location.name}. ${protagonist.name} faces a practical choice while ${ally.name} and the influence of ${opponent.name} alter the composition. No text, no logos, consistent character identity.`, shot: miniBlockNumber === 1 ? "Wide establishing frame" : miniBlockNumber === 2 ? "Medium two-shot with environmental evidence" : miniBlockNumber === 3 ? "Compressed close-up with obstructed foreground" : "Decisive wide frame with a changed visual axis", continuity: `Keep wardrobe, weather, brass key, map markings and ${location.name}'s geography consistent across Block ${number}.`, versions: [], approvedImageVersionId: "", approvedVideoVersionId: "",
    }));
    return {
      id: `block-${String(number).padStart(2, "0")}`, number, act, sequenceNumber, targetMinutes: 5, title: `${templateTitle}: ${location.name}`, purpose,
      summary: `${protagonist.name} pursues ${blockGoal} in ${location.name}; resistance exposes a cost, a choice transfers control and the consequence advances the central mystery.`, characterIds: characters.map((item) => item.id), locationIds: [location.id], goal: blockGoal, conflict: blockConflict, choice: `Choose between a safer partial truth and a risky action that preserves other people's agency.`, action: `Use the physical systems of ${location.name} to test the claim in public view.`, consequence: `The result solves the immediate problem but gives the opposition a stronger position in Block ${Math.min(24, number + 1)}.`, emotionalTurn: `Certainty gives way to ${number < 12 ? "earned suspicion" : number < 18 ? "responsibility" : "shared resolve"}.`, audienceExpectation: "A practical solution appears possible before its ethical cost becomes visible.", pickleTurn: "The apparent obstacle is also the mechanism that can reveal the truth.", setup: `Seed the Block ${number} key, map mark and relationship hesitation.`, payoff: `Pay off the choice through action by Block ${Math.min(24, number + 4)}.`, scriptExcerpt: scenes[0].miniBlocks[0].visualBeat, storyboardDirection: `${brief.visualLanguage}; shift the character axis only when control of the evidence changes.`, notes: `Human review: confirm causality from Block ${Math.max(1, number - 1)} and sharpen the unique behaviour in every scene.`, scenes, visuals,
    };
  });

  const screenplayWordCount = fountainSections.join("\n").trim().split(/\s+/).filter(Boolean).length;
  const project = {
    schemaVersion: "1.7.0", id: projectId,
    metadata: { title: brief.title, subtitle: "An original 24 Blocks / 96 mini-block feature", format: "Feature screenplay", targetMinutes: 120, genre: brief.genre, tone: brief.tone, status: "Complete structural draft — human review required", createdAt: now, updatedAt: now },
    story: { premise: brief.premise, logline: `When a public memory disappears in ${brief.setting}, ${brief.protagonist} must ${brief.protagonistGoal} before ${brief.opposition} makes the loss permanent, forcing a choice between protective control and shared truth.`, theme: brief.theme, antiTheme: "People are safest when a capable authority chooses which truths they can bear.", dramaticQuestion: `Can ${brief.protagonist} restore the truth without repeating the harm that made them fear it?`, hook: "A routine civic ceremony fails because one participant remembers a line that no longer exists.", catalyst: `${witness.name} delivers a physical object that proves the archive was altered from inside.`, stakes: "The community may lose both its history and the right to decide what replaces it; the protagonist may repeat the betrayal that shaped their private life.", ending: "The archive is restored as a plural record governed by the people inside it, and the closing civic ritual leaves room for more than one truthful voice.", notes: "Generated as an original editable draft. Every scene, fact, relationship and line remains subject to human authorship, review and revision." },
    world: { ordinaryWorld: `${brief.setting} survives through routine maintenance, careful civic roles and a shared archive that makes belonging legible.`, newWorld: "Once the archive's mutability is exposed, ordinary systems become contested evidence and every public ritual acquires a second meaning.", period: "Near present with restrained speculative infrastructure", history: "A past disaster led the community to centralize memory, repair and civic decisions under one trusted office.", cultures: "Neighbourhood rituals, repair guilds and family accounts preserve competing versions of local history.", rules: "Memory can be removed from the public archive but not cleanly from material objects or embodied habit. No single record is automatically canon.", technology: "Analog mechanisms, local networks, environmental sensors and an archive interface designed to look older than it is.", visualLanguage: brief.visualLanguage, locations },
    development: {
      conceptCanvas: { conceptText: brief.premise, emotionalPurpose: "Explore the difference between protecting people and controlling their choices.", audienceExperience: "Curiosity becomes unease, then moral urgency, then a release earned through collective action.", desiredVisualImpact: brief.visualLanguage, mustKeepConstraints: "Character agency, causal 24/96 movement, local-first privacy and a genuinely original story world.", openExploration: "Human writer should deepen cultural specificity, humour and scene-level language.", targetKind: "project", targetId: "project", targetLabel: "Whole project", updatedAt: now },
      visualReferences: [], storySetup: { audience: brief.audience, contentRating: brief.contentRating, language: brief.language, scope: "120-page feature screenplay target; 4 acts, 12 sequences, 24 blocks and 96 mini-blocks.", collaborators: "Generated locally for the project owner; no collaborator or public licence assumed." },
      pitch: { oneSentence: `A conservator discovers that a beloved civic archive is deleting the people it was built to protect.`, shortPitch: brief.premise, audiencePromise: "A character-led mystery whose practical discoveries create moral choices and cinematic visual turns.", emotionalExperience: "Tactile curiosity, tightening ethical pressure and earned collective hope.", comparableTitles: "Define original market references during human review; none were used as source material.", visualVision: brief.visualLanguage },
      ghost: { centralWound: protagonist.ghost, origin: "A previous disclosure was true but careless about who would absorb the fallout.", lie: "If I control the truth carefully enough, I can prevent harm.", trigger: "A witness asks to be believed without surrendering ownership of their memory.", presentPattern: "Works alone, withholds partial evidence and accepts responsibility no one assigned.", truth: "Responsible truth requires consent, context and shared agency, not solitary control." },
      catalyst: { event: `${witness.name} produces an object whose recorded history contradicts the public archive.`, timing: "Within the opening movement, before the protagonist can complete the safe assignment.", immediateImpact: "The protagonist's routine work becomes evidence in a civic conflict.", choiceForced: "Report the anomaly to the institution that may have caused it, or investigate without protection.", resistance: "Professional ethics, distrust from residents and the risk of creating another damaging disclosure.", doorway: "The protagonist enters the sealed maintenance layer beneath the archive." },
      foundations: { protagonist: protagonist.name, objective: brief.protagonistGoal, opposition: brief.opposition, urgency: "A scheduled archive reset will make the current alteration permanent within three days.", storyEngine: "Each recovered material fact changes both the practical route and who has authority to choose the next step.", transformation: protagonist.arc, endingProof: "The protagonist releases control of the final evidence while staying to help the community interpret it." },
      pickle: { centralTension: "Truth can free the community or repeat the violence of deciding for it.", audienceQuestion: "Who changed the archive, and can restoration happen without another act of control?", storyPromise: "Every answer will be physical, playable and ethically double-edged.", expectedDestination: "Expose a corrupt keeper and restore the deleted record.", unpredictableRoute: "The keeper's motive is protective, the archive was altered with community consent that was itself manipulated, and restoration must become a new shared system.", liveAnswerA: "Reveal everything immediately.", liveAnswerB: "Preserve safety by keeping the record closed.", escalationPattern: "Each attempt to secure evidence expands the number of people affected and reduces the possibility of a private solution.", finalAnswer: "Return informed choice to the affected community and build a record that can hold disagreement.", signatureMove: "A practical repair changes the meaning of an earlier image and forces an ethical decision." },
      dialogue: { principles: "Every exchange pursues an objective; explanation arrives only when it changes power.", voiceContrast: "The protagonist is precise, the ally is elliptical, the opponent is inclusive and the witness is direct.", subtext: "Arguments about maintenance carry arguments about agency.", expositionRules: "Attach world information to a task, risk, withheld answer or visible contradiction.", recurringLanguage: "Maps, thresholds, repairs, weather and the difference between keeping and owning.", notes: "Replace generated dialogue with character-specific field observation during revision.", worldVernacular: "Keepers, marks, tide pages, repair bells and open record.", monologueRules: "No speech resolves a conflict that can be forced into action.", subtextSeeds: "I kept it safe / You kept it from us; repair / alteration; record / memory.", fieldworkNotes: "Human writer should listen for regional rhythm and remove generic phrasing." },
      notes: { general: `Full Story Builder job ${jobId}.`, research: "No external research or copyrighted source material was used by the deterministic local fallback.", openQuestions: "Which civic practices deserve more cultural specificity? Where should humour interrupt pressure? Which supporting resident can complicate the final vote?", continuity: "Track the brass key, map marks, weather front, archive access levels, wardrobe damage and who possesses each copy of the evidence.", revisions: "First human pass: specificity. Second: causality. Third: dialogue voices. Fourth: page rhythm and visual repetition.", sources: `Learn Workspace guidance used: ${LEARNING_EVIDENCE.join(", ")}.` },
    },
    screenplay: { fileName: `${slug(brief.title)}.fountain`, format: "fountain", sourceText: fountainSections.join("\n").trim(), importedAt: now, analysisStatus: "reviewed", analyzedAt: now, suggestedFields: ["story", "world", "characters", "structure", "blocks", "screenplay", "visuals", "production", "rights"], draftElements, productionDraft: emptyProductionDraft() },
    structure: { pacingProfile: "original-24-96", averageShotSeconds: 4.6875, automaticTiming: true, sequences: SEQUENCE_TEMPLATES.map(([title, purpose], index) => ({ id: `sequence-${String(index + 1).padStart(2, "0")}`, number: index + 1, act: Math.floor(index / 3) + 1, title, purpose, question: `What must ${protagonist.name} understand before this sequence can end?`, promise: "A material discovery will force a relationship and strategy change.", escalation: "The useful answer increases exposure and reduces private options.", climax: `The second Block forces a visible choice about who controls the evidence.`, turningPoint: "The consequence changes the next sequence's objective.", result: "The story advances through causality rather than a reset.", targetMinutes: 10, blockNumbers: [index * 2 + 1, index * 2 + 2] })) },
    characters, blocks, storyThreads,
    rights: { projectOwner: brief.projectOwner, copyrightNotice: `Copyright ${new Date(now).getUTCFullYear()} ${brief.projectOwner}. All rights reserved.`, rightsStatement: `The project owner retains the rights they hold in ${brief.title} and its original creative material.`, defaultCreativeLicence: "All rights reserved", sourceWorkTitle: "", sourceWorkAuthor: "", adaptationStatus: "original", collaborators: [], attributions: [], aiProvenance: [{ id: "full-story-builder-local", provider: "PlotPickle local Full Story Builder", model: "deterministic-human-workflow-v1", operation: "other", promptSummary: "Original story brief plus the canonical Learn-guided 24 Blocks / 96 mini-block workflow.", outputSummary: "Complete editable project draft with screenplay, visual prompts and production planning.", humanContribution: "The project owner supplied or approved the story brief and retains editorial control.", humanDecision: "Generated material is a draft requiring human review before canon approval or publication.", retained: true, attachedTo: [projectId], createdAt: now }] },
    revisions: [{ id: "revision-full-story-builder", createdAt: now, label: "Full Story Builder initial draft", summary: "Original 120-page-target structural and screenplay draft generated locally for human review.", projectHash: "", author: "PlotPickle Full Story Builder", notes: "No cloud text generation and no silent provider cost." }],
    review: { threads: [], loglineCandidates: [{ id: "logline-full-story-builder", text: `When a public memory disappears in ${brief.setting}, ${brief.protagonist} must ${brief.protagonistGoal} before the loss becomes permanent.`, source: "Full Story Builder local draft", selected: true, createdAt: now }], pitchPackage: { title: brief.title, subtitle: "An original feature screenplay", tagline: "The truth belongs to everyone it changes.", logline: `When a public memory disappears in ${brief.setting}, ${brief.protagonist} must ${brief.protagonistGoal} before the loss becomes permanent.`, synopsis: brief.premise, creatorStatement: "A visual story about memory, care and the boundary between protection and control.", audience: brief.audience, comparableTitles: "To be defined by the human writer during market review.", visualStatement: brief.visualLanguage, contactLine: brief.projectOwner, selectedCharacterIds: characters.map((item) => item.id), selectedLocationIds: locations.map((item) => item.id), includeSections: ["cover", "logline", "synopsis", "characters", "world", "visuals", "creator", "rights"], comicDeck: { version: 1, style: "black-and-white-sketch", status: "not-started", panels: [], createdAt: now, updatedAt: now, lastGeneratedAt: "" }, updatedAt: now } },
    production: {
      shots: blocks.flatMap((block) => block.visuals.map((frame, index) => ({ id: `shot-${block.number}-${index + 1}`, blockNumber: block.number, miniBlockNumber: index + 1, sceneId: block.scenes[index < 2 ? 0 : 1].id, screenplayElementIds: [`element-${block.number}.${index + 1}-heading`], frameId: frame.id, shotNumber: index + 1, shotSize: index === 0 ? "Wide" : index === 2 ? "Close-up" : "Medium", angle: "Eye level unless the control relationship changes", movement: index === 3 ? "Measured push" : "Locked or restrained drift", lens: "Natural perspective", composition: frame.shot, purpose: frame.caption, continuity: frame.continuity, keyframeSrc: "", keyframeAlt: frame.alt, status: "planned", durationSeconds: 8, notes: "Confirm after storyboard review.", createdAt: now, updatedAt: now }))),
      cues: blocks.map((block) => ({ id: `cue-${block.number}`, cueNumber: String(block.number), blockNumber: block.number, sceneId: block.scenes[1].id, type: block.number % 6 === 0 ? "silence" : "atmosphere", title: `Block ${block.number} transition`, motif: "Archive mechanism and weather pressure", cueIn: "At the final choice", cueOut: "After the consequence lands", purpose: "Make the story turn audible without explaining it.", status: "temp", rights: "Original cue to be commissioned or created; no licensed recording attached.", durationSeconds: 20, notes: "Human music and sound review required.", createdAt: now, updatedAt: now })),
      breakdowns: blocks.flatMap((block) => block.scenes.map((scene) => ({ id: `breakdown-${scene.id}`, blockNumber: block.number, sceneId: scene.id, castIds: scene.characterIds, locationIds: scene.locationIds, props: "Brass key, marked map, archive tool case and evidence container", wardrobe: "Track weather exposure and repair damage", vehicles: "None unless added during production review", effects: "Practical archive mechanisms; restrained screen composites", stunts: "Low-risk movement only; review Block climax actions", extras: "Community members for civic rituals and public decision scenes", makeup: "Naturalistic continuity across a three-day story clock", sound: "Mechanical archive tone, weather and public-room perspective", estimatedHours: 5, readiness: "draft", notes: "Generated planning estimate; production lead must verify.", updatedAt: now }))),
      schedule: Array.from({ length: 12 }, (_, index) => ({ id: `shoot-day-${index + 1}`, dayNumber: index + 1, date: "", sceneIds: blocks.slice(index * 2, index * 2 + 2).flatMap((block) => block.scenes.map((scene) => scene.id)), locationId: locations[index % locations.length].id, callTime: "08:00", estimatedHours: 10, status: "planned", notes: "Group by location after cast and permit review.", updatedAt: now })),
      reporting: { locations: locations.map((location) => ({ locationId: location.id, realLocation: "To be scouted", lighting: "Practical motivated light with controlled amber accents", weather: "Track the three-day front", permits: "To be confirmed", travel: "Local planning estimate only", accessibility: "Accessibility review required before selection", availability: "Unconfirmed", setupMinutes: 90, estimatedShootHours: 10, notes: "Do not treat generated assumptions as booked production facts.", updatedAt: now })), actors: characters.map((item) => ({ characterId: item.id, actorName: "Uncast", availableDates: [], unavailableDates: [], wardrobe: "Continuity plan derived from block progression", makeup: "Naturalistic", rehearsalHours: 8, preferredCallTime: "08:00", estimatedWrapTime: "18:00", notes: "Casting and availability remain human decisions.", updatedAt: now })), shootGroups: [], timeline: { hoursPerDay: 10, pagesPerDay: 5, prepDays: 5, pickupDays: 2, contingencyPercent: 20, updatedAt: now } },
      animatic: { defaultFrameSeconds: 4, includeDialogue: true, showCueLabels: true, updatedAt: now },
      distribution: { audience: brief.audience, positioning: "Original character-led visual mystery", releasePath: "Human producer to determine", festivalTargets: "Not researched", distributorTargets: "Not researched", salesMaterials: "Pitch package, screenplay, visual direction and rights summary", trailerPlan: "Build only after approved visual and story passes", posterPlan: `Use ${brief.visualLanguage.toLowerCase()} without implying generated assets are final key art.`, socialCampaign: "Not planned", pressAngles: "Memory, public agency and local-first visual storytelling", milestones: [], updatedAt: now },
    },
    assets: { version: "1.0.0", assets: [], extensions: {} },
    collaboration: { provider: "none", repositoryUrl: "", sourceRepositoryUrl: "", owner: "", repo: "", branch: "main", projectPath: "", syncEnabled: false, lastPulledCommit: "", lastPushedCommit: "", connectedAt: "", updatedAt: now },
    extensions: { fullStoryBuilder: { version: 1, jobId, workspace: "Learn", workflow: "human-style-24-96", targetPages: 120, estimatedPages: blocks.flatMap((block) => block.scenes).reduce((sum, scene) => sum + scene.pageEstimate, 0), blockCount: blocks.length, miniBlockCount: blocks.flatMap((block) => block.scenes.flatMap((scene) => scene.miniBlocks)).length, screenplayWordCount, learningEvidence: LEARNING_EVIDENCE, originalitySeedHash: hash(brief.originalitySeed).toString(16), textRoute: "deterministic-local", visualRoute: "prompts-only", visualAttempts: 0, generatedAt: now, humanReviewRequired: true } },
  };
  return project;
}

export function attachGeneratedVisual(project, result) {
  const blockNumber = integer(result?.blockNumber, 0, 1, 24);
  const miniBlockNumber = integer(result?.miniBlockNumber, 0, 1, 4);
  const source = clean(result?.assetUrl);
  if (!blockNumber || !miniBlockNumber || !source) return false;
  const frame = project?.blocks?.[blockNumber - 1]?.visuals?.find((item) => item.miniBlockNumber === miniBlockNumber);
  if (!frame) return false;
  const createdAt = clean(result?.createdAt, new Date().toISOString());
  const variationId = id("visual-version", `${source}:${createdAt}`);
  frame.src = source;
  frame.versions = [...(Array.isArray(frame.versions) ? frame.versions : []), { id: variationId, kind: "image", src: source, prompt: frame.prompt, status: "candidate", createdAt }];
  const assetId = `storyboard-${blockNumber}-${miniBlockNumber}`;
  const variation = {
    id: variationId, source, portablePath: "", sourceFingerprint: id("fingerprint", source), contentHash: "", mediaType: "image/webp", bytes: 0,
    provider: clean(result?.provider, clean(result?.route, "configured image route")), model: clean(result?.model), prompt: frame.prompt, generatedAt: createdAt,
    provenanceIds: ["full-story-builder-local"], approval: "unreviewed", extensions: { origin: "local" },
  };
  project.assets.assets.push({ id: assetId, kind: "image", label: frame.caption, targets: [{ kind: "storyboard-frame", id: frame.id }], variations: [variation], approvedVariationId: "", createdAt, updatedAt: createdAt, extensions: {} });
  frame.assetRef = { assetId, variationId };
  return true;
}

export function fullStorySummary(project) {
  const builder = project?.extensions?.fullStoryBuilder || {};
  return {
    projectId: clean(project?.id), title: clean(project?.metadata?.title), targetPages: Number(builder.targetPages) || 0,
    estimatedPages: Number(builder.estimatedPages) || 0, blockCount: Array.isArray(project?.blocks) ? project.blocks.length : 0,
    miniBlockCount: Array.isArray(project?.blocks) ? project.blocks.flatMap((block) => block.scenes?.flatMap((scene) => scene.miniBlocks || []) || []).length : 0,
    screenplayWordCount: Number(builder.screenplayWordCount) || 0, visualCount: Array.isArray(project?.assets?.assets) ? project.assets.assets.length : 0,
  };
}
