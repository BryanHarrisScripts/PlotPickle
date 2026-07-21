import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import CurrentDownloadLinks from "./current-download-links";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PlotPickle Playhouse — Download the 24 Blocks Story Planner",
  description:
    "Download PlotPickle Playhouse for Windows: a local-first story planner connecting Instructions, Story Planner, Visual Board, and a guided Engines workspace through Bryan Harris's 24 Blocks method.",
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
        <CurrentDownloadLinks />
      </body>
    </html>
  );
}
