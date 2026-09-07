import React, { useEffect, useState } from 'react';
import * as mentorAIWalletService from '../../services/mentorAIWalletService';

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
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')}-${MONTHS_SHORT[m - 1]}-${y}`;
}

export default function Wallet({ goTo }) {
  const [data, setData] = useState(null);
  const [viewPlanId, setViewPlanId] = useState(null);
  const [tooltipKey, setTooltipKey] = useState(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [bank, setBank] = useState(null);

  useEffect(() => {
    mentorAIWalletService.getWalletData().then(d => { setData(d); setViewPlanId(d.activePlanId); });
  }, []);

  if (!data) return null;
  const plan = data.plans.find(p => p.id === viewPlanId) || data.plans.find(p => p.isCurrent);

  const openUpgrade = () => {
    if (!bank) mentorAIWalletService.getBankDetails().then(setBank);
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
            onClick={() => { setViewPlanId(p.id); setTooltipKey(null); }}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="mwallet-hero">
        <div className="mwallet-hero-top">
          <div>
            <div className="mwallet-hero-name">{plan.name} Plan</div>
            <div className="mwallet-hero-tagline">{plan.tagline}</div>
          </div>
          {plan.isCurrent && (
            <span className="mwallet-hero-badge"><span className="mwallet-hero-badge-dot" /> Your Current Plan</span>
          )}
        </div>
        <div className="mwallet-hero-price">{plan.price ? <>Rs. {plan.price.toLocaleString()} <span>/ month</span></> : 'Free'}</div>
      </div>

      <div className="mwallet-cards">
        {data.features.map(f => {
          const total = plan.totals[f.key];
          const used = plan.used[f.key] || 0;
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
                {plan.isCurrent && <div><span>Due Date</span><b>{fmtDate(plan.dueDate)}</b></div>}
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

      {!(plan.id === 'premium' && plan.isCurrent) && (
        <button type="button" className="mwallet-upgrade-btn" onClick={openUpgrade}>
          <i className="fa-solid fa-crown" aria-hidden="true" /> Upgrade to Premium
        </button>
      )}

      {upgradeOpen && (
        <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) setUpgradeOpen(false); }}>
          <div className="modal modal-sm">
            <div className="mwallet-modal-head">
              <span>Upgrade to Premium</span>
              <button type="button" className="mwallet-info-btn" onClick={() => setUpgradeOpen(false)} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
            </div>
            <div className="mwallet-modal-body">
              <div className="mwallet-modal-plan">
                <i className="fa-solid fa-crown" aria-hidden="true" /> Premium — Rs. {data.plans.find(p => p.id === 'premium').price.toLocaleString()} / month
              </div>
              <div className="mwallet-modal-steps-h">How to Upgrade — 3 Simple Steps</div>
              <ol className="mwallet-modal-steps">
                <li>Transfer the plan amount to the bank account below.</li>
                <li>Send your payment screenshot on WhatsApp.</li>
                <li>Our team activates your new plan within 24 hours.</li>
              </ol>
              {bank && (
                <div className="mwallet-bank-card">
                  <div><span>Bank Name</span><b>{bank.bankName}</b></div>
                  <div><span>Account Title</span><b>{bank.accountTitle}</b></div>
                  <div><span>Account No.</span><b>{bank.accountNo}</b></div>
                  <div><span>IBAN</span><b>{bank.iban}</b></div>
                </div>
              )}
              {bank && (
                <a
                  className="mwallet-upgrade-btn"
                  style={{ textDecoration: 'none' }}
                  href={`https://wa.me/${bank.whatsapp.replace(/[^0-9]/g, '')}`}
                  target="_blank" rel="noreferrer"
                >
                  <i className="fa-brands fa-whatsapp" aria-hidden="true" /> WhatsApp School Mentor
                </a>
              )}
              <button type="button" className="msai-btn-secondary" onClick={() => setUpgradeOpen(false)}>Maybe Later</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
