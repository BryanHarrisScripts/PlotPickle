"use client";

import surfaceRegistry from "@/config/skin-v1-surface-registry.json";

type RegistrySurface = {
  id: string;
  orchestrated?: boolean;
  runtimeRoute?: string;
};

function pathnameFromRoute(route: string) {
  const [withoutHash] = route.split("#", 1);
  const [pathname] = withoutHash.split("?", 1);
  return pathname || "/";
}

const ORCHESTRATED_DIRECT_PATHS = Object.freeze(
  Array.from(new Set(
    (surfaceRegistry.surfaces as RegistrySurface[])
      .filter((surface) => surface.orchestrated && surface.runtimeRoute)
      .map((surface) => pathnameFromRoute(surface.runtimeRoute!))
      .filter((pathname) => pathname !== "/"),
  )).sort(),
);

export function canonicalSkinV1DirectPaths() {
  return ORCHESTRATED_DIRECT_PATHS;
}

export function isCanonicalSkinV1Path(pathname: string) {
  return pathname === "/skin-v1"
    || pathname.startsWith("/skin-v1/")
    || ORCHESTRATED_DIRECT_PATHS.includes(pathname);
}
