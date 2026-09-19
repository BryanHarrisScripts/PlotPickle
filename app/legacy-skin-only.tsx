"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import DemoOnboardingBoundary from "./profile-access/demo/demo-onboarding-boundary";
import { isCanonicalSkinV1Path } from "./skin-v1-route-contract";

export function LegacyDemoBoundary({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  if (isCanonicalSkinV1Path(pathname)) return <>{children}</>;
  return <DemoOnboardingBoundary>{children}</DemoOnboardingBoundary>;
}

export function LegacySkinOnly({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  if (isCanonicalSkinV1Path(pathname)) return null;
  return <>{children}</>;
}
