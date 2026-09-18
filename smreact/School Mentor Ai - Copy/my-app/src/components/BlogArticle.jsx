import { useEffect, useMemo, useRef, useState } from "react";
import {
  useBlog, formatDate, readingTime, tableOfContents, headingId, postPath,
} from "../blogContent";
import { SITE_ORIGIN, applyArticleSeo, applyPageSeo, setJsonLd, organizationLd } from "../blogSeo";
import { pathForPage } from "../lib/routes";
import { trackEvent } from "../analytics";
import { ArticleGlyph } from "./BlogPage.jsx";

// -----------------------------------------------------------------------------
// Blog article - the reference's detail view (#bl-detail), rebuilt.
//
// Layout, type scale, and section order come from the reference: a 780px column
// with a hero (back link, tag, title, ruled meta row), a gradient cover panel,
// the article body, a share/print/CTA action bar, then a three-up "Related
// Articles" grid on the wider 1140px measure.
//
// What the reference does not have but this page keeps, because removing it
// would cost real search traffic:
//
// * Semantic structure - one <h1>, ordered <h2>/<h3>, real <ul>/<ol>/<table>.
//   The body is data (blog.json blocks) rendered into elements, so there is no
//   dangerouslySetInnerHTML anywhere.
// * Structured data - BlogPosting, FAQPage (the expandable answers in results),
//   and BreadcrumbList.
// * Measured engagement - scroll depth and share events feed analytics.
// -----------------------------------------------------------------------------

const CSS = `
.blga {
  /* Reference tokens, scoped to the blog article only. */
  --blue:#2563EB; --blue-d:#1D4ED8;
  --tx:#0F172A; --tx2:#475569; --tx3:#94A3B8;
  --bg:#F8FAFC; --surface:#FFFFFF; --surface2:#F1F5F9;
  --bd:rgba(15,23,42,0.08);
  --sh3:0 20px 60px rgba(0,0,0,0.10);
  --shb:0 8px 32px rgba(37,99,235,0.25);
  --herobg:linear-gradient(160deg,#EFF6FF 0%,#F8FAFC 45%,#F0FDF9 80%,#FAF5FF 100%);
  --f:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --fd:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  font-family:var(--f); background:var(--bg); color:var(--tx); line-height:1.6;
  display:block;
}
html[data-theme="dark"] .blga {
  --tx:#F8FAFC; --tx2:#94A3B8; --tx3:#64748B;
  --bg:#0F172A; --surface:#111827; --surface2:#1E293B;
  --bd:rgba(248,250,252,0.07);
  --sh3:0 20px 60px rgba(0,0,0,0.6);
  --shb:0 8px 32px rgba(37,99,235,0.4);
  --herobg:linear-gradient(160deg,#0F172A 0%,#111827 45%,#0A1E18 80%,#15092A 100%);
}
.blga a { color:inherit; text-decoration:none; }

/* Reading progress - above the site's sticky navbar, which sits at z-index 1000 */
.blga .bld-progress { position:fixed; top:0; left:0; right:0; height:3px; z-index:1100; pointer-events:none; }
.blga .bld-progress-bar { height:100%; background:var(--blue); transform-origin:0 50%; transition:transform .08s linear; }

/* == Hero ================================================================== */
/* The reference nav is fixed over its hero (108px padding minus a 66px nav =
   42px of visible clearance); this site's navbar is sticky and in-flow. */
.blga .bld-hero { padding:44px 40px 0; background:var(--herobg); position:relative; overflow:hidden; }
.blga .bld-blob { position:absolute; border-radius:50%; filter:blur(80px); pointer-events:none; opacity:.34; }
html[data-theme="dark"] .blga .bld-blob { opacity:.16; }
.blga .bld-inner { max-width:780px; margin:0 auto; position:relative; z-index:2; }
.blga .bld-back {
  display:inline-flex; align-items:center; gap:8px;
  font-size:14px; font-weight:600; color:var(--tx2);
  background:none; border:none; cursor:pointer;
  font-family:var(--f); padding:0; margin-bottom:28px;
  line-height:normal; transition:color .2s;
}
.blga .bld-back:hover { color:var(--blue); }
.blga .bld-tags { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:18px; }
.blga .bld-title {
  font-family:var(--fd);
  font-size:clamp(26px,4vw,46px);
  font-weight:800; line-height:1.1;
  letter-spacing:-.03em; color:var(--tx);
  margin:0 0 20px; overflow-wrap:anywhere;
}
.blga .bld-meta {
  display:flex; align-items:center; gap:8px; flex-wrap:wrap;
  font-size:14px; color:var(--tx2);
  padding-bottom:28px; border-bottom:1px solid var(--bd);
}
.blga .bld-meta strong { font-weight:600; color:var(--tx); }
.blga .bl-meta-dot { width:3px; height:3px; border-radius:50%; background:var(--tx3); flex:0 0 auto; }

/* == Tag badges (reference palette) ======================================== */
.blga .bl-tag {
  display:inline-flex; align-items:center; gap:5px;
  font-size:11px; font-weight:700; letter-spacing:.08em;
  text-transform:uppercase; padding:4px 12px;
  border-radius:100px; width:fit-content;
}
.blga .blt-blue   { background:rgba(37,99,235,.1);  color:#2563EB }
.blga .blt-teal   { background:rgba(20,184,166,.1); color:#14B8A6 }
.blga .blt-purple { background:rgba(139,92,246,.1); color:#8B5CF6 }
.blga .blt-amber  { background:rgba(245,158,11,.1); color:#F59E0B }
.blga .blt-pink   { background:rgba(236,72,153,.1); color:#EC4899 }
.blga .blt-green  { background:rgba(16,185,129,.1); color:#10B981 }

/* == Cover ================================================================= */
.blga .bld-cover { max-width:780px; margin:40px auto 0; padding:0 40px; }
.blga .bld-cover-img {
  width:100%; border-radius:20px;
  min-height:300px; border:1.5px solid var(--bd);
  display:flex; align-items:center; justify-content:center;
  overflow:hidden; padding:56px;
  background:linear-gradient(135deg,var(--bv-a),var(--bv-b));
}
.blga .bl-glyph {
  width:88px; height:88px; border-radius:22px;
  background:rgba(255,255,255,.65);
  backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px);
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 4px 24px rgba(0,0,0,.1);
  color:var(--bv-hue); flex-shrink:0;
}
html[data-theme="dark"] .blga .bl-glyph { background:rgba(255,255,255,.12); }

/* == Illustration palettes ================================================= */
.blga .bv1 { --bv-a:#EFF6FF; --bv-b:#DBEAFE; --bv-ink:#1E3A8A; --bv-hue:#2563EB }
.blga .bv2 { --bv-a:#F0FDF4; --bv-b:#DCFCE7; --bv-ink:#065F46; --bv-hue:#10B981 }
.blga .bv3 { --bv-a:#FAF5FF; --bv-b:#EDE9FE; --bv-ink:#4C1D95; --bv-hue:#8B5CF6 }
.blga .bv4 { --bv-a:#FFF7ED; --bv-b:#FEF3C7; --bv-ink:#92400E; --bv-hue:#F59E0B }
.blga .bv5 { --bv-a:#FDF2F8; --bv-b:#FCE7F3; --bv-ink:#9D174D; --bv-hue:#EC4899 }
.blga .bv6 { --bv-a:#F0FDFA; --bv-b:#CCFBF1; --bv-ink:#115E59; --bv-hue:#14B8A6 }
html[data-theme="dark"] .blga .bv1 { --bv-a:#1e3a5f; --bv-b:#1e3a8a; --bv-ink:#DBEAFE; --bv-hue:#93C5FD }
html[data-theme="dark"] .blga .bv2 { --bv-a:#064e3b; --bv-b:#065f46; --bv-ink:#DCFCE7; --bv-hue:#6EE7B7 }
html[data-theme="dark"] .blga .bv3 { --bv-a:#3b0764; --bv-b:#4c1d95; --bv-ink:#EDE9FE; --bv-hue:#C4B5FD }
html[data-theme="dark"] .blga .bv4 { --bv-a:#78350f; --bv-b:#92400e; --bv-ink:#FEF3C7; --bv-hue:#FCD34D }
html[data-theme="dark"] .blga .bv5 { --bv-a:#831843; --bv-b:#9d174d; --bv-ink:#FCE7F3; --bv-hue:#F9A8D4 }
html[data-theme="dark"] .blga .bv6 { --bv-a:#134e4a; --bv-b:#115e59; --bv-ink:#CCFBF1; --bv-hue:#5EEAD4 }

/* == Body ================================================================== */
/* line-height is stated on every heading because App.js carries a global
   h1..h4 { line-height:1.2 } that the reference does not have - the reference's
   headings simply inherit from their container. */
.blga .bld-body { max-width:780px; margin:48px auto 0; padding:0 40px 80px; }
.blga .bld-content { font-size:16px; color:var(--tx2); line-height:1.85; }
.blga .bld-content h2 {
  font-family:var(--fd); font-size:22px; font-weight:700; line-height:1.85;
  color:var(--tx); margin:40px 0 14px; letter-spacing:-.01em;
  scroll-margin-top:90px;
}
.blga .bld-content h2:first-child { margin-top:0; }
.blga .bld-content h3 {
  font-family:var(--fd); font-size:18px; font-weight:700; line-height:1.85;
  color:var(--tx); margin:28px 0 10px; scroll-margin-top:90px;
}
.blga .bld-content p { margin:0 0 18px; }
.blga .bld-content ul, .blga .bld-content ol { margin:0 0 18px 20px; padding:0; }
.blga .bld-content li { margin-bottom:8px; }
.blga .bld-content li::marker { color:var(--blue); font-weight:700; }
.blga .bld-content strong { color:var(--tx); font-weight:600; }

/* Table of contents */
.blga .bld-toc {
  background:var(--surface); border:1.5px solid var(--bd);
  border-radius:16px; padding:22px 24px; margin-bottom:36px;
}
.blga .bld-toc-title {
  font-family:var(--fd); font-size:11px; font-weight:700;
  letter-spacing:.08em; text-transform:uppercase;
  color:var(--tx3); margin-bottom:14px;
  display:flex; align-items:center; gap:8px;
}
.blga .bld-toc ol { list-style:none; margin:0; padding:0; counter-reset:bldtoc; }
.blga .bld-toc li { counter-increment:bldtoc; margin:0; }
.blga .bld-toc a {
  display:flex; gap:10px; padding:6px 0 6px 12px; margin-left:-12px;
  font-size:14px; line-height:1.5; color:var(--tx2);
  border-left:2px solid transparent; transition:color .2s,border-color .2s;
}
.blga .bld-toc a::before { content:counter(bldtoc) "."; color:var(--tx3); font-weight:700; flex:0 0 auto; }
.blga .bld-toc a:hover { color:var(--blue); }
.blga .bld-toc a.is-active { color:var(--blue); font-weight:600; border-left-color:var(--blue); }
.blga .bld-toc a.is-active::before { color:var(--blue); }

/* Key takeaways */
.blga .bld-takeaways {
  background:var(--surface); border:1.5px solid var(--bd);
  border-left:3px solid var(--blue); border-radius:16px;
  padding:24px; margin-bottom:36px;
}
.blga .bld-takeaways-title {
  font-family:var(--fd); font-size:11px; font-weight:700;
  letter-spacing:.08em; text-transform:uppercase;
  color:var(--blue); margin-bottom:14px;
  display:flex; align-items:center; gap:8px;
}
.blga .bld-takeaways ul { list-style:none; margin:0; padding:0; }
.blga .bld-takeaways li {
  display:flex; gap:11px; align-items:flex-start;
  font-size:14.5px; line-height:1.7; color:var(--tx2); margin-bottom:10px;
}
.blga .bld-takeaways li:last-child { margin-bottom:0; }
.blga .bld-takeaways svg { color:var(--blue); margin-top:5px; flex:0 0 auto; }

/* Checklist / callout / quote / stats / table / inline CTA */
.blga .bld-checklist { list-style:none; margin:0 0 22px; padding:0; }
.blga .bld-checklist li {
  display:flex; gap:12px; align-items:flex-start;
  padding:12px 16px; margin-bottom:8px;
  background:var(--surface); border:1.5px solid var(--bd); border-radius:11px;
  font-size:15px; line-height:1.65;
}
.blga .bld-checklist svg { color:var(--blue); margin-top:5px; flex:0 0 auto; }
.blga .bld-callout {
  display:flex; gap:14px; align-items:flex-start;
  border:1.5px solid var(--bd); border-left:3px solid var(--blue);
  background:var(--surface); border-radius:14px;
  padding:18px 20px; margin:28px 0;
}
.blga .bld-callout.tone-warn { border-left-color:#F59E0B; }
.blga .bld-callout.tone-success { border-left-color:#10B981; }
.blga .bld-callout-icon { color:var(--blue); margin-top:3px; flex:0 0 auto; }
.blga .bld-callout.tone-warn .bld-callout-icon { color:#F59E0B; }
.blga .bld-callout.tone-success .bld-callout-icon { color:#10B981; }
.blga .bld-callout-title { font-family:var(--fd); font-size:15px; font-weight:700; color:var(--tx); margin-bottom:6px; }
.blga .bld-callout p { font-size:14.5px; line-height:1.75; margin:0; }
.blga .bld-quote {
  margin:32px 0; padding:24px 26px;
  background:var(--surface); border:1.5px solid var(--bd); border-radius:16px;
}
.blga .bld-quote svg { color:var(--blue); opacity:.35; }
.blga .bld-quote p { font-size:17px; line-height:1.7; color:var(--tx); font-weight:500; margin:10px 0 0; }
.blga .bld-quote cite { display:block; margin-top:14px; font-size:13px; font-style:normal; color:var(--tx3); font-weight:600; }
.blga .bld-statgrid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin:28px 0; }
.blga .bld-statgrid > * { min-width:0; }
.blga .bld-statcard { background:var(--surface); border:1.5px solid var(--bd); border-radius:14px; padding:20px; }
.blga .bld-statcard-value {
  font-family:var(--fd); font-size:26px; font-weight:800;
  color:var(--blue); line-height:1.15; letter-spacing:-.02em;
}
.blga .bld-statcard-label { font-size:13px; line-height:1.55; color:var(--tx3); margin-top:8px; }
.blga .bld-tablewrap {
  margin:28px 0; overflow-x:auto; max-width:100%;
  border:1.5px solid var(--bd); border-radius:14px;
  background:var(--surface); -webkit-overflow-scrolling:touch;
}
.blga .bld-table { width:100%; border-collapse:collapse; min-width:480px; font-size:14px; }
.blga .bld-table th {
  text-align:left; padding:13px 16px; background:var(--surface2);
  font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase;
  color:var(--tx); border-bottom:1px solid var(--bd); white-space:nowrap;
}
.blga .bld-table td { padding:13px 16px; border-bottom:1px solid var(--bd); line-height:1.65; color:var(--tx2); vertical-align:top; }
.blga .bld-table tr:last-child td { border-bottom:0; }
.blga .bld-table td:first-child { font-weight:600; color:var(--tx); }
.blga .bld-scrollhint { font-size:12px; color:var(--tx3); margin:-20px 0 26px; display:none; }
.blga .bld-inline-cta {
  background:linear-gradient(135deg,rgba(37,99,235,.06),rgba(139,92,246,.06));
  border:1.5px solid var(--bd); border-radius:20px;
  padding:28px 30px; margin:36px 0;
}
.blga .bld-inline-cta h3 { font-family:var(--fd); font-size:19px; font-weight:700; line-height:1.6; color:var(--tx); margin:0 0 8px; }
.blga .bld-inline-cta p { font-size:14.5px; line-height:1.7; margin:0 0 18px; }

/* == Action bar ============================================================ */
.blga .bld-actions {
  display:flex; align-items:center; gap:10px;
  flex-wrap:wrap; margin-top:48px;
  padding-top:32px; border-top:1px solid var(--bd);
}
.blga .bld-share-lbl { font-size:13px; font-weight:600; color:var(--tx3); white-space:nowrap; }
.blga .bld-share-btn {
  display:inline-flex; align-items:center; gap:7px;
  padding:9px 18px; border-radius:9px; font-size:13px;
  font-weight:600; cursor:pointer; line-height:normal;
  border:1.5px solid var(--bd); background:var(--surface);
  color:var(--tx2); font-family:var(--f); transition:all .2s;
}
.blga .bld-share-btn:hover { border-color:var(--blue); color:var(--blue); }
.blga .bld-cta-btn {
  margin-left:auto; padding:9px 20px; border-radius:9px;
  font-size:13px; font-weight:700; cursor:pointer; border:none;
  background:linear-gradient(135deg,var(--blue),var(--blue-d));
  color:#fff; font-family:var(--f); line-height:normal;
  display:inline-flex; align-items:center; gap:6px;
  box-shadow:var(--shb); transition:all .2s;
}
.blga .bld-cta-btn:hover { transform:translateY(-1px); }

/* == Topics ================================================================ */
.blga .bld-topics { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-top:36px; padding-top:26px; border-top:1px solid var(--bd); }
.blga .bld-topic {
  font-size:12.5px; font-weight:600; color:var(--tx2);
  background:var(--surface); border:1.5px solid var(--bd);
  border-radius:100px; padding:5px 14px;
}

/* == FAQ =================================================================== */
.blga .bld-faq { margin-top:44px; }
.blga .bld-faq h2 { font-family:var(--fd); font-size:22px; font-weight:700; line-height:1.6; color:var(--tx); margin:0 0 20px; letter-spacing:-.01em; }
.blga .bld-faq-item {
  border:1.5px solid var(--bd); border-radius:14px;
  background:var(--surface); margin-bottom:10px; overflow:hidden;
  transition:border-color .2s, box-shadow .2s;
}
.blga .bld-faq-item:hover, .blga .bld-faq-item.is-open { border-color:rgba(37,99,235,.3); }
.blga .bld-faq-q {
  width:100%; display:flex; align-items:center; justify-content:space-between; gap:16px;
  padding:17px 20px; background:transparent; text-align:left; border:none; cursor:pointer;
  font-family:var(--fd); font-size:15px; font-weight:700; color:var(--tx); line-height:1.45;
}
.blga .bld-faq-chevron {
  width:28px; height:28px; flex:0 0 28px; border-radius:50%;
  background:rgba(37,99,235,.08); color:var(--blue);
  display:flex; align-items:center; justify-content:center;
  transition:transform .28s cubic-bezier(.22,.61,.36,1);
}
.blga .bld-faq-item.is-open .bld-faq-chevron { transform:rotate(180deg); }
.blga .bld-faq-panel { display:grid; grid-template-rows:0fr; transition:grid-template-rows .3s cubic-bezier(.22,.61,.36,1); }
.blga .bld-faq-item.is-open .bld-faq-panel { grid-template-rows:1fr; }
.blga .bld-faq-panel > div { overflow:hidden; }
.blga .bld-faq-a { padding:0 20px 18px; font-size:14.5px; line-height:1.8; color:var(--tx2); margin:0; }

/* == Author ================================================================ */
.blga .bld-author {
  display:flex; gap:18px; align-items:flex-start;
  background:var(--surface); border:1.5px solid var(--bd);
  border-radius:20px; padding:26px; margin-top:44px;
}
.blga .bld-author-avatar {
  width:56px; height:56px; flex:0 0 56px; border-radius:16px;
  background:rgba(37,99,235,.08); color:var(--blue);
  display:flex; align-items:center; justify-content:center;
}
.blga .bld-author-name { font-family:var(--fd); font-size:16px; font-weight:700; line-height:1.6; color:var(--tx); }
.blga .bld-author-role { font-size:12.5px; font-weight:600; color:var(--blue); margin-top:3px; }
.blga .bld-author-bio { font-size:14px; line-height:1.75; color:var(--tx2); margin:10px 0 0; }

/* == Related =============================================================== */
.blga .bld-related { max-width:1140px; margin:0 auto; padding:0 40px 80px; }
.blga .bld-related h2 {
  font-family:var(--fd); font-size:22px; font-weight:700; line-height:1.6; color:var(--tx);
  margin:0 0 28px; padding-top:48px; border-top:1px solid var(--bd); letter-spacing:-.01em;
}
.blga .bld-rel-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
.blga .bld-rel-grid > * { min-width:0; }
.blga .bl-card {
  background:var(--surface); border-radius:20px;
  border:1.5px solid var(--bd); overflow:hidden;
  cursor:pointer; display:flex; flex-direction:column;
  transition:all .3s;
}
.blga .bl-card:hover { transform:translateY(-4px); box-shadow:var(--sh3); border-color:rgba(37,99,235,.2); }
.blga .bl-card-vis { width:100%; height:140px; flex-shrink:0; background:linear-gradient(135deg,var(--bv-a),var(--bv-b)); }
.blga .bl-card-body { padding:22px; flex:1; display:flex; flex-direction:column; }
.blga .bl-card-body .bl-tag { margin-bottom:14px; }
.blga .bl-card-body h3 {
  font-family:var(--fd); font-size:16px; font-weight:700; line-height:1.38;
  letter-spacing:-.01em; color:var(--tx); margin:0 0 8px;
  transition:color .2s; overflow-wrap:anywhere; flex:1;
}
.blga .bl-card:hover .bl-card-body h3 { color:var(--blue); }
.blga .bl-card-foot { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:auto; }
.blga .bl-card-meta { font-size:12px; color:var(--tx3); font-weight:500; }
.blga .bl-card-btn {
  display:inline-flex; align-items:center; gap:5px; flex:0 0 auto;
  font-size:12px; font-weight:700; color:var(--blue);
  background:rgba(37,99,235,.08); border-radius:100px;
  padding:5px 13px; border:none; white-space:nowrap; line-height:normal;
  font-family:var(--f); transition:all .2s;
}
.blga .bl-card-btn:hover { background:var(--blue); color:#fff; }

/* == Missing article ======================================================= */
.blga .bld-missing { max-width:780px; margin:0 auto; padding:96px 40px 120px; text-align:center; }
.blga .bld-missing-icon {
  width:80px; height:80px; border-radius:22px; margin:0 auto 24px;
  background:rgba(37,99,235,.08); color:var(--blue);
  display:flex; align-items:center; justify-content:center;
}
.blga .bld-missing h1 {
  font-family:var(--fd); font-size:clamp(26px,4vw,40px); font-weight:800;
  line-height:1.15; letter-spacing:-.03em; color:var(--tx); margin:0 0 14px;
}
.blga .bld-missing p { font-size:16px; color:var(--tx2); line-height:1.75; margin:0 auto; max-width:44ch; }
.blga .bld-missing-actions { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-top:28px; }

@keyframes blga-bf {
  0%,100% { transform:translate(0,0) scale(1) }
  33%     { transform:translate(16px,-16px) scale(1.04) }
  66%     { transform:translate(-12px,12px) scale(.97) }
}
@media (prefers-reduced-motion: reduce) {
  .blga .bld-blob { animation:none !important; }
  .blga * { transition-duration:.01ms !important; }
}

/* == Responsive (reference breakpoints) ==================================== */
@media (max-width:960px) {
  .blga .bld-rel-grid { grid-template-columns:repeat(2,1fr); }
}
@media (max-width:640px) {
  .blga .bld-hero { padding:32px 20px 0; }
  .blga .bld-cover, .blga .bld-body, .blga .bld-related { padding-left:20px; padding-right:20px; }
  .blga .bld-rel-grid { grid-template-columns:1fr; }
  .blga .bld-actions { flex-direction:column; align-items:flex-start; }
  .blga .bld-cta-btn { margin-left:0; }
  .blga .bld-share-btn, .blga .bld-cta-btn { width:100%; justify-content:center; }
  .blga .bld-cover-img { min-height:220px; padding:36px; }
  .blga .bld-scrollhint { display:block; }
  .blga .bld-author { flex-direction:column; gap:14px; }
  .blga .bld-content h2, .blga .bld-content h3 { scroll-margin-top:72px; }
}
`;

// == Inline icons (reference set) =============================================
const Ico = ({ size = 15, children, w = 2, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
    {children}
  </svg>
);

const IconBack = () => <Ico size={15} w={2.5}><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></Ico>;
const IconArrow = ({ size = 13 }) => <Ico size={size} w={2.5}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></Ico>;
const IconCopy = () => <Ico size={14}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Ico>;
const IconCheck = () => <Ico size={14} w={2.5}><polyline points="20 6 9 17 4 12" /></Ico>;
const IconPrint = () => <Ico size={14}><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></Ico>;
const IconList = () => <Ico size={13}><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></Ico>;
const IconBookmark = () => <Ico size={13}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></Ico>;
const IconCircleCheck = ({ size = 13 }) => <Ico size={size}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></Ico>;
const IconInfo = () => <Ico size={17}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></Ico>;
const IconQuote = () => <Ico size={22} w={1.6}><path d="M3 21c3 0 7-1 7-8V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3" /><path d="M14 21c3 0 7-1 7-8V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3" /></Ico>;
const IconChevron = () => <Ico size={12} w={2.5}><polyline points="6 9 12 15 18 9" /></Ico>;
const IconPen = ({ size = 22 }) => <Ico size={size} w={1.7}><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></Ico>;
const IconArrows = () => <Ico size={13}><polyline points="17 11 21 7 17 3" /><line x1="21" y1="7" x2="9" y2="7" /><polyline points="7 21 3 17 7 13" /><line x1="15" y1="17" x2="3" y2="17" /></Ico>;
const IconMissing = () => <Ico size={34} w={1.6}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h6" /><polyline points="14 2 14 8 20 8" /><circle cx="18" cy="18" r="3" /><path d="M18 15.5v1M18 20v.01" /></Ico>;

// == Body block renderer ======================================================
// Every block type in blog.json maps to a real semantic element. Adding a new
// block type means adding a case here and nothing else.
function Block({ block, ui, onCta }) {
  switch (block.type) {
    case "p":
      return <p>{block.text}</p>;

    case "h2":
      return <h2 id={headingId(block.text)}>{block.text}</h2>;

    case "h3":
      return <h3 id={headingId(block.text)}>{block.text}</h3>;

    case "ul":
      return <ul>{block.items.map((item, i) => <li key={i}>{item}</li>)}</ul>;

    case "ol":
      return <ol>{block.items.map((item, i) => <li key={i}>{item}</li>)}</ol>;

    case "checklist":
      return (
        <ul className="bld-checklist">
          {block.items.map((item, i) => (
            <li key={i}><IconCircleCheck size={15} /><span>{item}</span></li>
          ))}
        </ul>
      );

    case "callout":
      return (
        <aside className={`bld-callout tone-${block.tone || "info"}`}>
          <span className="bld-callout-icon"><IconInfo /></span>
          <div>
            {block.title && <div className="bld-callout-title">{block.title}</div>}
            <p>{block.text}</p>
          </div>
        </aside>
      );

    case "quote":
      return (
        <blockquote className="bld-quote">
          <IconQuote />
          <p>{block.text}</p>
          {block.cite && <cite>{"— "}{block.cite}</cite>}
        </blockquote>
      );

    case "stats":
      return (
        <div className="bld-statgrid">
          {block.items.map((item, i) => (
            <div className="bld-statcard" key={i}>
              <div className="bld-statcard-value">{item.value}</div>
              <div className="bld-statcard-label">{item.label}</div>
            </div>
          ))}
        </div>
      );

    case "table":
      return (
        <>
          <div className="bld-tablewrap" role="region" aria-label="Data table" tabIndex={0}>
            <table className="bld-table">
              <thead><tr>{block.head.map((cell, i) => <th key={i} scope="col">{cell}</th>)}</tr></thead>
              <tbody>
                {block.rows.map((row, i) => (
                  <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="bld-scrollhint"><IconArrows /> {ui.tableHint}</p>
        </>
      );

    case "cta":
      return (
        <aside className="bld-inline-cta">
          <h3>{block.title}</h3>
          <p>{block.text}</p>
          <button type="button" className="bld-cta-btn" style={{ marginLeft: 0 }} onClick={() => onCta(block)}>
            {block.button} <IconArrow />
          </button>
        </aside>
      );

    default:
      return null;
  }
}

export default function BlogArticle({ slug, setPage }) {
  const blog = useBlog();
  const { ui } = blog;
  const post = blog.getPost(slug);

  const [progress, setProgress] = useState(0);
  const [activeHeading, setActiveHeading] = useState("");
  const [openFaq, setOpenFaq] = useState(0);
  const [copied, setCopied] = useState(false);
  const depthsSent = useRef(new Set());

  const toc = useMemo(() => (post ? tableOfContents(post) : []), [post]);
  const related = useMemo(() => (post ? blog.relatedPosts(post, 3) : []), [blog, post]);
  const category = post ? blog.getCategory(post.category) : null;
  const author = post ? blog.getAuthor(post.author) : null;
  const theme = post ? blog.themeForCategory(post.category) : null;
  const canonical = post ? `${SITE_ORIGIN}${postPath(post.slug)}` : "";

  // == Head tags + structured data ===========================================
  useEffect(() => {
    if (!post) {
      // An unknown slug must not be indexed, and must not inherit the previous
      // article's title.
      document.title = ui.missingDocumentTitle;
      applyPageSeo("__missing-blog-article");
      return undefined;
    }

    const publishedAuthor = blog.getAuthor(post.author);
    applyArticleSeo({
      title: post.metaTitle
        ? `${post.metaTitle} | SchoolMentor®`
        : `${post.title} | SchoolMentor®`,
      description: post.metaDescription || post.excerpt,
      path: postPath(post.slug),
      published: post.date,
      modified: post.updated || post.date,
      section: blog.getCategory(post.category).label,
      author: publishedAuthor.name,
      keywords: (post.keywords || post.tags || []).join(", "),
    });

    setJsonLd("article", {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "@id": `${SITE_ORIGIN}${postPath(post.slug)}#article`,
      mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_ORIGIN}${postPath(post.slug)}` },
      headline: post.title,
      description: post.metaDescription || post.excerpt,
      articleSection: blog.getCategory(post.category).label,
      keywords: (post.keywords || post.tags || []).join(", "),
      wordCount: (post.body || []).reduce((total, block) => total + String(block.text || "").split(/\s+/).length, 0),
      timeRequired: `PT${readingTime(post)}M`,
      inLanguage: "en",
      datePublished: post.date,
      dateModified: post.updated || post.date,
      author: { "@type": "Organization", name: publishedAuthor.name, url: `${SITE_ORIGIN}/about-us` },
      publisher: organizationLd(),
      image: `${SITE_ORIGIN}/og-image.png`,
    });

    setJsonLd("article-breadcrumb", {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_ORIGIN },
        { "@type": "ListItem", position: 2, name: "Blogs", item: `${SITE_ORIGIN}/blog` },
        { "@type": "ListItem", position: 3, name: post.title, item: `${SITE_ORIGIN}${postPath(post.slug)}` },
      ],
    });

    // An FAQPage block is what turns a result into an expandable answer panel,
    // so it is emitted whenever the article carries questions.
    if (post.faq?.length) {
      setJsonLd("article-faq", {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: post.faq.map(item => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      });
    }

    return () => {
      setJsonLd("article", null);
      setJsonLd("article-breadcrumb", null);
      setJsonLd("article-faq", null);
    };
  }, [post, blog, ui.missingDocumentTitle]);

  // Reset per-article UI state so navigating between articles does not carry
  // the previous article's open FAQ or scroll-depth events across.
  useEffect(() => {
    setOpenFaq(0);
    setCopied(false);
    setProgress(0);
    depthsSent.current = new Set();
  }, [slug]);

  // == Reading progress + scroll-depth analytics =============================
  useEffect(() => {
    if (!post) return undefined;
    let ticking = false;

    const measure = () => {
      ticking = false;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      const ratio = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
      setProgress(ratio);

      // Scroll milestones - one event per depth, per article.
      [25, 50, 75, 100].forEach(depth => {
        if (ratio * 100 >= depth && !depthsSent.current.has(depth)) {
          depthsSent.current.add(depth);
          trackEvent("blog_read_depth", { article_slug: post.slug, percent: depth });
        }
      });
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(measure);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    measure();
    return () => window.removeEventListener("scroll", onScroll);
  }, [post]);

  // == Active heading for the table of contents ==============================
  useEffect(() => {
    if (!post || !toc.length) return undefined;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) setActiveHeading(entry.target.id); });
    }, { rootMargin: "-90px 0px -70% 0px", threshold: 0 });

    toc.forEach(item => {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [post, toc]);

  const go = target => { if (setPage) setPage(target); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const toBlog = event => {
    if (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
    }
    if (setPage) setPage("blog");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const jumpTo = id => {
    const element = document.getElementById(id);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveHeading(id);
  };

  // == Missing article =======================================================
  if (!post) {
    return (
      <div className="blga page-enter">
        <style>{CSS}</style>
        <div className="bld-missing">
          <div className="bld-missing-icon"><IconMissing /></div>
          <h1>{ui.missingTitle}</h1>
          <p>{ui.missingText}</p>
          <div className="bld-missing-actions">
            <a className="bld-cta-btn" href={pathForPage("blog")} style={{ marginLeft: 0 }} onClick={toBlog}>
              {ui.missingBrowseButton} <IconArrow />
            </a>
            <button type="button" className="bld-share-btn" onClick={() => go("home")}>{ui.missingHomeButton}</button>
          </div>
        </div>
      </div>
    );
  }

  const copyLink = async () => {
    trackEvent("blog_share", { article_slug: post.slug, method: "copy_link" });
    try {
      await navigator.clipboard.writeText(canonical);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard access can be blocked; the URL bar still has the link.
      setCopied(false);
    }
  };

  const handleInlineCta = block => {
    trackEvent("blog_cta_click", { article_slug: post.slug, target: block.page, placement: "in_article" });
    go(block.page);
  };

  return (
    <article className="blga page-enter">
      <style>{CSS}</style>

      <div className="bld-progress" aria-hidden="true">
        <div className="bld-progress-bar" style={{ transform: `scaleX(${progress})` }} />
      </div>

      {/* == Hero ============================================================ */}
      <header className="bld-hero">
        <span className="bld-blob" aria-hidden="true" style={{
          width: 400, height: 400, background: "rgba(37,99,235,.12)",
          top: -80, right: -40, animation: "blga-bf 9s ease-in-out infinite",
        }} />
        <div className="bld-inner">
          <a className="bld-back" href={pathForPage("blog")} onClick={toBlog}><IconBack /> {ui.backLabel}</a>
          <div className="bld-tags">
            <span className={`bl-tag ${theme.tag}`}>{category.label}</span>
          </div>
          <h1 className="bld-title">{post.title}</h1>
          <div className="bld-meta">
            <strong>{author.name}</strong>
            <span className="bl-meta-dot" />
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span className="bl-meta-dot" />
            <span>{readingTime(post)} {ui.minRead}</span>
          </div>
        </div>
      </header>

      {/* == Cover =========================================================== */}
      <div className="bld-cover">
        <div className={`bld-cover-img ${theme.bv}`} aria-hidden="true">
          <span className="bl-glyph"><ArticleGlyph size={44} /></span>
        </div>
      </div>

      {/* == Body ============================================================ */}
      <div className="bld-body">
        {toc.length > 0 && (
          <nav className="bld-toc" aria-label="On this page">
            <div className="bld-toc-title"><IconList />{ui.tocTitle}</div>
            <ol>
              {toc.map(item => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className={activeHeading === item.id ? "is-active" : ""}
                    onClick={event => { event.preventDefault(); jumpTo(item.id); }}
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {post.takeaways?.length > 0 && (
          <section className="bld-takeaways" aria-label="Key takeaways">
            <div className="bld-takeaways-title"><IconBookmark />{ui.takeawaysTitle}</div>
            <ul>
              {post.takeaways.map((item, i) => (
                <li key={i}><IconCircleCheck /><span>{item}</span></li>
              ))}
            </ul>
          </section>
        )}

        <div className="bld-content">
          {(post.body || []).map((block, i) => (
            <Block key={i} block={block} ui={ui} onCta={handleInlineCta} />
          ))}
        </div>

        {/* Share / print / CTA */}
        <div className="bld-actions">
          <span className="bld-share-lbl">{ui.shareLabel}</span>
          <button type="button" className="bld-share-btn" onClick={copyLink}>
            {copied ? <IconCheck /> : <IconCopy />} {copied ? ui.copiedLabel : ui.copyLinkLabel}
          </button>
          <button type="button" className="bld-share-btn" onClick={() => window.print()}>
            <IconPrint /> {ui.printLabel}
          </button>
          <button
            type="button"
            className="bld-cta-btn"
            onClick={() => {
              trackEvent("blog_cta_click", { article_slug: post.slug, target: ui.articleCtaPage, placement: "article_actions" });
              go(ui.articleCtaPage);
            }}
          >
            {ui.articleCtaButton} <IconArrow />
          </button>
        </div>

        {post.tags?.length > 0 && (
          <div className="bld-topics">
            <span className="bld-share-lbl">{ui.topicsLabel}</span>
            {post.tags.map(tag => <span className="bld-topic" key={tag}>{tag}</span>)}
          </div>
        )}

        {post.faq?.length > 0 && (
          <section className="bld-faq" aria-labelledby="bld-faq-head">
            <h2 id="bld-faq-head">{ui.faqHeading}</h2>
            {post.faq.map((item, i) => (
              <div className={`bld-faq-item ${openFaq === i ? "is-open" : ""}`} key={i}>
                <button
                  type="button"
                  className="bld-faq-q"
                  onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                  aria-expanded={openFaq === i}
                >
                  <span>{item.q}</span>
                  <span className="bld-faq-chevron"><IconChevron /></span>
                </button>
                <div className="bld-faq-panel">
                  <div><p className="bld-faq-a">{item.a}</p></div>
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="bld-author" aria-label="About the author">
          <span className="bld-author-avatar"><IconPen /></span>
          <div>
            <div className="bld-author-name">{author.name}</div>
            <div className="bld-author-role">{author.role}</div>
            <p className="bld-author-bio">{author.bio}</p>
          </div>
        </section>
      </div>

      {/* == Related ========================================================= */}
      {related.length > 0 && (
        <section className="bld-related" aria-labelledby="bld-related-head">
          <h2 id="bld-related-head">{ui.relatedHeading}</h2>
          <div className="bld-rel-grid">
            {related.map(item => {
              const itemCategory = blog.getCategory(item.category);
              const itemTheme = blog.themeForCategory(item.category);
              return (
                <a
                  key={item.slug}
                  href={pathForPage(`blog/${item.slug}`)}
                  className="bl-card"
                  onClick={event => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                    event.preventDefault();
                    trackEvent("blog_article_open", { article_slug: item.slug, source: "related" });
                    if (setPage) setPage(`blog/${item.slug}`);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <div className={`bl-card-vis ${itemTheme.bv}`} aria-hidden="true" />
                  <div className="bl-card-body">
                    <span className={`bl-tag ${itemTheme.tag}`}>{itemCategory.label}</span>
                    <h3>{item.title}</h3>
                    <div className="bl-card-foot">
                      <span className="bl-card-meta">
                        <time dateTime={item.date}>{formatDate(item.date)}</time>
                        {" · "}
                        {readingTime(item)} {ui.minShort}
                      </span>
                      <span className="bl-card-btn">{ui.relatedButton}</span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      )}
    </article>
  );
}
