import React, { useEffect, useRef, useState } from 'react';
import * as mentorAiStudioService from '../../services/mentorAiStudioService';
import { GeneratingProgress, VersionBadge, AttachmentPicker, revokeAttachments, VoiceDictationButton } from './MentorAIShared';
import { HowItWorksButton } from './HowItWorks';
import {
  DS_PLATFORMS, DS_CATEGORIES, DS_QUICK_TAGS, DS_EDIT_CHIPS,
  GENERATING_FACTS, DESIGN_GENERATING_STEPS,
} from './mentorAiStudioData';

/* ═══════════════════════════════════════════════════════════════════
   DesignStudio — branded social-post generator.
   Ported from the prototype's design-studio-landing / step1 (category)
   / step2 (content & branding) / loading / result screens.
   ═══════════════════════════════════════════════════════════════════ */

export default function DesignStudio({ toast, onConsumed }) {
  const [step, setStep] = useState('landing');
  const [platform, setPlatform] = useState(null);
  const [customSize, setCustomSize] = useState({ w: 1080, h: 1080 });
  const [category, setCategory] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [branding, setBranding] = useState({ logo: true, name: true, contact: true, address: false });
  const [brandColor, setBrandColor] = useState('');
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [draftColor, setDraftColor] = useState('#1E40AF');
  const colorInputRef = useRef(null);
  const [refImages, setRefImages] = useState([]);
  const [post, setPost] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  const reset = () => {
    revokeAttachments(refImages);
    setStep('landing'); setPlatform(null); setCategory(null); setPrompt(''); setPost(null); setRefImages([]);
    setBrandColor(''); setColorPickerOpen(false);
  };

  const openColorPicker = () => { setDraftColor(brandColor || '#1E40AF'); setColorPickerOpen(true); };
  /* Clicking the picker button reveals the popover AND immediately opens
     the native color slate (hue/saturation picker) on the swatch inside
     it, so the user can pick a color in one click instead of two. The
     swatch is scrolled to the vertical center of the viewport first —
     the browser positions that native picker relative to the swatch,
     and if the swatch sits near the top/bottom edge the picker can
     render partly off-screen. Centering it first keeps the picker
     fully within the visible screen. */
  useEffect(() => {
    if (!colorPickerOpen) return undefined;
    colorInputRef.current?.scrollIntoView({ block: 'center', inline: 'center' });
    const t = setTimeout(() => colorInputRef.current?.click(), 60);
    return () => clearTimeout(t);
  }, [colorPickerOpen]);
  const confirmColor = () => {
    if (/^#[0-9a-fA-F]{6}$/.test(draftColor)) setBrandColor(draftColor.toUpperCase());
    setColorPickerOpen(false);
  };
  const onHexInput = (raw) => {
    const hex = raw.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
    setDraftColor(`#${hex}`);
  };
  const addRefImage = (item) => setRefImages(prev => [...prev, item]);
  const removeRefImage = (id) => {
    setRefImages(prev => {
      const found = prev.find(im => im.id === id);
      if (found?.url) URL.revokeObjectURL(found.url);
      return prev.filter(im => im.id !== id);
    });
  };

  const toggleTag = (tag) => setPrompt(p => (p.includes(tag) ? p : p ? `${p} ${tag}.` : `${tag}.`));

  const runGenerate = async () => {
    setStep('generating'); setGenerating(true);
    try {
      /* Brand color is appended to the same `prompt` instruction string
         already sent to generateDesignPost — no new API/params shape,
         just an extra sentence when the user has actually picked one. */
      const promptWithBrand = brandColor
        ? `${prompt}\n\nUse the school's selected brand color: ${brandColor}.`
        : prompt;
      const res = await mentorAiStudioService.generateDesignPost({
        category: category.id, categoryName: category.name,
        platform: platform === 'custom' ? 'custom' : platform.id,
        platformName: platform === 'custom' ? `Custom ${customSize.w}×${customSize.h}` : platform.name,
        prompt: promptWithBrand, branding, brandColor,
      });
      setPost(res); setStep('result');
      onConsumed?.();
    } finally { setGenerating(false); }
  };

  return (
    <div className="msai-ds">
      {step !== 'landing' && (
        <button type="button" className="msai-back-link" onClick={() => (step === 'result' ? reset() : setStep(step === 'category' ? 'landing' : 'category'))}>
          <i className="fa-solid fa-arrow-left" aria-hidden="true" /> {step === 'result' ? 'Start Over' : 'Back'}
        </button>
      )}

      {step === 'landing' && (
        <div className="msai-card msai-ds-step">
          <div className="msai-ds-hero">
            <div className="msai-step-title">Design Studio <HowItWorksButton topicKeys={['designStudio']} /></div>
            <div className="msai-step-sub">Branded social posts for your school, generated in minutes.</div>
            <div className="msai-ds-pills">
              <span><i className="fa-solid fa-pen-nib" aria-hidden="true" /> AI writes your copy</span>
              <span><i className="fa-solid fa-school" aria-hidden="true" /> Auto school branding</span>
              <span><i className="fa-solid fa-download" aria-hidden="true" /> HD download ready</span>
            </div>
          </div>
          <div className="msai-field"><label>Platform &amp; Size</label>
            <div className="msai-ds-platform-grid">
              {DS_PLATFORMS.map(p => (
                <button key={p.id} type="button" className={`msai-ds-platform-card${platform?.id === p.id ? ' selected' : ''}`} onClick={() => setPlatform(p)}>
                  <div className="msai-ds-platform-name">{p.name}</div>
                  <div className="msai-ds-platform-size">{p.size}</div>
                </button>
              ))}
              <button type="button" className={`msai-ds-platform-card${platform === 'custom' ? ' selected' : ''}`} onClick={() => setPlatform('custom')}>
                <div className="msai-ds-platform-name">Custom Size</div>
                <div className="msai-ds-platform-size">Set your own</div>
              </button>
            </div>
            {platform === 'custom' && (
              <div className="msai-form-grid" style={{ marginTop: 10 }}>
                <Field label="Width (px)"><input type="number" value={customSize.w} onChange={e => setCustomSize(s => ({ ...s, w: Number(e.target.value) || 0 }))} /></Field>
                <Field label="Height (px)"><input type="number" value={customSize.h} onChange={e => setCustomSize(s => ({ ...s, h: Number(e.target.value) || 0 }))} /></Field>
              </div>
            )}
          </div>
          <div className="msai-ds-stats">
            <div><b>10k+</b><span>Posts Created</span></div>
            <div><b>2 min</b><span>Avg Design Time</span></div>
            <div><b>500+</b><span>Schools Using</span></div>
          </div>
          <button type="button" className="msai-btn-primary" style={{ alignSelf: 'flex-end' }} disabled={!platform} onClick={() => setStep('category')}>Start Creating <i className="fa-solid fa-arrow-right" aria-hidden="true" /></button>
          <div className="msai-hint-text" style={{ textAlign: 'left' }}>School logo &amp; contact number are auto-added from your profile.</div>
        </div>
      )}

      {step === 'category' && (
        <div className="msai-card msai-ds-step">
          <div className="msai-step-title">Post Category <span className="msai-step-pill">Step 1 of 2</span></div>
          <div className="msai-step-sub">What is this post about?</div>
          <div className="msai-content-type-grid">
            {DS_CATEGORIES.map(c => (
              <button key={c.id} type="button" className="msai-content-type-card" onClick={() => { setCategory(c); setStep('content'); }}>
                <i className={`fa-solid ${c.icon}`} aria-hidden="true" />
                <div className="msai-ctc-title">{c.name}</div>
                <div className="msai-ctc-desc">{c.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'content' && category && (
        <div className="msai-card msai-ds-step">
          <div className="msai-step-title">Content &amp; Branding <span className="msai-step-pill">Step 2 of 2</span></div>
          <span className="msai-mode-tag" style={{ background: 'rgba(21,101,192,.1)', color: '#1E3A8A', alignSelf: 'flex-start' }}>{category.name}</span>
          <Field label={`Describe your post (${prompt.length}/500)`}>
            <div className="msai-field-voice-wrap">
              <textarea rows={4} maxLength={500} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="What should this post say?" />
              <VoiceDictationButton onResult={t => setPrompt(p => (p.trim() ? `${p.trim()} ${t}`.slice(0, 500) : t.slice(0, 500)))} />
            </div>
          </Field>
          <div className="msai-chip-row">{DS_QUICK_TAGS.map(t => <button key={t} type="button" className="msai-chip" onClick={() => toggleTag(t)}>+ {t}</button>)}</div>

          {/* ─── Brand Color Theme ───
              Feeds into the same `prompt` instruction string already
              sent to generateDesignPost (see runGenerate) — no new API
              shape, just an extra sentence appended when a color is set. */}
          <div className="msai-brandcolor-card">
            <div className="msai-brandcolor-head">
              <span className="msai-brandcolor-ic"><i className="fa-solid fa-palette" aria-hidden="true" /></span>
              <div>
                <div className="msai-brandcolor-title">Brand Color Theme</div>
                <div className="msai-brandcolor-desc">Pick your exact brand color. AI will apply it across backgrounds, gradients, accents, highlights and all design elements.</div>
              </div>
            </div>

            <div className="msai-brandcolor-row">
              <span className="msai-brandcolor-lbl">Brand Color</span>
              <span className="msai-brandcolor-val">{brandColor || 'Not set'}</span>
              <span className="msai-brandcolor-swatch" style={{ background: brandColor || 'var(--brand-primary)' }} />
              <button type="button" className="msai-brandcolor-btn" onClick={openColorPicker} aria-label="Pick brand color" title="Pick brand color">
                <i className="fa-solid fa-eye-dropper" aria-hidden="true" />
              </button>

              {colorPickerOpen && (
                <div className="msai-brandcolor-popover">
                  <input
                    ref={colorInputRef}
                    type="color"
                    className="msai-brandcolor-native"
                    value={draftColor}
                    onChange={e => setDraftColor(e.target.value)}
                    aria-label="Choose brand color visually"
                  />
                  <label className="msai-brandcolor-hexfield">
                    <span>#</span>
                    <input
                      type="text"
                      value={draftColor.replace('#', '')}
                      onChange={e => onHexInput(e.target.value)}
                      placeholder="1E69BF"
                      maxLength={6}
                      aria-label="Enter brand color as HEX"
                    />
                  </label>
                  <button
                    type="button"
                    className="msai-btn-primary msai-brandcolor-done"
                    disabled={!/^#[0-9a-fA-F]{6}$/.test(draftColor)}
                    onClick={confirmColor}
                  >
                    Done
                  </button>
                </div>
              )}
            </div>

            <div className="msai-brandcolor-prompt">
              <div className="msai-brandcolor-prompt-h">AI Prompt Appended</div>
              <div className="msai-brandcolor-prompt-txt">
                {brandColor
                  ? `Use ${brandColor} as the primary brand color throughout the design.`
                  : 'No brand color selected yet. Add one to guide the design.'}
              </div>
            </div>
          </div>

          <div className="msai-field"><label>School Branding</label>
            <div className="msai-branding-toggles">
              {[['logo', 'Logo'], ['name', 'Name'], ['contact', 'Contact Number'], ['address', 'Address']].map(([k, l]) => (
                <label key={k} className="msai-toggle-row" style={{ flex: '1 1 45%' }}>
                  <span>{l}</span>
                  <span className="msai-toggle-wrap">
                    <input type="checkbox" className="msai-toggle-input" checked={branding[k]} onChange={e => setBranding(b => ({ ...b, [k]: e.target.checked }))} />
                    <span className="msai-toggle-track"><span className="msai-toggle-knob" /></span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="msai-field"><label>Reference Images (optional)</label>
            <AttachmentPicker items={refImages} onAdd={addRefImage} onRemove={removeRefImage} />
          </div>

          <button type="button" className="msai-btn-primary" style={{ alignSelf: 'flex-end' }} disabled={!prompt.trim()} onClick={runGenerate}>
            <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> Generate Post
          </button>
        </div>
      )}

      {step === 'generating' && (
        <div className="msai-card">
          <GeneratingProgress title="Crafting your design…" steps={DESIGN_GENERATING_STEPS} facts={GENERATING_FACTS} active={generating} />
        </div>
      )}

      {step === 'result' && post && (
        <div className="msai-card msai-ds-result">
          <div className="msai-lp-result-head">
            <div>
              <div className="msai-step-title">Post Ready <i className="fa-solid fa-circle-check" style={{ color: '#16A34A', marginLeft: 6 }} aria-hidden="true" /></div>
              <div className="msai-lp-meta">{post.categoryName} · {post.platformName}</div>
            </div>
            <div className="msai-lp-result-badges">
              <span className="msai-duration-pill"><i className="fa-solid fa-sparkles" aria-hidden="true" /> AI Generated</span>
              <VersionBadge version={post.version} />
            </div>
          </div>

          <PostMockup post={post} branding={branding} />

          <div className="msai-result-actions">
            <button type="button" className="msai-btn-secondary" onClick={() => toast?.('Downloading HD post…')}><i className="fa-solid fa-download" aria-hidden="true" /> Download</button>
            <button type="button" className="msai-btn-secondary" onClick={() => setEditOpen(true)}><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> Edit by AI</button>
            <button type="button" className="msai-btn-secondary" onClick={async () => { await mentorAiStudioService.saveToLibrary({ kind: 'design', title: post.headline, category: post.categoryName, platform: post.platformName, meta: post }); toast?.('Post saved to Library'); }}>
              <i className="fa-regular fa-bookmark" aria-hidden="true" /> Save to Library
            </button>
          </div>
        </div>
      )}

      {editOpen && post && (
        <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) setEditOpen(false); }}>
          <div className="modal modal-sm">
            <div className="msai-panel-head">
              <span>Edit by AI</span>
              <button type="button" className="msai-icon-btn" onClick={() => setEditOpen(false)} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
            </div>
            <div className="msai-panel-body">
              <div className="msai-chip-row">{DS_EDIT_CHIPS.map(c => <button key={c} type="button" className="msai-chip" onClick={async () => {
                setApplying(true);
                try {
                  const { post: updated } = await mentorAiStudioService.editDesignPostViaAI(post, c);
                  setPost(updated); setEditOpen(false); toast?.('Post updated');
                } finally { setApplying(false); }
              }} disabled={applying}>{c}</button>)}</div>
              <EditFreeform disabled={applying} onSend={async (text) => {
                setApplying(true);
                try {
                  const { post: updated } = await mentorAiStudioService.editDesignPostViaAI(post, text);
                  setPost(updated); setEditOpen(false); toast?.('Post updated');
                } finally { setApplying(false); }
              }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return <div className="msai-field"><label>{label}</label>{children}</div>;
}

function EditFreeform({ onSend, disabled }) {
  const [text, setText] = useState('');
  return (
    <form className="msai-editai-composer" onSubmit={e => { e.preventDefault(); if (text.trim()) onSend(text.trim()); }}>
      <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Describe the change…" disabled={disabled} />
      <VoiceDictationButton disabled={disabled} onResult={t => setText(v => (v.trim() ? `${v.trim()} ${t}` : t))} />
      <button type="submit" disabled={!text.trim() || disabled} aria-label="Send"><i className="fa-solid fa-paper-plane" aria-hidden="true" /></button>
    </form>
  );
}

function PostMockup({ post, branding }) {
  return (
    <div className="msai-ds-mockup">
      {branding.logo && <div className="msai-ds-mockup-badge"><i className="fa-solid fa-school" aria-hidden="true" /></div>}
      <div className="msai-ds-mockup-headline">{post.headline}</div>
      <div className="msai-ds-mockup-sub">{post.subtext}</div>
      {(branding.name || branding.contact || branding.address) && (
        <div className="msai-ds-mockup-bar">
          {branding.name && <span>Your School</span>}
          {branding.contact && <span><i className="fa-solid fa-phone" aria-hidden="true" /> 0300 1234567</span>}
          {branding.address && <span><i className="fa-solid fa-location-dot" aria-hidden="true" /> Lahore, Pakistan</span>}
        </div>
      )}
    </div>
  );
}
