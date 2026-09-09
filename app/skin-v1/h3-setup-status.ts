export type H3ModelRequirement = {
  label: string;
  directory?: string;
  filenames?: string[];
  found?: string;
  ready: boolean;
};

export type H3SetupStatus = {
  active: boolean;
  allowConstrainedVram?: boolean;
  reachable: boolean;
  ready: boolean;
  manifestConfigured: boolean;
  compatibleVersion: boolean;
  minimumComfyUIVersion?: string;
  modelsReady: boolean;
  missingNodes: string[];
  modelRequirements: H3ModelRequirement[];
  workflowFamily: string;
  vramGiB: number;
  vramProfile: string;
  vramWarning: string;
  error: string;
};

export type H3SetupBlocker = {
  blocked: boolean;
  code: string;
  title: string;
  detail: string;
  action: string;
};

function firstMissingModel(status: H3SetupStatus) {
  return status.modelRequirements.find((item) => !item.ready) || null;
}

function expectedModelName(model: H3ModelRequirement | null) {
  if (!model) return "required MiniMax H3 model file";
  return model.filenames?.[0] || model.label || "required MiniMax H3 model file";
}

export function h3TextToVideoPrerequisitesReady(status: H3SetupStatus | null) {
  return Boolean(
    status?.reachable
    && status.manifestConfigured
    && status.workflowFamily === "text-to-video"
    && status.compatibleVersion
    && status.missingNodes.length === 0
    && status.modelsReady
    && status.vramProfile !== "impractical",
  );
}

export function deriveH3TextToVideoSetup(status: H3SetupStatus | null): H3SetupBlocker {
  if (!status) {
    return {
      blocked: true,
      code: "checking",
      title: "CHECKING LOCAL H3 SETUP",
      detail: "PlotPickle is checking ComfyUI, the text-to-video workflow and local H3 model files.",
      action: "Wait for the local status check to finish.",
    };
  }

  if (!status.reachable) {
    return {
      blocked: true,
      code: "comfyui-stopped",
      title: "COMFYUI SERVICE NOT RUNNING",
      detail: "MiniMax H3 uses PlotPickle's managed local ComfyUI service on 127.0.0.1:8188.",
      action: "Start the managed ComfyUI service, then check H3 again.",
    };
  }

  if (status.vramProfile === "impractical") {
    return {
      blocked: true,
      code: "gpu-below-minimum",
      title: "GPU BELOW LOCAL VIDEO MINIMUM",
      detail: `${status.vramGiB || 0} GB VRAM is below PlotPickle's local MiniMax H3 text-to-video floor.`,
      action: "Use a machine with at least an 8 GB-class GPU or use a cloud video route.",
    };
  }

  if (!status.manifestConfigured) {
    return {
      blocked: true,
      code: "workflow-missing",
      title: "TEXT-TO-VIDEO WORKFLOW NOT INSTALLED",
      detail: "PlotPickle has no reviewed MiniMax H3 text-to-video workflow manifest configured yet.",
      action: "Open Advanced Setup and import the reviewed official MiniMax H3 text-to-video workflow manifest.",
    };
  }

  if (status.workflowFamily !== "text-to-video") {
    return {
      blocked: true,
      code: "wrong-workflow",
      title: "TEXT-TO-VIDEO WORKFLOW REQUIRED",
      detail: `The configured H3 workflow is ${status.workflowFamily || "unknown"}; PlotPickle local VIDEO uses text-to-video only.`,
      action: "Replace it with the reviewed official MiniMax H3 text-to-video workflow manifest.",
    };
  }

  if (!status.compatibleVersion) {
    return {
      blocked: true,
      code: "comfyui-version",
      title: "COMFYUI VERSION UPDATE REQUIRED",
      detail: status.minimumComfyUIVersion
        ? `The H3 workflow requires ComfyUI ${status.minimumComfyUIVersion} or newer.`
        : "The configured H3 workflow requires a newer compatible ComfyUI version.",
      action: "Update the local ComfyUI installation, restart it, then check again.",
    };
  }

  if (status.missingNodes.length > 0) {
    const [first, ...rest] = status.missingNodes;
    return {
      blocked: true,
      code: "node-missing",
      title: `MISSING COMFYUI NODE: ${first}`,
      detail: rest.length ? `${rest.length + 1} required workflow nodes are missing. First missing node: ${first}.` : `${first} is required by the reviewed text-to-video workflow.`,
      action: "Install the required compatible node manually, restart ComfyUI, then check again.",
    };
  }

  if (!status.modelsReady) {
    const missing = firstMissingModel(status);
    const modelName = expectedModelName(missing);
    const location = missing?.directory ? `ComfyUI/models/${missing.directory}/` : "the required ComfyUI models folder";
    return {
      blocked: true,
      code: "model-missing",
      title: `MISSING H3 MODEL: ${modelName}`,
      detail: `${modelName} was not detected in ${location}.`,
      action: `Place the user-owned official H3 model file in ${location}, refresh ComfyUI, then check again.`,
    };
  }

  return {
    blocked: false,
    code: "ready",
    title: "TEXT-TO-VIDEO SETUP READY",
    detail: "ComfyUI, the reviewed H3 text-to-video workflow, required nodes and local H3 model files are present.",
    action: "Return to VIDEO and press RUN to activate the constrained local default.",
  };
}
