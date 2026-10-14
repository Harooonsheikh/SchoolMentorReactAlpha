import React, { useEffect, useState } from 'react';
import * as mentorAIWalletService from './services/mentorAIWalletService';

/* ═══════════════════════════════════════════════════════════════════
   Wallet — redesigned to match the Mentor AI mobile app's Wallet
   screens (reference screenshots): a back header, purple-gradient
   plan tabs, a large current-plan hero card, four usage cards (AI
   Chat Tokens, Screens / Scans, Worksheets, Design Studio) each with
   an info tooltip where specced and a progress bar, and a single
   "Upgrade to Premium" CTA. Upgrading is a manual bank-transfer +
   WhatsApp flow (same as before) — a tab click only PREVIEWS a tier,
   it never instantly switches plans.
   ═══════════════════════════════════════════════════════════════════ */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${String(d).padStart(2, '0')}-${MONTHS_SHORT[m - 1]}-${y}`;
}

const PLAN_THEMES = {
  basic:   { gradient: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)' }, // light blue
  pro:     { gradient: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)' }, // dark blue
  premium: { gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }, // purple
};
const themeFor = (id) => PLAN_THEMES[id] || PLAN_THEMES.pro;

const PLAN_PRICE_OVERRIDE = { premium: 7000 };
const priceFor = (p) => PLAN_PRICE_OVERRIDE[p?.id] ?? p?.price;

export default function Wallet({ goTo }) {
  console.log("WALLET COMPONENT OPENED");
  const [data, setData] = useState(null);
  const [viewPlanId, setViewPlanId] = useState(null);
  const [tooltipKey, setTooltipKey] = useState(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [bank, setBank] = useState(null);
  const [loadError, setLoadError] = useState('');

  /* Live usage from /ai/api/wallet/ — re-read every time the Wallet is
     opened (this component remounts on each visit). */
  const load = () => {
    setLoadError('');
    mentorAIWalletService.getWalletData()
      .then((d) => {
        setData(d);
        setViewPlanId(prev => prev || d.activePlanId);
      })
      .catch((error) => {
        console.error("WALLET ERROR:", error?.response?.data || error);
        setLoadError(error?.response?.status === 401
          ? 'Your Mentor AI session has expired. Please reload the page.'
          : 'Could not load your wallet. Please try again.');
      });
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Basic → Pro, Pro → Premium (next plan up from the one on screen).
     Viewing a lower plan than the current one: offer the next plan above
     the current one instead. Nothing above → no upgrade button. */
  const upgradeTarget = (() => {
    if (!data) return null;
    const idx = (id) => data.plans.findIndex(p => p.id === id);
    const viewed = data.plans.find(p => p.id === viewPlanId) || data.plans.find(p => p.isCurrent);
    const current = data.plans.find(p => p.isCurrent);
    const from = Math.max(idx(viewed?.id), current ? idx(current.id) : -1);
    return data.plans[from + 1] || null;
  })();

  if (!data) {
    return (
      <div className="mwallet">
        <div className="msai-card msai-lib-empty">
          {loadError
            ? <><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /><div>{loadError}</div>
                <button type="button" className="msai-btn-primary" onClick={load}><i className="fa-solid fa-rotate-right" aria-hidden="true" /> Try again</button></>
            : <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /><div>Loading your wallet…</div></>}
        </div>
      </div>
    );
  }
  const plan = data.plans.find(p => p.id === viewPlanId) || data.plans.find(p => p.isCurrent);

  const openUpgrade = () => {
    setUpgradeOpen(true);
  };
  return (
    <div className="mwallet">
      <div className="mwallet-header">
        <button type="button" className="mwallet-back" onClick={() => goTo?.('chat')} aria-label="Back">
          <i className="fa-solid fa-arrow-left" aria-hidden="true" />
        </button>
        <div className="mwallet-title">Wallet</div>
      </div>

      <div className="mwallet-plan-tabs">
        {data.plans.map(p => (
      <button
            key={p.id}
            type="button"
            className={`mwallet-plan-tab${p.id === viewPlanId ? ' active' : ''}`}
            style={p.id === viewPlanId ? { background: themeFor(p.id).gradient, color: '#fff' } : undefined}
            onClick={() => { setViewPlanId(p.id); setTooltipKey(null); }}
          >
                  {p.name}
{p.isCurrent && (
  <span style={{
    marginLeft: 6, padding: '1px 7px', borderRadius: 999,
    fontSize: 10, fontWeight: 700, background: '#16a34a',
    color: '#fff', verticalAlign: 'middle'
  }}>Active</span>
)}          </button>
        ))}
      </div>

      <div className="mwallet-hero" style={{ background: themeFor(plan.id).gradient, backgroundImage: themeFor(plan.id).gradient }}>
        <div className="mwallet-hero-top">
          <div>
            <div className="mwallet-hero-name">{plan.name}</div>   
       <div className="mwallet-hero-tagline">{plan.tagline}</div>
          </div>
              {plan.isCurrent ? (
            <span className="mwallet-hero-badge"><span className="mwallet-hero-badge-dot" /> Your Current Plan</span>
          ) : (
<span className="mwallet-hero-badge" style={{ opacity: 0.85 }}>Preview</span>          )}
        </div>
<div className="mwallet-hero-price">{priceFor(plan) ? <>Rs. {Number(priceFor(plan)).toLocaleString()} <span>/ month</span></> : 'Free'}</div>      </div>

      <div className="mwallet-cards">
{data.features.map(f => {
    const currentPlan = data.plans.find(p => p.isCurrent);
    const total = plan.totals?.[f.key] ?? 0;
    // Only the current plan has real usage; every other tab shows 0
    const used = plan.isCurrent ? (plan.used?.[f.key] ?? 0) : 0;
    const remaining = Math.max(0, total - used);
    const pct = total ? Math.min(100, (used / total) * 100) : 0;
          return (
            <div key={f.key} className="mwallet-card">
              <div className="mwallet-card-h">
                <span className="mwallet-card-title"><i className={`fa-solid ${f.icon}`} aria-hidden="true" /> {f.title}</span>
                {f.tooltip && (
                  <div className="mwallet-info-wrap">
                    <button
                      type="button"
                      className="mwallet-info-btn"
                      onClick={() => setTooltipKey(k => (k === f.key ? null : f.key))}
                      aria-label={`About ${f.title}`}
                    >
                      <i className="fa-solid fa-circle-info" aria-hidden="true" />
                    </button>
                    {tooltipKey === f.key && (
                      <>
                        <div className="mwallet-tooltip-backdrop" onClick={() => setTooltipKey(null)} />
                        <div className="mwallet-tooltip">{f.tooltip}</div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="mwallet-rows">
                <div><span>{f.totalLabel}</span><b>{total.toLocaleString()}</b></div>
                <div><span>{f.usedLabel}</span><b>{used.toLocaleString()}</b></div>
                <div><span>Remaining</span><b>{remaining.toLocaleString()}</b></div>
{currentPlan?.id === plan.id && (
  <div>
    <span>Due Date</span>
    <b>{fmtDate(currentPlan.dueDate)}</b>
  </div>
)}
              </div>

              <div className="mwallet-bar"><div className="mwallet-bar-fill" style={{ width: `${pct}%` }} /></div>
              <div className="mwallet-bar-caption">
                <span>{pct.toFixed(1)}% used</span>
                <span>{remaining.toLocaleString()} left</span>
              </div>
            </div>
          );
        })}
      </div>

      {upgradeTarget && (
<button type="button" className="mwallet-upgrade-btn" onClick={openUpgrade} style={{ background: themeFor(upgradeTarget.id).gradient }}>          <i className="fa-solid fa-crown" aria-hidden="true" /> Upgrade to {upgradeTarget.name}
        </button>
      )}

      {upgradeOpen && (
        <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) setUpgradeOpen(false); }}>
          <div className="modal modal-sm">
            <div className="mwallet-modal-head">
              <span>Upgrade to {upgradeTarget?.name}</span>
              <button type="button" className="mwallet-info-btn" onClick={() => setUpgradeOpen(false)} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
            </div>
            <div className="mwallet-modal-body">
              <div className="mwallet-modal-plan">
                <i className="fa-solid fa-crown" aria-hidden="true" /> {upgradeTarget?.name}{priceFor(upgradeTarget) ? <> — Rs. {Number(priceFor(upgradeTarget)).toLocaleString()} / month</> : null}
              </div>
                  <div className="mwallet-modal-steps-h">How to Upgrade — 4 Simple Steps</div>
              <p style={{ margin: '0 0 12px', fontSize: 13, opacity: 0.8, lineHeight: 1.5 }}>
                Plan upgrades are handled securely through the Mentor AI mobile app (Admin account).
              </p>
              <ol className="mwallet-modal-steps">
                <li>Open the <b>Mentor AI</b> mobile app and sign in with your <b>Admin</b> account.</li>
                <li>Tap <b>Wallet</b> from the menu.</li>
                <li>Select the <b>{upgradeTarget?.name}</b> plan.</li>
                <li>Tap <b>Purchase</b> and complete the payment. Your new plan activates automatically.</li>
              </ol>
              <div style={{
                display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px',
                borderRadius: 10, background: 'rgba(139,92,246,0.08)', fontSize: 12.5, lineHeight: 1.5, margin: '12px 0'
              }}>
                <i className="fa-solid fa-circle-info" aria-hidden="true" style={{ marginTop: 3, color: '#7c3aed' }} />
                <span>Once purchased, your upgraded limits will appear here the next time you open the Wallet.</span>
              </div>
              <button type="button" className="msai-btn-primary" onClick={() => setUpgradeOpen(false)}>Got It</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
