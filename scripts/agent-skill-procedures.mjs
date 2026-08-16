import { readAgentSkillProcedure } from './agent-skills.mjs';

export const PLOTPICKLE_AGENT_SKILL_IDS = Object.freeze({
  planFoundations: 'plan-foundations',
  writerInResidence: 'writer-in-residence',
  visualQa: 'visual-qa',
  buzzGuildhallReporting: 'buzz-guildhall-reporting',
});

const CONSUMER_SKILL = Object.freeze({
  'foundations-planner': PLOTPICKLE_AGENT_SKILL_IDS.planFoundations,
  'writer-in-residence': PLOTPICKLE_AGENT_SKILL_IDS.writerInResidence,
  'visual-qa': PLOTPICKLE_AGENT_SKILL_IDS.visualQa,
  'buzz-guildhall': PLOTPICKLE_AGENT_SKILL_IDS.buzzGuildhallReporting,
});

export function readPlanFoundationsProcedure() {
  return readAgentSkillProcedure(PLOTPICKLE_AGENT_SKILL_IDS.planFoundations);
}

export function readWriterInResidenceProcedure() {
  return readAgentSkillProcedure(PLOTPICKLE_AGENT_SKILL_IDS.writerInResidence);
}

export function readVisualQaProcedure() {
  return readAgentSkillProcedure(PLOTPICKLE_AGENT_SKILL_IDS.visualQa);
}

export function readBuzzGuildhallReportingProcedure() {
  return readAgentSkillProcedure(PLOTPICKLE_AGENT_SKILL_IDS.buzzGuildhallReporting);
}

export function readProcedureForConsumer(consumer) {
  const skillId = CONSUMER_SKILL[consumer];
  if (!skillId) {
    throw new Error(`No PlotPickle Agent Skill is registered for consumer: ${consumer}`);
  }
  return readAgentSkillProcedure(skillId);
}

export function listProcedureConsumers() {
  return Object.keys(CONSUMER_SKILL);
}
