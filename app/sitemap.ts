import type { MetadataRoute } from "next";
import { publishedBlogPosts } from "@/lib/public-site/blog";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://plotpickle.com";
  return [
    { url: base + "/", changeFrequency: "weekly", priority: 1 },
    { url: base + "/blog", changeFrequency: "daily", priority: 0.8 },
    { url: base + "/about", changeFrequency: "monthly", priority: 0.5 },
    { url: base + "/legal", changeFrequency: "yearly", priority: 0.3 },
    ...publishedBlogPosts().map((post) => ({
      url: base + "/blog/" + post.slug,
      lastModified: new Date(post.updatedAt + "T12:00:00Z"),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
