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
  basic:   { gradient: 'linear-gradient(135deg, #93C5FD 0%, #2563EB 100%)' }, // light blue
  premium: { gradient: 'linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)' }, // dark blue
};
const themeFor = (id) => PLAN_THEMES[id] || PLAN_THEMES.premium;

const PLAN_PRICE_OVERRIDE = { premium: 7000 };
const priceFor = (p) => PLAN_PRICE_OVERRIDE[p?.id] ?? p?.price;

const errText = (e) => {
  const d = e?.response?.data;
  return (typeof d === 'string' ? d : d?.error || d?.message || d?.detail) || e?.message || 'Something went wrong.';
};

/* Super-admin only: all branches' wallet status + plan. Renders nothing
   unless the admin list call succeeds (401/403/404 → silently hidden). */
function WalletAdminSection({ plans }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');

  const load = () => mentorAIWalletService.getBranchSubscriptions().then(setRows).catch(() => setRows(null));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!rows) return null;

  const run = async (key, fn, okMsg) => {
    setBusy(key); setNote('');
    try { await fn(); setNote(okMsg); await load(); } catch (e) { setNote(errText(e)); } finally { setBusy(''); }
  };

  return (
    <div className="msai-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="msai-step-title">Branch Subscriptions <span className="msai-step-pill">Super Admin</span></div>
      {note && <div className="msai-tip-card"><i className="fa-solid fa-circle-info" aria-hidden="true" /> {note}</div>}
      {rows.length === 0 && <div className="msai-empty-state">No branches found.</div>}
      <div style={{ overflowX: 'auto' }}>
        <table className="msai-nb-table">
          <thead><tr><th>Branch</th><th>Plan</th><th>Wallet</th><th>Change plan</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.branchId}>
                <td>{r.name || `Branch ${r.branchId}`}<div style={{ fontSize: 11, opacity: .6 }}>#{r.branchId}</div></td>
                <td>{r.planCode || '—'}</td>
                <td>
                  <label className="msai-toggle-wrap" title="Wallet enabled">
                    <input type="checkbox" className="msai-toggle-input" checked={!!r.walletEnabled} disabled={busy === `s${r.branchId}`}
                      onChange={(e) => run(`s${r.branchId}`, () => mentorAIWalletService.setBranchWalletStatus(r.branchId, e.target.checked), 'Wallet status updated')} />
                    <span className="msai-toggle-track"><span className="msai-toggle-knob" /></span>
                  </label>
                </td>
                <td>
                  <select defaultValue="" disabled={busy === `p${r.branchId}`}
                    onChange={(e) => { const code = e.target.value; e.target.value = ''; if (code) run(`p${r.branchId}`, () => mentorAIWalletService.setBranchSubscription(r.branchId, code, true), `Plan changed to ${code} (period reset)`); }}>
                    <option value="">Select…</option>
                    {plans.map(p => <option key={p.id} value={p.code || p.id}>{p.name}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Wallet({ goTo }) {
  console.log("WALLET COMPONENT OPENED");
  const [paying, setPaying] = useState(false);
  const [payNote, setPayNote] = useState('');
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

  /* Basic → Premium (next plan up from the one on screen).
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
    setPayNote('');
    setUpgradeOpen(true);
  };

  /* POST /ai/api/wallet/payment/ — open the checkout URL if the server gives
     one, otherwise show its message and re-read the wallet. */
  const purchase = async () => {
    if (!upgradeTarget || paying) return;
    setPaying(true); setPayNote('');
    try {
      const r = await mentorAIWalletService.purchasePlan(upgradeTarget.code || upgradeTarget.id);
      if (r.url) {
        window.open(r.url, '_blank', 'noopener');
        setPayNote('Payment page opened in a new tab. Complete the payment there — your plan updates automatically.');
      } else {
        setPayNote(r.message || 'Purchase request sent.');
        load();
      }
    } catch (e) {
      setPayNote(errText(e));
    } finally { setPaying(false); }
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
                <i className="fa-solid fa-circle-info" aria-hidden="true" style={{ marginTop: 3, color: '#1D4ED8' }} />
                <span>Once purchased, your upgraded limits will appear here the next time you open the Wallet.</span>
              </div>
              {payNote && <div style={{ fontSize: 12.5, lineHeight: 1.5, margin: '0 0 12px' }}>{payNote}</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="msai-btn-primary" disabled={paying} onClick={purchase}>
                  <i className={`fa-solid ${paying ? 'fa-spinner fa-spin' : 'fa-credit-card'}`} aria-hidden="true" /> Purchase {upgradeTarget?.name} now
                </button>
                <button type="button" className="msai-btn-secondary" onClick={() => setUpgradeOpen(false)}>Got It</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <WalletAdminSection plans={data.plans} />
    </div>
  );
}
