import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import CollaborationWorkspaceRouter from "./collaboration-workspace-router";
import CurrentDownloadLinks from "./current-download-links";
import GitHubAppReleaseGuidance from "./github-app-release-guidance";
import GraphicNovelTerminology from "./graphic-novel-terminology";
import WorkspaceIntroHost from "./workspace-intro-host";
import "./globals.css";
import "./engines-workspace-overrides.css";
import "./navigation-additions.css";
import "./ui-ux-cleanup.css";
import "./engine-ux-cleanup.css";
import "./premium-ui.css";
import "./minimal-navigation.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PlotPickle",
  description:
    "Download PlotPickle Playhouse: a local-first story planner connecting Project Overview, Story Planner, Structure Map, Visual Board, and guided specialist engines through Bryan Harris's 24 Blocks method.",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <GraphicNovelTerminology />
        <GitHubAppReleaseGuidance />
        <CollaborationWorkspaceRouter />
        <WorkspaceIntroHost />
        <CurrentDownloadLinks />
      </body>
    </html>
  );
}
