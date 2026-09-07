import React, { useState } from 'react';
import { HOW_IT_WORKS } from './howItWorksData';

/* ═══════════════════════════════════════════════════════════════════
   HowItWorks — reusable help layer for the 4 Mentor AI functionalities.

   HowItWorksButton (the pulsing "i")
        ↓
   HowItWorksModal (looks up content by topic key(s), header + optional
        tab switch + steps, reuses the app's existing .modal-overlay/
        .modal pattern — same convention as every other modal in this
        module, e.g. Wallet's upgrade modal)
        ↓
   HowItWorksStep[] (rendered from data)

   Content lives entirely in howItWorksData.js — this file is UI only.
   Purely explanatory: no workflow, API, or functionality changes.

   Usage: <HowItWorksButton topicKeys={['lessonPlans', 'notebookPlans']} />
   Pass one key for a single-topic screen (chat, worksheets, designStudio),
   or two for Lesson Plans, which hosts both guides behind one button
   since Notebook Work lives inside the same screen (see LessonPlans.jsx).
   ═══════════════════════════════════════════════════════════════════ */

export function HowItWorksButton({ topicKeys, label = 'How it works' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="msai-hiw-btn" onClick={() => setOpen(true)} aria-label={label} title={label}>
        <i className="fa-solid fa-circle-info" aria-hidden="true" />
      </button>
      {open && <HowItWorksModal topicKeys={topicKeys} onClose={() => setOpen(false)} />}
    </>
  );
}

function HowItWorksModal({ topicKeys, onClose }) {
  const [activeKey, setActiveKey] = useState(topicKeys[0]);
  const topic = HOW_IT_WORKS[activeKey];
  if (!topic) return null;

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal msai-hiw-modal">
        <div className="msai-hiw-head">
          <div className="msai-hiw-head-ic"><i className={`fa-solid ${topic.icon}`} aria-hidden="true" /></div>
          <div className="msai-hiw-head-txt">
            <div className="msai-hiw-head-t">{topic.title}</div>
            <div className="msai-hiw-head-s">{topic.description}</div>
          </div>
          <button type="button" className="msai-icon-btn" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
        </div>

        {topicKeys.length > 1 && (
          <div className="msai-hiw-tabs">
            {topicKeys.map(k => (
              <button
                key={k}
                type="button"
                className={`msai-hiw-tab${k === activeKey ? ' active' : ''}`}
                onClick={() => setActiveKey(k)}
              >
                {HOW_IT_WORKS[k].title}
              </button>
            ))}
          </div>
        )}

        <div className="msai-hiw-body">
          {topic.steps.map((s, i) => (
            <HowItWorksStep key={`${activeKey}-${i}`} index={i + 1} icon={s.icon} title={s.title} text={s.text} />
          ))}
        </div>

        <div className="msai-hiw-foot">
          <button type="button" className="msai-btn-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}

function HowItWorksStep({ index, icon, title, text }) {
  return (
    <div className="msai-hiw-step">
      <div className="msai-hiw-step-num">{index}</div>
      <div className="msai-hiw-step-body">
        <div className="msai-hiw-step-h"><i className={`fa-solid ${icon}`} aria-hidden="true" /> {title}</div>
        <div className="msai-hiw-step-s">{text}</div>
      </div>
    </div>
  );
}
