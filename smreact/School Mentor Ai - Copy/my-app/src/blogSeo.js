// ─── BLOG SEO / STRUCTURED DATA ───────────────────────────────────────────────
// Document-head helpers used by the blog pages: canonical + Open Graph/Twitter
// tags for an article, and JSON-LD blocks (Blog, ItemList, BreadcrumbList,
// BlogPosting, FAQPage). Lifted verbatim from the reference project's routes.js
// so the blog emits exactly the same structured data it does there.

export const SITE_ORIGIN = "https://schoolmentor.ai";

const setMeta = (selector, attr, value) => {
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement("meta");
    const [, name, key] = selector.match(/\[([^=]+)="([^"]+)"\]/) || [];
    if (!name) return;
    tag.setAttribute(name, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute(attr, value);
};

const setLink = (rel, href) => {
  let tag = document.head.querySelector(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
};

const removeMeta = selector => {
  const tag = document.head.querySelector(selector);
  if (tag) tag.remove();
};

/**
 * Write a <script type="application/ld+json"> block, replacing any previous one
 * with the same id. Passing null removes the block (how a page cleans up after
 * itself on unmount).
 */
export function setJsonLd(id, data) {
  const elementId = `ld-${id}`;
  const existing = document.getElementById(elementId);
  if (!data) {
    if (existing) existing.remove();
    return;
  }
  const script = existing || document.createElement("script");
  script.type = "application/ld+json";
  script.id = elementId;
  script.textContent = JSON.stringify(data);
  if (!existing) document.head.appendChild(script);
}

/** The Organization node every structured-data block points its publisher at. */
export const organizationLd = () => ({
  "@type": "Organization",
  name: "SchoolMentor",
  url: SITE_ORIGIN,
  logo: { "@type": "ImageObject", url: `${SITE_ORIGIN}/logo512.png` },
});

/**
 * Head tags for one blog article. Switches og:type to "article" so social cards
 * and news crawlers treat it as dated content rather than a standing page.
 */
export function applyArticleSeo(article) {
  if (!article) return;
  const canonical = `${SITE_ORIGIN}${article.path}`;
  const image = article.image || `${SITE_ORIGIN}/og-image.png`;

  document.title = article.title;
  setMeta('meta[name="description"]', "content", article.description);
  setMeta('meta[property="og:type"]', "content", "article");
  setMeta('meta[property="og:title"]', "content", article.title);
  setMeta('meta[property="og:description"]', "content", article.description);
  setMeta('meta[property="og:url"]', "content", canonical);
  setMeta('meta[property="og:image"]', "content", image);
  setMeta('meta[name="twitter:title"]', "content", article.title);
  setMeta('meta[name="twitter:description"]', "content", article.description);
  setMeta('meta[name="twitter:image"]', "content", image);
  setLink("canonical", canonical);

  if (article.published) setMeta('meta[property="article:published_time"]', "content", article.published);
  if (article.modified) setMeta('meta[property="article:modified_time"]', "content", article.modified);
  if (article.section) setMeta('meta[property="article:section"]', "content", article.section);
  if (article.author) setMeta('meta[name="author"]', "content", article.author);
  if (article.keywords) setMeta('meta[name="keywords"]', "content", article.keywords);

  const robots = document.head.querySelector('meta[name="robots"]');
  if (robots) robots.remove();
}

/**
 * Reset the article-only head tags and, for an unknown slug, mark the page
 * noindex so a broken /blog/<slug> URL never competes in search results.
 */
export function applyPageSeo(page) {
  ["article:published_time", "article:modified_time", "article:section"].forEach(property => {
    removeMeta(`meta[property="${property}"]`);
  });
  removeMeta('meta[name="keywords"]');
  removeMeta('meta[name="author"]');
  setMeta('meta[property="og:type"]', "content", "website");

  if (page === "__missing-blog-article") {
    setMeta('meta[name="robots"]', "content", "noindex, nofollow");
  }
}
