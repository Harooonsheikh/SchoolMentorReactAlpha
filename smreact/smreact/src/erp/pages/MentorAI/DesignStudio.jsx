import React, { useEffect, useRef, useState } from 'react';
import { usePermissions } from '../../context/PermissionsContext';
import * as designStudioService from './services/mentorraistudioservice';
import { GeneratingProgress, VersionBadge, AttachmentPicker, revokeAttachments, VoiceDictationButton, SaveToLibraryButton, downloadFile } from './MentorAIShared';import ProgressBar from './ProgressBar';
import { STAGE_SETS, useJobProgress, isCancelError } from './services/aiProgress';
import { HowItWorksButton } from './HowItWorks';
import { useMentorAIActions } from './mentorAIPermissions';import {
  DS_PLATFORMS, DS_CATEGORIES, DS_QUICK_TAGS, DS_EDIT_CHIPS,
  GENERATING_FACTS,
} from './mentorAiStudioData';

/* ═══════════════════════════════════════════════════════════════════
   DesignStudio — branded social-post generator.
   Now connected to Mentor AI Design Studio API.
   ═══════════════════════════════════════════════════════════════════ */
export default function DesignStudio({ toast, onConsumed }) {
  const { canCreate, canEdit, canDownload, deny } = useMentorAIActions('designstudio', toast);
  const { can } = usePermissions();
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
  const [undoPost, setUndoPost] = useState(null);
  const genJob = useJobProgress();
  const editJob = useJobProgress();
  const applying = editJob.running;
  const [apiError, setApiError] = useState(null);

  const reset = () => {
    revokeAttachments(refImages);
    setStep('landing'); setPlatform(null); setCategory(null); setPrompt(''); setPost(null); setRefImages([]);
    setBrandColor(''); setColorPickerOpen(false); setApiError(null);
  };

  const openColorPicker = () => { setDraftColor(brandColor || '#1E40AF'); setColorPickerOpen(true); };
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

  /* ─── Generate — calls real API, then polls status if needed ─── */
  const runGenerate = async () => {
    if (!canCreate) { deny('create'); return; }
    if (genJob.running) return;
    setStep('generating');
    setGenerating(true);
    setApiError(null);
    const signal = genJob.start(STAGE_SETS.design);
    const opts = { signal, onProgress: genJob.report };

    try {
      const promptWithBrand = brandColor
        ? `${prompt}\n\nUse the school's selected brand color: ${brandColor}.`
        : prompt;

      const response = await designStudioService.generateDesignPost({
        category: category.id,
        categoryName: category.name,
        platform: platform === 'custom' ? 'custom' : platform.id,
        platformName: platform === 'custom' ? `Custom ${customSize.w}×${customSize.h}` : platform.name,
        prompt: promptWithBrand,
        branding,
        brandColor,
        customSize: platform === 'custom' ? customSize : null,
        refImages,
      }, opts);

      console.log('Design Studio generation response:', response);

      // API returns: { tracking_id, design_post_id, status: 'pending' }
      const trackingId =
        response?.tracking_id ||
        response?.data?.tracking_id;

      const designPostId =
        response?.design_post_id ||
        response?.data?.design_post_id;

      // If tracking_id exists AND no image yet, poll for result
      const hasImageAlready =
        response?.image_url || response?.imageUrl ||
        response?.pdf_url || response?.pdfUrl;

      if (trackingId && !hasImageAlready) {
        const finalPost = await designStudioService.waitForDesignResult(trackingId, designPostId, opts);
        // Attach display meta that API may not return
        finalPost.categoryName = finalPost.categoryName || category.name;
        finalPost.platformName = finalPost.platformName || (platform === 'custom' ? `Custom ${customSize.w}×${customSize.h}` : platform.name);
        // Ensure design_post_id is available for edit/detail calls
        finalPost.designPostId = finalPost.designPostId || designPostId;
        setPost(finalPost);
        setUndoPost(null);
        genJob.complete();
        setStep('result');
        onConsumed?.();
        return;
      }

      // Immediate result — normalize it
      const normalized = designStudioService.normalizeDesignPost(
        response?.post || response?.data?.post || response?.data || response
      );

      if (!normalized) {
        throw new Error('Design response is incomplete.');
      }

      // Attach display meta
      normalized.categoryName = normalized.categoryName || category.name;
      normalized.platformName = normalized.platformName || (platform === 'custom' ? `Custom ${customSize.w}×${customSize.h}` : platform.name);

      setPost(normalized);
      setUndoPost(null);
      genJob.complete();
      setStep('result');
      onConsumed?.();
    } catch (error) {
      console.error('Design generation failed:', error.response?.data || error.message);

      const backendError = error.response?.data;
      const message =
        typeof backendError === 'string'
          ? backendError
          : backendError?.error ||
            backendError?.message ||
            error.message ||
            'Design generation failed.';

      // Errors / timeouts keep the progress card with Retry + Back;
      // Cancel returns straight to the form.
      if (genJob.fail(error, message) === 'cancelled') { setStep('content'); return; }
      setApiError(message);
      toast?.(message);
    } finally {
      setGenerating(false);
    }
  };

  /* ─── Edit via AI — calls real edit endpoint ───
     Only reports success when a real updated post came back; the
     previous version is kept for Undo. */
  const handleEditViaAI = async (instruction) => {
    if (!canEdit) { deny('edit'); return; }
    if (editJob.running) return;
    // Use design_post_id for edit endpoint (NOT tracking_id)
    const editId = post?.designPostId || post?.design_post_id || post?.id;
    if (!editId) { toast?.('Post ID not available for editing.'); return; }
    const signal = editJob.start(STAGE_SETS.design);
    const opts = { signal, onProgress: editJob.report };
    try {
      const response = await designStudioService.editDesignPostViaAI(editId, instruction, opts);

      // Edit also returns { tracking_id, design_post_id, status: 'pending' }
      // so we need to poll for the result just like generate
      const trackingId = response?.tracking_id || response?.data?.tracking_id;
      const editDesignPostId = response?.design_post_id || response?.data?.design_post_id || editId;

      let updated;
      if (trackingId) {
        updated = await designStudioService.waitForDesignResult(trackingId, editDesignPostId, opts);
      } else {
        const editedData = response?.post || response?.data?.post || response?.data || response;
        updated = designStudioService.normalizeDesignPost(editedData);
      }
      if (!updated || (!updated.imageUrl && !updated.pdfUrl)) {
        throw new Error('Mentor AI did not return an updated design. Please try again.');
      }
      updated.categoryName = updated.categoryName || post.categoryName;
      updated.platformName = updated.platformName || post.platformName;
      updated.designPostId = editDesignPostId;
      updated.version = (post.version || 1) + 1;

      setUndoPost(post);
      setPost(updated);
      editJob.complete();
      setEditOpen(false);
      onConsumed?.();
      toast?.('Post updated');
    } catch (error) {
      console.error('Edit design failed:', error.response?.data || error.message);
      const message = error.response?.data?.error || error.response?.data?.message || error.message || 'Edit failed.';
      editJob.fail(error, isCancelError(error) ? 'Edit cancelled — the post was not changed.' : message);
    }
  };

  const closeEdit = () => { editJob.cancel(); editJob.reset(); setEditOpen(false); };

  /* ─── Download handler ─── */
   const handleDownload = async () => {
    if (!canDownload) { deny('download'); return; }    const url = post?.imageUrl || post?.pdfUrl;
    if (!url) { toast?.('Download not available yet.'); return; }
    toast?.('Downloading HD post…');
    const result = await downloadFile(url, `design-${post.id || 'post'}${post.imageUrl ? '' : '.pdf'}`);
    if (result === 'opened') toast?.('Opened in a new tab — use Save there to keep it.');
  };
  return (
    <div className="msai-ds">
      {step !== 'landing' && (
        <button type="button" className="msai-back-link" onClick={() => { genJob.cancel(); if (step === 'result') reset(); else setStep(step === 'category' ? 'landing' : 'category'); }}>
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

          {/* API error banner */}
          {apiError && (
            <div className="msai-ds-error-banner" style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', color: '#991B1B', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
              <span>{apiError}</span>
              <button type="button" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B' }} onClick={() => setApiError(null)} aria-label="Dismiss"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
            </div>
          )}

          <Field label={`Describe your post (${prompt.length}/500)`}>
            <div className="msai-field-voice-wrap">
              <textarea rows={4} maxLength={500} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="What should this post say?" />
              <VoiceDictationButton onResult={t => setPrompt(p => (p.trim() ? `${p.trim()} ${t}`.slice(0, 500) : t.slice(0, 500)))} />
            </div>
          </Field>
          <div className="msai-chip-row">{DS_QUICK_TAGS.map(t => <button key={t} type="button" className="msai-chip" onClick={() => toggleTag(t)}>+ {t}</button>)}</div>

          {/* ─── Brand Color Theme ─── */}
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

          <button type="button" className="msai-btn-primary" style={{ alignSelf: 'flex-end' }} disabled={!canCreate || !prompt.trim()} onClick={runGenerate}>
            <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> Generate Post
          </button>
        </div>
      )}

      {step === 'generating' && (
        <div className="msai-card">
          <GeneratingProgress
            title="Crafting your design…"
            progress={genJob.progress}
            facts={GENERATING_FACTS}
            onCancel={genJob.cancel}
            onRetry={runGenerate}
            onDismiss={() => { genJob.reset(); setStep('content'); }}
          />
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
                     {canDownload && (
              <button type="button" className="msai-btn-secondary" onClick={handleDownload}><i className="fa-solid fa-download" aria-hidden="true" /> Download</button>
            )}
            {canEdit && (
              <button type="button" className="msai-btn-secondary" onClick={() => { editJob.reset(); setEditOpen(true); }}><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> Edit by AI</button>
            )}
            {canEdit && undoPost && (
              <button type="button" className="msai-btn-secondary" onClick={() => { setPost(undoPost); setUndoPost(null); toast?.('Reverted to the previous version'); }}>
                <i className="fa-solid fa-rotate-left" aria-hidden="true" /> Undo AI edit
              </button>
            )}
                 <SaveToLibraryButton
              perm="Design Studio"
              toast={toast}
              resetKey={post.version || 1}
              build={() => ({
                type: 'design',
                title: post.headline || 'Design post',
                content: { post },
                sourceKey: `design:${post.designPostId || post.id}`,
              })}
            />
          </div>
        </div>
      )}

      {editOpen && post && canEdit && (        <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget && !applying) closeEdit(); }}>
          <div className="modal modal-sm">
            <div className="msai-panel-head">
              <span>Edit by AI</span>
              <button type="button" className="msai-icon-btn" onClick={closeEdit} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
            </div>
            <div className="msai-panel-body">
              <div className="msai-chip-row">{DS_EDIT_CHIPS.map(c => <button key={c} type="button" className="msai-chip" onClick={() => handleEditViaAI(c)} disabled={applying}>{c}</button>)}</div>
              <EditFreeform disabled={applying} onSend={(text) => handleEditViaAI(text)} />
              <ProgressBar progress={editJob.progress} compact onCancel={editJob.cancel} />
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

/* ─── PostMockup — shows real image if available, else text fallback ─── */
function PostMockup({ post, branding }) {
  const imageUrl = post?.imageUrl || post?.pdfUrl;

  return (
    <div className="msai-ds-mockup">
      {imageUrl ? (
        /* Real generated image from API */
        <img
          src={imageUrl}
          alt={post.headline || 'Generated design'}
          style={{
            width: '100%',
            maxHeight: 520,
            objectFit: 'contain',
            borderRadius: 8,
            display: 'block',
          }}
          onError={(e) => {
            // Fallback to text mockup on image load error
            e.target.style.display = 'none';
            const fallback = e.target.nextSibling;
            if (fallback) fallback.style.display = '';
          }}
        />
      ) : null}

      {/* Text fallback — shown when no image URL or image fails to load */}
      <div style={imageUrl ? { display: 'none' } : undefined}>
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
    </div>
  );
}
