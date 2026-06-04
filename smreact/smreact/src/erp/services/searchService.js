/* ═══════════════════════════════════════════════════════════════════
   UNIVERSAL SEARCH SERVICE — single entry point for the global search.

   ARCHITECTURE
   ────────────
   The service is a thin orchestrator on top of a provider registry.
   Each ERP module registers a SearchProvider; the service iterates
   over enabled providers, fans out the query, merges results, applies
   activation + permission filters, ranks, groups, and returns.

   This file is the only thing the UI (UniversalSearch component) and
   the useUniversalSearch hook need to talk to. When the backend lands,
   each provider's `search()` function is the single seam to swap from
   in-memory mock data to an HTTP call — the UI stays unchanged.

   TYPES
   ─────
   SearchProvider = {
     moduleId:       string   // Must match MODULE_REGISTRY id (moduleConfig.js)
     navTarget:      string   // Key in App.js NAV_LABELS (used by navigate())
     moduleLabel:    string   // Display name ("Students", "Human Resource", …)
     icon:           string   // Font Awesome icon, no `fa-` prefix
     accent?:        string   // CSS color used by the result list
     priority?:      number   // Higher = earlier in grouped output (default 0)
     search:         (query: string, ctx: SearchContext) => Promise<SearchResult[]>
   }

   SearchResult = {
     id:           string          // Unique per provider+row
     title:        string          // Primary line shown to the user
     subtitle?:    string          // Optional: 2nd line shown smaller
     preview?:     string          // Optional: short hint text
     path:         string[]        // Breadcrumb: ["HR", "Employee Management"]
     navTarget:    string          // Same as provider.navTarget (denormalised)
     navParams?:   object          // Optional: forwarded to module on click
     icon?:        string          // Override the module icon if needed
     score?:       number          // Provider-supplied relevance (0..1)
     matchedField?:string          // Optional: which field caused the hit
   }

   SearchContext = {
     activeModuleIds:Set<string>   // From ModuleContext.moduleState
     canAccess:    (moduleId) => boolean
     sessionId?:   string          // Current session — providers may scope
     limit?:       number          // Cap per-provider rows (default 8)
     signal?:      AbortSignal     // For future debounced cancellation
   }
   ═══════════════════════════════════════════════════════════════════ */

const _providers = new Map();   // moduleId -> SearchProvider

/* ─── Registry API ────────────────────────────────────────────── */
export function registerSearchProvider(provider) {
  if (!provider || !provider.moduleId || typeof provider.search !== 'function') {
    throw new Error('[searchService] invalid provider (need moduleId + search())');
  }
  _providers.set(provider.moduleId, provider);
}
export function unregisterSearchProvider(moduleId) {
  _providers.delete(moduleId);
}
export function getRegisteredProviders() {
  return Array.from(_providers.values());
}

/* ─── Public search() entry point ─────────────────────────────── */
export async function search(query, ctx = {}) {
  const q = (query || '').trim();
  if (!q) {
    return { query: '', results: [], grouped: [], totalCount: 0 };
  }
  const {
    activeModuleIds = null,
    canAccess       = null,
    sessionId       = null,
    limit           = 8,
    signal          = null,
  } = ctx;

  const providers = getRegisteredProviders().filter(p => {
    if (activeModuleIds && !activeModuleIds.has(p.moduleId)) return false;
    if (typeof canAccess === 'function' && !canAccess(p.moduleId)) return false;
    return true;
  });

  /* Fan-out + collect. Per-provider failures are isolated so a single
     bad provider can never break the whole search. */
  const settled = await Promise.allSettled(
    providers.map(p =>
      Promise.resolve(p.search(q, { sessionId, limit, signal }))
        .then(rows => ({ provider: p, rows: Array.isArray(rows) ? rows : [] }))
    )
  );

  const grouped = [];
  const flat    = [];
  for (const r of settled) {
    if (r.status !== 'fulfilled') continue;
    const { provider, rows } = r.value;
    if (!rows.length) continue;
    const enriched = rows.slice(0, limit).map(row => ({
      ...row,
      navTarget:   row.navTarget   || provider.navTarget,
      icon:        row.icon        || provider.icon,
      moduleId:    provider.moduleId,
      moduleLabel: provider.moduleLabel,
      accent:      row.accent      || provider.accent,
      score:       typeof row.score === 'number' ? row.score : scoreByQuery(q, row),
    }));
    grouped.push({
      moduleId:    provider.moduleId,
      moduleLabel: provider.moduleLabel,
      icon:        provider.icon,
      accent:      provider.accent,
      priority:    provider.priority || 0,
      results:     enriched,
    });
    flat.push(...enriched);
  }

  /* Sort groups: by priority desc, then by result count desc. */
  grouped.sort((a, b) =>
    (b.priority - a.priority) || (b.results.length - a.results.length)
  );
  /* Sort flat results by score desc — used for the "Top results" view. */
  flat.sort((a, b) => (b.score || 0) - (a.score || 0));

  return {
    query:      q,
    results:    flat,
    grouped,
    totalCount: flat.length,
  };
}

/* ─── Default relevance scorer used when a provider doesn't supply one ── */
function scoreByQuery(query, row) {
  const q = query.toLowerCase();
  const title    = (row.title    || '').toLowerCase();
  const subtitle = (row.subtitle || '').toLowerCase();
  const preview  = (row.preview  || '').toLowerCase();
  if (title === q)            return 1.0;
  if (title.startsWith(q))    return 0.9;
  if (title.includes(q))      return 0.75;
  if (subtitle.includes(q))   return 0.55;
  if (preview.includes(q))    return 0.35;
  return 0.1;
}

/* ─── Helper for providers: case-insensitive substring across many fields ── */
export function matchAny(query, ...fields) {
  if (!query) return false;
  const q = String(query).trim().toLowerCase();
  if (!q) return false;
  return fields.some(f => f != null && String(f).toLowerCase().includes(q));
}
