
import type { PlotPickleProject } from "./project";

export const LOGLINE_RUBRIC_TOTAL = 20 as const;

export type LoglineRubricCriterion = {
  id: string;
  label: string;
  question: string;
  passed: boolean;
  guidance: string;
};

export type LoglineRubricResult = {
  score: number;
  total: typeof LOGLINE_RUBRIC_TOTAL;
  wordCount: number;
  band: "Needs rebuilding" | "Developing" | "Pitch-ready" | "Exceptional";
  criteria: LoglineRubricCriterion[];
};

const activeVerbs = ["must", "tries", "seeks", "fights", "risks", "sets out", "struggles", "races", "attempts", "pursues", "protects", "escapes", "discovers", "confronts"];
const concreteVerbs = ["steal", "save", "find", "escape", "expose", "stop", "win", "rescue", "destroy", "cross", "return", "survive", "build", "solve", "uncover", "deliver", "prevent"];
const vagueWords = ["something", "things", "stuff", "somehow", "various", "a situation", "deals with", "learns about life"];

function words(value: string) {
  return value.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? [];
}

function includesAny(value: string, candidates: string[]) {
  const lower = value.toLowerCase();
  return candidates.some((candidate) => lower.includes(candidate.toLowerCase()));
}

function projectTerms(project: PlotPickleProject) {
  return [
    project.development.foundations.protagonist,
    project.development.foundations.objective,
    project.development.foundations.opposition,
    project.story.catalyst,
    project.story.stakes,
    project.metadata.genre,
    project.world.period,
    ...project.characters.slice(0, 3).flatMap((character) => [character.name, character.role]),
  ].filter((value) => value.trim().length > 2);
}

function item(id: string, label: string, question: string, passed: boolean, guidance: string): LoglineRubricCriterion {
  return { id, label, question, passed, guidance };
}

export function scoreLogline(project: PlotPickleProject, input: string): LoglineRubricResult {
  const text = input.replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  const wordCount = words(text).length;
  const names = project.characters.filter((character) => character.name && lower.includes(character.name.toLowerCase())).length;
  const hasProjectSpecificity = includesAny(text, projectTerms(project));
  const hasGoal = includesAny(text, activeVerbs) || includesAny(text, concreteVerbs);
  const hasOpposition = /\b(?:against|while|but|despite|opposed|pursued|hunted|blocked|threatened)\b/i.test(text) || includesAny(text, [project.development.foundations.opposition]);
  const hasStakes = /\b(?:before|or else|risk|lose|cost|failure|destroy|die|death|forever|last chance)\b/i.test(text) || includesAny(text, [project.story.stakes]);
  const criteria = [
    item("protagonist", "Identifiable protagonist", "Can we tell who carries the film?", /\b(?:a|an|the)\s+[\w-]+|\b[A-Z][a-z]+\b/.test(text) || names > 0, "Name or define the person whose choices drive the film."),
    item("specific-identity", "Specific identity", "Is the lead more specific than a generic hero?", hasProjectSpecificity || /\b(?:reluctant|disgraced|retired|young|aging|estranged|rookie|widowed|idealistic)\b/i.test(text), "Add a role, contradiction or defining condition."),
    item("disruption", "Catalytic disruption", "Does something break the ordinary world?", /\b(?:after|when|following|once|upon discovering|is forced)\b/i.test(text) || includesAny(text, [project.story.catalyst]), "Name the event that makes the story begin now."),
    item("active-goal", "Active visible goal", "Must the protagonist do something filmable?", hasGoal, "Use a concrete objective rather than a state of mind."),
    item("opposition", "Opposing force", "What makes the objective difficult?", hasOpposition, "Name the person, system, environment or inner strategy pushing back."),
    item("stakes", "Consequences of failure", "Why does success or failure matter?", hasStakes, "State the personal and external cost."),
    item("urgency", "Urgency or clock", "Why can the protagonist not wait?", /\b(?:before|within|by dawn|deadline|last|races?|countdown|until|hours?|days?)\b/i.test(text) || Boolean(project.development.foundations.urgency.trim()), "Add a deadline, narrowing window or escalating consequence."),
    item("central-conflict", "Central conflict", "Does the sentence promise sustained dramatic pressure?", hasGoal && hasOpposition, "Connect the goal directly to the force resisting it."),
    item("causal-chain", "Clear cause and effect", "Does disruption lead to mission and pressure?", /\b(?:after|when|once)\b.+\b(?:must|tries|sets out|races|seeks)\b/i.test(text), "Use a causal shape: after X, the lead must Y against Z."),
    item("irony", "Dramatic irony", "Is the lead poorly suited to this exact problem?", /\b(?:reluctant|unlikely|only|despite|forced to|must become|the last person)\b/i.test(text) || Boolean(project.development.pickle.signatureMove.trim()), "Expose the contradiction that makes this protagonist/story pairing compelling."),
    item("distinctive-world", "Distinctive world", "Could this only happen in this setting?", hasProjectSpecificity || Boolean(project.world.rules.trim() || project.world.technology.trim()), "Include one world rule, period detail or arena that changes the conflict."),
    item("genre-promise", "Genre promise", "Does the wording signal the expected experience?", includesAny(text, [project.metadata.genre, project.metadata.tone]) || /\b(?:murder|love|haunted|conspiracy|war|comedy|romance|thriller|horror|adventure|mystery)\b/i.test(text), "Signal the type of movie without listing genre labels mechanically."),
    item("emotional-hook", "Emotional hook", "Is there a human relationship, fear or longing?", /\b(?:love|family|daughter|son|mother|father|friend|trust|grief|home|identity|memory|belong|forgive)\b/i.test(text) || project.characters.some((character) => character.need && lower.includes(character.need.toLowerCase().split(/\s+/)[0])), "Name the personal wound, relationship or longing beneath the plot."),
    item("visual-potential", "Visual potential", "Can we imagine images and actions from the sentence?", includesAny(text, concreteVerbs) || /\b(?:city|island|ship|forest|station|arena|house|road|ocean|desert|machine)\b/i.test(text), "Prefer concrete actions and arenas over abstract explanation."),
    item("audience-question", "Compelling audience question", "Does the logline make us wonder how it will resolve?", hasGoal && hasStakes, "Create a visible objective with a difficult, consequential outcome."),
    item("concision", "Professional concision", "Is it focused enough to say in one breath?", wordCount >= 18 && wordCount <= 45, "Aim for roughly 18–45 words; remove secondary plot and backstory."),
    item("present-tense", "Present-tense drive", "Does it feel immediate rather than hypothetical?", !/\b(?:will|would|was|were going to)\b/i.test(text), "Use active present tense."),
    item("name-control", "Controlled proper names", "Can a listener follow it without a cast list?", names <= 2, "Use roles instead of naming more than one or two people."),
    item("specific-language", "Specific language", "Are the nouns and verbs precise?", !includesAny(text, vagueWords) && wordCount > 0, "Replace vague placeholders with exact actions, obstacles and costs."),
    item("ending-pressure", "Escalating final pressure", "Does the sentence end on danger, cost or distinction?", /(?:before|or|risk|against|while|—|but).{5,}[.!?]?$/i.test(text) || hasStakes, "End on the hardest pressure, irreversible cost or signature distinction."),
  ];
  const score = criteria.filter((criterion) => criterion.passed).length;
  const band = score >= 18 ? "Exceptional" : score >= 15 ? "Pitch-ready" : score >= 10 ? "Developing" : "Needs rebuilding";
  return { score, total: LOGLINE_RUBRIC_TOTAL, wordCount, band, criteria };
}
