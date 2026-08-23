export const FIRST_NAMES = ["Mara", "Theo", "Inez", "Callum", "Asha", "Jonah", "Noor", "Elian"];
export const SURNAMES = ["Vale", "Mercer", "Sato", "Quill", "Moreno", "Rook", "Avery", "Bell"];

const TITLE_FIRST = ["Glass", "Quiet", "Copper", "Winter", "Paper", "Hidden", "Salt", "Last"];
const TITLE_SECOND = ["Orchard", "Signal", "Harbour", "Atlas", "Lantern", "Current", "Garden", "Compass"];
const SETTINGS = ["a weather-beaten island observatory", "a lake town built around a silent mill", "a vertical city whose elevators remember every passenger", "a northern greenhouse settlement", "a coastal archive threatened by the tide", "a railway community at the end of its line"];

export function clean(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 4_000) : fallback;
}

export function hash(value) {
  let state = 2166136261;
  for (const character of String(value)) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  return state >>> 0;
}

export function pick(values, seed, offset = 0) {
  return values[(seed + offset * 2654435761) % values.length];
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
