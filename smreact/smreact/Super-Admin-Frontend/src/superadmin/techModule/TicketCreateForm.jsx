import React, { useState } from 'react';
import { PLATFORMS, BUG_TYPES, SOURCES, modulesFor } from '../techModuleCatalog';
import { DEVELOPERS } from '../techTicketsData';
import { normalizedSchools } from './SchoolPicker';
import SchoolPicker from './SchoolPicker';

/* ═══════════════════════════════════════════════════════════════════
   TicketCreateForm — shared Bug / New Development creation modal.
   Bug Type → Platform → SubPlatform (mobile only) → Module cascade,
   Title/Description/Expected-Actual (bugs only), Source, Attachments,
   School search+pick, optional immediate Assign (moves straight to In
   Progress — mirrors techTicketsData.addTicket's own stage logic).

   Also reused, unchanged, as the Support module's own Bug / New
   Development modal (see components/AgentSupport.jsx) — that's the
   "same modal everywhere" requirement. Support opens it with:
     - lockType        (the Bug/New Development button already picked
                         the type, so the dropdown is shown but locked)
     - defaultSource    'customer_support' instead of the Tech-Module
                         default, since that's genuinely where it came from
     - initialSchoolId  best-effort match from the live conversation's
                         school name, so the agent isn't asked twice
     - hideAssignment   Support never hands a ticket to a specific
                         developer directly — every Support-reported
                         ticket must land unassigned in Bugs & New
                         Development so the Tech Team Lead triages and
                         assigns it themselves (see techTicketsData.js /
                         BugsNewDevTab.jsx for the same rule already
                         enforced ticket-side).
   ═══════════════════════════════════════════════════════════════════ */

const emptyForm = (defaultType, defaultSource, initialSchoolId) => ({
  type: defaultType || 'bug', platform: 'erp', subPlatform: '', module: '', source: defaultSource || 'head_office_internal',
  title: '', description: '', expectedBehaviour: '', actualBehaviour: '',
  schoolId: initialSchoolId || '', assignedTo: '', attachments: [],
});

export default function TicketCreateForm({
  onClose, onCreate, toast, defaultType,
  lockType = false, defaultSource, initialSchoolId, hideAssignment = false,
  reportedBy = 'Super Admin', supportConversationId = null,
}) {
  const [f, setF] = useState(() => emptyForm(defaultType, defaultSource, initialSchoolId));
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const platform = PLATFORMS.find((p) => p.id === f.platform);
  const modules = modulesFor(f.platform, f.subPlatform);

  const onFiles = (e) => {
    const files = Array.from(e.target.files || []);
    const staged = files.map((file) => ({ id: `att-${Date.now()}-${file.name}`, name: file.name, type: file.type.startsWith('image') ? 'image' : file.type.startsWith('video') ? 'video' : 'document', size: `${(file.size / 1024).toFixed(0)} KB` }));
    setF((p) => ({ ...p, attachments: [...p.attachments, ...staged] }));
  };
  const removeAttachment = (id) => setF((p) => ({ ...p, attachments: p.attachments.filter((a) => a.id !== id) }));

  const submit = () => {
    if (!f.title.trim()) { toast?.('Please enter a title', 'warn'); return; }
    if (!f.description.trim()) { toast?.('Please enter a description', 'warn'); return; }
    if (platform.subPlatforms.length && !f.subPlatform) { toast?.('Please select a sub-platform', 'warn'); return; }
    if (!f.module) { toast?.('Please select a module', 'warn'); return; }
    if (!f.schoolId) { toast?.('Please select a school', 'warn'); return; }
    const school = normalizedSchools().find((s) => s.id === f.schoolId);
    onCreate({
      type: f.type, platform: f.platform, subPlatform: f.subPlatform || null, module: f.module, source: f.source,
      title: f.title.trim(), description: f.description.trim(),
      expectedBehaviour: f.type === 'bug' ? f.expectedBehaviour.trim() : '',
      actualBehaviour: f.type === 'bug' ? f.actualBehaviour.trim() : '',
      school, attachments: f.attachments,
      assignedTo: hideAssignment ? null : (f.assignedTo || null),
      reportedBy,
      supportConversationId,
    });
  };

  return (
    <div className="tm-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tm-modal" style={{ maxWidth: 640 }}>
        <div className="tm-modal-hd" style={{ background: 'linear-gradient(135deg,#4F46E5,#4338CA)' }}>
          <div className="tm-modal-hd-ic"><i className="fa-solid fa-plus" /></div>
          <div style={{ flex: 1 }}>
            <div className="tm-modal-hd-tt">Create New Ticket</div>
            <div className="tm-modal-hd-sb">Report a bug or a new development request</div>
          </div>
          <button className="pm-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="tm-modal-body">
          <div className="tm-form-section-lbl c-blue"><i className="fa-solid fa-tags" /> Classification</div>
          <div className="tm-grid">
            <div className="um-field">
              <label className="um-label">Type <span className="tm-req">*</span></label>
              <select className="um-input" value={f.type} disabled={lockType} onChange={(e) => set('type', e.target.value)}>
                {BUG_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div className="um-field">
              <label className="um-label">Platform <span className="tm-req">*</span></label>
              <select className="um-input" value={f.platform} onChange={(e) => { set('platform', e.target.value); set('subPlatform', ''); set('module', ''); }}>
                {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div className="um-field" style={{ marginBottom: 14 }}>
            <label className="um-label">Source <span className="tm-req">*</span></label>
            <select className="um-input" value={f.source} onChange={(e) => set('source', e.target.value)}>
              {SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>

          {platform.subPlatforms.length > 0 && (
            <div className="um-field" style={{ marginBottom: 14 }}>
              <label className="um-label">Sub-Platform <span className="tm-req">*</span></label>
              <select className="um-input" value={f.subPlatform} onChange={(e) => { set('subPlatform', e.target.value); set('module', ''); }}>
                <option value="">Select…</option>
                {platform.subPlatforms.map((sp) => <option key={sp.id} value={sp.id}>{sp.label}</option>)}
              </select>
            </div>
          )}

          <div className="um-field" style={{ marginBottom: 14 }}>
            <label className="um-label">Module <span className="tm-req">*</span></label>
            <select className="um-input" value={f.module} onChange={(e) => set('module', e.target.value)} disabled={platform.subPlatforms.length > 0 && !f.subPlatform}>
              <option value="">Select…</option>
              {modules.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>

          <div className="tm-form-section-lbl c-purple"><i className="fa-solid fa-file-lines" /> Details</div>
          <div className="um-field" style={{ marginBottom: 14 }}>
            <label className="um-label">Title <span className="tm-req">*</span></label>
            <input className="um-input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Short summary of the issue / request" />
          </div>
          <div className="um-field" style={{ marginBottom: 14 }}>
            <label className="um-label">Description <span className="tm-req">*</span></label>
            <textarea className="um-input" style={{ height: 'auto', padding: 10 }} rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Full details…" />
          </div>

          {f.type === 'bug' && (
            <div className="tm-grid">
              <div className="um-field"><label className="um-label">Expected Behaviour</label><textarea className="um-input" style={{ height: 'auto', padding: 10 }} rows={2} value={f.expectedBehaviour} onChange={(e) => set('expectedBehaviour', e.target.value)} placeholder="What should happen…" /></div>
              <div className="um-field"><label className="um-label">Actual Behaviour</label><textarea className="um-input" style={{ height: 'auto', padding: 10 }} rows={2} value={f.actualBehaviour} onChange={(e) => set('actualBehaviour', e.target.value)} placeholder="What actually happens…" /></div>
            </div>
          )}

          <div className="tm-form-section-lbl c-teal"><i className="fa-solid fa-school" /> School &amp; Attachments</div>
          <div className="um-field" style={{ marginBottom: 14 }}>
            <label className="um-label">School <span className="tm-req">*</span></label>
            <SchoolPicker value={f.schoolId} onChange={(id) => set('schoolId', id)} />
          </div>

          <div className="um-field" style={{ marginBottom: 14 }}>
            <label className="um-label">Attachments</label>
            <input type="file" multiple className="um-input" style={{ height: 'auto', padding: '6px 10px' }} onChange={onFiles} />
            {f.attachments.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {f.attachments.map((a) => (
                  <span key={a.id} className="badge b-gray" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <i className={`fa-solid ${a.type === 'image' ? 'fa-image' : a.type === 'video' ? 'fa-video' : 'fa-file'}`} /> {a.name}
                    <i className="fa-solid fa-xmark" style={{ cursor: 'pointer' }} onClick={() => removeAttachment(a.id)} />
                  </span>
                ))}
              </div>
            )}
          </div>

          {hideAssignment ? (
            <div className="tm-banner tm-banner-info">
              <i className="fa-solid fa-circle-info" /> This will be reported to the Tech Team unassigned — the Tech Team Lead will review and assign it to a developer.
            </div>
          ) : (
            <>
              <div className="tm-form-section-lbl c-amber"><i className="fa-solid fa-user-gear" /> Assignment</div>
              <div className="um-field">
                <label className="um-label">Assign To Tech Team <span style={{ color: 'var(--tm)', fontWeight: 400 }}>(optional — leave blank to triage later)</span></label>
                <select className="um-input" value={f.assignedTo} onChange={(e) => set('assignedTo', e.target.value)}>
                  <option value="">Unassigned</option>
                  {DEVELOPERS.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.role}</option>)}
                </select>
              </div>
              {f.assignedTo && <div className="tm-banner tm-banner-info" style={{ marginTop: 12 }}><i className="fa-solid fa-circle-info" /> Assigning now will move this ticket straight to <b>In Progress</b>.</div>}
            </>
          )}
        </div>
        <div className="tm-modal-ft">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit}><i className="fa-solid fa-plus" /> Create</button>
        </div>
      </div>
    </div>
  );
}
