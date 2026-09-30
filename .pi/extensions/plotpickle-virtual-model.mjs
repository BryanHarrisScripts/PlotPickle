import {
  PI_DEVELOPER_LOGICAL_MODEL,
  choosePiDeveloperPhysicalRoute,
  readPiDeveloperRouteProjection,
} from "../../lib/agents/pi-developer-routing.mjs";

function lastUserText(messages) {
  const content = (Array.isArray(messages) ? messages : [])
    .filter((message) => message?.role === "user")
    .at(-1)?.content ?? "";
  if (typeof content === "string") return content.slice(0, 16_000);
  if (!Array.isArray(content)) return "";
  return content.flatMap((block) => block?.type === "text" ? [String(block.text || "")] : []).join("\n").slice(0, 16_000);
}

async function classifyRoute(request, ctx, projection) {
  const classifier = projection.classifier;
  if (!classifier?.enabled || request.reason !== "user") return "";
  if (!classifier.decisionKinds.includes("complexity")) return "";
  const model = ctx.modelRegistry.findOfType("classifier", classifier.provider, classifier.model);
  if (!model) return "";
  const result = await ctx.modelRegistry.classify(
    model,
    {
      state: { prompt: lastUserText(request.messages) },
      questions: {
        complexity: {
          type: "choice",
          instructions: "Classify only the engineering complexity of the prompt for routing among routes already authorized by PlotPickle.",
          criteria: {
            standard: "Ordinary implementation, review, or bounded repair work",
            complex: "Cross-cutting architecture, subtle debugging, or unusually demanding reasoning",
          },
        },
      },
    },
    { signal: request.signal },
  );
  const answer = result?.stopReason === "stop" ? result.answers?.complexity : undefined;
  return answer?.type === "choice" && (answer.probabilities?.complex ?? 0) >= 0.5 ? "complex" : "standard";
}

export default function plotpickleVirtualDeveloperModel(pi) {
  pi.registerVirtualModel({
    provider: PI_DEVELOPER_LOGICAL_MODEL.provider,
    id: PI_DEVELOPER_LOGICAL_MODEL.model,
    name: "PlotPickle Developer",
    thinkingLevels: ["off", "low", "medium", "high", "xhigh"],
    async route(request, ctx) {
      const projection = readPiDeveloperRouteProjection();
      const classifierChoice = await classifyRoute(request, ctx, projection);
      const route = choosePiDeveloperPhysicalRoute({ projection, request, classifierChoice });
      const model = ctx.modelRegistry.find(route.provider, route.model);
      if (!model) {
        throw new Error(`Authorized PlotPickle Pi route ${route.provider}/${route.model} is not in the current Pi model catalog.`);
      }
      return {
        model,
        thinkingLevel: route.thinkingLevel || request.thinkingLevel || "medium",
        state: {
          authority: projection.authority,
          routeId: route.id,
          category: classifierChoice || "unclassified",
        },
      };
    },
  });
}
