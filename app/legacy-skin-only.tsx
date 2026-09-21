"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import DemoOnboardingBoundary from "./profile-access/demo/demo-onboarding-boundary";
import { isCanonicalSkinV1Path } from "./skin-v1-route-contract";
import { isPublicWebPath } from "./public-web-route";

type PublicWebBoundaryProps = { readonly children: ReactNode; readonly publicWebRoot?: boolean };

export function LegacyDemoBoundary({ children, publicWebRoot = false }: PublicWebBoundaryProps) {
  const pathname = usePathname();
  if (publicWebRoot || isCanonicalSkinV1Path(pathname) || isPublicWebPath(pathname)) return <>{children}</>;
  return <DemoOnboardingBoundary>{children}</DemoOnboardingBoundary>;
}

export function LegacySkinOnly({ children, publicWebRoot = false }: PublicWebBoundaryProps) {
  const pathname = usePathname();
  if (publicWebRoot || isCanonicalSkinV1Path(pathname) || isPublicWebPath(pathname)) return null;
  return <>{children}</>;
}
