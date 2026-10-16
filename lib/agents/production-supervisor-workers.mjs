// Canonical local production companion registry shared by Supervisor and health census.
// A registered script does not imply a started process or successful output.
export const PRODUCTION_SUPERVISOR_WORKERS = Object.freeze([
  { agentId: "full-story-builder", capability: "story-build", script: "scripts/full-story-builder-agent.mjs", acceptedJobTypes: ["story-build", "follow-up"] },
  { agentId: "visual-production", capability: "poster-and-image-production", script: "scripts/visual-production-agent.mjs", acceptedJobTypes: ["image", "follow-up"] },
  { agentId: "video-production", capability: "video-and-animatic-production", script: "scripts/video-production-agent.mjs", acceptedJobTypes: ["video", "follow-up"] },
  { agentId: "ui-continuity", capability: "ui-continuity", script: "scripts/ui-continuity-agent.mjs", acceptedJobTypes: ["ui-continuity", "follow-up"] },
  { agentId: "creative-writer-uat", capability: "uat", script: "scripts/run-creative-writer-uat.ps1", acceptedJobTypes: ["uat", "follow-up"] },
]);
