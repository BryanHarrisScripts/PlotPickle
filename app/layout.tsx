import type { Metadata } from "next";
import CollaborationWorkspaceRouter from "./collaboration-workspace-router";
import CurrentDownloadLinks from "./current-download-links";
import GitHubAppReleaseGuidance from "./github-app-release-guidance";
import GraphicNovelTerminology from "./graphic-novel-terminology";
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

export const metadata: Metadata = {
  title: "PlotPickle — Visual Storyworld Collaboration and Previsualization",
  description:
    "See the whole movie before you make it. PlotPickle is a visual storyworld collaboration and previsualization engine connecting story logic, canon, characters, scenes and visual direction in one portable PPF project and interactive Storyworld Map.",
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
    <html lang="en">
      <body
        className="antialiased"
        style={{
          "--font-geist-sans": "Arial, Helvetica, sans-serif",
          "--font-geist-mono": '"Courier New", Courier, monospace',
        } as React.CSSProperties}
      >
        {children}
        <WriterFacingCollaborationLanguage />
        <GraphicNovelTerminology />
        <GitHubAppReleaseGuidance />
        <CollaborationWorkspaceRouter />
        <WorkspaceIntroHost />
        <CurrentDownloadLinks />
      </body>
    </html>
  );
}