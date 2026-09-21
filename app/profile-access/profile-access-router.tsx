"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import ProfileAccessBoundary from "./profile-access-boundary";
import { isPublicWebPath } from "../public-web-route";

function isSkinV1Path(pathname: string) {
  return pathname === "/skin-v1" || pathname.startsWith("/skin-v1/");
}

/**
 * Authentication authority remains shared, but its presentation is skin-owned.
 * Legacy routes keep the existing ProfileAccessBoundary. Skin V1 renders LOGON
 * through the headless Experience use case instead.
 */
export default function ProfileAccessRouter({ children, publicWebRoot = false }: { readonly children: ReactNode; readonly publicWebRoot?: boolean }) {
  const pathname = usePathname();
  if (publicWebRoot || isSkinV1Path(pathname) || isPublicWebPath(pathname)) return <>{children}</>;
  return <ProfileAccessBoundary>{children}</ProfileAccessBoundary>;
}
