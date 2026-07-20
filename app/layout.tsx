import type { Metadata } from "next";
import EditionBanner from "./edition-banner";
import LocalRuntimeBridge from "./local-runtime-bridge";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlotPickle Online — 24 Blocks Story Planner",
  description:
    "Try PlotPickle Online or download the local-first story planning and visual board application built around the 24 Blocks screenwriting method.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <LocalRuntimeBridge />
        <EditionBanner />
        <div id="plotpickle-workspace">{children}</div>
      </body>
    </html>
  );
}
