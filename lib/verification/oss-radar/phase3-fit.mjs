const LANE_KIND = Object.freeze({
  "writer-craft": 1,
  "learn-education": 2,
  "visual-story": 3,
  "story-game-engine": 4,
  "ai-architecture": 5,
  "platform-engineering": 6,
});

export function phase3LaneKinds(candidate) {
  return [...new Set((candidate?.matchedLaneIds || []).map((lane) => LANE_KIND[lane]).filter(Boolean))].sort((a, b) => a - b);
}
