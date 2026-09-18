import { useMemo } from "react";

import blogData from "./data/blog.json";

// ─────────────────────────────────────────────────────────────────────────────
// Blog content.
//
// src/data/blog.json is compiled into the bundle and is the single source of
// truth for the blog — the same file scripts/generate-sitemap.js would read.
// The reference project also layers an admin-published copy over this via an
// API; this project has no backend, so the bundled JSON is all there is.
// ─────────────────────────────────────────────────────────────────────────────

export const BLOG_BASE = "/blog";

// ── Interface copy ───────────────────────────────────────────────────────────
// Every fixed string the blog renders. These are the defaults; `page.ui` in
// blog.json overrides any of them, and a blank or missing key falls back to the
// default below rather than rendering an empty button.
export const BLOG_UI_DEFAULTS = {
  // Index page
  searchPlaceholder: "Search articles...",
  searchAriaLabel: "Search articles",
  allCategoriesOption: "All Categories",
  allPostsPill: "All Posts",
  featuredBadge: "Featured",
  readFullArticle: "Read full article",
  readMore: "Read More",
  minRead: "min read",
  minShort: "min",
  latestHeading: "Latest Articles",
  countSingular: "article",
  countPlural: "articles",
  emptyText: "No articles found. Try a different search or category.",
  emptyButton: "Show all articles",
  // Article page
  backLabel: "Back to Blogs",
  tocTitle: "On this page",
  takeawaysTitle: "Key takeaways",
  tableHint: "Scroll the table sideways to see all columns.",
  shareLabel: "Share:",
  copyLinkLabel: "Copy Link",
  copiedLabel: "Link copied",
  printLabel: "Print",
  articleCtaButton: "Book a Free Demo",
  articleCtaPage: "demo",
  topicsLabel: "Topics:",
  faqHeading: "Frequently asked",
  relatedHeading: "Related Articles",
  relatedButton: "Read",
  // Article page — unknown slug
  missingTitle: "We couldn't find that article",
  missingText: "The link may be outdated or mistyped. Every published guide is listed on the blog index.",
  missingBrowseButton: "Browse all articles",
  missingHomeButton: "Go to homepage",
  missingDocumentTitle: "Article Not Found | SchoolMentor®",
};

// The reference paints six illustration panels (bv1–bv6) and six tag colours.
// The pairing is per category, so a topic always reads in the same colour across
// the featured card, the grid, and the article page.
const THEMES = [
  { bv: "bv1", tag: "blt-blue" },
  { bv: "bv2", tag: "blt-green" },
  { bv: "bv3", tag: "blt-purple" },
  { bv: "bv4", tag: "blt-amber" },
  { bv: "bv5", tag: "blt-pink" },
  { bv: "bv6", tag: "blt-teal" },
];

// ── Pure helpers (independent of which blog is loaded) ───────────────────────

/** The canonical URL path for an article. */
export const postPath = slug => `${BLOG_BASE}/${String(slug || "").replace(/^\/+/, "")}`;

/** "12 August 2026" — spelled out, because numeric formats are read differently in different regions. */
export function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** Stable anchor id for a heading, used by the in-article table of contents. */
export const headingId = text =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);

/** The h2 headings of a post, in order — the table of contents. */
export function tableOfContents(post) {
  return (post?.body || [])
    .filter(block => block.type === "h2")
    .map(block => ({ id: headingId(block.text), text: block.text }));
}

/**
 * Approximate word count of a post body. Used only as a fallback when a post
 * carries no explicit readTime.
 */
function wordCount(post) {
  let words = 0;
  (post?.body || []).forEach(block => {
    if (block.text) words += String(block.text).split(/\s+/).length;
    (block.items || []).forEach(item => { words += String(item).split(/\s+/).length; });
    (block.rows || []).forEach(row => row.forEach(cell => { words += String(cell).split(/\s+/).length; }));
  });
  return words;
}

/** Reading time in minutes, at 200 words per minute. */
export const readingTime = post => post?.readTime || Math.max(1, Math.round(wordCount(post) / 200));

// ── The blog, as the components see it ───────────────────────────────────────

/**
 * Everything the blog pages need, derived from one content blob. Kept a pure
 * function of its input.
 */
export function createBlogView(data) {
  const source = data && typeof data === "object" ? data : {};
  const page = source.page || {};
  const categories = Array.isArray(source.categories) ? source.categories : [];
  const authors = source.authors && typeof source.authors === "object" ? source.authors : {};

  const configuredUi = page.ui || {};
  const ui = Object.keys(BLOG_UI_DEFAULTS).reduce((labels, key) => {
    const value = configuredUi[key];
    labels[key] = typeof value === "string" && value.trim() ? value : BLOG_UI_DEFAULTS[key];
    return labels;
  }, {});

  /** Every post, newest first. Drafts (`published: false`) never reach the site. */
  const posts = (Array.isArray(source.posts) ? source.posts : [])
    .filter(post => post && post.slug && post.published !== false)
    .slice()
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

  const bySlug = new Map(posts.map(post => [post.slug, post]));
  const categoryById = new Map(categories.map(category => [category.id, category]));

  /** A post by slug, or null. Trailing slashes and casing are tolerated. */
  const getPost = slug => {
    const key = String(slug || "").trim().replace(/^\/+|\/+$/g, "").toLowerCase();
    return bySlug.get(key) || null;
  };

  /** Category metadata for an id, with a neutral fallback so render never breaks. */
  const getCategory = id =>
    categoryById.get(id) || { id, label: "Insights", icon: "fa-solid fa-newspaper", description: "" };

  /** Author metadata for an id, with a fallback to the editorial byline. */
  const getAuthor = id =>
    authors[id] || authors.editorial || { name: "SchoolMentor", role: "", bio: "", icon: "fa-solid fa-pen-nib" };

  /** Post counts per category, used for the filter pills. */
  const categoryCounts = () => {
    const counts = {};
    posts.forEach(post => { counts[post.category] = (counts[post.category] || 0) + 1; });
    return counts;
  };

  /**
   * Related articles for a post: same category first, then the most recent of
   * everything else, so the rail is always full even for a thin category.
   */
  const relatedPosts = (post, limit = 3) => {
    if (!post) return posts.slice(0, limit);
    const others = posts.filter(candidate => candidate.slug !== post.slug);
    const sameCategory = others.filter(candidate => candidate.category === post.category);
    const rest = others.filter(candidate => candidate.category !== post.category);
    return [...sameCategory, ...rest].slice(0, limit);
  };

  /** The illustration panel + tag colour a category reads in. */
  const themeForCategory = id => {
    const index = categories.findIndex(category => category.id === id);
    return THEMES[(index < 0 ? 0 : index) % THEMES.length];
  };

  /**
   * Free-text search across title, excerpt, tags, and category label.
   * Deliberately simple: the corpus is small enough that substring matching
   * beats anything cleverer, and it runs without a network call.
   */
  const searchPosts = (list, query) => {
    const needle = String(query || "").trim().toLowerCase();
    if (!needle) return list;
    return list.filter(post => {
      const haystack = [
        post.title,
        post.excerpt,
        getCategory(post.category).label,
        ...(post.tags || []),
        ...(post.keywords || []),
      ].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  };

  return {
    page, ui, categories, authors, posts,
    getPost, getCategory, getAuthor, categoryCounts, relatedPosts, themeForCategory, searchPosts,
  };
}

// The view is derived once — the bundled JSON never changes at runtime.
const BLOG_VIEW = createBlogView(blogData);

/** Everything the blog pages need. */
export function useBlog() {
  return useMemo(() => BLOG_VIEW, []);
}

/** A one-off, non-reactive read — for code that runs outside a component. */
export const blogSnapshot = () => BLOG_VIEW;
