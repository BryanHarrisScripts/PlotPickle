import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: "https://plotpickle.com/sitemap.xml",
    host: "https://plotpickle.com",
  };
}
