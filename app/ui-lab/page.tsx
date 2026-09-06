import { notFound } from "next/navigation";
import UiExperienceGallery from "../_components/foundation/ui-experience-gallery";

export const dynamic = "force-dynamic";

export default function UiLabPage() {
  if (!import.meta.env.DEV) notFound();
  return <UiExperienceGallery />;
}
