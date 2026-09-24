export type StoryboardFramePromptInput = Readonly<{
  title: string;
  blockNumber: number;
  miniBlockNumber: number;
  position: number;
  scene: string;
  beat: string;
  shot: string;
  source: string;
}>;

export function storyboardFramePrompt(input: StoryboardFramePromptInput) {
  const clean = (value: string) => value.trim().replace(/\s+/g, " ").slice(0, 1200);
  return [
    `Create one cinematic storyboard frame for ${clean(input.title) || "this story"}.`,
    `Block ${String(input.blockNumber).padStart(2, "0")}, Mini-Block ${input.miniBlockNumber}, position ${String(input.position).padStart(2, "0")}.`,
    input.scene ? `Observed scene: ${clean(input.scene)}.` : "No scene is mapped here; do not invent a scene.",
    input.beat ? `Authored beat: ${clean(input.beat)}.` : "No beat is authored here; do not invent a beat.",
    input.shot ? `Authored shot: ${clean(input.shot)}.` : "No shot is authored here; treat this as exploratory frame coverage.",
    input.source ? `Screenplay evidence: ${clean(input.source)}.` : "No screenplay passage is mapped here; use only the available story context.",
    "Show clear dramatic action and spatial continuity with established characters and locations. Black-and-white storyboard illustration, landscape composition, no dialogue, text, logos, or watermarks.",
    "Create one WebP visual candidate. Generation does not create a canonical Beat or Shot or approve the Frame.",
  ].join(" ");
}
