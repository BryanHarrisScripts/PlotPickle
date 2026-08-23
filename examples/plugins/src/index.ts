import type { PluginModule, PluginContext } from "../../../sdk/plugin/src/index";

export type ExampleKind = "read-only" | "write" | "provider" | "exporter";

export type ExampleDefinition = {
  id: string;
  title: string;
  kind: ExampleKind;
  command: string;
  description: string;
};

function referencePlugin(definition: ExampleDefinition): PluginModule {
  return {
    activate(context: PluginContext) {
      context.registerCommand({
        id: definition.command,
        title: definition.title,
        handler: async (...args: unknown[]) => ({
          pluginId: definition.id,
          kind: definition.kind,
          status: "review-required",
          args,
        }),
      });

      context.registerMenu({
        location: "tools",
        command: definition.command,
        group: `examples.${definition.kind}`,
      });

      context.subscriptions.add(
        context.events.on("ProjectSaved", ({ projectId, savedAt }) => {
          void Promise.resolve({ pluginId: definition.id, projectId, savedAt });
        }),
      );
    },
  };
}

export const exampleDefinitions: ExampleDefinition[] = [
  { id: "plotpickle.hello", title: "Hello PlotPickle", kind: "read-only", command: "example.hello.inspect", description: "Minimal lifecycle, command, menu and event example." },
  { id: "plotpickle.github", title: "GitHub Collaboration", kind: "write", command: "example.github.snapshot", description: "Creates reviewable story snapshots without storing credentials in projects." },
  { id: "plotpickle.openai-compatible", title: "OpenAI-Compatible Provider", kind: "provider", command: "example.ai.openai.suggest", description: "Cloud AI provider contract with explicit human approval." },
  { id: "plotpickle.ollama", title: "Ollama Provider", kind: "provider", command: "example.ai.ollama.suggest", description: "Local provider example requiring no cloud account." },
  { id: "plotpickle.lm-studio", title: "LM Studio Provider", kind: "provider", command: "example.ai.lmstudio.suggest", description: "Local OpenAI-compatible endpoint example." },
  { id: "plotpickle.final-draft", title: "Final Draft Exchange", kind: "exporter", command: "example.export.fdx", description: "FDX import/export boundary with compatibility reporting." },
  { id: "plotpickle.fountain", title: "Fountain Exchange", kind: "exporter", command: "example.export.fountain", description: "Plain-text screenplay interchange example." },
  { id: "plotpickle.pdf", title: "PDF Publisher", kind: "exporter", command: "example.export.pdf", description: "Screenplay and report publishing example." },
  { id: "plotpickle.character-reports", title: "Character Reports", kind: "read-only", command: "example.report.characters", description: "Lines, words and scene participation report." },
  { id: "plotpickle.dialogue-analysis", title: "Dialogue Analysis", kind: "read-only", command: "example.report.dialogue", description: "Dialogue distribution and voice consistency analysis." },
  { id: "plotpickle.story-diagnostics", title: "Story Diagnostics", kind: "read-only", command: "example.report.story", description: "24-block and 96-mini-block diagnostic example." },
  { id: "plotpickle.image-provider", title: "Image Provider", kind: "provider", command: "example.image.generate", description: "Reviewable character and storyboard image generation." },
  { id: "plotpickle.music-provider", title: "Music Provider", kind: "provider", command: "example.music.generate", description: "Scene cue and temporary music generation contract." },
];

export const examplePlugins = Object.fromEntries(
  exampleDefinitions.map((definition) => [definition.id, referencePlugin(definition)]),
) as Record<string, PluginModule>;

export default examplePlugins;
