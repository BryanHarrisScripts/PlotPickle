/** Native storyteller procedure shared by the agent role and narration tasks. */
export const NARRATION_STORYTELLER_PROCEDURE = `Work as a storyteller adapting an existing story into sequential art. First interpret the whole story's central conflict, character desire and need, stakes, theme, causal arc and earned ending from supplied evidence. Then locate the selected Mini-Block: what pressure brings the characters here, what they want now, what choice or discovery changes their emotional state, and what consequence carries forward. Follow cause -> choice -> consequence; do not impose invented beats on missing material. Shape the 25 moments as a connected narrative with purposeful rhythm, tension, release and silence. Preserve viewpoint and audience knowledge: a future payoff may guide a setup but must not be revealed early. Use subtext, specific language and emotional progression; captions should add meaning the image cannot carry alone, never recite camera directions or redundantly label each image. Before returning a proposal, check continuity, motivation, setup/payoff order, repetition, clarity and whether fewer words or silence serves the moment better. Interpretive language remains a reviewable proposal, never new canon. Obey the task's output schema, exact screenplay dialogue and printed-text limits; keep this craft assessment internal when JSON alone is requested.`;

/** Saved story evidence only; proposals and operational project data stay out. */
export function narrationOverallStory(project) {
  const clean = (value, limit) => typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim().slice(0, limit) : '';
  const decisions = Object.entries(project?.storyDevelopment?.fields ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, field]) => field?.acceptedSource && clean(field.value, 1))
    .map(([field, value]) => `${clean(field, 100)}: ${clean(value.value, 500)}`)
    .join('\n').slice(0, 2400);
  const foundations = clean(project?.foundations?.brief?.content, 1600);
  const blocks = [...(project?.sourceEvidence?.storyMatrix?.blocks ?? [])]
    .filter(block => Number.isInteger(block.blockNumber) && block.blockNumber >= 1 && block.blockNumber <= 24)
    .sort((a, b) => a.blockNumber - b.blockNumber)
    .slice(0, 24)
    .map(block => ({ block: block.blockNumber, title: clean(block.title, 80), responsibility: clean(block.responsibility, 120) }));
  return { decisions, foundations, blocks };
}

export function validateNarrationOverallStory(value) {
  if (value === undefined) return undefined; // legacy request compatibility
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || typeof value.decisions !== 'string' || value.decisions.length > 2400
      || typeof value.foundations !== 'string' || value.foundations.length > 1600
      || !Array.isArray(value.blocks) || value.blocks.length > 24) throw new Error('Invalid overall story context.');
  let previous = 0;
  const blocks = value.blocks.map(block => {
    if (!block || !Number.isInteger(block.block) || block.block <= previous || block.block > 24
        || typeof block.title !== 'string' || block.title.length > 80
        || typeof block.responsibility !== 'string' || block.responsibility.length > 120) throw new Error('Invalid overall story block map.');
    previous = block.block;
    return { block: block.block, title: block.title, responsibility: block.responsibility };
  });
  return { decisions: value.decisions, foundations: value.foundations, blocks };
}
