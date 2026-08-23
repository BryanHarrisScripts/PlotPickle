import { selectGraphicNovelAssetVersion } from "./graphic-novel-asset-versions";
import type { PlotPickleProject, ProjectAssetReference } from "./project";

export function approveGraphicNovelAssetVersion(
  project: PlotPickleProject,
  panelId: string,
  reference: ProjectAssetReference,
): PlotPickleProject {
  const selected = selectGraphicNovelAssetVersion(project, panelId, reference);
  const now = new Date().toISOString();
  return {
    ...selected,
    metadata: { ...selected.metadata, updatedAt: now },
    assets: {
      ...selected.assets,
      assets: selected.assets.assets.map((asset) => asset.id === reference.assetId ? {
        ...asset,
        approvedVariationId: reference.variationId,
        updatedAt: now,
        variations: asset.variations.map((variation) => variation.id === reference.variationId
          ? { ...variation, approval: "approved" as const }
          : variation),
      } : asset),
    },
  };
}
