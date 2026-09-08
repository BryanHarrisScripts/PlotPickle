"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import DemoOnboardingBoundary from "./profile-access/demo/demo-onboarding-boundary";

function skinV1(pathname: string) {
  return pathname === "/skin-v1" || pathname.startsWith("/skin-v1/");
}

export function LegacyDemoBoundary({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  if (skinV1(pathname)) return <>{children}</>;
  return <DemoOnboardingBoundary>{children}</DemoOnboardingBoundary>;
}

export function LegacySkinOnly({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  if (skinV1(pathname)) return null;
  return <>{children}</>;
}
