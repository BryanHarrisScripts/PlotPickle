import { publishedBlogPosts } from "@/lib/public-site/blog";

export async function GET() {
  const posts = publishedBlogPosts();
  const body = [
    "# PlotPickle",
    "",
    "PlotPickle is an open-source, local-first Story Operating System for writers.",
    "",
    "Canonical public origin: https://plotpickle.com",
    "Source: https://github.com/BryanHarrisScripts/PlotPickle",
    "Blog: https://plotpickle.com/blog",
    "RSS: https://plotpickle.com/blog/feed.xml",
    "Blog index: https://plotpickle.com/blog/index.json",
    "Source provenance: https://plotpickle.com/source.json",
    "",
    "## Published Blog posts",
    ...posts.map((post) => "- " + post.title + ": https://plotpickle.com/blog/" + post.slug),
    "",
    "Use this file for progressive discovery. Read individual pages only when relevant."
  ].join("\n");
  return new Response(body + "\n", { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" } });
}
