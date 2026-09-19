import { publishedBlogPosts } from "@/lib/public-site/blog";

function xml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export async function GET() {
  const posts = publishedBlogPosts();
  const items = posts.map((post) => [
    "<item>",
    "<title>" + xml(post.title) + "</title>",
    "<link>https://plotpickle.com/blog/" + xml(post.slug) + "</link>",
    "<guid>https://plotpickle.com/blog/" + xml(post.slug) + "</guid>",
    "<pubDate>" + new Date(post.publishedAt + "T12:00:00Z").toUTCString() + "</pubDate>",
    "<description>" + xml(post.summary) + "</description>",
    "</item>"
  ].join("")).join("");
  const feed = '<?xml version="1.0" encoding="UTF-8"?>'
    + '<rss version="2.0"><channel><title>PlotPickle Blog</title>'
    + '<link>https://plotpickle.com/blog</link>'
    + '<description>OSS Radar, story technology and notes from building PlotPickle.</description>'
    + items + '</channel></rss>';
  return new Response(feed, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=300" } });
}
