import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  publicBlogPost,
  publicBlogPostForDateHeading,
  publishedBlogPosts,
} from "@/lib/public-site/blog";
import styles from "../blog.module.css";

export function generateStaticParams() {
  return publishedBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = publicBlogPost(slug);
  if (!post) return {};
  return {
    title: post.title + " — PlotPickle",
    description: post.summary,
    alternates: { canonical: "https://plotpickle.com/blog/" + post.slug },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = publicBlogPost(slug);
  if (!post) notFound();
  return <div className={styles.page}>
    <nav className={styles.nav}><Link href="/">PlotPickle</Link><Link href="/blog">All posts</Link></nav>
    <article className={styles.wrap + " " + styles.article}>
      <p className={styles.eyebrow}>{post.series}</p>
      <h1>{post.title}</h1>
      <div className={styles.meta}><span>{post.author}</span><span>{post.publishedAt}</span></div>
      <p>{post.summary}</p>
      <div className={styles.tags}>{post.tags.map((tag)=><span key={tag}>{tag}</span>)}</div>
      {post.sections.map((section) => {
        const linkedPost = post.slug === "oss-radar-september-2026-by-date"
          ? publicBlogPostForDateHeading(section.heading)
          : null;
        return <section key={section.heading}>
          <h2>{linkedPost
            ? <Link className={styles.dateLink} href={"/blog/" + linkedPost.slug}>{section.heading}<span aria-hidden="true"> →</span></Link>
            : section.heading}</h2>
          {section.paragraphs.map((paragraph)=><p key={paragraph}>{paragraph}</p>)}
        </section>;
      })}
      <footer className={styles.sources}><h2>Sources</h2><ul>{post.sources.map((source)=><li key={source.url}><a href={source.url}>{source.label}</a></li>)}</ul></footer>
    </article>
  </div>;
}
