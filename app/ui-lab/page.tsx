import { notFound } from "next/navigation";
import { UI_EXPERIENCE_LAB_ENABLED } from "../../build/ui-experience-lab-gate";
import UiExperienceGallery from "../_components/foundation/ui-experience-gallery";

export const dynamic = "force-dynamic";

export default function UiLabPage() {
  if (!UI_EXPERIENCE_LAB_ENABLED) notFound();
  return <UiExperienceGallery />;
}
