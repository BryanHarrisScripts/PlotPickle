import { createRoot } from "react-dom/client";
import CommonOverlayLayer from "../../../app/common-overlay-layer";
import UiExperienceGallery from "../../../app/_components/foundation/ui-experience-gallery";
import "../../../app/design-tokens.css";
import "../../../app/globals.css";

const root = document.getElementById("root");
if (!root) throw new Error("UI experience verification fixture requires #root.");

createRoot(root).render(
  <>
    <UiExperienceGallery />
    <CommonOverlayLayer />
  </>,
);
