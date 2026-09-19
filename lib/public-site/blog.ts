import corpus from "@/content/blog/posts.json";

export type PublicBlogPost = (typeof corpus.posts)[number];

export function publishedBlogPosts() {
  return corpus.posts
    .filter((post) => post.status === "published")
    .slice()
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
}

export function publicBlogPost(slug: string) {
  return publishedBlogPosts().find((post) => post.slug === slug) ?? null;
}

export const publicBlogSchemaVersion = corpus.schemaVersion;
