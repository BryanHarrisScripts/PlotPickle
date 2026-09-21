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

const MONTH_NUMBERS: Record<string, string> = {
  January: "01",
  February: "02",
  March: "03",
  April: "04",
  May: "05",
  June: "06",
  July: "07",
  August: "08",
  September: "09",
  October: "10",
  November: "11",
  December: "12",
};

export function publicBlogPostForDateHeading(heading: string) {
  const match = /^([A-Z][a-z]+) (\d{1,2}), (\d{4})$/.exec(heading);
  if (!match) return null;
  const [, monthName, day, year] = match;
  const month = MONTH_NUMBERS[monthName];
  if (!month) return null;
  const isoDate = `${year}-${month}-${day.padStart(2, "0")}`;
  return publicBlogPost(`oss-radar-${isoDate}`);
}

export const publicBlogSchemaVersion = corpus.schemaVersion;
