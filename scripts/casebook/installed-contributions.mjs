import { defineBusinessCaseContribution } from "./business-case-registry.mjs";

const explicitContributions = Object.freeze({
  "buzz-connect-existing-identity": {
    version: "1.0.0",
    ownerId: "org.plotpickle.core",
    capability: "buzz.identity.connect-existing",
    prerequisiteCapabilities: ["profile.authenticated-human"],
    setupRef: "casebook.fixture.authenticated-human",
    cleanupRef: "casebook.cleanup.restore-buzz-test-identity",
    semanticActions: ["open-profile-buzz", "enter-existing-key", "verify-signer", "persist-connected", "open-community"],
    humanGates: ["human-only-buzz-private-key-entry"],
    productionFulfillmentRef: "profile.buzz.connect-existing-identity",
    uatAdapterRef: "creative-uat.phase3b3.buzz-connect-existing-identity",
  },
  "buzz-great-hall-signed-conversation": {
    version: "1.0.0",
    ownerId: "org.plotpickle.playhouse",
    capability: "community.great-hall.signed-conversation",
    prerequisiteCapabilities: ["buzz.identity.connected-human"],
    setupRef: "casebook.fixture.connected-buzz-human",
    cleanupRef: "casebook.cleanup.remove-disposable-great-hall-message",
    semanticActions: ["open-great-hall", "send-message", "observe-signed-event", "read-back", "reload-and-confirm"],
    humanGates: [],
    productionFulfillmentRef: "plotpickle-playhouse.great-hall.signed-conversation",
    uatAdapterRef: "creative-uat.phase3b3.buzz-great-hall-signed-conversation",
  },
  "comfyui-local-image-visible": {
    version: "1.0.0",
    ownerId: "org.plotpickle.ai-provider",
    capability: "image-generation.comfyui.local-visible-output",
    prerequisiteCapabilities: ["local-runtime.comfyui"],
    setupRef: "casebook.fixture.comfyui-local-runtime",
    cleanupRef: "casebook.cleanup.remove-test-image-output",
    semanticActions: ["configure-comfyui", "start-or-connect", "verify-prerequisites", "run-test-image", "observe-output-asset", "render-output", "enable-local-route"],
    humanGates: ["human-only-native-comfyui-startup"],
    productionFulfillmentRef: "settings.comfyui.local-image-generation",
    uatAdapterRef: "casebook-attended-live.comfyui-local-image-visible",
  },
});

function legacyContribution(caseDefinition) {
  return defineBusinessCaseContribution({
    businessCaseId: caseDefinition.id,
    version: "1.0.0",
    title: caseDefinition.title,
    ownerId: `org.plotpickle.legacy.${caseDefinition.domain}`,
    capability: `legacy.${caseDefinition.domain}.${caseDefinition.id}`,
    prerequisiteCapabilities: [],
    semanticActions: (caseDefinition.humanJourney || []).map((step) => step.id),
    humanGates: [],
    productionFulfillmentRef: `legacy.production.${caseDefinition.id}`,
    uatAdapterRef: `legacy.uat.${caseDefinition.id}`,
    migrationState: "legacy",
    caseDefinition,
  });
}

export function installedBusinessCaseContributions(casebook) {
  const cases = Array.isArray(casebook?.cases) ? casebook.cases : [];
  return cases.map((caseDefinition) => {
    const metadata = explicitContributions[caseDefinition.id];
    if (!metadata) return legacyContribution(caseDefinition);
    return defineBusinessCaseContribution({
      businessCaseId: caseDefinition.id,
      title: caseDefinition.title,
      ...metadata,
      caseDefinition,
    });
  });
}
