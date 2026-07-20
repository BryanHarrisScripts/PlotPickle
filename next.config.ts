import type { NextConfig } from "next";

const isLocalExport = process.env.PLOTPICKLE_LOCAL_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(isLocalExport
    ? {
        output: "export" as const,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
