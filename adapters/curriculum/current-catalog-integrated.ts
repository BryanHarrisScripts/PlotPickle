import character from "../../learn/character.json";
import collaboration from "../../learn/collaboration.json";
import dialogue from "../../learn/dialogue.json";
import drafting from "../../learn/drafting.json";
import foundations from "../../learn/foundations.json";
import industry from "../../learn/industry.json";
import index from "../../learn/index.json";
import responsibleAi from "../../learn/responsible-ai.json";
import revision from "../../learn/revision.json";
import structure from "../../learn/structure.json";
import theme from "../../learn/theme.json";
import visualStorytelling from "../../learn/visual-storytelling.json";
import world from "../../learn/world.json";
import type { CurriculumLesson } from "../../core/contracts/curriculum";
import { compareVisualWriterCurriculumOrder } from "../../core/contracts/visual-writer-progression/index";
import { FOUNDATION_SOURCE_COVERAGE } from "./foundation-content-coverage";
import { buildDeepFoundationCurriculum } from "./foundation-deep-learning";
import { FOUNDATION_PROMOTED_SOURCE_IDS } from "./foundation-reference-lessons";
import { ISSUE_1976_CANONICAL_LESSON_COUNT, withIssue1976CanonicalEnrichment } from "./issue-1976-canonical";

type TopicDocument = {
  readonly schemaVersion: string;
  readonly topic: { readonly id: string; readonly title: string };
  readonly lessonCount: number;
  readonly sourceCount: number;
  readonly lessons: readonly CurriculumLesson[];
};

const baseTopicDocuments = [
  foundations,
  industry,
  theme,
  character,
  world,
  structure,
  dialogue,
  visualStorytelling,
  drafting,
  revision,
  responsibleAi,
  collaboration,
] as readonly TopicDocument[];

for (const document of baseTopicDocuments) {
  if (document.schemaVersion !== index.schemaVersion) throw new Error(`LEARN topic ${document.topic.id} uses an unexpected schema version.`);
  if (document.lessonCount !== document.lessons.length) throw new Error(`LEARN topic ${document.topic.id} declares ${document.lessonCount} lessons but contains ${document.lessons.length}.`);
  const sourceCount = document.lessons.reduce((total, lesson) => total + lesson.sources.length, 0);
  if (document.sourceCount !== sourceCount) throw new Error(`LEARN topic ${document.topic.id} declares ${document.sourceCount} sources but contains ${sourceCount}.`);
}

function integrateIndustryLesson(lesson: CurriculumLesson): CurriculumLesson {
  if (lesson.id !== "industry") return lesson;
  return {
    ...lesson,
    sections: [
      ...lesson.sections.slice(0, 2),
      {
        heading: "What the major organizations actually do",
        paragraphs: [
          "Major film organizations are not interchangeable. The Writers Guild of America (WGA), Directors Guild of America (DGA) and SAG-AFTRA are labour organizations for writers, directors/directorial teams and performers/media professionals; the International Alliance of Theatrical Stage Employees (IATSE) represents many technicians, artisans and craftspeople. The Producers Guild of America (PGA) is a professional trade association for producers rather than the labour-union equivalent of those guilds.",
          "AMPAS, BAFTA and the European Film Academy are professional or cultural academies focused on recognition and screen culture. ASC, ACE and VES are professional societies serving cinematography, editing and visual-effects communities. BFI supports and develops UK moving-image culture and funding activity; FERA advocates for European film directors; the Cinémathèque Française preserves and presents film heritage; the Motion Picture Association and cinema-exhibition trade associations represent business sectors rather than individual creative labour.",
          "These descriptions are role distinctions, not current membership, eligibility, rate or agreement advice. For a real project, verify the organization's current official information and the jurisdiction and agreement that actually apply.",
        ],
      },
      ...lesson.sections.slice(2),
    ],
    definitions: [
      ...lesson.definitions,
      {
        term: "Trade association",
        meaning: "An organization representing the shared professional or business interests of a sector or member group; it is not automatically a labour union or regulator.",
      },
      {
        term: "Professional society or academy",
        meaning: "An organization centered on a craft, profession or screen culture through recognition, education, standards, preservation or community rather than collective bargaining.",
      },
    ],
  };
}

function integrateCharacterFidelity(lesson: CurriculumLesson): CurriculumLesson {
  if (lesson.id === "characters-inner-journey") {
    return {
      ...lesson,
      sections: [
        ...lesson.sections,
        {
          heading: "Use the legacy Act questions as a flexible question bank",
          paragraphs: [
            "The original 24 Blocks Character archive organized many useful questions under Acts 1–4 and specific Block numbers. Keep the questions; loosen the placement. A story may reach these problems at different positions, skip some of them, combine several at once or return to them more than once.",
            "Use the groups below as prompts for the nearest relevant movement or checkpoint. Labels such as All Is Lost, Dark Night of the Soul or a secondary climax are familiar traditions, not required beats. The durable test is whether pressure, choice and consequence make the character's movement visible.",
          ],
          points: [
            "Opening / setup — What immediately draws attention? What is the protagonist's ordinary condition? Which relationships, routines and pressures define that condition?",
            "Disruption / catalyst — What event changes the protagonist's situation? What problem follows from it, and what now stands to be lost?",
            "Thematic pressure — What deeper question does the problem raise? Which credible counter-position challenges the protagonist's current belief or strategy?",
            "Want / commitment — What does the protagonist consciously want now? Which choice commits them to a more difficult situation?",
            "First plan — What strategy do they try first? What action follows, and what new obstacle or unintended consequence does that action create?",
            "Adaptation — How do they revise the plan? What does the revision reveal about their priorities, fear, belief or willingness to pay a cost?",
            "New world / changed conditions — What unfamiliar situation, relationship or rule must they learn to navigate? Which opportunities and dangers become visible only after commitment?",
            "Escalation — Which actions intensify the conflict? What additional problems arise because of the protagonist's own choices rather than arriving randomly?",
            "Revelation — What new information changes the meaning of the pursuit? How does the protagonist reinterpret the problem, opposition, stakes or themselves?",
            "Mid-story reassessment — Which meaningful choice changes direction, leverage or strategy? What becomes harder, more personal or less reversible afterward?",
            "Consequences — What direct practical, emotional and relationship results now follow from earlier decisions? Which new complications are caused by those results?",
            "Crisis / severe pressure — What live options remain when the current strategy becomes costly or fails? What fear, moral dilemma, self-doubt or contradiction becomes impossible to avoid?",
            "Reflection / insight — What questions does the protagonist ask about their beliefs and actions? What realization, refusal or renewed commitment changes the next plan?",
            "Preparation for climax — What new plan follows from what has been learned? How does preparation demonstrate change, steadfastness, corruption, recovery or tragic refusal?",
            "Climax proof — What decisive challenge tests the protagonist's strategy or belief? What choice supplies the clearest evidence of who they are now?",
            "Aftermath / new normal — What are the practical and emotional consequences of the climax? How have relationships, systems or the world changed?",
            "Remaining business — Which questions or conflicts still matter after the main confrontation? What action, if any, is required to resolve or deliberately leave them open?",
            "Final choice / final obstacle — Does one last decision clarify the arc, relationship or thematic argument? If there is another confrontation, what distinct dramatic job does it perform?",
            "Ending state — What is the new equilibrium? What has changed, what has not changed, and what does the ending make the audience reconsider about the opening?",
            "Closing image — What final image, action, relationship or condition best expresses the ending? A mirror of the opening can be useful, but contrast is a tool rather than a requirement.",
          ],
        },
      ],
    };
  }

  if (lesson.id === "characters-conflict") {
    return {
      ...lesson,
      sections: [
        ...lesson.sections,
        {
          heading: "Keep the traditional conflict names discoverable",
          paragraphs: [
            "Older screenwriting texts often use gendered labels such as Man vs Man, Man vs Self, Man vs Nature and Man vs Machine. PlotPickle uses person- or pressure-based language as the primary terminology, but the traditional names remain useful search aliases because writers will still encounter them in books, classes and source material.",
            "The old labels describe sources of pressure, not complete themes. A technology conflict becomes dramatically specific only when it tests dependency, freedom, identity, work, control, safety or another value. An internal conflict becomes playable only when competing beliefs or desires change behaviour.",
          ],
          points: [
            "Person vs person / relationship — traditionally Man vs Man: family conflict, rivalry, love, betrayal, incompatible goals, power struggles and moral disagreement between people.",
            "Person vs self — traditionally Man vs Himself or Man vs Self: fear, self-doubt, shame, addiction, conflicting loyalties, moral dilemmas, self-worth and competing desires that alter choices.",
            "Person vs environment / nature — often called Man vs Nature: climate, terrain, illness, isolation, disaster, scarcity or physical conditions that constrain action and expose strategy.",
            "Person vs technology / constructed system — traditionally Man vs Machine: automation, artificial intelligence, tools, infrastructure or designed systems that create questions about control, dependency, capability, freedom and human values.",
            "Person vs group / institution / society — often folded into Man vs Other or Man vs Society: families, communities, organizations, laws, norms, ideologies or us-versus-them divisions that pressure belonging and agency.",
            "Person vs time / history / fate / expectation — deadlines, inherited consequences, irreversible history, prophecy or social expectations can function as pressure when they narrow meaningful choices.",
          ],
        },
      ],
      definitions: [
        ...lesson.definitions,
        {
          term: "Traditional conflict taxonomy",
          meaning: "Legacy labels such as Man vs Man, Man vs Self, Man vs Nature and Man vs Machine; useful as search vocabulary, but not a complete or mandatory theory of conflict.",
        },
      ],
    };
  }

  if (lesson.id === "characters-opposition") {
    return {
      ...lesson,
      sections: [
        ...lesson.sections,
        {
          heading: "Recognize thesis, antithesis and synthesis",
          paragraphs: [
            "A common screenwriting shorthand describes a dialectical movement as thesis, antithesis and synthesis. These terms are frequently associated with Hegelian dialectics, although Hegel did not present this exact three-word formula as a screenplay method. Use the vocabulary as an optional thinking lens, not as required architecture.",
          ],
          points: [
            "Thesis — the starting position, belief, strategy or status quo currently treated as workable.",
            "Antithesis — a contradiction, counter-position, event or opposing force that exposes limits in the starting position.",
            "Synthesis — a changed understanding or new condition produced by the conflict; a story may instead end in refusal, tragedy, stalemate or unresolved tension.",
            "Antagonist — the principal opposing person or force in a particular dramatic line; complexity comes from objective, leverage, self-justification and the ability to initiate action.",
            "Rival — a character pursuing the same or a competing prize, status, relationship or outcome; rivalry may be hostile, respectful, intimate or temporary.",
            "Foil — a contrasting character whose strategy, values or behaviour make another character easier to understand; a foil need not be an enemy.",
          ],
        },
      ],
      definitions: [
        ...lesson.definitions,
        { term: "Thesis", meaning: "The starting position, belief, strategy or condition examined by a dialectical lens." },
        { term: "Antithesis", meaning: "The counter-position or contradiction that challenges the starting position." },
        { term: "Synthesis", meaning: "A resulting changed understanding or condition; useful as a possibility, not a required ending." },
        { term: "Rival", meaning: "A character whose pursuit competes with another character for an outcome, status, relationship, resource or value." },
      ],
    };
  }

  if (lesson.id === "characters-relationships") {
    return {
      ...lesson,
      sections: [
        ...lesson.sections,
        {
          heading: "Use relationship patterns as lenses, not templates",
          paragraphs: [
            "The legacy Character material names recurring relationship patterns because they help writers notice pressure. Preserve the vocabulary without assuming every mentor, family bond, romance or rivalry must behave the same way. The dramatic question is what each person wants, fears, withholds and changes in the other.",
          ],
          points: [
            "Chemistry — an engaging interaction pattern created by attention, contrast, shared history, complementary traits, friction, curiosity or emotional risk; it is not limited to romance.",
            "Mentor–pupil — knowledge and authority move through a relationship, but dependence, rebellion, disappointment and the mentor's own blind spots can complicate the transfer.",
            "Loyalty and betrayal — loyalty creates expectations and leverage; betrayal matters because a prior bond, promise or dependency gives the breach a cost.",
            "Parent, sibling and chosen-family dynamics — history, obligation, comparison, protection, rivalry and inherited roles can make the same event mean different things to each person.",
            "Companionship and rivalry — friendship and competition can coexist; shared goals may strengthen a bond while incompatible methods or recognition needs create pressure.",
            "Power dynamics — status, expertise, money, access, institutional authority, secrecy, dependency or social position affect who can ask, refuse, leave, punish or protect.",
            "Shared experience — common history can create shorthand and trust, but the same event may be remembered differently and become a source of conflict.",
            "Conflict and repair — disagreement can reveal needs and boundaries; repair becomes meaningful when behaviour, trust or access changes rather than when characters merely declare reconciliation.",
          ],
        },
      ],
      definitions: [
        ...lesson.definitions,
        {
          term: "Character chemistry",
          meaning: "The pattern of attention, contrast, affinity, friction and response that makes interactions between particular characters dramatically alive.",
        },
      ],
    };
  }

  if (lesson.id === "characters-voiceprint") {
    return {
      ...lesson,
      sections: [
        ...lesson.sections,
        {
          heading: "Trace the influences on voice",
          paragraphs: [
            "The original Character Guide emphasizes that voice grows from lived context as well as personality. Background, region, family, education, work, expertise and social position can influence vocabulary, references, rhythm and conversational assumptions. Use those factors as research questions, never as permission to reduce a community or identity to a stock accent.",
          ],
          points: [
            "Origin and environment — which places, communities and routines shaped what the character notices or assumes?",
            "Education and expertise — what can the character name precisely, explain casually or misunderstand outside their field?",
            "Profession and role — which habits of speech, evidence, command, persuasion or caution come from repeated work?",
            "Personality and worldview — what do they find funny, threatening, obvious, shameful, admirable or worth arguing about?",
            "Relationship and status — who receives directness, deference, teasing, silence, over-explanation or guarded language?",
            "Pressure and emotional access — which parts of the Voiceprint tighten, fracture, disappear or become more revealing under stress?",
            "Vocabulary and idiom — choose specific domains, metaphors and phrase patterns from character evidence and research rather than demographic shorthand.",
          ],
        },
      ],
    };
  }

  if (lesson.id === "characters-cast-system") {
    return {
      ...lesson,
      sections: [
        ...lesson.sections,
        {
          heading: "Recognize traditional archetype vocabulary",
          paragraphs: [
            "Traditional archetype names remain useful reference vocabulary even when PlotPickle prefers flexible dramatic functions. A character may combine several functions, abandon one, reverse one or refuse the pattern entirely. Treat the names as lenses for comparison, not identity boxes or required cast slots.",
          ],
          points: [
            "Hero / protagonist — the central pursuing or changing figure in a dramatic line; not necessarily morally heroic.",
            "Mentor — a guide, teacher or inherited worldview; the function may help, mislead, fail or be outgrown.",
            "Villain / antagonist — a traditional label for strong opposition; prefer objective, agency and worldview over treating villainy as a complete personality.",
            "Antihero — a protagonist who lacks conventional heroic qualities or pursues the story through morally complicated methods.",
            "Sidekick / ally — a supporting relationship that assists, challenges, witnesses or complicates the central pursuit rather than existing only to agree.",
            "Trickster / jester — a disruptive or comic function that can expose rules, hypocrisy, status or hidden information through reversal and play.",
            "Shapeshifter — a traditional label for uncertain allegiance or changing apparent motives; preserve actual motivation and evidence rather than using ambiguity as a substitute for character logic.",
            "Outcast / everyman — lenses for social position or audience identification: one stands at the edge of a community, while the other emphasizes ordinary perspective under unusual pressure.",
            "Herald — a person, message or event that announces disruption, opportunity or a call into a changed situation.",
            "Threshold guardian — a person, rule, institution or obstacle that tests access, commitment, readiness or strategy before further movement.",
            "Shadow — a lens for feared, denied or destructive possibilities embodied by a person, system or part of the protagonist's own strategy; do not reduce it to 'evil twin.'",
            "Damsel / rescue figure — a dated, gendered label for a character placed in danger so another can rescue them. Keep the historical term searchable, but analyze agency, vulnerability, objective and consequence rather than treating rescue as an identity.",
          ],
        },
        {
          heading: "Keep the useful character-pattern library",
          paragraphs: [
            "The legacy archive also collected recurring character pressures and narrative patterns. Their value is generative, not predictive: none guarantees popularity or commercial success. Use them to ask what kind of pressure, relationship or change might make a character more specific.",
          ],
          points: [
            "Sacrifice and adversity — self-sacrifice; overcoming adversity; survival instincts; wisdom through suffering.",
            "Competing drives — juxtaposed motivations; loyalty and betrayal; pursuit of justice; pursuit of power; freedom and oppression.",
            "Arc possibilities — evolution and transformation; quest for identity; inner demons and redemption; villain redemption; hero's fall and rise; tragic flaw as a pressure pattern rather than a mandatory defect.",
            "Hero-position variations — antihero; reluctant hero; everyman; outsider; unfamiliar nomad.",
            "Relationship patterns — mentor–pupil; mentor's shadow; parental and sibling dynamics; forbidden love; companionship and rivalry.",
            "Status and community — power dynamics; distinctive microcosm; grand tale / minor narrative; a character's place inside or outside a social system.",
            "Tonal and intellectual contrast — humour and wit; intellectualism and absurdity; contrasting strategies or values that make character choices more legible.",
          ],
        },
        {
          heading: "Give supporting and non-human characters full dramatic logic",
          paragraphs: [
            "A smaller role still needs a reason to exist. Define what the character changes, reveals, carries, witnesses, enables or prevents. Supporting characters need enough motivation and relationship specificity to avoid feeling like plot furniture, but they do not all need protagonist-sized biographies.",
            "Non-human characters may be animals, creatures, robots, artificial intelligences, aliens or other beings. Preserve what makes them genuinely different while giving them coherent drives, capabilities, limitations, relationships and consequences. Relatability does not require making every non-human character psychologically identical to a person.",
          ],
          points: [
            "Minor characters — name the story function, relationship, motivation and the consequence of removing the role.",
            "Avoid stereotype shorthand — specificity in behaviour, context and agency matters more than a stock role label.",
            "Entrances — a first appearance can establish objective, status, contradiction, ability, vulnerability, relationship or effect on the room through action rather than biography.",
            "Exits — a departure can transfer information, remove support, change status, leave a question, create absence or complete a relationship movement; do not waste the final impression.",
            "Non-human rules — abilities, traits and limitations should remain consistent until story events clearly justify change.",
            "Non-human meaning — difference can create unique conflict, perspective, symbolism or thematic pressure; do not use the character only as decoration or exposition machinery.",
          ],
        },
      ],
      definitions: [
        ...lesson.definitions,
        {
          term: "Archetype",
          meaning: "A recurring dramatic pattern or function used as a lens for comparison; it is not a complete identity, personality or mandatory cast position.",
        },
        {
          term: "Supporting-character function",
          meaning: "The specific change, pressure, relationship, information, witness role or consequence a supporting character contributes to the story.",
        },
      ],
    };
  }

  return lesson;
}

const withIssue2094LearnerIntegration = (documents: readonly TopicDocument[]): readonly TopicDocument[] => documents.map((document) => {
  if (document.topic.id === "industry") {
    return {
      ...document,
      lessons: document.lessons.map(integrateIndustryLesson),
    };
  }
  if (document.topic.id === "character") {
    return {
      ...document,
      lessons: document.lessons.map(integrateCharacterFidelity),
    };
  }
  return document;
});

export const canonicalTopicDocuments = withIssue2094LearnerIntegration(
  withIssue1976CanonicalEnrichment(baseTopicDocuments),
);
const archive = canonicalTopicDocuments.flatMap((document) => document.lessons).sort(compareVisualWriterCurriculumOrder);
const sourceIds = archive.flatMap((lesson) => lesson.sources.map((source) => source.id));
const expectedArchiveLessons = index.lessonCount + ISSUE_1976_CANONICAL_LESSON_COUNT;
if (archive.length !== expectedArchiveLessons || archive.length !== 89) throw new Error(`Expected ${expectedArchiveLessons} PlotPickle lessons, found ${archive.length}.`);
if (sourceIds.length !== index.sourceCount || sourceIds.length !== 95 || new Set(sourceIds).size !== sourceIds.length) throw new Error(`Expected ${index.sourceCount} unique embedded lesson sources, found ${sourceIds.length}.`);

const standalonePlotPickleCurriculum: readonly CurriculumLesson[] = canonicalTopicDocuments
  .flatMap((document) => document.topic.id === "foundations" ? buildDeepFoundationCurriculum(document.lessons) : document.lessons)
  .sort(compareVisualWriterCurriculumOrder);

const standaloneFoundations = standalonePlotPickleCurriculum.filter((lesson) => lesson.topic === "foundations");
const foundationSourceIds = standaloneFoundations.flatMap((lesson) => lesson.sources.map((source) => source.id));
const standaloneSourceIds = standalonePlotPickleCurriculum.flatMap((lesson) => lesson.sources.map((source) => source.id));
if (standalonePlotPickleCurriculum.length !== 96 || standaloneFoundations.length !== 11) throw new Error(`Expected 96 presentation lessons with 11 Foundations lessons, found ${standalonePlotPickleCurriculum.length} and ${standaloneFoundations.length}.`);
if (foundationSourceIds.length !== FOUNDATION_PROMOTED_SOURCE_IDS.length || new Set(foundationSourceIds).size !== foundationSourceIds.length || FOUNDATION_PROMOTED_SOURCE_IDS.some((sourceId) => !foundationSourceIds.includes(sourceId))) throw new Error(`Expected all ${FOUNDATION_PROMOTED_SOURCE_IDS.length} canonical Foundations sources to remain attached to their presentation lessons.`);
for (const sourceId of FOUNDATION_PROMOTED_SOURCE_IDS) {
  const archiveLesson = standaloneFoundations.find((lesson) => lesson.sources.some((source) => source.id === sourceId));
  const coverage = FOUNDATION_SOURCE_COVERAGE[sourceId];
  if (!archiveLesson || !coverage || archiveLesson.title !== coverage.archiveLesson) throw new Error(`Foundations source ${sourceId} is missing its audited archive and teaching-destination coverage.`);
}
if (standaloneFoundations.some((lesson, position) => lesson.number !== position + 1)) throw new Error("Foundations presentation lessons must be numbered sequentially from 1 to 11.");
if (standaloneSourceIds.length !== 95 || new Set(standaloneSourceIds).size !== standaloneSourceIds.length) throw new Error(`Expected all 95 unique embedded presentation references, found ${standaloneSourceIds.length}.`);

export { standalonePlotPickleCurriculum as plotPickleCurriculum };
