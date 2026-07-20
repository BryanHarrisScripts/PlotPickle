import type { Metadata } from "next";
import LocalRuntimeBridge from "./local-runtime-bridge";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlotPickle — 24 Blocks Story Planner",
  description:
    "A local-first story planning and visual board application built around the 24 Blocks screenwriting method.",
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
        {children}
      </body>
    </html>
  );
}
