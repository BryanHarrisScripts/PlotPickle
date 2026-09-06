import { notFound } from "next/navigation";
import UiExperienceGallery from "../_components/foundation/ui-experience-gallery";

export const dynamic = "force-dynamic";

export default function UiLabPage() {
  if (process.env.NODE_ENV === "production" && process.env.PLOTPICKLE_UI_LAB !== "1") notFound();
  return <UiExperienceGallery />;
}
