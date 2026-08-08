import type { Metadata } from "next";
import AppearanceRuntime from "./appearance-runtime";
import CollaborationWorkspaceRouter from "./collaboration-workspace-router";
import CommonOverlayLayer from "./common-overlay-layer";
import CurrentDownloadLinks from "./current-download-links";
import GitHubAppReleaseGuidance from "./github-app-release-guidance";
import GraphicNovelTerminology from "./graphic-novel-terminology";
import LearnEntryRouter from "./learn-entry-router";
import PlanStudioRailHost from "./plan-studio-rail-host";
import StoryboardNavigationGroupsHost from "./storyboard-navigation-groups-host";
import StoryboardPlanIntentionHost from "./storyboard-plan-intention-host";
import StoryboardStudioHost from "./storyboard-studio-host";
import StoryboardWriteHandoff from "./storyboard-write-handoff";
import WorkspaceIntroHost from "./workspace-intro-host";
import WriterFacingCollaborationLanguage from "./writer-facing-collaboration-language";
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
import "./plan-studio-phase-c.css";
import "./plan-studio-editors.css";
import "./plan-studio-editor-polish.css";
import "./storyboard-studio-phase-d.css";
import "./storyboard-studio-polish.css";
import "./storyboard-studio-deeplink.css";
import "./storyboard-navigation-groups.css";
import "./storyboard-write-handoff.css";

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
      { url: "/brand/favicon/plotpickle-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon/plotpickle-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/favicon/plotpickle-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/brand/favicon/favicon.ico",
    apple: "/brand/favicon/apple-touch-icon-180.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-plotpickle-theme="dark" suppressHydrationWarning>
      <body
        className="antialiased"
        style={{
          "--font-geist-sans":
            '\"Courier New\", \"Lucida Console\", \"Liberation Mono\", Consolas, monospace',
          "--font-geist-mono":
            '\"Courier New\", \"Lucida Console\", \"Liberation Mono\", Consolas, monospace',
        } as React.CSSProperties}
      >
        <AppearanceRuntime />
        {children}
        <LearnEntryRouter />
        <CommonOverlayLayer />
        <WriterFacingCollaborationLanguage />
        <GraphicNovelTerminology />
        <GitHubAppReleaseGuidance />
        <CollaborationWorkspaceRouter />
        <PlanStudioRailHost />
        <StoryboardStudioHost />
        <StoryboardNavigationGroupsHost />
        <StoryboardPlanIntentionHost />
        <StoryboardWriteHandoff />
        <WorkspaceIntroHost />
        <CurrentDownloadLinks />
      </body>
    </html>
  );
}
