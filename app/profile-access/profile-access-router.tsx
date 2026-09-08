"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import ProfileAccessBoundary from "./profile-access-boundary";

function isSkinV1Path(pathname: string) {
  return pathname === "/skin-v1" || pathname.startsWith("/skin-v1/");
}

/**
 * Authentication authority remains shared, but its presentation is skin-owned.
 * Legacy routes keep the existing ProfileAccessBoundary. Skin V1 renders LOGON
 * through the headless Experience use case instead.
 */
export default function ProfileAccessRouter({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  if (isSkinV1Path(pathname)) return <>{children}</>;
  return <ProfileAccessBoundary>{children}</ProfileAccessBoundary>;
}
