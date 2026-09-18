import { useState, useMemo, useEffect, useCallback } from "react";
import { useBlog, formatDate, readingTime, postPath } from "../blogContent";
import { SITE_ORIGIN, setJsonLd, organizationLd } from "../blogSeo";
import { pathForPage } from "../lib/routes";
import { trackEvent } from "../analytics";

// ─────────────────────────────────────────────────────────────────────────────
// Blog index — a 1:1 rebuild of the reference "Mentor AI Blogs" page.
//
// Section order, spacing, type scale, card anatomy, and interactions all come
// straight from the reference markup (#page-blog / #bl-list): hero with drifting
// blobs → search + category select → category pills → featured post → "Latest
// Articles" grid.
//
// Two things are kept from this project rather than the reference, deliberately:
//
// 1. The data. The reference renders its grid from a hardcoded JS array at
//    runtime; here the same UI is wired to src/data/blog.json (blogContent.js).
// 2. Crawlability + structured data. Every article link is a real
//    <a href="/blog/slug"> rather than a div with onClick, and the page emits
//    Blog + ItemList + BreadcrumbList JSON-LD.
//
// The reference's palette is re-declared locally on `.blg` instead of edited
// into index.css, so nothing outside this page sees it.
// ─────────────────────────────────────────────────────────────────────────────

const CSS = `
.blg {
  /* Reference tokens, scoped to the blog page only. */
  --blue:#2563EB; --blue-d:#1D4ED8;
  --tx:#0F172A; --tx2:#475569; --tx3:#94A3B8;
  --bg:#F8FAFC; --surface:#FFFFFF;
  --bd:rgba(15,23,42,0.08);
  --sh3:0 20px 60px rgba(0,0,0,0.10);
  --shb:0 8px 32px rgba(37,99,235,0.25);
  --herobg:linear-gradient(160deg,#EFF6FF 0%,#F8FAFC 45%,#F0FDF9 80%,#FAF5FF 100%);
  --f:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --fd:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  font-family:var(--f); background:var(--bg); color:var(--tx); line-height:1.6;
}
html[data-theme="dark"] .blg {
  --tx:#F8FAFC; --tx2:#94A3B8; --tx3:#64748B;
  --bg:#0F172A; --surface:#111827;
  --bd:rgba(248,250,252,0.07);
  --sh3:0 20px 60px rgba(0,0,0,0.6);
  --shb:0 8px 32px rgba(37,99,235,0.4);
  --herobg:linear-gradient(160deg,#0F172A 0%,#111827 45%,#0A1E18 80%,#15092A 100%);
}
.blg a { color:inherit; text-decoration:none; }

/* ── Hero ─────────────────────────────────────────────────────────── */
/* The reference nav is fixed and transparent over its hero, so 120px of top
   padding leaves 54px of visible clearance. This site's navbar is sticky and
   in-flow, so the clearance is the padding. */
.blg .bl-hero {
  padding:56px 40px 68px;
  background:var(--herobg);
  text-align:center;
  position:relative;
  overflow:hidden;
}
.blg .bl-hero-blob { position:absolute; border-radius:50%; filter:blur(80px); pointer-events:none; opacity:.34; }
html[data-theme="dark"] .blg .bl-hero-blob { opacity:.16; }
.blg .bl-hero-inner { position:relative; z-index:2; max-width:680px; margin:0 auto; }
.blg .bl-eyebrow {
  display:inline-flex; align-items:center; gap:8px;
  padding:5px 16px; border-radius:100px;
  background:rgba(37,99,235,.09);
  border:1px solid rgba(37,99,235,.22);
  font-size:12px; font-weight:700;
  color:var(--blue); letter-spacing:.06em;
  text-transform:uppercase; margin-bottom:22px;
}
.blg .bl-eyebrow-dot { width:7px; height:7px; border-radius:50%; background:var(--blue); animation:blg-dp 2s infinite; }
.blg .bl-hero-h1 {
  font-family:var(--fd);
  font-size:clamp(48px,7vw,80px);
  font-weight:800; line-height:1.05;
  letter-spacing:-.04em; color:var(--tx);
  margin:0 0 18px;
}
.blg .bl-hero-sub { font-size:18px; color:var(--tx2); line-height:1.72; max-width:520px; margin:0 auto 10px; }
.blg .bl-hero-note { font-size:14px; color:var(--tx3); margin:0; }

@keyframes blg-bf {
  0%,100% { transform:translate(0,0) scale(1) }
  33%     { transform:translate(16px,-16px) scale(1.04) }
  66%     { transform:translate(-12px,12px) scale(.97) }
}
@keyframes blg-dp {
  0%,100% { opacity:1; transform:scale(1) }
  50%     { opacity:.5; transform:scale(1.4) }
}
@media (prefers-reduced-motion: reduce) {
  .blg .bl-hero-blob, .blg .bl-eyebrow-dot { animation:none !important; }
  .blg * { transition-duration:.01ms !important; }
}

/* ── Search + filter bar ──────────────────────────────────────────── */
.blg .bl-bar {
  max-width:1140px; margin:44px auto 0; padding:0 40px;
  display:flex; gap:12px; flex-wrap:wrap; align-items:center;
}
.blg .bl-search-wrap { flex:1; min-width:220px; position:relative; }
.blg .bl-search-ico { position:absolute; left:13px; top:50%; transform:translateY(-50%); pointer-events:none; color:var(--tx3); display:flex; }
.blg .bl-search {
  width:100%; padding:11px 16px 11px 40px;
  border-radius:11px; border:1.5px solid var(--bd);
  background:var(--surface); font-size:14px;
  color:var(--tx); outline:none; font-family:var(--f);
  transition:border-color .2s;
}
.blg .bl-search:focus { border-color:var(--blue); box-shadow:0 0 0 3px rgba(37,99,235,.1); }
.blg .bl-search::placeholder { color:var(--tx3); }
.blg .bl-sel {
  padding:11px 16px; border-radius:11px;
  border:1.5px solid var(--bd); background:var(--surface);
  font-size:14px; color:var(--tx); outline:none;
  font-family:var(--f); cursor:pointer; max-width:100%;
  transition:border-color .2s;
}
.blg .bl-sel:focus { border-color:var(--blue); }

/* ── Category pills ───────────────────────────────────────────────── */
.blg .bl-cats { max-width:1140px; margin:18px auto 0; padding:0 40px; display:flex; gap:8px; flex-wrap:wrap; }
.blg .bl-cat {
  padding:6px 16px; border-radius:100px;
  font-size:13px; font-weight:600;
  border:1.5px solid var(--bd); background:var(--surface);
  color:var(--tx2); cursor:pointer; transition:all .2s;
  white-space:nowrap; font-family:var(--f);
}
.blg .bl-cat:hover { border-color:var(--blue); color:var(--blue); }
.blg .bl-cat.bl-act { background:var(--blue); border-color:var(--blue); color:#fff; }

/* ── Tag badges ───────────────────────────────────────────────────── */
.blg .bl-tag {
  display:inline-flex; align-items:center; gap:5px;
  font-size:11px; font-weight:700; letter-spacing:.08em;
  text-transform:uppercase; padding:4px 12px;
  border-radius:100px; margin-bottom:14px; width:fit-content;
}
.blg .blt-blue   { background:rgba(37,99,235,.1);  color:#2563EB }
.blg .blt-teal   { background:rgba(20,184,166,.1); color:#14B8A6 }
.blg .blt-purple { background:rgba(139,92,246,.1); color:#8B5CF6 }
.blg .blt-amber  { background:rgba(245,158,11,.1); color:#F59E0B }
.blg .blt-pink   { background:rgba(236,72,153,.1); color:#EC4899 }
.blg .blt-green  { background:rgba(16,185,129,.1); color:#10B981 }

/* ── Featured post ────────────────────────────────────────────────── */
.blg .bl-featured { max-width:1140px; margin:36px auto 0; padding:0 40px; }
.blg .bl-feat {
  display:grid; grid-template-columns:1fr 1fr; gap:0;
  background:var(--surface); border-radius:24px;
  border:1.5px solid var(--bd); overflow:hidden;
  cursor:pointer; transition:all .3s;
}
.blg .bl-feat > * { min-width:0; }
.blg .bl-feat:hover { transform:translateY(-4px); box-shadow:var(--sh3); }
.blg .bl-feat-vis {
  position:relative; min-height:320px;
  display:flex; align-items:center; justify-content:center;
  flex-direction:column; gap:14px; padding:36px;
}
.blg .bl-feat-badge {
  position:absolute; top:16px; left:16px;
  background:rgba(255,255,255,.92); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
  border-radius:100px; padding:5px 14px;
  font-size:12px; font-weight:700; color:#0F172A;
}
html[data-theme="dark"] .blg .bl-feat-badge { background:rgba(17,24,39,.92); color:#F8FAFC; }
.blg .bl-feat-illo-text {
  font-family:var(--fd); font-size:13px; font-weight:700;
  text-align:center; max-width:180px; line-height:1.4;
  opacity:.72; color:var(--bv-ink);
}
.blg .bl-feat-body {
  padding:44px 44px 44px 36px;
  display:flex; flex-direction:column; justify-content:center;
}
.blg .bl-feat-body h2 {
  font-family:var(--fd);
  font-size:clamp(20px,2.2vw,28px);
  font-weight:800; line-height:1.22;
  letter-spacing:-.02em; color:var(--tx);
  margin:0 0 12px; overflow-wrap:anywhere;
}
.blg .bl-feat-body p { font-size:15px; color:var(--tx2); line-height:1.75; margin:0 0 20px; }
.blg .bl-meta { display:flex; align-items:center; gap:7px; font-size:13px; color:var(--tx3); flex-wrap:wrap; }
.blg .bl-meta strong { color:var(--tx); font-weight:600; }
.blg .bl-meta-dot { width:3px; height:3px; border-radius:50%; background:var(--tx3); flex:0 0 auto; }
.blg .bl-readmore {
  display:inline-flex; align-items:center; gap:6px;
  font-size:14px; font-weight:700; color:var(--blue);
  background:rgba(37,99,235,.08); border-radius:9px;
  padding:9px 18px; border:none; line-height:normal;
  font-family:var(--f); margin-top:20px;
  transition:all .2s; width:fit-content;
}
.blg .bl-readmore:hover { background:var(--blue); color:#fff; gap:10px; }

/* ── Grid ─────────────────────────────────────────────────────────── */
.blg .bl-grid-wrap { max-width:1140px; margin:44px auto 0; padding:0 40px 80px; }
.blg .bl-grid-head {
  display:flex; align-items:center; justify-content:space-between;
  margin-bottom:24px; flex-wrap:wrap; gap:10px;
}
/* line-height is stated on every heading because App.js carries a global
   h1..h4 { line-height:1.2 } that the reference does not have — without it the
   heading boxes sit 8px short of the reference's inherited 1.6. */
.blg .bl-grid-head h2 { font-family:var(--fd); font-size:20px; font-weight:700; line-height:1.6; color:var(--tx); margin:0; }
.blg .bl-count { font-size:13px; color:var(--tx3); font-weight:500; }
.blg .bl-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:22px; }
.blg .bl-grid > * { min-width:0; }
.blg .bl-card {
  background:var(--surface); border-radius:20px;
  border:1.5px solid var(--bd); overflow:hidden;
  cursor:pointer; display:flex; flex-direction:column;
  transition:all .3s;
}
.blg .bl-card:hover { transform:translateY(-4px); box-shadow:var(--sh3); border-color:rgba(37,99,235,.2); }
.blg .bl-card-vis { width:100%; height:186px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.blg .bl-card-body { padding:22px; flex:1; display:flex; flex-direction:column; }
.blg .bl-card-body h3 {
  font-family:var(--fd); font-size:16px;
  font-weight:700; line-height:1.38;
  letter-spacing:-.01em; color:var(--tx);
  margin:0 0 8px; transition:color .2s; overflow-wrap:anywhere;
}
.blg .bl-card:hover .bl-card-body h3 { color:var(--blue); }
.blg .bl-card-body p { font-size:13px; color:var(--tx2); line-height:1.7; flex:1; margin:0 0 16px; }
.blg .bl-card-foot { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:auto; }
.blg .bl-card-meta { font-size:12px; color:var(--tx3); font-weight:500; }
.blg .bl-card-btn {
  display:inline-flex; align-items:center; gap:5px; flex:0 0 auto;
  font-size:12px; font-weight:700; color:var(--blue);
  background:rgba(37,99,235,.08); border-radius:100px;
  padding:5px 13px; border:none; white-space:nowrap; line-height:normal;
  font-family:var(--f); transition:all .2s;
}
.blg .bl-card-btn:hover { background:var(--blue); color:#fff; }

/* ── Illustration panels (gradient + frosted glyph, no bitmaps) ───── */
.blg .bv1 { --bv-a:#EFF6FF; --bv-b:#DBEAFE; --bv-ink:#1E3A8A; --bv-hue:#2563EB }
.blg .bv2 { --bv-a:#F0FDF4; --bv-b:#DCFCE7; --bv-ink:#065F46; --bv-hue:#10B981 }
.blg .bv3 { --bv-a:#FAF5FF; --bv-b:#EDE9FE; --bv-ink:#4C1D95; --bv-hue:#8B5CF6 }
.blg .bv4 { --bv-a:#FFF7ED; --bv-b:#FEF3C7; --bv-ink:#92400E; --bv-hue:#F59E0B }
.blg .bv5 { --bv-a:#FDF2F8; --bv-b:#FCE7F3; --bv-ink:#9D174D; --bv-hue:#EC4899 }
.blg .bv6 { --bv-a:#F0FDFA; --bv-b:#CCFBF1; --bv-ink:#115E59; --bv-hue:#14B8A6 }
html[data-theme="dark"] .blg .bv1 { --bv-a:#1e3a5f; --bv-b:#1e3a8a; --bv-ink:#DBEAFE; --bv-hue:#93C5FD }
html[data-theme="dark"] .blg .bv2 { --bv-a:#064e3b; --bv-b:#065f46; --bv-ink:#DCFCE7; --bv-hue:#6EE7B7 }
html[data-theme="dark"] .blg .bv3 { --bv-a:#3b0764; --bv-b:#4c1d95; --bv-ink:#EDE9FE; --bv-hue:#C4B5FD }
html[data-theme="dark"] .blg .bv4 { --bv-a:#78350f; --bv-b:#92400e; --bv-ink:#FEF3C7; --bv-hue:#FCD34D }
html[data-theme="dark"] .blg .bv5 { --bv-a:#831843; --bv-b:#9d174d; --bv-ink:#FCE7F3; --bv-hue:#F9A8D4 }
html[data-theme="dark"] .blg .bv6 { --bv-a:#134e4a; --bv-b:#115e59; --bv-ink:#CCFBF1; --bv-hue:#5EEAD4 }
.blg .bv1, .blg .bv2, .blg .bv3, .blg .bv4, .blg .bv5, .blg .bv6 {
  background:linear-gradient(135deg,var(--bv-a),var(--bv-b));
}
.blg .bl-glyph {
  width:80px; height:80px; border-radius:20px;
  background:rgba(255,255,255,.6);
  backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px);
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 3px 16px rgba(0,0,0,.08);
  color:var(--bv-hue); flex-shrink:0;
}
html[data-theme="dark"] .blg .bl-glyph { background:rgba(255,255,255,.12); }

/* ── Empty state ──────────────────────────────────────────────────── */
.blg .bl-empty { grid-column:1/-1; text-align:center; padding:64px 20px; }
.blg .bl-empty p { font-size:16px; color:var(--tx3); margin:0; }
.blg .bl-empty-reset {
  margin-top:20px; padding:9px 18px; border-radius:9px;
  font-size:14px; font-weight:700; color:var(--blue);
  background:rgba(37,99,235,.08); border:none; cursor:pointer;
  font-family:var(--f); transition:all .2s;
}
.blg .bl-empty-reset:hover { background:var(--blue); color:#fff; }

/* ── Responsive (reference breakpoints) ───────────────────────────── */
@media (max-width:960px) {
  .blg .bl-feat { grid-template-columns:1fr; }
  .blg .bl-feat-vis { min-height:220px; }
  .blg .bl-feat-body { padding:28px; }
  .blg .bl-grid { grid-template-columns:repeat(2,1fr); }
}
@media (max-width:640px) {
  .blg .bl-hero { padding:36px 20px 52px; }
  .blg .bl-bar, .blg .bl-cats, .blg .bl-featured, .blg .bl-grid-wrap { padding-left:20px; padding-right:20px; }
  .blg .bl-grid { grid-template-columns:1fr; }
  .blg .bl-sel { width:100%; }
}
`;

/** The reference's article glyph — a document outline in the panel's hue. */
export function ArticleGlyph({ size = 38 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  );
}

const ArrowIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);

const BoltIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

/**
 * A real anchor that also routes client-side. Crawlers, middle-click, and
 * "open in new tab" all need the href; the app needs the SPA navigation.
 */
function PostLink({ slug, className, children, onNavigate, ariaLabel, setPage }) {
  const href = pathForPage(`blog/${slug}`);
  const handleClick = event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    if (onNavigate) onNavigate();
    if (setPage) setPage(`blog/${slug}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <a href={href} className={className} aria-label={ariaLabel} onClick={handleClick}>{children}</a>
  );
}

function FeaturedCard({ post, blog, onOpen, setPage }) {
  const { ui } = blog;
  const category = blog.getCategory(post.category);
  const theme = blog.themeForCategory(post.category);
  const author = blog.getAuthor(post.author);
  return (
    <PostLink slug={post.slug} className="bl-feat" onNavigate={() => onOpen(post, "featured")} setPage={setPage}>
      <div className={`bl-feat-vis ${theme.bv}`} aria-hidden="true">
        <span className="bl-feat-badge">{ui.featuredBadge}</span>
        <span className="bl-glyph"><ArticleGlyph size={38} /></span>
        <span className="bl-feat-illo-text">{post.title}</span>
      </div>
      <div className="bl-feat-body">
        <span className={`bl-tag ${theme.tag}`}><BoltIcon />{category.label}</span>
        <h2>{post.title}</h2>
        <p>{post.excerpt}</p>
        <span className="bl-meta">
          <strong>{author.name}</strong>
          <span className="bl-meta-dot" />
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          <span className="bl-meta-dot" />
          <span>{readingTime(post)} {ui.minRead}</span>
        </span>
        <span className="bl-readmore">{ui.readFullArticle} <ArrowIcon /></span>
      </div>
    </PostLink>
  );
}

function PostCard({ post, blog, onOpen, setPage }) {
  const { ui } = blog;
  const category = blog.getCategory(post.category);
  const theme = blog.themeForCategory(post.category);
  return (
    <PostLink slug={post.slug} className="bl-card" onNavigate={() => onOpen(post, "grid")} setPage={setPage}>
      <div className={`bl-card-vis ${theme.bv}`} aria-hidden="true" />
      <div className="bl-card-body">
        <span className={`bl-tag ${theme.tag}`}>{category.label}</span>
        <h3>{post.title}</h3>
        <p>{post.excerpt}</p>
        <div className="bl-card-foot">
          <span className="bl-card-meta">
            <time dateTime={post.date}>{formatDate(post.date)}</time> · {readingTime(post)} {ui.minShort}
          </span>
          <span className="bl-card-btn">{ui.readMore}</span>
        </div>
      </div>
    </PostLink>
  );
}

export default function BlogPage({ setPage }) {
  const blog = useBlog();
  const { ui, posts: blogPosts, categories: blogCategories } = blog;
  const [activeCategory, setActiveCategory] = useState("");
  const [query, setQuery] = useState("");

  // The reference always keeps its featured post above the grid and filters
  // only what sits below it (blFilter runs over BL.slice(1)).
  const featured = useMemo(
    () => blogPosts.find(post => post.featured) || blogPosts[0] || null,
    [blogPosts]
  );

  const gridPosts = useMemo(() => {
    const rest = featured ? blogPosts.filter(post => post.slug !== featured.slug) : blogPosts;
    const byCategory = activeCategory ? rest.filter(post => post.category === activeCategory) : rest;
    return blog.searchPosts(byCategory, query);
  }, [blog, blogPosts, featured, activeCategory, query]);

  // Blog + ItemList tells search engines this is an article index and gives it
  // the article order; BreadcrumbList produces the "Home › Blog" trail in
  // results instead of a bare URL.
  useEffect(() => {
    setJsonLd("blog-index", {
      "@context": "https://schema.org",
      "@type": "Blog",
      "@id": `${SITE_ORIGIN}/blog#blog`,
      name: blog.page.metaTitle || "SchoolMentor Blog",
      description: blog.page.metaDescription || "",
      url: `${SITE_ORIGIN}/blog`,
      inLanguage: "en",
      publisher: organizationLd(),
      blogPost: blogPosts.map(post => ({
        "@type": "BlogPosting",
        headline: post.title,
        description: post.excerpt,
        url: `${SITE_ORIGIN}${postPath(post.slug)}`,
        datePublished: post.date,
        dateModified: post.updated || post.date,
        author: { "@type": "Organization", name: blog.getAuthor(post.author).name },
      })),
    });
    setJsonLd("blog-itemlist", {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: blogPosts.map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE_ORIGIN}${postPath(post.slug)}`,
        name: post.title,
      })),
    });
    setJsonLd("blog-breadcrumb", {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_ORIGIN },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_ORIGIN}/blog` },
      ],
    });
    return () => {
      setJsonLd("blog-index", null);
      setJsonLd("blog-itemlist", null);
      setJsonLd("blog-breadcrumb", null);
    };
  }, [blog, blogPosts]);

  const handleOpen = useCallback((post, source) => {
    trackEvent("blog_article_open", {
      article_slug: post.slug,
      article_title: post.title,
      article_category: post.category,
      source,
    });
  }, []);

  // The pills and the <select> are two controls over one value, exactly as in
  // the reference (blSetCat writes the select back).
  const handleCategory = useCallback((id, source) => {
    setActiveCategory(id);
    trackEvent("blog_category_filter", { category: id || "all", source });
  }, []);

  // Search fires an analytics event only once the reader pauses, so a
  // seven-letter query is one event rather than seven.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 3) return undefined;
    const timer = setTimeout(() => {
      trackEvent("blog_search", { search_term: term.toLowerCase(), results: gridPosts.length });
    }, 900);
    return () => clearTimeout(timer);
  }, [query, gridPosts.length]);

  const page = blog.page;

  return (
    <div className="blg page-enter">
      <style>{CSS}</style>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <header className="bl-hero">
        <span className="bl-hero-blob" aria-hidden="true" style={{
          width: 480, height: 480, background: "rgba(37,99,235,.16)",
          top: -100, left: -80, animation: "blg-bf 9s ease-in-out infinite",
        }} />
        <span className="bl-hero-blob" aria-hidden="true" style={{
          width: 360, height: 360, background: "rgba(139,92,246,.12)",
          top: 60, right: -60, animation: "blg-bf 9s ease-in-out 3s infinite",
        }} />
        <div className="bl-hero-inner">
          <span className="bl-eyebrow"><span className="bl-eyebrow-dot" />{page.eyebrow}</span>
          <h1 className="bl-hero-h1">{page.heading || "Blogs"}</h1>
          <p className="bl-hero-sub">{page.lede || page.subtitle}</p>
          {page.note && <p className="bl-hero-note">{page.note}</p>}
        </div>
      </header>

      {/* ── Search + category select ─────────────────────────────── */}
      <div className="bl-bar" role="search">
        <div className="bl-search-wrap">
          <span className="bl-search-ico">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            className="bl-search"
            id="bl-q"
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={ui.searchPlaceholder}
            aria-label={ui.searchAriaLabel}
          />
        </div>
        <select
          className="bl-sel"
          id="bl-cat-sel"
          value={activeCategory}
          onChange={event => handleCategory(event.target.value, "select")}
          aria-label="Filter by category"
        >
          <option value="">{ui.allCategoriesOption}</option>
          {blogCategories.map(category => (
            <option key={category.id} value={category.id}>{category.label}</option>
          ))}
        </select>
      </div>

      {/* ── Category pills ───────────────────────────────────────── */}
      <nav className="bl-cats" aria-label="Article categories">
        <button
          type="button"
          className={`bl-cat ${activeCategory === "" ? "bl-act" : ""}`}
          aria-pressed={activeCategory === ""}
          onClick={() => handleCategory("", "pill")}
        >
          {ui.allPostsPill}
        </button>
        {blogCategories.map(category => (
          <button
            key={category.id}
            type="button"
            className={`bl-cat ${activeCategory === category.id ? "bl-act" : ""}`}
            aria-pressed={activeCategory === category.id}
            onClick={() => handleCategory(category.id, "pill")}
          >
            {category.label}
          </button>
        ))}
      </nav>

      {/* ── Featured post ────────────────────────────────────────── */}
      {featured && (
        <section className="bl-featured" aria-label="Featured article">
          <FeaturedCard post={featured} blog={blog} onOpen={handleOpen} setPage={setPage} />
        </section>
      )}

      {/* ── Latest articles ──────────────────────────────────────── */}
      <section className="bl-grid-wrap" aria-labelledby="bl-latest">
        <div className="bl-grid-head">
          <h2 id="bl-latest">{ui.latestHeading}</h2>
          <span className="bl-count" aria-live="polite">
            {gridPosts.length} {gridPosts.length === 1 ? ui.countSingular : ui.countPlural}
          </span>
        </div>
        <div className="bl-grid">
          {gridPosts.length > 0 ? (
            gridPosts.map(post => <PostCard key={post.slug} post={post} blog={blog} onOpen={handleOpen} setPage={setPage} />)
          ) : (
            <div className="bl-empty">
              <p>{ui.emptyText}</p>
              <button
                type="button"
                className="bl-empty-reset"
                onClick={() => { setQuery(""); handleCategory("", "empty_state"); }}
              >
                {ui.emptyButton}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
