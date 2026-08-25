import type { CurriculumGuideRequest } from "../../core/contracts/curriculum-guide";
import { parseSageMemoryCommand } from "../../core/memory/agent-memory-continuity";
import {
  forgetSageMemory,
  rememberSageMemory,
  retrieveSageMemory,
} from "../../core/memory/memory-browser";

export async function handleSageMemoryCommand(request: CurriculumGuideRequest) {
  const command = parseSageMemoryCommand(request.question);
  if (!command) return null;

  if (command.action === "remember") {
    await rememberSageMemory({
      scope: command.scope,
      projectId: request.projectMemory.id,
      content: command.content,
    });
    return command.scope === "human"
      ? "I’ll remember that as one of your writing preferences across your PlotPickle projects."
      : "I’ll remember that for this project. It stays contextual; your PPF remains the story authority.";
  }

  await forgetSageMemory({
    projectId: request.projectMemory.id,
    ...(command.mode === "matching" ? { query: command.query } : {}),
  });
  return "Forgotten. I won’t use that remembered context again.";
}

export async function sagePersistentMemoryText(request: CurriculumGuideRequest) {
  const result = await retrieveSageMemory(request.projectMemory.id, request.question);
  if (!result.retrieval.items.length) return "";
  return result.retrieval.items
    .map((memory) => `- ${memory.excerpt}`)
    .join("\n")
    .slice(0, 1_800);
}
