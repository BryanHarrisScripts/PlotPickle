import { publicBlogSchemaVersion, publishedBlogPosts } from "@/lib/public-site/blog";

export async function GET() {
  return Response.json({
    schemaVersion: publicBlogSchemaVersion,
    canonical: "https://plotpickle.com/blog",
    posts: publishedBlogPosts().map((post) => ({
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      publishedAt: post.publishedAt,
      updatedAt: post.updatedAt,
      author: post.author,
      series: post.series,
      tags: post.tags,
      url: "https://plotpickle.com/blog/" + post.slug,
    })),
  });
}
