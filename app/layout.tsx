import type { Metadata } from "next";
import AppearanceRuntime from "./appearance-runtime";
import BuildAssemblyStudio from "./build-assembly-studio";
import CollaborationWorkspaceRouter from "./collaboration-workspace-router";
import CommonOverlayLayer from "./common-overlay-layer";
import CurrentDownloadLinks from "./current-download-links";
import FeedbackStudioHost from "./feedback-studio-host";
import GitHubAppReleaseGuidance from "./github-app-release-guidance";
import GraphicNovelBuildHandoff from "./graphic-novel-build-handoff";
import GraphicNovelStudioHost from "./graphic-novel-studio-host";
import GraphicNovelTerminology from "./graphic-novel-terminology";
import LearnEntryRouter from "./learn-entry-router";
import PlanStudioRailHost from "./plan-studio-rail-host";
import StoryboardNavigationGroupsHost from "./storyboard-navigation-groups-host";
import StoryboardPlanIntentionHost from "./storyboard-plan-intention-host";
import StoryboardStudioHost from "./storyboard-studio-host";
import StoryboardWriteHandoff from "./storyboard-write-handoff";
import WriteEditHandoff from "./write-edit-handoff";
import WriteStudioHost from "./write-studio-host";
import WorkspaceIntroHost from "./workspace-intro-host";
import WriterFacingCollaborationLanguage from "./writer-facing-collaboration-language";
import UiContinuityAnchor from "./ui-continuity-anchor";
import "./design-tokens.css";
import "./globals.css";
import "./engines-workspace-overrides.css";
import "./navigation-additions.css";
import "./ui-ux-cleanup.css";
import "./engine-ux-cleanup.css";
import "./premium-ui.css";
import "./minimal-navigation.css";
import "./issue-208-polish.css";
import "./first-run-configuration-dashboard.css";
import "./appearance-runtime.css";
import "./studio-shell-phase-a.css";
import "./learning-studio-phase-b.css";
import "./learning-studio-phase-b-compat.css";
import "./learn-first-phase-528.css";
import "./plan-studio-phase-c.css";
import "./plan-studio-editors.css";
import "./plan-studio-editor-polish.css";
import "./storyboard-studio-phase-d.css";
import "./phase-a-visual-writing-screens.css";
import "./phase-b-visual-writing-screens.css";
import "./storyboard-studio-polish.css";
import "./storyboard-studio-deeplink.css";
import "./storyboard-navigation-groups.css";
import "./storyboard-write-handoff.css";
import "./write-studio-phase-c.css";
import "./write-studio-treatment.css";
import "./write-studio-progressive.css";
import "./write-edit-handoff.css";
import "./edit-decision-panel.css";
import "./graphic-novel-studio.css";
import "./graphic-novel-build-handoff.css";
import "./build-assembly-studio.css";
import "./feedback-studio.css";
import "./learn-first-phase-528-rendered.css";
import "./learn-first-phase-528-core-polish.css";
import "./studio-surface-continuity.css";
import "./ui-continuity-anchor.css";
import "./approved-visual-system.css";
import "./learn-lesson-formatting.css";

const LEARN_BRAND_GLYPH_STYLES = `
nav[aria-label="PlotPickle workflow"]::before {
  position: absolute;
  z-index: 1;
  top: 5px;
  left: 14px;
  width: 58px;
  height: 58px;
  background: linear-gradient(145deg, #c89446 0 34%, #35c9b8 48%, #9d783d 70%);
  clip-path: polygon(50% 0, 92% 24%, 92% 76%, 50% 100%, 8% 76%, 8% 24%);
  content: "";
  filter: drop-shadow(0 0 8px rgba(53, 201, 184, 0.18));
  opacity: 0.82;
  pointer-events: none;
}

nav[aria-label="PlotPickle workflow"] > img[alt="PlotPickle"] {
  position: absolute !important;
  z-index: 2 !important;
  top: 8px !important;
  right: auto !important;
  left: 17px !important;
  display: block !important;
  width: 52px !important;
  height: 52px !important;
  padding: 6px !important;
  background:
    radial-gradient(circle at 50% 32%, rgba(200, 148, 70, 0.14), transparent 48%),
    #0d0f10 !important;
  clip-path: polygon(50% 0, 92% 24%, 92% 76%, 50% 100%, 8% 76%, 8% 24%) !important;
  object-fit: contain !important;
  filter:
    saturate(0.92)
    brightness(0.98)
    drop-shadow(0 0 7px rgba(53, 201, 184, 0.28)) !important;
}

@media (max-width: 920px) {
  nav[aria-label="PlotPickle workflow"]::before {
    top: 7px;
    left: 9px;
    width: 50px;
    height: 50px;
  }

  nav[aria-label="PlotPickle workflow"] > img[alt="PlotPickle"] {
    top: 10px !important;
    left: 12px !important;
    width: 44px !important;
    height: 44px !important;
    padding: 5px !important;
  }
}
`;

export const metadata: Metadata = {
  title: "PlotPickle - AI-native Visual Writing and Creative Direction",
  description:
    "Shape the story, see the world and direct what comes next. PlotPickle connects concepts, writing, visual exploration, human approval and reusable storyworld canon in one portable PPF project.",
  other: {
    "codex-preview": "development",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/favicon/plotpickle-ouroboros-v2-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon/plotpickle-ouroboros-v2-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/favicon/plotpickle-ouroboros-v2-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/brand/favicon/plotpickle-ouroboros-v2.ico",
    apple: "/brand/favicon/plotpickle-ouroboros-v2-180.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-plotpickle-startup={__PLOTPICKLE_STARTUP_CONTRACT__}
      data-plotpickle-theme="dark"
      suppressHydrationWarning
    >
      <body
        className="antialiased"
        style={{
          "--font-geist-sans":
            '\"Courier New\", \"Lucida Console\", \"Liberation Mono\", Consolas, monospace',
          "--font-geist-mono":
            '\"Courier New\", \"Lucida Console\", \"Liberation Mono\", Consolas, monospace',
        } as React.CSSProperties}
      >
        <style>{LEARN_BRAND_GLYPH_STYLES}</style>
        <AppearanceRuntime />
        {children}
        <UiContinuityAnchor />
        <LearnEntryRouter />
        <CommonOverlayLayer />
        <WriterFacingCollaborationLanguage />
        <GraphicNovelTerminology />
        <GraphicNovelStudioHost />
        <GraphicNovelBuildHandoff />
        <BuildAssemblyStudio />
        <FeedbackStudioHost />
        <GitHubAppReleaseGuidance />
        <CollaborationWorkspaceRouter />
        <PlanStudioRailHost />
        <StoryboardStudioHost />
        <StoryboardNavigationGroupsHost />
        <StoryboardPlanIntentionHost />
        <StoryboardWriteHandoff />
        <WriteStudioHost />
        <WriteEditHandoff />
        <WorkspaceIntroHost />
        <CurrentDownloadLinks />
      </body>
    </html>
  );
}
