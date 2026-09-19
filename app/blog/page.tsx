import type { Metadata } from "next";
import Link from "next/link";
import { publishedBlogPosts } from "@/lib/public-site/blog";
import styles from "./blog.module.css";

export const metadata: Metadata = {
  title: "PlotPickle Blog",
  description: "OSS Radar, story technology and notes from building PlotPickle.",
  alternates: { canonical: "https://plotpickle.com/blog" },
};

export default function BlogIndexPage() {
  const posts = publishedBlogPosts();
  return <div className={styles.page}>
    <nav className={styles.nav}><Link href="/">PlotPickle</Link><a href="/blog/feed.xml">RSS</a></nav>
    <main className={styles.wrap + " " + styles.hero}>
      <p className={styles.eyebrow}>PlotPickle Blog</p>
      <h1>Notes from the Story Operating System.</h1>
      <p>OSS Radar, story technology, product decisions and what we learn while building PlotPickle in the open.</p>
      <div className={styles.list}>{posts.map((post)=><Link className={styles.card} href={"/blog/" + post.slug} key={post.slug}><small>{post.series} · {post.publishedAt}</small><h2>{post.title}</h2><p>{post.summary}</p><div className={styles.meta}><span>{post.author}</span><span>{post.tags.join(" · ")}</span></div></Link>)}</div>
    </main>
  </div>;
}
