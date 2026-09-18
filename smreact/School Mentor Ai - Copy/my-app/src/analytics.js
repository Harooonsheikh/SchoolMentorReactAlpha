// ─── ANALYTICS (no-op shim) ───────────────────────────────────────────────────
// The reference blog calls trackEvent(...) from a few places (article opens,
// category filters, search, scroll depth, share, CTA clicks). This project has
// no analytics provider wired in, so these are inert stubs that keep the blog
// components working without pulling in a dependency. Swap the body of
// trackEvent for a real call (GA4, Plausible, …) if analytics is added later.

/** Fire a custom analytics event. Currently a no-op. */
export function trackEvent(/* name, params */) {}

/** Send one page_view. Currently a no-op. */
export function trackPageView(/* path, title */) {}

/** True when an analytics provider is configured. */
export const analyticsEnabled = false;
