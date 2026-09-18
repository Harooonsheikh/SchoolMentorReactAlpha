// ─── ROUTE TABLE ──────────────────────────────────────────────────────────────
// The site used to navigate with hash fragments (#about, #blog). Google treats
// everything after "#" as the same URL, so the whole site was indexable as one
// page and no blog article could ever rank on its own. This table maps the
// existing internal page keys to real crawlable paths.
//
// Legacy #hash links are still understood and are rewritten to the new path on
// arrival, so old bookmarks, shared links and any stale external links keep
// working.
//
// Deep links (/blog/some-article) require the server to serve index.html for
// unknown paths. public/.htaccess does that for the LiteSpeed/Apache host.

export const ROUTES = [
  { page: "home", path: "/" },
  { page: "about", path: "/about" },
  { page: "pricing", path: "/pricing" },
  { page: "success", path: "/success-stories" },
  { page: "faq", path: "/faq" },
  { page: "contact", path: "/contact" },
  { page: "demo", path: "/request-demo" },
  { page: "blog", path: "/blog" },
  { page: "privacy", path: "/privacy-policy" },
  { page: "terms", path: "/terms-and-conditions" },

  // Service pages (serviceData keys in App.js)
  { page: "web", path: "/services/school-erp" },
  { page: "mobile", path: "/services/mobile-app" },
  { page: "manuals", path: "/services/operational-manuals" },
  { page: "trainings", path: "/services/teacher-trainings" },
  { page: "ai", path: "/services/mentor-ai" },

  // Audience pages (audienceData keys in App.js)
  { page: "for-admin", path: "/for-administrators" },
  { page: "for-teachers", path: "/for-teachers" },
  { page: "for-parents", path: "/for-parents" },
  { page: "for-students", path: "/for-students" },
];

const BY_PAGE = new Map(ROUTES.map((r) => [r.page, r.path]));
const BY_PATH = new Map(ROUTES.map((r) => [r.path, r.page]));

export const BLOG_PAGE_PREFIX = "blog/";

/** Internal page key -> site-relative path. */
export function pathForPage(page) {
  if (!page) return "/";
  if (page.startsWith(BLOG_PAGE_PREFIX)) {
    return `/blog/${page.slice(BLOG_PAGE_PREFIX.length)}`;
  }
  return BY_PAGE.get(page) || "/404";
}

/** URL pathname -> internal page key ("404" when nothing matches). */
export function pageForPath(pathname) {
  let p = (pathname || "/").split("?")[0].split("#")[0];
  // Tolerate trailing slashes: /blog/ and /blog are the same page.
  if (p.length > 1) p = p.replace(/\/+$/, "");
  if (p === "") p = "/";

  const direct = BY_PATH.get(p);
  if (direct) return direct;

  if (p.startsWith("/blog/")) {
    const slug = p.slice("/blog/".length);
    if (slug && !slug.includes("/")) return BLOG_PAGE_PREFIX + slug;
  }
  return "404";
}

/**
 * Resolve the page for the current URL, honouring legacy #hash links.
 * Returns { page, canonicalPath, isLegacyHash }.
 */
export function resolveLocation(loc = window.location) {
  const rawHash = (loc.hash || "").replace(/^#\/?/, "");
  const isRoot = loc.pathname === "/" || loc.pathname === "";

  if (rawHash && isRoot) {
    // Old-style link: #blog, #about, or #blog/slug
    const hashPage = rawHash.startsWith(BLOG_PAGE_PREFIX)
      ? rawHash
      : BY_PAGE.has(rawHash)
        ? rawHash
        : null;
    if (hashPage) {
      return {
        page: hashPage,
        canonicalPath: pathForPage(hashPage),
        isLegacyHash: true,
      };
    }
  }

  const page = pageForPath(loc.pathname);
  return { page, canonicalPath: pathForPage(page), isLegacyHash: false };
}
