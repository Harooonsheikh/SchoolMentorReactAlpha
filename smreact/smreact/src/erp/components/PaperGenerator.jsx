import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from './Tooltip';
import TutorialModal from './TutorialModal';
import * as paperService from '../services/paperService';
import useAsync from '../hooks/useAsync';

/* ═══════════════════════════════════════════════════════════════════
   PAPER GENERATOR — module shell
   Stage 1: page header, 2 inner tabs (Paper Setup / Paper Generator),
   Choose Paper Template selection card.
   Further sections to be ported incrementally.
   ═══════════════════════════════════════════════════════════════════ */

const TEMPLATES = [
  { id: 1, name: 'Classic', desc: 'Full-width navy header · 4-col marks grid · Centered layout' },
  { id: 2, name: 'Modern',  desc: 'Logo + color-coded marks blocks · Clean accent underline' },
  { id: 3, name: 'Formal',  desc: 'School seal · Board pattern · 5-col metadata grid · Premium' },
];

const PG_CLASSES_DATA = [
  { name:'class 1A',    section:'B',       subjects:['English','Urdu','Mathematics','Science','Social Studies'] },
  { name:'class 1A',    section:'C',       subjects:['English','Urdu','Mathematics','Science'] },
  { name:'class 1A',    section:'D',       subjects:['English','Urdu','Mathematics','Science'] },
  { name:'class 1A',    section:'Green f', subjects:['English','Urdu'] },
  { name:'class 1A',    section:'New',     subjects:['English','Urdu'] },
  { name:'II-Pre',      section:'A',       subjects:['English','Urdu','Mathematics','Science'] },
  { name:'III-Pre',     section:'2',       subjects:['English','Urdu','Mathematics','Science','Social Studies'] },
  { name:'I',           section:'White',   subjects:['English','Urdu'] },
  { name:'I',           section:'Green',   subjects:['English','Urdu'] },
  { name:'II',          section:'B',       subjects:['Mathematics','Science'] },
  { name:'II',          section:'A',       subjects:['Mathematics','Science'] },
  { name:'III',         section:'A',       subjects:['Urdu'] },
  { name:'IV',          section:'A',       subjects:['English','Urdu','Mathematics','Science','Social Studies'] },
  { name:'V',           section:'A',       subjects:['English','Urdu','Mathematics','Science'] },
  { name:'VI',          section:'A',       subjects:['English','Urdu','Mathematics','Science'] },
  { name:'VII',         section:'A',       subjects:['English','Urdu','Mathematics','Science'] },
  { name:'VIII',        section:'A',       subjects:['English','Urdu','Mathematics','Science'] },
  { name:'IX',          section:'A',       subjects:['English','Urdu','Mathematics','Science'] },
  { name:'IX',          section:'B',       subjects:['English','Urdu','Mathematics','Science'] },
  { name:'Pre-Year 1',  section:'A',       subjects:['English','Urdu'] },
];
const PG_SUBJ_ICON = {
  English: 'fa-spell-check',
  Urdu: 'fa-font',
  Mathematics: 'fa-square-root-variable',
  Science: 'fa-flask',
  'Social Studies': 'fa-globe',
};
const PG_SUBJ_STRIP = {
  English: 'eng', Urdu: 'urdu', Mathematics: 'math', Science: 'sci', 'Social Studies': 'sst',
};
const PG_SUBJ_TILE = {
  English: { bg: '#EFF6FF', color: '#1E40AF' },
  Urdu:    { bg: '#FDF4FF', color: '#7E22CE' },
  Mathematics: { bg: '#FFF7ED', color: '#C2410C' },
  Science: { bg: '#F0FDF4', color: '#15803D' },
  'Social Studies': { bg: '#FFFBEB', color: '#B45309' },
};

/* Sample generated papers per class key — derived idiomatically from the HTML draft */
function pgClassKey(cls) {
  return cls.name.replace(/\s+/g, '') + '_' + cls.section;
}
/* Generated papers now load via paperService (src/services/paperService.js).
   Create/update/delete remain in-memory until backend wires the matching endpoints. */
function pgBuildSubjDefaults(globalFmt, globalLine) {
  return PG_CLASSES_DATA.map(cls =>
    cls.subjects.map(() => ({ fmt: globalFmt, line: globalLine }))
  );
}
function pgBuildClassDefaults(globalFmt, globalLine) {
  return PG_CLASSES_DATA.map(() => ({ fmt: globalFmt, line: globalLine }));
}

export default function PaperGenerator({ toast = () => {} }) {
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tab, setTab]               = useState('setup');   // 'setup' | 'generator'
  const [templateId, setTemplateId] = useState(1);
  const [previewN, setPreviewN]     = useState(null);      // 1 | 2 | 3 | null

  /* ── Class-wise Paper Format & Line Settings ── */
  const [globalFmt, setGlobalFmt]   = useState('with');     // 'with' | 'without'
  const [globalLine, setGlobalLine] = useState('single');   // 'single' | 'four'
  const [classDefaults, setClassDefaults] = useState(() => pgBuildClassDefaults('with', 'single'));
  const [subjDefaults, setSubjDefaults]   = useState(() => pgBuildSubjDefaults('with', 'single'));
  const [openClassIdx, setOpenClassIdx]   = useState(null);
  /* Paper Generator tab: which class row's dropdown is open */
  const [openGenIdx, setOpenGenIdx]       = useState(null);
  /* Make Paper modal: holds the active class index (null = closed) */
  const [makeIdx, setMakeIdx]             = useState(null);
  /* Optional pre-fill payload (Edit flow) */
  const [editPaper, setEditPaper]         = useState(null);

  /* Paper-card action modals */
  const [viewPaper,     setViewPaper]     = useState(null);  // { paper, cls } | null
  const [downloadPaper, setDownloadPaper] = useState(null);  // { paper, cls } | null
  const [deletePaper,   setDeletePaper]   = useState(null);  // { paper, cls, key, index } | null
  /* Local mutable copy of generated papers so cards can be removed.
     Initial data comes from paperService.getAllPapers(); CRUD stays local. */
  const { data: papersByKey = {}, setData: setPapersByKey } = useAsync(paperService.getAllPapers, []);

  /* Cascade helpers */
  const cascadeFmt = f => {
    setGlobalFmt(f);
    setClassDefaults(prev => prev.map(d => ({ ...d, fmt: f })));
    setSubjDefaults(prev => prev.map(row => row.map(d => ({ ...d, fmt: f }))));
    toast(`Global default set: ${f === 'with' ? 'With Answer Sheet' : 'Without Answer Sheet'}`, 'success');
  };
  const cascadeLine = l => {
    setGlobalLine(l);
    setClassDefaults(prev => prev.map(d => ({ ...d, line: l })));
    setSubjDefaults(prev => prev.map(row => row.map(d => ({ ...d, line: l }))));
    toast(`Global default set: ${l === 'four' ? 'Four Line' : 'Single Line'}`, 'success');
  };
  const setClassFmt = (ci, f) => {
    const cls = PG_CLASSES_DATA[ci];
    setClassDefaults(prev => prev.map((d, i) => i === ci ? { ...d, fmt: f } : d));
    setSubjDefaults(prev => prev.map((row, i) => i === ci ? row.map(d => ({ ...d, fmt: f })) : row));
    toast(`${cls.name} · ${cls.section} → ${f === 'with' ? 'With Answer Sheet' : 'Without Answer Sheet'}`, 'success');
  };
  const setClassLine = (ci, l) => {
    const cls = PG_CLASSES_DATA[ci];
    setClassDefaults(prev => prev.map((d, i) => i === ci ? { ...d, line: l } : d));
    setSubjDefaults(prev => prev.map((row, i) => i === ci ? row.map(d => ({ ...d, line: l })) : row));
    toast(`${cls.name} · ${cls.section} → ${l === 'four' ? 'Four Line' : 'Single Line'}`, 'success');
  };
  const setSubjFmt = (ci, si, f) => {
    const subjName = PG_CLASSES_DATA[ci].subjects[si];
    setSubjDefaults(prev => prev.map((row, i) => i === ci ? row.map((d, j) => j === si ? { ...d, fmt: f } : d) : row));
    toast(`${subjName} → ${f === 'with' ? 'With Answer Sheet' : 'Without Answer Sheet'}`, 'success');
  };
  const setSubjLine = (ci, si, l) => {
    const subjName = PG_CLASSES_DATA[ci].subjects[si];
    setSubjDefaults(prev => prev.map((row, i) => i === ci ? row.map((d, j) => j === si ? { ...d, line: l } : d) : row));
    toast(`${subjName} → ${l === 'four' ? 'Four Line' : 'Single Line'}`, 'success');
  };

  return (
    <>
      <style>{PG_CSS}</style>

      {/* ── Page header ── */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title-icon"><i className="fa-solid fa-scroll"></i></div>
          <div>
            <div className="page-title">Papers Generator</div>
            <div className="page-sub">Create, manage &amp; download question papers for all classes</div>
          </div>
        </div>
        <Tooltip text="Play a short tutorial for the Papers Generator">
          <button
            className="tutorial-btn page-tutorial-btn"
            onClick={() => setTutorialOpen(true)}
          >
            <div className="play-dot"><i className="fa-solid fa-play" style={{ fontSize: 8 }}></i></div>
            <span className="tutorial-label">Tutorial</span>
          </button>
        </Tooltip>
      </div>

      {/* ── Two inner tabs ── */}
      <div className="pg-tabs-row">
        <button
          className={`pg-tab${tab === 'setup' ? ' active' : ''}`}
          onClick={() => setTab('setup')}
        >
          <i className="fa-solid fa-sliders"></i> Paper Setup
        </button>
        <button
          className={`pg-tab${tab === 'generator' ? ' active' : ''}`}
          onClick={() => setTab('generator')}
        >
          <i className="fa-solid fa-wand-magic-sparkles"></i> Paper Generator
        </button>
      </div>

      {/* ── Paper Setup tab ── */}
      {tab === 'setup' && (
        <>
          {/* Choose Paper Template */}
          <div className="section-card" style={{ marginBottom: 16, overflow: 'hidden' }}>
            <div className="pg-card-head">
              <div className="pg-card-title">
                <i className="fa-solid fa-file-lines" style={{ color: '#1E40AF' }}></i> Choose Paper Template
              </div>
              <div className="pg-card-sub">Select a header layout for your question papers</div>
            </div>
            <div style={{ padding: 20 }}>
              <div className="pg-tmpl-grid">
                {TEMPLATES.map(t => {
                  const sel = templateId === t.id;
                  return (
                    <div
                      key={t.id}
                      className={`pg-tmpl-card${sel ? ' selected' : ''}`}
                      onClick={() => setTemplateId(t.id)}
                    >
                      <div className="pg-tmpl-top-strip"></div>
                      {sel && (
                        <div className="pg-tmpl-badge">
                          <i className="fa-solid fa-check" style={{ fontSize: 7 }}></i> Selected
                        </div>
                      )}
                      <div className="pg-tmpl-body">
                        <div className="pg-tmpl-num">{String(t.id).padStart(2, '0')}</div>
                        <TemplatePreview id={t.id} />
                        <div>
                          <div className="pg-tmpl-name">{t.name} <span className="pg-tmpl-name-bar"></span></div>
                          <div className="pg-tmpl-desc">{t.desc}</div>
                        </div>
                        <Tooltip text="Preview this paper template">
                          <button
                            className="pg-tmpl-prev-btn"
                            onClick={e => { e.stopPropagation(); setPreviewN(t.id); }}
                          >
                            <i className="fa-solid fa-eye"></i> Preview
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Class-wise Paper Format & Line Settings */}
          <div className="section-card" style={{ marginBottom: 16, overflow: 'hidden' }}>
            <div className="pg-card-head">
              <div className="pg-global-defaults-row">
                <div>
                  <div className="pg-card-title">
                    <i className="fa-solid fa-sliders" style={{ color: '#1E40AF' }}></i> Class-wise Paper Format &amp; Line Settings
                  </div>
                  <div className="pg-card-sub">Set paper format and answer line type per class and subject</div>
                </div>
                <div className="pg-global-defaults-controls">
                  <span className="pg-global-lbl">Global Default:</span>
                  <div className="pg-seg">
                    <Tooltip text="Apply 'With Answer Sheet' to every class and subject">
                      <button
                        className={`pg-seg-btn${globalFmt === 'with' ? ' active' : ''}`}
                        onClick={() => cascadeFmt('with')}
                      >
                        <i className="fa-solid fa-file-lines"></i> With Sheet
                      </button>
                    </Tooltip>
                    <Tooltip text="Apply 'No Answer Sheet' to every class and subject">
                      <button
                        className={`pg-seg-btn${globalFmt === 'without' ? ' active' : ''}`}
                        onClick={() => cascadeFmt('without')}
                      >
                        <i className="fa-regular fa-file"></i> No Sheet
                      </button>
                    </Tooltip>
                  </div>
                  <div className="pg-seg-divider" />
                  <div className="pg-seg">
                    <Tooltip text="Apply single-line answer lines to every class and subject">
                      <button
                        className={`pg-seg-btn${globalLine === 'single' ? ' active' : ''}`}
                        onClick={() => cascadeLine('single')}
                      >
                        <i className="fa-solid fa-minus"></i> Single
                      </button>
                    </Tooltip>
                    <Tooltip text="Apply four-line (handwriting) answer lines to every class and subject">
                      <button
                        className={`pg-seg-btn${globalLine === 'four' ? ' active' : ''}`}
                        onClick={() => cascadeLine('four')}
                      >
                        <i className="fa-solid fa-bars"></i> Four Line
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 20px' }}>
              {PG_CLASSES_DATA.map((cls, ci) => {
                const cd = classDefaults[ci];
                const isOpen = openClassIdx === ci;
                return (
                  <div key={`${cls.name}-${cls.section}-${ci}`} className={`pg-subj-class-block${isOpen ? ' open' : ''}`}>
                    <div
                      className="pg-subj-class-header"
                      onClick={() => setOpenClassIdx(isOpen ? null : ci)}
                    >
                      <div className="pg-subj-class-header-top">
                        <i className="fa-solid fa-school" style={{ color: '#1E40AF', fontSize: 13, flexShrink: 0 }}></i>
                        <span className="pg-subj-class-name">{cls.name}</span>
                        <span className="pg-subj-class-section">{cls.section}</span>
                        <span className="pg-subj-count-pill">{cls.subjects.length} subj</span>
                        <Tooltip text={isOpen ? 'Hide subjects' : 'Show subjects'}>
                          <button
                            className="pg-cls-chevron"
                            onClick={e => { e.stopPropagation(); setOpenClassIdx(isOpen ? null : ci); }}
                            style={{ marginLeft: 'auto' }}
                            aria-label="Toggle"
                          >
                            <i className="fa-solid fa-chevron-down"></i>
                          </button>
                        </Tooltip>
                      </div>
                      <div className="pg-cls-defaults" onClick={e => e.stopPropagation()}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>Default:</span>
                        <Tooltip text={`Apply 'With Sheet' to every subject in ${cls.name} (${cls.section})`}>
                          <button
                            className={`pg-cls-chip${cd.fmt === 'with' ? ' active-fmt' : ''}`}
                            onClick={() => setClassFmt(ci, 'with')}
                          >
                            <i className="fa-solid fa-file-lines"></i> With Sheet
                          </button>
                        </Tooltip>
                        <Tooltip text={`Apply 'No Sheet' to every subject in ${cls.name} (${cls.section})`}>
                          <button
                            className={`pg-cls-chip${cd.fmt === 'without' ? ' active-fmt' : ''}`}
                            onClick={() => setClassFmt(ci, 'without')}
                          >
                            <i className="fa-regular fa-file"></i> No Sheet
                          </button>
                        </Tooltip>
                        <div style={{ width: 1, height: 18, background: 'var(--border-light)', margin: '0 2px', flexShrink: 0 }} />
                        <Tooltip text={`Apply single-line answer lines to every subject in ${cls.name} (${cls.section})`}>
                          <button
                            className={`pg-cls-chip${cd.line === 'single' ? ' active-line' : ''}`}
                            onClick={() => setClassLine(ci, 'single')}
                          >
                            <i className="fa-solid fa-minus"></i> Single
                          </button>
                        </Tooltip>
                        <Tooltip text={`Apply four-line answer lines to every subject in ${cls.name} (${cls.section})`}>
                          <button
                            className={`pg-cls-chip${cd.line === 'four' ? ' active-line' : ''}`}
                            onClick={() => setClassLine(ci, 'four')}
                          >
                            <i className="fa-solid fa-bars"></i> Four
                          </button>
                        </Tooltip>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="pg-subj-rows">
                        {cls.subjects.map((s, si) => {
                          const sd = subjDefaults[ci][si];
                          const icon = PG_SUBJ_ICON[s] || 'fa-book';
                          return (
                            <div key={s + si} className="pg-subj-row">
                              <div className="pg-subj-row-left">
                                <div className="pg-subj-icon"><i className={`fa-solid ${icon}`}></i></div>
                                <span className="pg-subj-name">{s}</span>
                              </div>

                              <div className="pg-subj-toggle-col">
                                <span className="pg-subj-toggle-lbl">
                                  <i className="fa-solid fa-file-lines" style={{ fontSize: 8, marginRight: 3 }}></i>Paper Format
                                </span>
                                <div className="pg-subj-toggle">
                                  <Tooltip text={`Use 'With Answer Sheet' for ${s}`}>
                                    <button
                                      className={`pg-subj-toggle-btn${sd.fmt === 'with' ? ' active-fmt' : ''}`}
                                      onClick={() => setSubjFmt(ci, si, 'with')}
                                    >
                                      <i className="fa-solid fa-file-lines" style={{ fontSize: 9 }}></i> With Sheet
                                    </button>
                                  </Tooltip>
                                  <Tooltip text={`Use 'No Answer Sheet' for ${s}`}>
                                    <button
                                      className={`pg-subj-toggle-btn${sd.fmt === 'without' ? ' active-fmt' : ''}`}
                                      onClick={() => setSubjFmt(ci, si, 'without')}
                                    >
                                      <i className="fa-regular fa-file" style={{ fontSize: 9 }}></i> No Sheet
                                    </button>
                                  </Tooltip>
                                </div>
                              </div>

                              <div className="pg-subj-toggle-col">
                                <span className="pg-subj-toggle-lbl">
                                  <i className="fa-solid fa-bars" style={{ fontSize: 8, marginRight: 3 }}></i>Line Type
                                </span>
                                <div className="pg-subj-toggle">
                                  <Tooltip text={`Use single-line answer lines for ${s}`}>
                                    <button
                                      className={`pg-subj-toggle-btn${sd.line === 'single' ? ' active-line' : ''}`}
                                      onClick={() => setSubjLine(ci, si, 'single')}
                                    >
                                      <i className="fa-solid fa-minus" style={{ fontSize: 9 }}></i> Single
                                    </button>
                                  </Tooltip>
                                  <Tooltip text={`Use four-line (handwriting) answer lines for ${s}`}>
                                    <button
                                      className={`pg-subj-toggle-btn${sd.line === 'four' ? ' active-line' : ''}`}
                                      onClick={() => setSubjLine(ci, si, 'four')}
                                    >
                                      <i className="fa-solid fa-bars" style={{ fontSize: 9 }}></i> Four
                                    </button>
                                  </Tooltip>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Paper Generator tab ── */}
      {tab === 'generator' && (
        <div className="section-card" style={{ animation: 'fadeSlide .2s ease both', padding: 0, overflow: 'hidden' }}>
          <div className="pg-class-table-head">
            <div>S. No.</div>
            <div>Class</div>
            <div>Section</div>
            <div>Make Paper</div>
            <div style={{ textAlign: 'center' }}>Generated</div>
            <div style={{ textAlign: 'center' }}>Details</div>
          </div>
          {PG_CLASSES_DATA.map((cls, idx) => {
            const key    = pgClassKey(cls);
            const papers = papersByKey[key] || [];
            const count  = papers.length;
            const isOpen = openGenIdx === idx;
            return (
              <div key={`${cls.name}-${cls.section}-${idx}`}>
                <div className="pg-class-row">
                  <div style={{ color: 'var(--text-muted)', fontWeight: 700 }}># {idx + 1}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <i className="fa-solid fa-school" style={{ color: '#1E40AF', fontSize: 12, flexShrink: 0 }}></i>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cls.name}</span>
                    <span className="pg-section-badge-inline" style={{ fontSize: 10, fontWeight: 700, color: '#1E40AF', background: '#EFF6FF', border: '1px solid var(--border-med)', padding: '1px 6px', borderRadius: 99, flexShrink: 0 }}>{cls.section}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i className="fa-solid fa-sitemap" style={{ color: 'var(--text-muted)', fontSize: 12 }}></i>
                    <span style={{ color: 'var(--text-secondary)' }}>{cls.section}</span>
                  </div>
                  <div>
                    <Tooltip text={`Generate a new paper for ${cls.name} · ${cls.section}`}>
                      <button
                        className="pg-make-paper-btn"
                        onClick={() => setMakeIdx(idx)}
                      >
                        <i className="fa-solid fa-wand-magic-sparkles"></i> Make Paper
                      </button>
                    </Tooltip>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <Tooltip text={count === 0 ? 'No papers generated yet' : `${count} paper${count !== 1 ? 's' : ''} generated for this class`}>
                      <span className={`pg-paper-count${count === 0 ? ' zero' : ''}`}>{count}</span>
                    </Tooltip>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <Tooltip text={isOpen ? 'Hide generated papers' : 'Show generated papers'}>
                      <button
                        className={`pg-chevron-btn${isOpen ? ' open' : ''}`}
                        onClick={() => setOpenGenIdx(isOpen ? null : idx)}
                        aria-label="Toggle papers"
                      >
                        <i className="fa-solid fa-chevron-down" style={{ fontSize: 11 }}></i>
                      </button>
                    </Tooltip>
                  </div>
                </div>
                <div className={`pg-papers-dropdown${isOpen ? ' open' : ''}`}>
                  <PapersGrid
                    papers={papers}
                    toast={toast}
                    onView={p => setViewPaper({ paper: p, cls })}
                    onDownload={p => setDownloadPaper({ paper: p, cls })}
                    onDelete={(p, pi) => setDeletePaper({ paper: p, cls, key, index: pi })}
                    onEdit={p => { setEditPaper(p); setMakeIdx(idx); }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Template Preview modal ── */}
      {previewN && (
        <TemplatePreviewModal
          n={previewN}
          onClose={() => setPreviewN(null)}
          onSelect={id => {
            setTemplateId(id);
            setPreviewN(null);
            toast(`Template ${id} selected`, 'success');
          }}
        />
      )}

      {/* ── Make Paper modal ── */}
      {makeIdx != null && (
        <MakePaperModal
          cls={PG_CLASSES_DATA[makeIdx]}
          defaultFmt={classDefaults[makeIdx]?.fmt || 'with'}
          initialPaper={editPaper}
          onClose={() => { setMakeIdx(null); setEditPaper(null); }}
          toast={toast}
        />
      )}

      {/* ── Paper View modal ── */}
      {viewPaper && (
        <PaperViewModal
          paper={viewPaper.paper}
          cls={viewPaper.cls}
          onClose={() => setViewPaper(null)}
          onDownload={() => { setDownloadPaper(viewPaper); setViewPaper(null); }}
        />
      )}

      {/* ── Download modal ── */}
      {downloadPaper && (
        <DownloadModal
          paper={downloadPaper.paper}
          cls={downloadPaper.cls}
          onClose={() => setDownloadPaper(null)}
          toast={toast}
        />
      )}

      {/* ── Delete confirmation ── */}
      {deletePaper && (
        <DeleteConfirmDialog
          paper={deletePaper.paper}
          cls={deletePaper.cls}
          onClose={() => setDeletePaper(null)}
          onConfirm={() => {
            const { key, index, paper } = deletePaper;
            setPapersByKey(prev => {
              const next = { ...prev };
              const arr  = (next[key] || []).filter((_, i) => i !== index);
              next[key]  = arr;
              return next;
            });
            setDeletePaper(null);
            toast(`Paper "${paper.title}" deleted successfully`, 'success');
          }}
        />
      )}

      <TutorialModal
        open={tutorialOpen}
        moduleKey="paperGenerator"
        onClose={() => setTutorialOpen(false)}
        toast={toast}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PAPERS GRID — list of generated papers under a class row
   ═══════════════════════════════════════════════════════════════════ */
function PapersGrid({ papers, toast, onView, onDownload, onDelete, onEdit }) {
  if (!papers.length) {
    return (
      <div style={{ textAlign: 'center', padding: '28px 20px', color: 'var(--text-muted)' }}>
        <i className="fa-regular fa-file-lines" style={{ fontSize: 28, display: 'block', marginBottom: 10, opacity: .35 }}></i>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>No papers generated yet</div>
        <div style={{ fontSize: 12 }}>Click <strong>Make Paper</strong> to create your first question paper</div>
      </div>
    );
  }

  const typeLabel = { objective: 'Objective', subjective: 'Subjective', both: 'Obj+Subj' };
  const typeColor = { objective: '#1E40AF',   subjective: '#0E7490',    both: '#5B21B6' };
  const typeBg    = { objective: '#EFF6FF',   subjective: '#ECFEFF',    both: '#F5F3FF' };
  const fmtColor  = { with: '#16A34A', without: '#D97706' };
  const fmtBg     = { with: '#F0FDF4',  without: '#FFFBEB' };

  return (
    <>
      <div className="pg-pc-count">{papers.length} paper{papers.length !== 1 ? 's' : ''} generated</div>
      <div className="pg-papers-grid-v2">
        {papers.map((p, pi) => {
          const sc       = PG_SUBJ_STRIP[p.subj] || 'eng';
          const fa       = PG_SUBJ_ICON[p.subj]  || 'fa-file';
          const tile     = PG_SUBJ_TILE[p.subj]  || { bg: '#EFF6FF', color: '#1E40AF' };
          const fmt      = p.format || 'with';
          const typ      = p.type   || 'both';
          const fmtText  = fmt === 'with' ? 'With Answer Sheet' : 'Without Answer Sheet';
          const fmtIcon  = fmt === 'with' ? 'fa-file-lines' : 'fa-file';

          return (
            <div key={pi} className="pg-paper-card-v2">
              <div className={`pg-pc-strip ${sc}`}></div>
              <div className="pg-pc-body">
                <div className="pg-pc-subject-row">
                  <div className="pg-pc-icon" style={{ background: tile.bg, color: tile.color }}>
                    <i className={`fa-solid ${fa}`}></i>
                  </div>
                  <div className="pg-pc-subject" title={p.subj}>{p.subj}</div>
                  <span className="pg-pc-type-badge" style={{ background: typeBg[typ], color: typeColor[typ] }}>{typeLabel[typ]}</span>
                </div>

                <div className="pg-pc-title" title={p.title}>{p.title}</div>

                <div>
                  <span className="pg-pc-fmt-badge" style={{ background: fmtBg[fmt], color: fmtColor[fmt] }}>
                    <i className={`fa-solid ${fmtIcon}`} style={{ fontSize: 9 }}></i> {fmtText}
                  </span>
                </div>

                {((p.objMarks || 0) > 0 || (p.subjMarks || 0) > 0) && (
                  <div className="pg-pc-chips">
                    {(p.objMarks || 0) > 0 && (
                      <span className="pg-pc-chip" style={{ background: '#EFF6FF', color: '#1E40AF' }}>
                        <i className="fa-solid fa-circle-dot" style={{ fontSize: 9 }}></i> Obj: {p.objMarks} Marks &middot; {p.objTime} min
                      </span>
                    )}
                    {(p.subjMarks || 0) > 0 && (
                      <span className="pg-pc-chip" style={{ background: '#ECFEFF', color: '#0E7490' }}>
                        <i className="fa-solid fa-pencil" style={{ fontSize: 9 }}></i> Subj: {p.subjMarks} Marks &middot; {p.subjTime} min
                      </span>
                    )}
                  </div>
                )}

                <div className="pg-pc-meta">
                  <span>
                    <i className="fa-regular fa-calendar" style={{ fontSize: 9, marginRight: 3 }}></i>{p.date}
                    &nbsp;<i className="fa-regular fa-clock" style={{ fontSize: 9, margin: '0 3px' }}></i>{p.time}
                  </span>
                  <span>
                    <i className="fa-solid fa-user" style={{ fontSize: 9, marginRight: 3 }}></i>{p.by}
                  </span>
                </div>
              </div>
              <div className="pg-pc-actions">
                <Tooltip text="Shuffle questions in this paper">
                  <button className="pg-action-icon shuffle" onClick={() => toast(`Shuffling "${p.title}" — questions re-ordered`, 'info')}><i className="fa-solid fa-shuffle"></i></button>
                </Tooltip>
                <Tooltip text="Edit this paper">
                  <button className="pg-action-icon edit" onClick={() => onEdit && onEdit(p)}><i className="fa-solid fa-pen"></i></button>
                </Tooltip>
                <Tooltip text="Preview this paper">
                  <button className="pg-action-icon view" onClick={() => onView && onView(p)}><i className="fa-solid fa-eye"></i></button>
                </Tooltip>
                <Tooltip text="Download as PDF or Word">
                  <button className="pg-action-icon download" onClick={() => onDownload && onDownload(p)}><i className="fa-solid fa-download"></i></button>
                </Tooltip>
                <Tooltip text="Delete this paper">
                  <button className="pg-action-icon delete" onClick={() => onDelete && onDelete(p, pi)}><i className="fa-solid fa-trash"></i></button>
                </Tooltip>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAKE PAPER MODAL — configure & fetch flow
   ═══════════════════════════════════════════════════════════════════ */
const PG_OBJ_TYPES = [
  { key:'match_columns',  label:'Match Columns' },
  { key:'true_false',     label:'True / False' },
  { key:'mcq',            label:'Multiple Choice Questions' },
  { key:'fill_blanks',    label:'Fill in the Blanks' },
  { key:'circle_word',    label:'Circle the Correct Word' },
  { key:'comprehension',  label:'Comprehension' },
  { key:'word_sentences', label:'Word Sentences' },
  { key:'word_opposite',  label:'Word Opposite' },
  { key:'singular_plural',label:'Singular / Plural' },
  { key:'word_synonyms',  label:'Word Synonyms' },
  { key:'qa',             label:'Question & Answer' },
  { key:'punctuation',    label:'Punctuation' },
];
const PG_SUBJ_TYPES = [
  { key:'short_q',        label:'Short Questions' },
  { key:'long_q',         label:'Long Question' },
  { key:'paragraph',      label:'Paragraph Writing' },
  { key:'comprehension',  label:'Comprehension' },
  { key:'letter',         label:'Letter' },
  { key:'application',    label:'Application' },
  { key:'stories',        label:'Stories' },
  { key:'essays',         label:'Essays' },
  { key:'word_sentences', label:'Word Sentences' },
  { key:'word_opposite',  label:'Word Opposite' },
  { key:'singular_plural',label:'Singular / Plural' },
  { key:'word_synonyms',  label:'Word Synonyms' },
  { key:'qa',             label:'Question & Answer' },
  { key:'punctuation',    label:'Punctuation' },
];

/* ═══════════════════════════════════════════════════════════
   RICH UNIT DATA — per subject, per unit, per question type
   Each unit has: main questions (instructions) and item counts
   ═══════════════════════════════════════════════════════════ */
const PG_UNIT_DATA = {
  English: [
    { name:'Stories of Kindness', qtypes:{
      true_false:    [{ instr:'Write True or False in the box provided.', total:10, submitted:7 }],
      mcq:           [{ instr:'Choose the correct answer by circling (A), (B), (C) or (D).', total:12, submitted:9 }],
      fill_blanks:   [{ instr:'Fill in the Blanks with the correct word from the box.', total:10, submitted:8 }],
      match_columns: [{ instr:'Match Column A with Column B.', total:8, submitted:6 }],
      circle_word:   [{ instr:'Circle the correct word to complete each sentence.', total:7, submitted:5 }],
      short_q:       [{ instr:'Answer the following Short Questions.', total:8, submitted:6 }, { instr:'Short Questions (With Answers).', total:8, submitted:6 }],
      long_q:        [{ instr:'Answer the following Long Questions.', total:5, submitted:4 }],
      comprehension: [{ instr:'Read the passage carefully and answer the questions.', total:4, submitted:3 }],
      word_opposite: [{ instr:'Write the Opposite of the following words.', total:10, submitted:8 }],
      word_sentences:[{ instr:'Make sentences using the following words.', total:6, submitted:5 }],
      singular_plural:[{ instr:'Write the Singular or Plural of the following words.', total:8, submitted:6 }],
      word_synonyms: [{ instr:'Write the Synonym of the following words.', total:9, submitted:7 }],
      qa:            [{ instr:'Write Answers of the Following Short Questions.', total:5, submitted:4 }, { instr:'Write any 2 words that begin with these letters.', total:5, submitted:5 }],
      punctuation:   [{ instr:'Punctuate the following sentences correctly.', total:8, submitted:6 }],
      stories:       [{ instr:'Write a Story on ONE of the following topics.', total:3, submitted:2 }],
      essays:        [{ instr:'Write an Essay on ONE of the following topics.', total:3, submitted:2 }],
      letter:        [{ instr:'Write a Letter as directed.', total:3, submitted:2 }],
      application:   [{ instr:'Write an Application as directed.', total:3, submitted:2 }],
      paragraph:     [{ instr:'Write a Paragraph on ONE of the following topics.', total:4, submitted:3 }],
    }},
    { name:'The Science Fair', qtypes:{
      true_false:    [{ instr:'Mark the statements as True or False.', total:8, submitted:6 }],
      mcq:           [{ instr:'Circle the correct option.', total:10, submitted:8 }],
      fill_blanks:   [{ instr:'Fill in the blanks with suitable words.', total:8, submitted:7 }],
      match_columns: [{ instr:'Match the words in Column A with Column B.', total:6, submitted:5 }],
      short_q:       [{ instr:'Answer in one or two sentences.', total:6, submitted:5 }],
      long_q:        [{ instr:'Write detailed answers.', total:4, submitted:3 }],
      word_opposite: [{ instr:'Write the antonym of each word.', total:8, submitted:6 }],
      word_sentences:[{ instr:'Use each word in a sentence.', total:5, submitted:4 }],
      qa:            [{ instr:'Short Questions.', total:5, submitted:4 }],
    }},
    { name:'The New Student', qtypes:{
      true_false:    [{ instr:'Read the sentences and write True/False.', total:10, submitted:7 }],
      mcq:           [{ instr:'Tick the correct answer.', total:8, submitted:6 }],
      fill_blanks:   [{ instr:'Complete the sentences.', total:7, submitted:5 }],
      short_q:       [{ instr:'Answer the following questions.', total:6, submitted:5 }, { instr:'Short Questions (With Answers).', total:6, submitted:4 }],
      word_opposite: [{ instr:'Write opposites.', total:7, submitted:5 }],
      qa:            [{ instr:'Write any five days of the following?', total:1, submitted:0 }],
    }},
    { name:"Fizza's Family", qtypes:{
      true_false:    [{ instr:'Are these sentences True or False?', total:8, submitted:6 }],
      mcq:           [{ instr:'Choose the best answer.', total:9, submitted:7 }],
      fill_blanks:   [{ instr:'Fill in with words from the box.', total:8, submitted:6 }],
      short_q:       [{ instr:'Write short answers.', total:5, submitted:4 }],
      word_sentences:[{ instr:'Make sentences.', total:5, submitted:4 }],
      qa:            [{ instr:'Write Answers of the Following Short Questions.', total:5, submitted:5 }],
    }},
    { name:'Creative School', qtypes:{
      true_false:    [{ instr:'Write T for True and F for False.', total:7, submitted:5 }],
      mcq:           [{ instr:'Select the right answer.', total:8, submitted:6 }],
      fill_blanks:   [{ instr:'Fill in the blanks.', total:6, submitted:5 }],
      short_q:       [{ instr:'Answer briefly.', total:5, submitted:4 }],
      qa:            [{ instr:'Write any 2 words that begin with these letters.', total:5, submitted:5 }, { instr:'Write any five days of the following?', total:1, submitted:0 }],
    }},
    { name:'Ahmad testing', qtypes:{
      true_false:    [{ instr:'Testing on 5th Aug.', total:1, submitted:0 }],
      short_q:       [{ instr:'Short Questions.', total:5, submitted:0 }],
      qa:            [{ instr:'Mentor AI.', total:5, submitted:0 }],
    }},
  ],
  Urdu: [
    { name:'سبق 1 – محنت', qtypes:{
      true_false:  [{ instr:'درست یا غلط لکھیں', total:8, submitted:6 }],
      fill_blanks: [{ instr:'خالی جگہیں پر کریں', total:7, submitted:5 }],
      short_q:     [{ instr:'مختصر جوابات لکھیں', total:6, submitted:4 }],
    }},
    { name:'سبق 2 – صفائی', qtypes:{
      mcq:         [{ instr:'درست جواب منتخب کریں', total:8, submitted:6 }],
      short_q:     [{ instr:'سوالات کے جوابات دیں', total:5, submitted:4 }],
    }},
    { name:'سبق 3 – وطن', qtypes:{
      true_false:  [{ instr:'صحیح یا غلط', total:6, submitted:5 }],
      short_q:     [{ instr:'مختصر جوابات', total:5, submitted:3 }],
    }},
  ],
  Mathematics: [
    { name:'Unit 1 – Numbers', qtypes:{
      mcq:         [{ instr:'Choose the correct answer.', total:12, submitted:10 }],
      fill_blanks: [{ instr:'Fill in the blanks.', total:10, submitted:8 }],
      true_false:  [{ instr:'Write True or False.', total:8, submitted:6 }],
      short_q:     [{ instr:'Solve the following.', total:6, submitted:5 }],
      long_q:      [{ instr:'Solve with full working.', total:5, submitted:4 }],
    }},
    { name:'Unit 2 – Fractions', qtypes:{
      mcq:         [{ instr:'Tick the correct option.', total:10, submitted:8 }],
      fill_blanks: [{ instr:'Complete each statement.', total:8, submitted:7 }],
      short_q:     [{ instr:'Solve briefly.', total:5, submitted:4 }],
    }},
    { name:'Unit 3 – Geometry', qtypes:{
      mcq:         [{ instr:'Select the right answer.', total:8, submitted:7 }],
      short_q:     [{ instr:'Solve these problems.', total:6, submitted:5 }],
      long_q:      [{ instr:'Solve with diagram.', total:4, submitted:3 }],
    }},
  ],
  Science: [
    { name:'Unit 1 – Plants', qtypes:{
      mcq:         [{ instr:'Choose the correct answer.', total:10, submitted:8 }],
      true_false:  [{ instr:'Write True or False.', total:8, submitted:6 }],
      fill_blanks: [{ instr:'Fill in the blanks.', total:8, submitted:7 }],
      short_q:     [{ instr:'Answer in 2-3 sentences.', total:6, submitted:5 }],
      long_q:      [{ instr:'Write detailed answer.', total:4, submitted:3 }],
    }},
    { name:'Unit 2 – Animals', qtypes:{
      mcq:         [{ instr:'Tick the best answer.', total:10, submitted:8 }],
      true_false:  [{ instr:'Are these correct?', total:7, submitted:5 }],
      short_q:     [{ instr:'Short answers.', total:5, submitted:4 }],
    }},
    { name:'Unit 3 – Earth', qtypes:{
      mcq:         [{ instr:'Circle the correct option.', total:9, submitted:7 }],
      fill_blanks: [{ instr:'Fill in with correct words.', total:7, submitted:6 }],
      short_q:     [{ instr:'Write brief answers.', total:5, submitted:4 }],
      long_q:      [{ instr:'Explain in detail.', total:3, submitted:2 }],
    }},
  ],
  'Social Studies': [
    { name:'Unit 1 – My Family', qtypes:{
      mcq:         [{ instr:'Choose the correct answer.', total:8, submitted:6 }],
      short_q:     [{ instr:'Short questions.', total:5, submitted:4 }],
      fill_blanks: [{ instr:'Fill in the blanks.', total:6, submitted:5 }],
    }},
    { name:'Unit 2 – My City', qtypes:{
      mcq:         [{ instr:'Select the best option.', total:8, submitted:7 }],
      short_q:     [{ instr:'Answer briefly.', total:5, submitted:4 }],
    }},
  ],
};

/* Per-block / per-tab state lives inside MakePaperModal as React state.
   Shape:
   blocksState = {
     [section]: {                      // 'obj' | 'subj'
       [typeKey]: {
         tabs: [
           { entryId, label, saved,
             unitSelections: { [unitName]: instrIdx },
             instr, items, choices, marks, totalEligible
           },
         ],
         activeTab: entryId | null,
         open: bool,
       },
     },
   }
*/

/* Sum visible marks (items - choices) × marks across all saved/dirty tabs of a section */
function sectionUsedMarks(sectionState) {
  if (!sectionState) return 0;
  let total = 0;
  Object.values(sectionState).forEach(block => {
    (block.tabs || []).forEach(t => {
      const visible = Math.max(0, (+t.items || 0) - (+t.choices || 0));
      total += visible * (+t.marks || 0);
    });
  });
  return total;
}

/* Per-type aggregate badge — { items, marks, count } per typeKey within a section */
function typeAggregates(sectionState) {
  const map = {};
  if (!sectionState) return map;
  Object.entries(sectionState).forEach(([typeKey, block]) => {
    (block.tabs || []).forEach(t => {
      const items   = +t.items   || 0;
      const choices = +t.choices || 0;
      const marks   = +t.marks   || 0;
      const visible = Math.max(0, items - choices);
      const m = map[typeKey] || { items:0, marks:0, count:0 };
      m.items += items;
      m.marks += visible * marks;
      m.count += items > 0 ? 1 : 0;
      map[typeKey] = m;
    });
  });
  return map;
}

let PG_ENTRY_COUNTER = 0;
const newEntryId = () => 'pgEntry-' + (++PG_ENTRY_COUNTER);

/* Empty fresh tab template */
function freshTab(num) {
  return {
    entryId: newEntryId(),
    label: 'Q No. ' + num,
    saved: false,
    unitSelections: {},  // { unitName: instrIdx }
    instr: '',
    items: 0,
    choices: 0,
    marks: 1,
    totalEligible: 0,
  };
}

function MakePaperModal({ cls, defaultFmt, initialPaper, onClose, toast }) {
  const isEdit = !!initialPaper;
  const [subject, setSubject]   = useState(isEdit ? (initialPaper.subj      || '') : '');
  const [paperType, setPaperType] = useState(isEdit ? (initialPaper.type    || '') : '');
  const [paperFmt, setPaperFmt] = useState(isEdit ? (initialPaper.format    || defaultFmt || '') : (defaultFmt || ''));
  const [title, setTitle]       = useState(isEdit ? (initialPaper.title     || '') : '');
  const [objMarks, setObjMarks] = useState(isEdit && initialPaper.objMarks  ? String(initialPaper.objMarks)  : '');
  const [objTime, setObjTime]   = useState(isEdit && initialPaper.objTime   ? String(initialPaper.objTime)   : '');
  const [subjMarks, setSubjMarks] = useState(isEdit && initialPaper.subjMarks ? String(initialPaper.subjMarks) : '');
  const [subjTime, setSubjTime] = useState(isEdit && initialPaper.subjTime  ? String(initialPaper.subjTime)  : '');
  const [fetched, setFetched]   = useState(false);
  const [qTab, setQTab]         = useState('obj');  // 'obj' | 'subj'

  /* blocksState = { obj: { typeKey: { open, activeTab, tabs:[...] } }, subj: {...} } */
  const [blocksState, setBlocksState] = useState({ obj: {}, subj: {} });

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* Edit flow: notify once on mount */
  useEffect(() => {
    if (isEdit) toast(`Editing "${initialPaper.title}" — modify fields and Save`, 'info');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showObj  = paperType === 'objective' || paperType === 'both';
  const showSubj = paperType === 'subjective' || paperType === 'both';
  const showMarksRow = !!paperType;

  // Validation: every required field for the chosen paperType must be filled
  const objOk  = !showObj  || ((+objMarks  > 0) && (+objTime  > 0));
  const subjOk = !showSubj || ((+subjMarks > 0) && (+subjTime > 0));
  const baseOk = !!subject && !!paperType && !!paperFmt && !!title.trim() && objOk && subjOk;
  const canFetch = baseOk;

  /* Live totals from saved + open tabs */
  const objUsed  = sectionUsedMarks(blocksState.obj);
  const subjUsed = sectionUsedMarks(blocksState.subj);
  const objTarget  = +objMarks  || 0;
  const subjTarget = +subjMarks || 0;
  const objStatus  = !showObj  ? 'na' : objUsed === objTarget && objTarget > 0 ? 'ok' : objUsed > objTarget ? 'over' : 'under';
  const subjStatus = !showSubj ? 'na' : subjUsed === subjTarget && subjTarget > 0 ? 'ok' : subjUsed > subjTarget ? 'over' : 'under';
  const validationOk = (!showObj || objStatus === 'ok') && (!showSubj || subjStatus === 'ok');

  const canGenerate = baseOk && fetched && validationOk;

  /* Reset fetched state when settings change */
  const resetOnChange = () => { if (fetched) { setFetched(false); setBlocksState({ obj: {}, subj: {} }); } };

  /* ── Block (accordion) helpers ── */
  const ensureBlock = (state, section, typeKey) => {
    const sec = { ...(state[section] || {}) };
    if (!sec[typeKey]) sec[typeKey] = { open:false, activeTab:null, tabs:[] };
    return { ...state, [section]: sec };
  };

  const toggleBlockOpen = (section, typeKey) => {
    setBlocksState(prev => {
      const next = ensureBlock(prev, section, typeKey);
      const block = { ...next[section][typeKey], open: !next[section][typeKey].open };
      return { ...next, [section]: { ...next[section], [typeKey]: block } };
    });
  };

  const addTab = (section, typeKey) => {
    const subjUnits = (PG_UNIT_DATA[subject] || []).filter(u => u.qtypes[typeKey]);
    if (subjUnits.length === 0) {
      toast('No approved items found for this question type', 'warning');
      return;
    }
    setBlocksState(prev => {
      const next = ensureBlock(prev, section, typeKey);
      const block = next[section][typeKey];
      const tab = freshTab(block.tabs.length + 1);
      const newBlock = { ...block, open:true, activeTab: tab.entryId, tabs:[...block.tabs, tab] };
      return { ...next, [section]: { ...next[section], [typeKey]: newBlock } };
    });
  };

  const switchTab = (section, typeKey, entryId) => {
    setBlocksState(prev => {
      const block = prev[section]?.[typeKey];
      if (!block) return prev;
      return { ...prev, [section]: { ...prev[section], [typeKey]: { ...block, activeTab: entryId } } };
    });
  };

  const removeTab = (section, typeKey, entryId) => {
    setBlocksState(prev => {
      const block = prev[section]?.[typeKey];
      if (!block) return prev;
      const tabs = block.tabs.filter(t => t.entryId !== entryId);
      const activeTab = block.activeTab === entryId
        ? (tabs.length ? tabs[tabs.length - 1].entryId : null)
        : block.activeTab;
      return { ...prev, [section]: { ...prev[section], [typeKey]: { ...block, tabs, activeTab } } };
    });
  };

  const updateTab = (section, typeKey, entryId, patch) => {
    setBlocksState(prev => {
      const block = prev[section]?.[typeKey];
      if (!block) return prev;
      const tabs = block.tabs.map(t => t.entryId === entryId ? { ...t, ...patch } : t);
      return { ...prev, [section]: { ...prev[section], [typeKey]: { ...block, tabs } } };
    });
  };

  const saveTab = (section, typeKey, entryId) => {
    const block = blocksState[section]?.[typeKey];
    const tab = block?.tabs.find(t => t.entryId === entryId);
    if (!tab) return;
    const selCount = Object.keys(tab.unitSelections).length;
    if (selCount === 0) { toast('Please select at least one unit', 'warning'); return; }
    const items = +tab.items || 0;
    if (items < 1) { toast('Please enter number of items', 'warning'); return; }
    if (items > tab.totalEligible) {
      toast('Items exceed approved count (' + tab.totalEligible + ')', 'warning');
      return;
    }
    updateTab(section, typeKey, entryId, { saved:true });
    toast('Question block saved', 'success');
  };

  const editTab = (section, typeKey, entryId) =>
    updateTab(section, typeKey, entryId, { saved:false });

  const onFetch = () => {
    if (!canFetch) {
      toast('Please fill all the fields before fetching', 'warning');
      return;
    }
    setBlocksState({ obj: {}, subj: {} });
    setFetched(true);
    setQTab(showObj ? 'obj' : 'subj');
    toast('Questions fetched successfully', 'success');
  };

  const onGenerate = () => {
    if (!canGenerate) {
      toast('Complete validation before generating', 'warning');
      return;
    }
    toast(`Paper generated — "${title}"`, 'success');
    onClose();
  };

  return createPortal(
    <div
      className="pg-modal-overlay open"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="pg-modal" style={{ maxWidth: 900 }}>
        <div className="pg-modal-header">
          <div>
            <div className="pg-modal-title">Make Paper — {cls.name} ({cls.section})</div>
            <div className="pg-modal-sub">{cls.name} · Section {cls.section}</div>
          </div>
          <Tooltip text="Close"><button className="pg-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>

        <div className="pg-modal-body" style={{ padding: '16px 20px' }}>
          {/* Info notice */}
          <div className="pg-info-notice">
            <i className="fa-solid fa-circle-info" style={{ color: '#1E40AF', fontSize: 14, flexShrink: 0, marginTop: 1 }}></i>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              <strong style={{ color: '#1E40AF' }}>How paper generation works:</strong> This paper is generated from <strong>teacher-submitted notebook items only</strong>. Unsubmitted items will not appear in paper generation. Fill all fields below, fetch questions, then configure each question type.
            </div>
          </div>

          {/* Settings */}
          <div className="pg-settings-compact">
            <div className="pg-settings-row">
              <div className="pg-sc-field">
                <div className="pg-field-label">Subject</div>
                <select className="pg-select" value={subject} onChange={e => { setSubject(e.target.value); resetOnChange(); }}>
                  <option value="">— Choose —</option>
                  {cls.subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="pg-sc-field">
                <div className="pg-field-label">Paper Type</div>
                <select className="pg-select" value={paperType} onChange={e => { setPaperType(e.target.value); resetOnChange(); }}>
                  <option value="">— Choose —</option>
                  <option value="objective">Objective</option>
                  <option value="subjective">Subjective</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div className="pg-sc-field">
                <div className="pg-field-label">Paper Format</div>
                <select className="pg-select" value={paperFmt} onChange={e => { setPaperFmt(e.target.value); resetOnChange(); }}>
                  <option value="">— Choose —</option>
                  <option value="with">With Answer Sheet</option>
                  <option value="without">Without Answer Sheet</option>
                </select>
              </div>
              <div className="pg-sc-field pg-sc-field--wide">
                <div className="pg-field-label">Paper Title</div>
                <input className="pg-input" type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Monthly Test 1" />
              </div>
            </div>

            {showMarksRow && (
              <div className="pg-marks-compact-row">
                {showObj && (
                  <>
                    <div className="pg-sc-field">
                      <div className="pg-field-label">Obj. Time (min)</div>
                      <input className="pg-input" type="number" min="1" value={objTime} onChange={e => { setObjTime(e.target.value); resetOnChange(); }} placeholder="30" />
                    </div>
                    <div className="pg-sc-field">
                      <div className="pg-field-label">Obj. Marks</div>
                      <input className="pg-input" type="number" min="1" value={objMarks} onChange={e => { setObjMarks(e.target.value); resetOnChange(); }} placeholder="20" />
                    </div>
                  </>
                )}
                {showSubj && (
                  <>
                    <div className="pg-sc-field">
                      <div className="pg-field-label">Subj. Time (min)</div>
                      <input className="pg-input" type="number" min="1" value={subjTime} onChange={e => { setSubjTime(e.target.value); resetOnChange(); }} placeholder="70" />
                    </div>
                    <div className="pg-sc-field">
                      <div className="pg-field-label">Subj. Marks</div>
                      <input className="pg-input" type="number" min="1" value={subjMarks} onChange={e => { setSubjMarks(e.target.value); resetOnChange(); }} placeholder="80" />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Hint */}
          <div className="pg-fetch-hint">
            <i className="fa-solid fa-lightbulb" style={{ color: '#F59E0B', fontSize: 12, flexShrink: 0 }}></i>
            <span>
              Select a subject, paper type, format, and title above, then click <strong>Fetch Questions</strong> to load available submitted items.
            </span>
          </div>

          {/* Fetch button */}
          <div style={{ textAlign: 'center', margin: '6px 0 14px' }}>
            <Tooltip text={canFetch ? 'Load questions for the selected class and subject' : 'Pick a class and subject first'}>
              <button className="pg-fetch-btn" onClick={onFetch} disabled={!canFetch}>
                <i className="fa-solid fa-magnifying-glass"></i> Fetch Questions
              </button>
            </Tooltip>
          </div>

          {/* Question builder (after fetch) */}
          {fetched && (
            <div>
              {/* Marks tracker */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, padding: '6px 10px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <i className="fa-solid fa-chart-bar" style={{ color: '#1E40AF', fontSize: 11 }}></i>
                  <span><strong>Marks tracker:</strong> Used marks must exactly match the required marks before you can generate the paper. Adjust item counts or marks per item to balance.</span>
                </div>
                {showObj && (
                  <MarksBar status={objStatus} label="Objective" iconColor="#1E40AF" iconClass="fa-circle-dot" used={objUsed} target={objTarget} />
                )}
                {showSubj && (
                  <MarksBar status={subjStatus} label="Subjective" iconColor="#0891B2" iconClass="fa-pencil" used={subjUsed} target={subjTarget} style={{ marginTop: 6 }} />
                )}
              </div>

              {/* Obj/Subj tabs */}
              {paperType === 'both' && (
                <div className="pg-qtype-tabs" style={{ marginBottom: 10 }}>
                  <Tooltip text="Edit the objective section (MCQs, fill in the blanks, etc.)">
                    <button className={`pg-qtype-tab${qTab === 'obj' ? ' active' : ''}`} onClick={() => setQTab('obj')}>
                      <i className="fa-solid fa-circle-dot"></i> Objective
                    </button>
                  </Tooltip>
                  <Tooltip text="Edit the subjective section (short / long questions)">
                    <button className={`pg-qtype-tab${qTab === 'subj' ? ' active' : ''}`} onClick={() => setQTab('subj')}>
                      <i className="fa-solid fa-pencil"></i> Subjective
                    </button>
                  </Tooltip>
                </div>
              )}

              {/* Question type blocks */}
              {(showObj && (paperType === 'objective' || qTab === 'obj')) && (
                <div>
                  <div className="pg-section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Objective Question Types</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                      Select main questions · set items &amp; choices per type
                    </span>
                  </div>
                  {PG_OBJ_TYPES.map(t => (
                    <QBlockAccordion
                      key={t.key}
                      typeDef={t}
                      section="obj"
                      subject={subject}
                      block={blocksState.obj[t.key]}
                      typeAgg={typeAggregates(blocksState.obj)[t.key]}
                      onToggleOpen={() => toggleBlockOpen('obj', t.key)}
                      onAddTab={() => addTab('obj', t.key)}
                      onSwitchTab={entryId => switchTab('obj', t.key, entryId)}
                      onRemoveTab={entryId => removeTab('obj', t.key, entryId)}
                      onUpdateTab={(entryId, patch) => updateTab('obj', t.key, entryId, patch)}
                      onSaveTab={entryId => saveTab('obj', t.key, entryId)}
                      onEditTab={entryId => editTab('obj', t.key, entryId)}
                    />
                  ))}
                </div>
              )}

              {(showSubj && (paperType === 'subjective' || qTab === 'subj')) && (
                <div>
                  <div className="pg-section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Subjective Question Types</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                      Select main questions · set items &amp; marks per type
                    </span>
                  </div>
                  {PG_SUBJ_TYPES.map(t => (
                    <QBlockAccordion
                      key={t.key}
                      typeDef={t}
                      section="subj"
                      subject={subject}
                      block={blocksState.subj[t.key]}
                      typeAgg={typeAggregates(blocksState.subj)[t.key]}
                      onToggleOpen={() => toggleBlockOpen('subj', t.key)}
                      onAddTab={() => addTab('subj', t.key)}
                      onSwitchTab={entryId => switchTab('subj', t.key, entryId)}
                      onRemoveTab={entryId => removeTab('subj', t.key, entryId)}
                      onUpdateTab={(entryId, patch) => updateTab('subj', t.key, entryId, patch)}
                      onSaveTab={entryId => saveTab('subj', t.key, entryId)}
                      onEditTab={entryId => editTab('subj', t.key, entryId)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pg-modal-footer">
          <Tooltip text="Discard changes and close">
            <button className="pg-btn-secondary" onClick={onClose}>Cancel</button>
          </Tooltip>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>
              <i className="fa-solid fa-lock" style={{ fontSize: 9, marginRight: 3 }}></i>
              Generate is enabled only when all marks validations are complete
            </div>
            <Tooltip text={canGenerate ? 'Generate the paper' : 'Complete all marks validations first'}>
              <button
                className="pg-btn-primary"
                onClick={onGenerate}
                disabled={!canGenerate}
                style={!canGenerate ? { opacity: .5, cursor: 'not-allowed' } : undefined}
              >
                <i className="fa-solid fa-wand-magic-sparkles"></i> Generate Paper
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* Marks tracker bar with color-coded status */
function MarksBar({ status, label, iconColor, iconClass, used, target, style }) {
  const cls = target > 0 ? status : '';
  const remain = target - used;
  let body;
  if (status === 'ok') {
    body = <>Used: <strong>{used}</strong> / Target: {target} ✓</>;
  } else if (status === 'over') {
    body = <>Used: <strong style={{ color: 'var(--error,#DC2626)' }}>{used}</strong> / Target: {target} <span style={{ fontSize: 10 }}>(+{used - target} over)</span></>;
  } else {
    body = <>Used: <strong>{used}</strong> / Target: {target} <span style={{ fontSize: 10 }}>({target > 0 ? `${remain} remaining` : 'set marks above'})</span></>;
  }
  return (
    <div className={`pg-marks-bar ${cls}`} style={style}>
      <span className="pg-marks-label">
        <i className={`fa-solid ${iconClass}`} style={{ color: iconColor }}></i> {label}
      </span>
      <span className={`pg-marks-status ${status}`}>{body}</span>
    </div>
  );
}

/* Per-question-type accordion. Holds tabs (Question No. 1/2/...) and
   inside each tab a workspace where the user picks units, instruction,
   items / choices / marks. */
function QBlockAccordion({ typeDef, section, subject, block, typeAgg,
  onToggleOpen, onAddTab, onSwitchTab, onRemoveTab, onUpdateTab, onSaveTab, onEditTab }) {

  const unitData = PG_UNIT_DATA[subject] || [];
  let totalSubmitted = 0, unitCount = 0;
  unitData.forEach(u => {
    const qt = u.qtypes[typeDef.key];
    if (qt) { unitCount++; qt.forEach(q => { totalSubmitted += q.submitted; }); }
  });

  const open      = !!block?.open;
  const tabs      = block?.tabs || [];
  const activeTab = block?.activeTab;
  const activeIdx = tabs.findIndex(t => t.entryId === activeTab);

  const badge = totalSubmitted > 0
    ? <span className="pg-qblock-badge">{totalSubmitted} approved · {unitCount} unit{unitCount !== 1 ? 's' : ''}</span>
    : <span className="pg-qblock-badge" style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>No items</span>;

  return (
    <div className="pg-qblock">
      <div className="pg-qblock-header" onClick={onToggleOpen}>
        <div className="pg-qblock-title">{typeDef.label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {badge}
          {typeAgg && typeAgg.count > 0 && (
            <span className="pg-type-config-badge">
              <i className="fa-solid fa-check-circle" style={{ fontSize: 9 }}></i>
              {' '}{typeAgg.count} Question{typeAgg.count !== 1 ? 's' : ''} · {typeAgg.marks} Marks
            </span>
          )}
          <i className="fa-solid fa-chevron-down" style={{ fontSize: 11, color: 'var(--text-muted)', transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none', marginLeft: 2 }}></i>
        </div>
      </div>
      {open && (
        <div className="pg-qblock-body open">
          {/* Tab nav */}
          <div className="pg-qtab-nav">
            {tabs.length === 0 ? (
              <>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', padding: '2px 4px' }}>No question blocks yet.</span>
                <Tooltip text="Add a question block of this type">
                  <button className="pg-qtab-add-btn" onClick={onAddTab}>
                    <i className="fa-solid fa-plus"></i> Add Question Block
                  </button>
                </Tooltip>
              </>
            ) : (
              <>
                {tabs.map(t => {
                  const isActive = t.entryId === activeTab;
                  const visible = Math.max(0, (+t.items || 0) - (+t.choices || 0));
                  const totalMk = visible * (+t.marks || 0);
                  const hasData = (+t.items || 0) > 0;
                  return (
                    <Tooltip
                      key={t.entryId}
                      text={hasData
                        ? `${t.label} · ${t.items} questions · ${totalMk} marks${t.saved ? ' (saved)' : ''}`
                        : `${t.label}${t.saved ? ' (saved)' : ''}`}
                    >
                      <button
                        className={`pg-qtab-pill${isActive ? ' active' : ''}${t.saved ? ' saved' : ''}`}
                        onClick={() => onSwitchTab(t.entryId)}
                      >
                        {t.saved && (
                          <i className="fa-solid fa-check" style={{ fontSize: 9, marginRight: 2, color: isActive ? '#fff' : 'var(--success,#16A34A)' }}></i>
                        )}
                        {t.label}
                        {hasData && (
                          <span style={{ fontSize: 9.5, fontWeight: 700, opacity: .75, marginLeft: 3 }}>
                            {t.items} Q · {totalMk} Marks
                          </span>
                        )}
                        {tabs.length > 1 && (
                          <span
                            className="pg-qtab-close"
                            onClick={e => { e.stopPropagation(); onRemoveTab(t.entryId); }}
                          >×</span>
                        )}
                      </button>
                    </Tooltip>
                  );
                })}
                <Tooltip text="Add another tab of this question type">
                  <button className="pg-qtab-add-btn" onClick={onAddTab}>
                    <i className="fa-solid fa-plus"></i> Add
                  </button>
                </Tooltip>
              </>
            )}
          </div>

          {/* Active tab workspace */}
          {activeIdx >= 0 && (
            <div className="pg-qworkspace">
              {tabs[activeIdx].saved ? (
                <QSavedCard
                  tab={tabs[activeIdx]}
                  onEdit={() => onEditTab(tabs[activeIdx].entryId)}
                />
              ) : (
                <QWorkspacePanel
                  tab={tabs[activeIdx]}
                  typeKey={typeDef.key}
                  subject={subject}
                  onUpdate={patch => onUpdateTab(tabs[activeIdx].entryId, patch)}
                  onSave={() => onSaveTab(tabs[activeIdx].entryId)}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* Saved-state summary card shown inside a tab once user clicks Save */
function QSavedCard({ tab, onEdit }) {
  const items   = +tab.items   || 0;
  const choices = +tab.choices || 0;
  const marks   = +tab.marks   || 1;
  const visible = Math.max(0, items - choices);
  const unitNames = Object.keys(tab.unitSelections || {});
  return (
    <div className="pg-qws-panel">
      <div className="pg-qws-saved-card">
        <div className="pg-qws-saved-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <div className="pg-qws-saved-icon"><i className="fa-solid fa-check"></i></div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{tab.instr || '(no instruction)'}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{unitNames.join(' · ')}</div>
            </div>
          </div>
          <Tooltip text="Edit this question block">
            <button className="pg-qws-edit-btn" onClick={onEdit}>
              <i className="fa-solid fa-pen"></i> Edit
            </button>
          </Tooltip>
        </div>
        <div className="pg-qws-saved-chips">
          <span className="pg-qws-chip blue"><i className="fa-solid fa-list-ol" style={{ fontSize: 9 }}></i> {items} items</span>
          <span className="pg-qws-chip teal"><i className="fa-solid fa-eye-slash" style={{ fontSize: 9 }}></i> {choices} choices</span>
          <span className="pg-qws-chip green"><i className="fa-solid fa-star" style={{ fontSize: 9 }}></i> {marks} mark{marks !== 1 ? 's' : ''}/item</span>
          <span className="pg-qws-chip amber"><i className="fa-solid fa-calculator" style={{ fontSize: 9 }}></i> {visible * marks} total marks</span>
          <span className="pg-qws-chip gray"><i className="fa-solid fa-database" style={{ fontSize: 9 }}></i> {tab.totalEligible} eligible</span>
        </div>
      </div>
    </div>
  );
}

/* Editable workspace: left = units + instructions, right = configure */
function QWorkspacePanel({ tab, typeKey, subject, onUpdate, onSave }) {
  const unitData      = PG_UNIT_DATA[subject] || [];
  const unitsWithType = unitData.filter(u => u.qtypes[typeKey]);

  const selectedUnits = tab.unitSelections || {};
  const selCount = Object.keys(selectedUnits).length;

  /* Recalculate eligible whenever unit/instruction selection changes */
  const breakdown = [];
  let totalEligible = 0;
  Object.entries(selectedUnits).forEach(([unitName, instrIdx]) => {
    const unitObj = unitData.find(u => u.name === unitName);
    if (!unitObj) return;
    const instrs = unitObj.qtypes[typeKey] || [];
    const chosen = instrs[instrIdx];
    if (chosen) {
      totalEligible += chosen.submitted;
      breakdown.push(`${unitName}: ${chosen.submitted}`);
    }
  });

  /* Keep tab.totalEligible in sync */
  useEffect(() => {
    if (tab.totalEligible !== totalEligible) {
      onUpdate({ totalEligible });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalEligible]);

  const toggleUnit = (unitName) => {
    const next = { ...selectedUnits };
    if (unitName in next) delete next[unitName];
    else next[unitName] = 0;
    onUpdate({ unitSelections: next });
  };

  const selectInstr = (unitName, instrIdx) => {
    onUpdate({ unitSelections: { ...selectedUnits, [unitName]: instrIdx } });
  };

  const items   = +tab.items   || 0;
  const choices = +tab.choices || 0;
  const marks   = +tab.marks   || 1;
  const visible = Math.max(0, items - choices);
  const overflow = items > totalEligible && totalEligible > 0;

  return (
    <div className="pg-qws-panel">
      <div className="pg-qws-inner">
        {/* LEFT */}
        <div className="pg-qws-left">
          <div className="pg-qws-section-label">
            <i className="fa-solid fa-layer-group" style={{ color: '#1E40AF' }}></i>
            Select Units
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>(click to toggle)</span>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.45, padding: '5px 8px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)', borderLeft: '2px solid #1E40AF' }}>
            Select the units to include. Only <strong>submitted &amp; acknowledged</strong> items from selected units will be available.
          </div>
          <div className="pg-unit-rows-container">
            {unitsWithType.length === 0 ? (
              <div style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                No approved items for this type.
              </div>
            ) : unitsWithType.map(u => {
              const isActive = u.name in selectedUnits;
              const totalSub = u.qtypes[typeKey].reduce((s, q) => s + q.submitted, 0);
              const instrs   = u.qtypes[typeKey] || [];
              const sel      = isActive ? selectedUnits[u.name] : -1;
              return (
                <div key={u.name} className="pg-unit-row-wrap">
                  <div
                    className={`pg-unit-row${isActive ? ' active' : ''}`}
                    onClick={() => toggleUnit(u.name)}
                  >
                    <div className={`pg-unit-row-dot${isActive ? ' active' : ''}`}></div>
                    <div className="pg-unit-row-name">{u.name}</div>
                    <span className="pg-unit-chip-count">{totalSub} approved</span>
                  </div>
                  {isActive && (
                    <div className="pg-unit-instr-list">
                      {instrs.map((q, qi) => (
                        <div
                          key={qi}
                          className={`pg-instr-card${sel === qi ? ' active' : ''}`}
                          onClick={() => selectInstr(u.name, qi)}
                        >
                          <div className="pg-instr-card-radio"></div>
                          <div className="pg-instr-card-body">
                            <div className="pg-instr-card-text">{q.instr}</div>
                            <div className="pg-instr-card-meta">
                              <span className="pg-q-info-chip total" style={{ padding: '2px 6px', fontSize: 10 }}>Total: {q.total}</span>
                              <span className="pg-q-info-chip available" style={{ padding: '2px 6px', fontSize: 10 }}>Approved: {q.submitted}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="pg-eligible-bar">
            {selCount === 0 ? (
              <>
                <i className="fa-solid fa-database" style={{ color: 'var(--text-muted)', fontSize: 11 }}></i>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Select units to see eligible items</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-check-circle" style={{ color: 'var(--success,#16A34A)', fontSize: 13 }}></i>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 12.5 }}>{totalEligible} Eligible Items</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11.5, marginLeft: 8 }}>({breakdown.join(' + ')})</span>
                </div>
              </>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>
            <i className="fa-solid fa-circle-info" style={{ fontSize: 9, marginRight: 3, color: '#0284C7' }}></i>
            Eligible = teacher-submitted &amp; principal-acknowledged items only.
          </div>
        </div>

        {/* RIGHT */}
        {selCount === 0 ? (
          <div className="pg-qws-right pg-qws-right-empty">
            <i className="fa-solid fa-arrow-left" style={{ fontSize: 20, opacity: .3 }}></i>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>Select units to configure</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Click any unit on the left to begin</div>
          </div>
        ) : (
          <div className="pg-qws-right">
            <div className="pg-qws-section-label">
              <i className="fa-solid fa-sliders" style={{ color: '#1E40AF' }}></i>
              Configure Question
            </div>
            <div style={{ marginBottom: 10 }}>
              <div className="pg-q-field-label" style={{ marginBottom: 4 }}>
                Main Instruction <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>(shown on paper)</span>
              </div>
              <input
                className="pg-q-instruction"
                type="text"
                value={tab.instr || ''}
                onChange={e => onUpdate({ instr: e.target.value })}
                placeholder="e.g. Write the Opposite of the following words"
                style={{ borderRadius: 'var(--radius-sm)', fontSize: 12.5 }}
              />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                <i className="fa-solid fa-lightbulb" style={{ fontSize: 9, color: '#F59E0B', marginRight: 3 }}></i>
                Main questions may differ per unit even if the question type is the same.
              </div>
            </div>
            <div className="pg-qws-fields">
              <div>
                <div className="pg-q-field-label">No. of Items</div>
                <input
                  className="pg-q-input"
                  type="number"
                  min={1}
                  value={items || ''}
                  placeholder="e.g. 5"
                  onChange={e => onUpdate({ items: Math.max(0, +e.target.value || 0) })}
                />
                <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 3 }}>Max = Total Eligible</div>
              </div>
              <div>
                <div className="pg-q-field-label">No. of Choices</div>
                <input
                  className="pg-q-input"
                  type="number"
                  min={0}
                  value={choices}
                  onChange={e => onUpdate({ choices: Math.max(0, +e.target.value || 0) })}
                />
                <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 3 }}>Choices = extra options; reduces compulsory items</div>
              </div>
              <div>
                <div className="pg-q-field-label">Marks / Item</div>
                <input
                  className="pg-q-input"
                  type="number"
                  min={1}
                  value={marks}
                  onChange={e => onUpdate({ marks: Math.max(0, +e.target.value || 0) })}
                />
                <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 3 }}>Auto-calculates total marks</div>
              </div>
              <div>
                <div className="pg-q-field-label">Total Eligible</div>
                <input
                  className="pg-q-input"
                  type="number"
                  value={totalEligible}
                  readOnly
                  style={{ background: 'var(--bg-card)', fontWeight: 700, color: '#1E40AF', cursor: 'default' }}
                />
                <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 3 }}>From selected units</div>
              </div>
            </div>
            <div className="pg-q-calc">
              {items > 0
                ? <>Paper shows <strong>{visible} item{visible !== 1 ? 's' : ''}</strong> · <strong>{choices} choice item{choices !== 1 ? 's' : ''}</strong> · <strong>{visible * marks} mark{visible * marks !== 1 ? 's' : ''}</strong></>
                : <>Set items &amp; choices to see layout preview</>}
            </div>
            {overflow && (
              <div className="pg-q-warn">
                <i className="fa-solid fa-triangle-exclamation"></i>
                You selected {items} items but only {totalEligible} approved items are available.
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-light)' }}>
              <Tooltip text="Save this question block">
                <button className="pg-btn-primary" style={{ padding: '8px 20px', fontSize: 12.5 }} onClick={onSave}>
                  <i className="fa-solid fa-floppy-disk"></i> Save
                </button>
              </Tooltip>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PAPER VIEW MODAL — Color/B&W toggle + sample paper body + Download
   ═══════════════════════════════════════════════════════════════════ */
function PaperViewModal({ paper, cls, onClose, onDownload }) {
  const [tone, setTone] = useState('color'); // 'color' | 'bw'

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isBW = tone === 'bw';
  /* Preview palettes: Colorful = brand blue header/sections; Colorless =
     printer-friendly white header/sections with dark text (matches the
     final printed output produced by buildFullPaperHTML). */
  const headerBg     = isBW ? '#FFFFFF' : '#1E3A8A';
  const headerColor  = isBW ? '#0F172A' : '#FFFFFF';
  const headerBorder = isBW ? '1px solid #D1D5DB' : 'none';
  const accent       = isBW ? '#111111' : '#1E40AF';
  const sectionBg    = isBW ? '#FFFFFF' : '#1E3A8A';
  const sectionColor = isBW ? '#0F172A' : '#FFFFFF';
  const sectionBorder = isBW ? '1px solid #0F172A' : 'none';
  const objMarks  = paper.objMarks  || 0;
  const subjMarks = paper.subjMarks || 0;
  const totalMk   = (objMarks + subjMarks) || 100;
  const totalMin  = ((paper.objTime || 0) + (paper.subjTime || 0)) || 100;
  const showObj   = paper.type === 'objective'  || paper.type === 'both';
  const showSubj  = paper.type === 'subjective' || paper.type === 'both';

  return createPortal(
    <div
      className="pg-modal-overlay open"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="pg-modal" style={{ maxWidth: 780 }}>
        <div className="pg-modal-header">
          <div>
            <div className="pg-modal-title">
              <i className="fa-solid fa-eye" style={{ marginRight: 6 }}></i> Paper Preview
            </div>
            <div className="pg-modal-sub">Preview of the generated question paper</div>
          </div>
          <Tooltip text="Close"><button className="pg-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>

        <div className="pg-modal-body" style={{ padding: 0 }}>
          <div style={{ background: '#F8FAFF', padding: 20, borderBottom: '1px solid var(--border-light)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Tooltip text="Preview the paper as a Colorful Report">
              <button
                className={`pg-toggle-btn${tone === 'color' ? ' active' : ''}`}
                style={{ fontSize: 12, padding: '6px 14px' }}
                onClick={() => setTone('color')}
                aria-pressed={tone === 'color'}
              >
                <i className="fa-solid fa-palette"></i> Colorful
              </button>
            </Tooltip>
            <Tooltip text="Preview the paper as a low-ink Colorless Report">
              <button
                className={`pg-toggle-btn${tone === 'bw' ? ' active' : ''}`}
                style={{ fontSize: 12, padding: '6px 14px' }}
                onClick={() => setTone('bw')}
                aria-pressed={tone === 'bw'}
              >
                <i className="fa-solid fa-circle-half-stroke"></i> Colorless
              </button>
            </Tooltip>
            <Tooltip text="Open download options">
              <button
                className="pg-btn-primary"
                style={{ padding: '6px 16px', fontSize: 12, marginLeft: 'auto' }}
                onClick={onDownload}
              >
                <i className="fa-solid fa-download"></i> Download
              </button>
            </Tooltip>
          </div>

          <div style={{ padding: 24, background: '#fff', minHeight: 400, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <div style={{ background: headerBg, color: headerColor, border: headerBorder, borderBottom: 'none', textAlign: 'center', padding: 12, borderRadius: '6px 6px 0 0', margin: '-24px -24px 16px', fontSize: 14, fontWeight: 700, letterSpacing: '.02em' }}>
              The Oxford System, Lahore Campus
            </div>
            <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 12 }}>
              {paper.title} &middot; {paper.subj} &middot; {cls.name} ({cls.section})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: '#334155', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '8px 0', marginBottom: 12 }}>
              <div>Student Name: _______________________</div>
              <div>Roll No: ___________</div>
              <div>Section: {cls.section}</div>
              <div>Date: ___________</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: accent, marginBottom: 16 }}>
              <span>Total Time: {totalMin} Minutes</span>
              <span>Total Marks: {totalMk} &nbsp;&nbsp; Obtained: ______/{totalMk}</span>
            </div>

            {showObj && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#64748B', borderBottom: '1px solid #e2e8f0', paddingBottom: 4, marginBottom: 8 }}>
                  Section A — Objective ({objMarks} Marks · {paper.objTime || 0} Min)
                </div>
                <div style={{ fontSize: 12, color: '#334155', marginBottom: 10 }}>
                  <strong>Q.1</strong> Write the Opposite of the following words.
                  <span style={{ float: 'right', color: accent, fontWeight: 600 }}>[10 Marks]</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, marginBottom: 14 }}>
                  <thead>
                    <tr style={{ background: isBW ? '#FFFFFF' : '#EFF6FF' }}>
                      <th style={{ padding: '5px 8px', border: `1px solid ${isBW ? '#D1D5DB' : '#BFDBFE'}`, textAlign: 'left' }}>#</th>
                      <th style={{ padding: '5px 8px', border: `1px solid ${isBW ? '#D1D5DB' : '#BFDBFE'}` }}>Word</th>
                      <th style={{ padding: '5px 8px', border: `1px solid ${isBW ? '#D1D5DB' : '#BFDBFE'}` }}>Opposite</th>
                      <th style={{ padding: '5px 8px', border: `1px solid ${isBW ? '#D1D5DB' : '#BFDBFE'}` }}>#</th>
                      <th style={{ padding: '5px 8px', border: `1px solid ${isBW ? '#D1D5DB' : '#BFDBFE'}` }}>Word</th>
                      <th style={{ padding: '5px 8px', border: `1px solid ${isBW ? '#D1D5DB' : '#BFDBFE'}` }}>Opposite</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['i', 'Happy', 'iii', 'Hot'],
                      ['ii', 'Day', 'iv', 'Big'],
                    ].map((row, ri) => (
                      <tr key={ri}>
                        <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0' }}>{row[0]}</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0' }}>{row[1]}</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0' }}>___________</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0' }}>{row[2]}</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0' }}>{row[3]}</td>
                        <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0' }}>___________</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {showSubj && (
              <>
                <div style={{ background: sectionBg, color: sectionColor, border: sectionBorder, padding: '6px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', borderRadius: 4, marginBottom: 10 }}>
                  Section B — Subjective ({subjMarks} Marks · {paper.subjTime || 0} Min)
                </div>
                <div style={{ fontSize: 12, color: '#334155', marginBottom: 10 }}>
                  <strong>Q.2</strong> Answer the following Short Questions.
                  <span style={{ float: 'right', color: accent, fontWeight: 600 }}>[15 Marks]</span>
                </div>
                <div style={{ fontSize: 12, color: '#334155', marginBottom: 6 }}>i. Where did the little red hen live?</div>
                <div style={{ height: 26, borderBottom: '1px solid #cbd5e1', marginBottom: 10 }}></div>
                <div style={{ fontSize: 12, color: '#334155', marginBottom: 6 }}>ii. What did the hen find in the field?</div>
                <div style={{ height: 26, borderBottom: '1px solid #cbd5e1', marginBottom: 10 }}></div>
              </>
            )}

            <div style={{ marginTop: 20, paddingTop: 12, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748B' }}>
              <span>Examiner: _____________________</span>
              <span>Checker: _____________________</span>
              <span>Re-Checker: _____________________</span>
            </div>
          </div>
        </div>

        <div className="pg-modal-footer">
          <Tooltip text="Close preview">
            <button className="pg-btn-secondary" onClick={onClose}>Close</button>
          </Tooltip>
          <Tooltip text="Open download options">
            <button className="pg-btn-primary" onClick={onDownload}>
              <i className="fa-solid fa-download"></i> Download Paper
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FULL PAPER PDF BUILDER — produces a complete printable HTML document.
   Opens in a new window so the user can print / save as PDF.
   ═══════════════════════════════════════════════════════════════════ */
function buildObjSection() {
  return `
  <div class="section-title">Section A — Objective Questions</div>

  <div class="q-block">
    <div class="q-header"><span><b>Q.1</b> Write the Opposite of the following words</span><span class="q-marks">[Total Marks: 10]</span></div>
    <table><tr><th>#</th><th>Word</th><th>Opposite</th><th>#</th><th>Word</th><th>Opposite</th></tr>
      <tr><td>i</td><td>Happy</td><td>_____________</td><td>ii</td><td>Day</td><td>_____________</td></tr>
      <tr><td>iii</td><td>Hot</td><td>_____________</td><td>iv</td><td>Big</td><td>_____________</td></tr>
      <tr><td>v</td><td>Fast</td><td>_____________</td><td></td><td></td><td></td></tr>
    </table>
  </div>

  <div class="q-block">
    <div class="q-header"><span><b>Q.2</b> Write the Singular or Plural of the following words</span><span class="q-marks">[Total Marks: 10]</span></div>
    <table><tr><th>#</th><th>Singular</th><th>Plural</th><th>#</th><th>Singular</th><th>Plural</th></tr>
      <tr><td>i</td><td>Child</td><td>___________</td><td>ii</td><td>___________</td><td>Teeth</td></tr>
      <tr><td>iii</td><td>___________</td><td>Leaves</td><td>iv</td><td>Man</td><td>___________</td></tr>
      <tr><td>v</td><td>Mouse</td><td>___________</td><td></td><td></td><td></td></tr>
    </table>
  </div>

  <div class="q-block">
    <div class="q-header"><span><b>Q.3</b> Write the Synonym of the following words</span><span class="q-marks">[Total Marks: 10]</span></div>
    <table><tr><th>#</th><th>Word</th><th>Synonym</th><th>#</th><th>Word</th><th>Synonym</th></tr>
      <tr><td>i</td><td>Beautiful</td><td>_______________</td><td>ii</td><td>Angry</td><td>_______________</td></tr>
      <tr><td>iii</td><td>Begin</td><td>_______________</td><td>iv</td><td>Tired</td><td>_______________</td></tr>
      <tr><td>v</td><td>Brave</td><td>_______________</td><td></td><td></td><td></td></tr>
    </table>
  </div>

  <div class="q-block">
    <div class="q-header"><span><b>Q.4</b> Choose the correct answer by circling (A), (B), (C) or (D)</span><span class="q-marks">[Total Marks: 10]</span></div>
    <div class="mcq-item">i. The little red hen found some ________. <div class="mcq-options"><span class="mcq-opt">(A) wheat seeds</span><span class="mcq-opt">(B) rice</span><span class="mcq-opt">(C) corn</span><span class="mcq-opt">(D) barley</span></div></div>
    <div class="mcq-item">ii. Which animal refused to help plant the seeds? <div class="mcq-options"><span class="mcq-opt">(A) Cat</span><span class="mcq-opt">(B) Dog</span><span class="mcq-opt">(C) Duck</span><span class="mcq-opt">(D) All of these</span></div></div>
    <div class="mcq-item">iii. The hen baked the bread ________. <div class="mcq-options"><span class="mcq-opt">(A) with friends</span><span class="mcq-opt">(B) all by herself</span><span class="mcq-opt">(C) in the morning</span><span class="mcq-opt">(D) outside</span></div></div>
    <div class="mcq-item">iv. What did the other animals want to do? <div class="mcq-options"><span class="mcq-opt">(A) Help the hen</span><span class="mcq-opt">(B) Eat the bread</span><span class="mcq-opt">(C) Plant seeds</span><span class="mcq-opt">(D) Sleep</span></div></div>
    <div class="mcq-item">v. The moral of the story is ________. <div class="mcq-options"><span class="mcq-opt">(A) share your food</span><span class="mcq-opt">(B) hard work pays off</span><span class="mcq-opt">(C) be honest</span><span class="mcq-opt">(D) be kind</span></div></div>
  </div>

  <div class="q-block">
    <div class="q-header"><span><b>Q.5</b> Fill in the Blanks with the correct word from the box</span><span class="q-marks">[Total Marks: 10]</span></div>
    <div style="background:#F8FAFF;border:1px solid #BFDBFE;border-radius:4px;padding:6px 12px;font-size:11.5px;margin-bottom:8px;font-weight:600;color:#1E40AF">Word Box: lazy &nbsp;|&nbsp; bread &nbsp;|&nbsp; seeds &nbsp;|&nbsp; herself &nbsp;|&nbsp; farm</div>
    <div class="write-item">i. The little red hen lived on a <span class="blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>. [2]</div>
    <div class="write-item">ii. She found some wheat <span class="blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> in the field. [2]</div>
    <div class="write-item">iii. The other animals were too <span class="blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> to help. [2]</div>
    <div class="write-item">iv. The hen baked the <span class="blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> all by herself. [2]</div>
    <div class="write-item">v. She ate the bread all by <span class="blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>. [2]</div>
  </div>

  <div class="q-block">
    <div class="q-header"><span><b>Q.6</b> Write True or False in the box provided</span><span class="q-marks">[Total Marks: 10]</span></div>
    <table class="tf-table"><tr><th>#</th><th>Statement</th><th>True</th><th>False</th><th>Marks</th></tr>
      <tr><td>i</td><td>The hen shared the bread with everyone.</td><td><span class="tf-box"></span></td><td><span class="tf-box"></span></td><td>[2]</td></tr>
      <tr><td>ii</td><td>The dog helped the hen sow the seeds.</td><td><span class="tf-box"></span></td><td><span class="tf-box"></span></td><td>[2]</td></tr>
      <tr><td>iii</td><td>The little red hen was lazy.</td><td><span class="tf-box"></span></td><td><span class="tf-box"></span></td><td>[2]</td></tr>
      <tr><td>iv</td><td>The hen baked the bread all by herself.</td><td><span class="tf-box"></span></td><td><span class="tf-box"></span></td><td>[2]</td></tr>
      <tr><td>v</td><td>The other animals were helpful.</td><td><span class="tf-box"></span></td><td><span class="tf-box"></span></td><td>[2]</td></tr>
    </table>
  </div>

  <div class="q-block">
    <div class="q-header"><span><b>Q.7</b> Match Column A with Column B</span><span class="q-marks">[Total Marks: 10]</span></div>
    <table><tr><th>Column A</th><th>Answer</th><th>Column B</th></tr>
      <tr><td>i. The hen found _______</td><td>______</td><td>A. all by herself</td></tr>
      <tr><td>ii. She planted _______</td><td>______</td><td>B. wheat seeds</td></tr>
      <tr><td>iii. The bread was _______</td><td>______</td><td>C. baked perfectly</td></tr>
      <tr><td>iv. The animals were _______</td><td>______</td><td>D. the seeds</td></tr>
      <tr><td>v. The hen ate it _______</td><td>______</td><td>E. lazy and unhelpful</td></tr>
    </table>
  </div>

  <div class="q-block">
    <div class="q-header"><span><b>Q.8</b> Circle the correct word to complete each sentence</span><span class="q-marks">[Total Marks: 10]</span></div>
    <div class="write-item">i. The hen was very ________. &nbsp; ( happy ) / ( lazy ) / ( angry ) &nbsp; [2]</div>
    <div class="write-item">ii. She planted the seeds on the ________. &nbsp; ( roof ) / ( farm ) / ( road ) &nbsp; [2]</div>
    <div class="write-item">iii. The bread smelled ________. &nbsp; ( bad ) / ( wonderful ) / ( strange ) &nbsp; [2]</div>
    <div class="write-item">iv. The animals refused to ________. &nbsp; ( eat ) / ( help ) / ( play ) &nbsp; [2]</div>
    <div class="write-item">v. The hen decided to eat the bread ________. &nbsp; ( alone ) / ( later ) / ( outside ) &nbsp; [2]</div>
  </div>

  <div class="q-block">
    <div class="q-header"><span><b>Q.9</b> Punctuate the following sentences correctly</span><span class="q-marks">[Total Marks: 10]</span></div>
    <div style="font-size:11.5px;color:#64748B;margin-bottom:6px">Add capital letters, full stops, commas, question marks, or exclamation marks where needed.</div>
    <div class="write-item">i. the little red hen lived on a big farm [2]</div>
    <div class="write-item">ii. did anyone help the hen plant the seeds [2]</div>
    <div class="write-item">iii. what a delicious bread the hen baked [2]</div>
    <div class="write-item">iv. fiza her brother and her mother went to the park [2]</div>
    <div class="write-item">v. no said the duck i am too busy to help [2]</div>
  </div>`;
}

function buildSubjSection() {
  const fourLines = '<div class="line-rule"></div>'.repeat(4);
  const eightLines = '<div class="line-rule"></div>'.repeat(8);
  return `
  <div class="section-title">Section B — Subjective Questions</div>

  <div class="q-block">
    <div class="q-header"><span><b>Q.10</b> Answer the following Short Questions</span><span class="q-marks">[Total Marks: 10]</span></div>
    <div class="write-item">i. Where did the little red hen live? [2] <div class="ans-line"></div></div>
    <div class="write-item">ii. What did the hen find in the field? [2] <div class="ans-line"></div></div>
    <div class="write-item">iii. Why did the hen eat the bread alone? [2] <div class="ans-line"></div></div>
    <div class="write-item">iv. Does Fiza have any siblings? Name them. [2] <div class="ans-line"></div></div>
    <div class="write-item">v. What does Fiza's family do on weekends? [2] <div class="ans-line"></div></div>
  </div>

  <div class="q-block">
    <div class="q-header"><span><b>Q.11</b> Answer the following Long Questions</span><span class="q-marks">[Total Marks: 15]</span></div>
    <div class="write-item">i. Describe what the little red hen did from finding the seeds to eating the bread. [3]<div class="write-lines">${fourLines}</div></div>
    <div class="write-item">ii. What message does the story of the little red hen teach us? [3]<div class="write-lines">${fourLines}</div></div>
    <div class="write-item">iii. How can education improve our lives? Give three examples. [3]<div class="write-lines">${fourLines}</div></div>
  </div>

  <div class="q-block">
    <div class="q-header"><span><b>Q.12</b> Write a Paragraph on ONE of the following topics (choose any one)</span><span class="q-marks">[Total Marks: 10]</span></div>
    <div style="font-size:11.5px;color:#64748B;margin-bottom:6px">Write 6–8 sentences. You will be marked on ideas, vocabulary, and grammar.</div>
    <div class="write-item">i. My Best Friend &nbsp;&nbsp; ii. A Rainy Day &nbsp;&nbsp; iii. The School Library &nbsp;&nbsp; iv. My Favourite Season</div>
    <div class="write-lines">${eightLines}</div>
  </div>

  <div class="q-block">
    <div class="q-header"><span><b>Q.13</b> Read the passage carefully and answer the questions</span><span class="q-marks">[Total Marks: 10]</span></div>
    <div style="background:#F8FAFF;border:1px solid #BFDBFE;border-radius:4px;padding:8px 12px;font-size:11.5px;margin-bottom:8px;line-height:1.6">Omar was a hardworking student who loved reading. Every day after school, he would go to the library and pick a new book. His favourite books were about science and nature. One day, he found a book about stars and planets. He read it all night and decided he wanted to become an astronaut.</div>
    <div class="write-item">i. What did Omar do after school every day? [2] <div class="ans-line"></div></div>
    <div class="write-item">ii. What type of books did Omar like the most? [2] <div class="ans-line"></div></div>
    <div class="write-item">iii. What did Omar decide after reading the book about space? [2] <div class="ans-line"></div></div>
  </div>`;
}

function buildAnswerSheetSection() {
  const cells = Array.from({ length: 13 }, (_, i) =>
    `<div class="ans-cell"><div class="qnum">Q.${i + 1}</div><div class="aline" style="border-bottom:1px solid #94A3B8;margin-top:18px"></div></div>`
  ).join('');
  return (
    '<div class="ans-sheet">' +
      '<div class="ans-sheet-title">&#10022; Answer Sheet &#10022;</div>' +
      '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">' + cells + '</div>' +
    '</div>'
  );
}

function buildFullPaperHTML({ paper, cls, isBW, asWord }) {
  const fmt      = paper.format || 'with';
  const typ      = paper.type   || 'both';
  const subject  = paper.subj   || 'English';
  const title    = paper.title  || 'Question Paper';
  const totalMin = (paper.objTime  || 0) + (paper.subjTime  || 0) || 100;
  const totalMk  = (paper.objMarks || 0) + (paper.subjMarks || 0) || 100;
  const className = cls?.name    || 'Class';
  const section   = cls?.section || '';

  const showObj  = typ === 'objective'  || typ === 'both';
  const showSubj = typ === 'subjective' || typ === 'both';

  const objSection  = showObj    ? buildObjSection()       : '';
  const subjSection = showSubj   ? buildSubjSection()      : '';
  const answerSheet = fmt === 'with' ? buildAnswerSheetSection() : '';

  /* Two coordinated palettes:
     • Colorful: brand-blue gradient header, blue-tinted info & table heads.
     • Colorless: dedicated LOW-INK layout — white header (no fill), light
       gray borders, no near-black section bands. Section titles become
       a bordered/underlined heading instead of a filled band so the
       paper prints with minimal toner. */
  const headerBg    = isBW ? '#FFFFFF' : 'linear-gradient(135deg,#1E3A8A,#1D4ED8)';
  const headerColor = isBW ? '#0F172A' : '#FFFFFF';
  const headerBorder = isBW ? '1px solid #D1D5DB' : 'none';
  const infoBg     = isBW ? '#FFFFFF' : '#F8FAFF';
  const infoBorder = isBW ? '#D1D5DB' : '#BFDBFE';
  const infoColor  = isBW ? '#111111' : '#1E40AF';
  const sectionBg  = isBW ? '#FFFFFF' : '#1E3A8A';
  const sectionColor = isBW ? '#0F172A' : '#FFFFFF';
  const sectionBorder = isBW ? '1px solid #0F172A' : 'none';
  const thBg       = isBW ? '#FFFFFF' : '#EFF6FF';
  const thColor    = isBW ? '#111111' : '#1E40AF';
  const thBorder   = isBW ? '#D1D5DB' : '#BFDBFE';
  const printBg    = isBW ? '#FFFFFF' : 'linear-gradient(135deg,#1E3A8A,#1D4ED8)';
  const printColor = isBW ? '#0F172A' : '#FFFFFF';
  const printShadow = isBW ? '0 2px 8px rgba(0,0,0,.12)' : '0 4px 14px rgba(30,58,138,.4)';
  const printBorder = isBW ? '1.5px solid #0F172A' : 'none';
  const dlButton   = asWord
    ? `<button class="print-btn no-print" onclick="(function(){const blob=new Blob(['<html>'+document.documentElement.innerHTML+'</html>'],{type:'application/msword'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='${title.replace(/[^a-z0-9]/gi,'_')}.doc';a.click();})()">${isBW ? '' : '⬇ '}Save as Word</button>`
    : `<button class="print-btn no-print" onclick="window.print()">${isBW ? '' : '⬇ '}Save as PDF</button>`;

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>${title} — ${subject}</title>
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Plus Jakarta Sans',sans-serif; background:#fff; color:#1E293B; font-size:13px; }
@page { size:A4; margin:15mm 18mm; }
@media print { .no-print{display:none!important} body{margin:0} }
.paper-wrap { max-width:800px; margin:0 auto; padding:20px; }
.school-header { background:${headerBg}; color:${headerColor}; border:${headerBorder}; border-bottom:none; text-align:center; padding:14px 20px; border-radius:8px 8px 0 0; }
.school-name { font-size:18px; font-weight:800; letter-spacing:.03em; }
.exam-sub { font-size:12px; ${isBW ? 'color:#4B5563;' : 'opacity:.85;'} margin-top:3px; }
.student-bar { display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:0; border:1px solid #CBD5E1; border-top:none; }
.student-bar div { padding:6px 10px; border-right:1px solid #CBD5E1; font-size:11.5px; }
.student-bar div:last-child { border-right:none; }
.student-bar div span { display:block; font-size:10px; color:#64748B; margin-bottom:2px; }
.info-bar { display:flex; justify-content:space-between; align-items:center; background:${infoBg}; border:1px solid ${infoBorder}; border-radius:6px; padding:8px 14px; margin:12px 0; font-size:12px; font-weight:600; color:${infoColor}; flex-wrap:wrap; gap:8px; }
.section-title { background:${sectionBg}; color:${sectionColor}; border:${sectionBorder}; padding:6px 14px; font-size:12px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; margin:16px 0 10px; border-radius:4px; }
.q-block { margin-bottom:14px; }
.q-header { font-size:12.5px; font-weight:700; color:#1E293B; margin-bottom:8px; display:flex; justify-content:space-between; gap:10px; }
.q-marks { color:${infoColor}; font-weight:700; }
table { width:100%; border-collapse:collapse; margin-bottom:8px; font-size:12px; }
th { background:${thBg}; color:${thColor}; padding:5px 8px; border:1px solid ${thBorder}; font-weight:700; }
td { padding:6px 8px; border:1px solid #E2E8F0; }
.blank { display:inline-block; min-width:80px; border-bottom:1px solid #334155; margin:0 4px; }
.mcq-item { margin-bottom:8px; font-size:12px; }
.mcq-options { display:flex; gap:14px; margin-top:3px; padding-left:14px; flex-wrap:wrap; }
.mcq-opt { border:1px solid #CBD5E1; border-radius:4px; padding:2px 8px; font-size:11.5px; }
.tf-table { font-size:12px; }
.tf-box { width:20px; height:20px; border:1px solid #334155; display:inline-block; }
.ans-line { border-bottom:1px solid #94A3B8; margin:12px 0 4px; height:20px; }
.write-item { margin-bottom:10px; font-size:12px; }
.write-lines { margin-top:4px; }
.line-rule { border-bottom:1px solid #CBD5E1; margin-bottom:10px; height:18px; }
.ans-sheet { margin-top:24px; padding-top:16px; border-top:2px dashed #94A3B8; page-break-before:always; }
.ans-sheet-title { text-align:center; font-size:14px; font-weight:700; color:${infoColor}; margin-bottom:10px; }
.ans-cell { border:1px solid #CBD5E1; border-radius:4px; padding:6px 4px; text-align:center; font-size:11px; }
.ans-cell .qnum { font-weight:700; color:${infoColor}; font-size:10px; }
.paper-footer { margin-top:24px; padding-top:10px; border-top:1px solid #E2E8F0; display:flex; justify-content:space-between; font-size:11px; color:#64748B; flex-wrap:wrap; gap:6px; }
.print-btn { position:fixed; bottom:20px; right:20px; background:${printBg}; color:${printColor}; border:${printBorder}; border-radius:10px; padding:10px 22px; font-family:'Plus Jakarta Sans',sans-serif; font-size:13px; font-weight:700; cursor:pointer; box-shadow:${printShadow}; z-index:99; }
.print-btn:hover { transform:translateY(-1px); }
</style>
</head><body>
<div class="paper-wrap">
  <div class="school-header">
    <div class="school-name">The Oxford System — Lahore Campus</div>
    <div class="exam-sub">Annual Examination &bull; ${subject} &bull; ${className} &bull; Section ${section}</div>
  </div>

  <div class="student-bar">
    <div><span>Student Name</span>______________________________</div>
    <div><span>Roll No.</span>____________</div>
    <div><span>Section</span>${section || '____________'}</div>
    <div><span>Date</span>____________</div>
  </div>

  <div class="info-bar">
    <span>Subject: <strong>${subject}</strong></span>
    <span>Class: <strong>${className}</strong></span>
    <span>Time: <strong>${totalMin} Minutes</strong></span>
    <span>Total Marks: <strong>${totalMk}</strong> &nbsp; Obtained: <strong>______/${totalMk}</strong></span>
  </div>

  ${objSection}
  ${subjSection}
  ${answerSheet}

  <div class="paper-footer">
    <span>Examiner: _______________________</span>
    <span>Checker: _______________________</span>
    <span>Re-Checker: _______________________</span>
  </div>
</div>
${dlButton}
</body></html>`;
}

/* ═══════════════════════════════════════════════════════════════════
   DOWNLOAD MODAL — Print Style (Color/BW) + File Format (PDF/Word)
   ═══════════════════════════════════════════════════════════════════ */
function DownloadModal({ paper, cls, onClose, toast }) {
  const [style,  setStyle]  = useState('color'); // 'color' | 'bw'
  const [format, setFormat] = useState('pdf');   // 'pdf'   | 'word'

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const label = `Download ${style === 'color' ? 'Colorful' : 'Colorless'} ${format === 'pdf' ? 'PDF' : 'Word'}`;

  /* Keyboard nav for the two radio-card groups (matches Modules 2 & 3). */
  const onStyleKey = (e, value) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setStyle(value); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   { e.preventDefault(); setStyle('color'); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); }
  };
  const onFormatKey = (e, value) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFormat(value); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   { e.preventDefault(); setFormat('pdf'); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setFormat('word'); }
  };

  const doDownload = () => {
    const win = window.open('', '_blank', 'width=900,height=750');
    if (!win) {
      toast('Please allow popups to download paper', 'warning');
      return;
    }
    const html = buildFullPaperHTML({
      paper,
      cls,
      isBW: style === 'bw',
      asWord: format === 'word',
    });
    win.document.write(html);
    win.document.close();
    toast(`${label} — opened in new window`, 'success');
    onClose();
  };

  return createPortal(
    <div
      className="pg-modal-overlay open"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pg-dl-title"
    >
      <div className="pg-modal" style={{ maxWidth: 480 }}>
        <div className="pg-modal-header">
          <div className="pg-modal-title" id="pg-dl-title">
            <i className="fa-solid fa-download"></i> Download Paper
          </div>
          <Tooltip text="Close"><button className="pg-modal-close" onClick={onClose} aria-label="Close download dialog"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>

        <div className="pg-modal-body">
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 16px' }}>
            Select print style and file format for download.
          </p>

          <div className="pg-section-label" id="pg-dl-style-label" style={{ margin: '0 0 8px' }}>Print Style</div>
          <div className="pg-dl-grid" role="radiogroup" aria-labelledby="pg-dl-style-label">
            <div
              className={`pg-dl-card${style === 'color' ? ' selected' : ''}`}
              onClick={() => setStyle('color')}
              role="radio"
              aria-checked={style === 'color'}
              tabIndex={style === 'color' ? 0 : -1}
              onKeyDown={e => onStyleKey(e, 'color')}
            >
              <div className="pg-dl-card-icon" style={{ color: '#1E40AF' }} aria-hidden="true"><i className="fa-solid fa-palette"></i></div>
              <div className="pg-dl-card-label">Colorful Report</div>
              <div className="pg-dl-card-desc">Full color with school branding, summary cards &amp; icons</div>
            </div>
            <div
              className={`pg-dl-card${style === 'bw' ? ' selected' : ''}`}
              onClick={() => setStyle('bw')}
              role="radio"
              aria-checked={style === 'bw'}
              tabIndex={style === 'bw' ? 0 : -1}
              onKeyDown={e => onStyleKey(e, 'bw')}
            >
              <div className="pg-dl-card-icon" style={{ color: '#374151' }} aria-hidden="true"><i className="fa-solid fa-circle-half-stroke"></i></div>
              <div className="pg-dl-card-label">Colorless Report</div>
              <div className="pg-dl-card-desc">Low-ink layout — white background, light borders only</div>
            </div>
          </div>

          <div className="pg-section-label" id="pg-dl-format-label" style={{ margin: '4px 0 8px' }}>File Format</div>
          <div className="pg-dl-grid" role="radiogroup" aria-labelledby="pg-dl-format-label">
            <div
              className={`pg-dl-card${format === 'pdf' ? ' selected' : ''}`}
              onClick={() => setFormat('pdf')}
              role="radio"
              aria-checked={format === 'pdf'}
              tabIndex={format === 'pdf' ? 0 : -1}
              onKeyDown={e => onFormatKey(e, 'pdf')}
            >
              <div className="pg-dl-card-icon" style={{ color: '#DC2626' }} aria-hidden="true"><i className="fa-solid fa-file-pdf"></i></div>
              <div className="pg-dl-card-label">PDF</div>
              <div className="pg-dl-card-desc">Best for printing</div>
            </div>
            <div
              className={`pg-dl-card${format === 'word' ? ' selected' : ''}`}
              onClick={() => setFormat('word')}
              role="radio"
              aria-checked={format === 'word'}
              tabIndex={format === 'word' ? 0 : -1}
              onKeyDown={e => onFormatKey(e, 'word')}
            >
              <div className="pg-dl-card-icon" style={{ color: '#1E40AF' }} aria-hidden="true"><i className="fa-solid fa-file-word"></i></div>
              <div className="pg-dl-card-label">Word (.docx)</div>
              <div className="pg-dl-card-desc">Editable document</div>
            </div>
          </div>
        </div>

        <div className="pg-modal-footer">
          <Tooltip text="Cancel download">
            <button className="pg-btn-secondary" onClick={onClose}>Cancel</button>
          </Tooltip>
          <Tooltip text={`Download the paper as ${format.toUpperCase()} (${style === 'color' ? 'Colorful' : 'Colorless'})`}>
            <button className="pg-btn-primary" onClick={doDownload}>
              <i className="fa-solid fa-download"></i> {label}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DELETE CONFIRMATION DIALOG
   ═══════════════════════════════════════════════════════════════════ */
function DeleteConfirmDialog({ paper, cls, onClose, onConfirm }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="pg-delete-overlay open"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="pg-delete-dialog">
        <div className="pg-del-icon-wrap">
          <div className="pg-del-icon-bg">
            <i className="fa-solid fa-trash pg-del-icon"></i>
          </div>
        </div>

        <div className="pg-del-title">Delete Generated Paper?</div>
        <div className="pg-del-subtitle">
          This will permanently delete this paper and all its settings.{' '}
          <strong>This action cannot be undone.</strong>
        </div>

        <div className="pg-del-detail-pill">
          <i className="fa-solid fa-school" style={{ color: '#6B7280', fontSize: 11, marginRight: 4 }}></i>
          {cls.name} · Section {cls.section}
          &nbsp;•&nbsp;
          <i className="fa-solid fa-file-lines" style={{ color: '#6B7280', fontSize: 11, marginRight: 4 }}></i>
          {paper.subj} — {paper.title}
        </div>

        <div className="pg-del-warning">
          <i className="fa-solid fa-triangle-exclamation" style={{ color: '#DC2626', fontSize: 14, flexShrink: 0, marginTop: 1 }}></i>
          <span>All configurations and question blocks for this paper will be permanently removed.</span>
        </div>

        <div className="pg-del-footer">
          <Tooltip text="Cancel and close">
            <button className="pg-del-btn-cancel" onClick={onClose}>Cancel</button>
          </Tooltip>
          <Tooltip text="Confirm delete this paper">
            <button className="pg-del-btn-confirm" onClick={onConfirm}>
              <i className="fa-solid fa-trash" style={{ fontSize: 13 }}></i> Yes, Delete
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TEMPLATE PREVIEW MODAL — Classic / Modern / Formal + With/Without
   Answer Sheet + Single/Four-line answer style.
   ═══════════════════════════════════════════════════════════════════ */
function TemplatePreviewModal({ n, onClose, onSelect }) {
  const [fmt, setFmt]   = useState('with');     // 'with' | 'without'
  const [line, setLine] = useState('single');   // 'single' | 'four'

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const titles = { 1: 'Classic (Template 1)', 2: 'Modern (Template 2)', 3: 'Formal (Template 3)' };

  return createPortal(
    <div
      className="pg-tmpl-prev-overlay open"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="pg-tmpl-prev-modal">
        <div className="pg-tmpl-prev-header">
          <div className="pg-tmpl-prev-title">Preview — {titles[n]}</div>
          <Tooltip text="Close"><button className="pg-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>

        <div className="pg-tmpl-prev-body">
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <Tooltip text="Preview template with answer sheet">
              <button
                className={`pg-toggle-btn${fmt === 'with' ? ' active' : ''}`}
                onClick={() => setFmt('with')}
              >
                <i className="fa-solid fa-file-lines"></i> With Answer Sheet
              </button>
            </Tooltip>
            <Tooltip text="Preview template without answer sheet">
              <button
                className={`pg-toggle-btn${fmt === 'without' ? ' active' : ''}`}
                onClick={() => setFmt('without')}
              >
                <i className="fa-regular fa-file"></i> Without Answer Sheet
              </button>
            </Tooltip>
            <Tooltip text={fmt === 'without' ? 'Available only when answer sheet is included' : 'Preview with single-line answer lines'}>
              <button
                className={`pg-toggle-btn${line === 'single' ? ' active' : ''}`}
                onClick={() => setLine('single')}
                style={{ marginLeft: 'auto' }}
                disabled={fmt === 'without'}
              >
                <i className="fa-solid fa-minus"></i> Single Line
              </button>
            </Tooltip>
            <Tooltip text={fmt === 'without' ? 'Available only when answer sheet is included' : 'Preview with four-line (handwriting) answer lines'}>
              <button
                className={`pg-toggle-btn${line === 'four' ? ' active' : ''}`}
                onClick={() => setLine('four')}
                disabled={fmt === 'without'}
              >
                <i className="fa-solid fa-bars"></i> Four Line
              </button>
            </Tooltip>
          </div>

          {/* Paper preview */}
          <div className="pg-paper-preview-box">
            {n === 1 && <ClassicHeader />}
            {n === 2 && <ModernHeader />}
            {n === 3 && <FormalHeader />}
            {fmt === 'with' && <AnswerSheet line={line} />}
          </div>
        </div>

        <div className="pg-tmpl-prev-footer">
          <Tooltip text="Close preview">
            <button className="pg-btn-secondary" onClick={onClose}>Close</button>
          </Tooltip>
          <Tooltip text={`Use Template ${n} for all generated papers`}>
            <button className="pg-btn-primary" onClick={() => onSelect(n)}>
              <i className="fa-solid fa-check"></i> Use This Template
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Classic (Template 1) ── */
function ClassicHeader() {
  return (
    <>
      <div className="pg-pp-school-bar">THE OXFORD SYSTEM — LAHORE CAMPUS</div>
      <div className="pg-pp-exam-line">Annual Examination 2026 &nbsp;•&nbsp; English (A) &nbsp;•&nbsp; Class IV (White)</div>
      <div className="pg-pp-student-grid">
        <div className="pg-pp-student-field">Student Name: _______________________________</div>
        <div className="pg-pp-student-field">Roll No: _______________</div>
        <div className="pg-pp-student-field">Section: _______________</div>
        <div className="pg-pp-student-field">Date: __________________</div>
      </div>
      <div className="pg-pp-marks-grid">
        <div className="pg-pp-marks-cell"><span className="pg-pp-marks-label">Subject</span><span className="pg-pp-marks-val">English (A)</span></div>
        <div className="pg-pp-marks-cell"><span className="pg-pp-marks-label">Class</span><span className="pg-pp-marks-val">IV</span></div>
        <div className="pg-pp-marks-cell"><span className="pg-pp-marks-label">Time</span><span className="pg-pp-marks-val">100 Min</span></div>
        <div className="pg-pp-marks-cell pg-pp-marks-cell--accent"><span className="pg-pp-marks-label">Total Marks</span><span className="pg-pp-marks-val">100</span></div>
        <div className="pg-pp-marks-cell" style={{ gridColumn: 'span 2' }}><span className="pg-pp-marks-label">Objective</span><span className="pg-pp-marks-val">40 Marks · 40 Min</span></div>
        <div className="pg-pp-marks-cell" style={{ gridColumn: 'span 2' }}><span className="pg-pp-marks-label">Subjective</span><span className="pg-pp-marks-val">60 Marks · 60 Min</span></div>
      </div>
      <div className="pg-pp-meta-bar">
        <span>Obtained Marks: ____________ / 100</span>
        <span>Grade: _______ &nbsp;&nbsp; Rank: _______</span>
      </div>
    </>
  );
}

/* ── Modern (Template 2) ── */
function ModernHeader() {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: 10, marginBottom: 8, borderBottom: '3px solid #1E3A8A' }}>
        <div style={{ width: 44, height: 44, background: 'linear-gradient(135deg,#DBEAFE,#BFDBFE)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: '#1E3A8A', flexShrink: 0 }}>O</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>The Oxford System</div>
          <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 1 }}>Lahore Campus &nbsp;·&nbsp; Annual Examination 2026</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#1E3A8A' }}>Class IV &nbsp;·&nbsp; Section White</div>
          <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 1 }}>English (A)</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 6, fontSize: 10.5, color: '#334155', marginBottom: 8 }}>
        <div style={{ borderBottom: '1px solid #CBD5E1', paddingBottom: 3 }}>Student Name: _____________________</div>
        <div style={{ borderBottom: '1px solid #CBD5E1', paddingBottom: 3 }}>Roll No: _________</div>
        <div style={{ borderBottom: '1px solid #CBD5E1', paddingBottom: 3 }}>Date: ___________</div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
        <div style={{ flex: 1, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, padding: '5px 10px', fontSize: 10.5 }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, color: '#93C5FD', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Objective</div>
          <div style={{ fontWeight: 700, color: '#1E3A8A' }}>40 Marks &nbsp;·&nbsp; 40 Min</div>
        </div>
        <div style={{ flex: 1, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 6, padding: '5px 10px', fontSize: 10.5 }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, color: '#6EE7B7', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Subjective</div>
          <div style={{ fontWeight: 700, color: '#15803D' }}>60 Marks &nbsp;·&nbsp; 60 Min</div>
        </div>
        <div style={{ flex: 1, background: '#1E3A8A', borderRadius: 6, padding: '5px 10px', fontSize: 10.5, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, color: '#93C5FD', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Total</div>
          <div style={{ fontWeight: 800, color: '#fff', fontSize: 13 }}>100</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 600, color: '#64748B', marginTop: 4 }}>
        <span>Obtained: _______ / 100</span>
        <span>Grade: _______</span>
        <span>Rank: _______</span>
      </div>
    </>
  );
}

/* ── Formal (Template 3) ── */
function FormalHeader() {
  return (
    <div className="pg-pp-formal-wrap">
      <div className="pg-pp-formal-top">
        <div className="pg-pp-formal-seal"><div className="pg-pp-formal-seal-inner">OX</div></div>
        <div className="pg-pp-formal-school-block">
          <div className="pg-pp-formal-school-name">THE OXFORD SYSTEM</div>
          <div className="pg-pp-formal-school-sub">LAHORE CAMPUS &nbsp;·&nbsp; ESTABLISHED 2004</div>
        </div>
        <div className="pg-pp-formal-board-tag">BOARD PATTERN</div>
      </div>
      <div className="pg-pp-formal-divider"></div>
      <div className="pg-pp-formal-exam-title">ANNUAL EXAMINATION — 2026</div>
      <div className="pg-pp-formal-meta-grid">
        {[
          ['SUBJECT', 'English (A)'],
          ['CLASS', 'IV White'],
          ['TOTAL MARKS', '100', true],
          ['OBJ. MARKS', '40'],
          ['TOTAL TIME', '100 Min'],
        ].map(([k, v, accent], i) => (
          <div key={i} className="pg-pp-formal-meta-cell">
            <div className="pg-pp-formal-meta-label">{k}</div>
            <div className={`pg-pp-formal-meta-val${accent ? ' pg-pp-formal-meta-accent' : ''}`}>{v}</div>
          </div>
        ))}
      </div>
      <div className="pg-pp-formal-student-grid">
        {['Student Name', 'Roll No.', 'Section', 'Date'].map((lbl, i) => (
          <div key={i} className="pg-pp-formal-student-field">
            <span className="pg-pp-formal-field-label">{lbl}</span>
            <span className="pg-pp-formal-field-line"></span>
          </div>
        ))}
      </div>
      <div className="pg-pp-formal-obtained-row">
        <div className="pg-pp-formal-obtained-cell">
          <span className="pg-pp-formal-field-label">Obtained Marks</span>
          <span className="pg-pp-formal-field-line" style={{ flex: 1, minWidth: 50 }}></span>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8' }}>/100</span>
        </div>
        <div className="pg-pp-formal-obtained-cell">
          <span className="pg-pp-formal-field-label">Grade</span>
          <span className="pg-pp-formal-field-line" style={{ flex: 1, minWidth: 30 }}></span>
        </div>
        <div className="pg-pp-formal-obtained-cell">
          <span className="pg-pp-formal-field-label">Rank</span>
          <span className="pg-pp-formal-field-line" style={{ flex: 1, minWidth: 30 }}></span>
        </div>
      </div>
    </div>
  );
}

/* ── Sample answer-sheet block ── */
function AnswerSheet({ line }) {
  const isFour = line === 'four';
  const AnsLine = () => isFour
    ? <div className="pg-pp-answer-lines-four"><div /><div /><div /><div /></div>
    : <div className="pg-pp-answer-lines-single" />;

  const SECTIONS = [
    {
      label: 'Section A — Objective',
      qs: [
        { q: 'Q.1 Choose the correct answer by circling (A), (B), (C) or (D)', marks: 10, items: [
          'i. The little red hen found some ________.  (A) wheat  (B) rice  (C) corn  (D) barley',
          'ii. The moral of the story is ________.  (A) share  (B) hard work pays  (C) be honest  (D) be kind',
        ], answerEvery: false },
        { q: 'Q.2 Write the Opposite of the following words', marks: 10, lines: 4 },
      ],
    },
    {
      label: 'Section B — Subjective',
      qs: [
        { q: 'Q.3 Answer the following Short Questions', marks: 15, items: [
          'i. Where did the little red hen live?',
          'ii. What did the hen find in the field?',
        ], answerEvery: true },
        { q: 'Q.4 Write a paragraph on any ONE of the following', marks: 10, items: [
          'My Best Friend       A Rainy Day       The School Library',
        ], answerEvery: true, extendedLines: isFour ? 2 : 3 },
      ],
    },
  ];

  return (
    <>
      {SECTIONS.map((sec, si) => (
        <React.Fragment key={si}>
          <div className="pg-pp-section-label">{sec.label}</div>
          {sec.qs.map((q, qi) => (
            <div key={qi} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', marginBottom: 5, display: 'flex', justifyContent: 'space-between' }}>
                <span>{q.q}</span>
                <span style={{ color: '#1E3A8A', fontWeight: 600 }}>[{q.marks} Marks]</span>
              </div>
              {q.items && q.items.map((it, ii) => (
                <React.Fragment key={ii}>
                  <div style={{ fontSize: 10.5, color: '#334155', marginBottom: q.answerEvery ? 3 : 7, paddingLeft: 4 }}>{it}</div>
                  {q.answerEvery && <AnsLine />}
                </React.Fragment>
              ))}
              {!q.items && q.lines && Array.from({ length: q.lines }).map((_, li) => (
                <React.Fragment key={li}>
                  <div style={{ fontSize: 10.5, color: '#334155', marginBottom: 3, paddingLeft: 4 }}>{li + 1}. _______________________________________________</div>
                  <AnsLine />
                </React.Fragment>
              ))}
              {q.extendedLines && Array.from({ length: q.extendedLines }).map((_, ei) => <AnsLine key={`ex-${ei}`} />)}
            </div>
          ))}
        </React.Fragment>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748B', borderTop: '1px solid #e2e8f0', paddingTop: 10, marginTop: 12 }}>
        <span>Examiner: _______________________</span>
        <span>Signature: _______________________</span>
      </div>
    </>
  );
}

/* Small static preview for each template */
function TemplatePreview({ id }) {
  if (id === 1) {
    return (
      <div className="pg-tmpl-static">
        <div className="pg-tmpl-hbar">THE OXFORD SYSTEM — LAHORE CAMPUS</div>
        <div className="pg-tmpl-content">
          <div style={{ textAlign: 'center', fontSize: 5.5, fontWeight: 600, color: '#334155', padding: '2px 0', borderBottom: '1px solid #BFDBFE', marginBottom: 3 }}>
            Annual Examination 2026 · English (A) · Class IV
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, marginBottom: 3 }}>
            <div style={{ fontSize: 5, color: '#64748B', borderBottom: '1px solid #CBD5E1', paddingBottom: 2 }}>Name: __________</div>
            <div style={{ fontSize: 5, color: '#64748B', borderBottom: '1px solid #CBD5E1', paddingBottom: 2 }}>Roll: ______</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 2, marginBottom: 3 }}>
            {['Eng A', 'IV', '100m', '100'].map((v, i) => (
              <div key={i} style={{ background: i === 3 ? '#1E3A8A' : '#EFF6FF', border: i === 3 ? 'none' : '1px solid #BFDBFE', borderRadius: 2, padding: '2px 3px', textAlign: 'center' }}>
                <div style={{ fontSize: 4, color: i === 3 ? '#93C5FD' : '#93C5FD', fontWeight: 700 }}>{['SUBJ','CLASS','TIME','MARKS'][i]}</div>
                <div style={{ fontSize: 5.5, fontWeight: 700, color: i === 3 ? '#fff' : '#1E3A8A' }}>{v}</div>
              </div>
            ))}
          </div>
          {[95, 80, 88, 72].map((w, i) => (
            <div key={i} style={{ height: 3.5, borderRadius: 2, background: i === 0 ? '#DBEAFE' : '#EEF2FF', width: `${w}%`, marginTop: 3 }} />
          ))}
        </div>
      </div>
    );
  }
  if (id === 2) {
    return (
      <div className="pg-tmpl-static">
        <div className="pg-tmpl-content" style={{ gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, borderBottom: '2.5px solid #1E3A8A', paddingBottom: 4, marginBottom: 4 }}>
            <div style={{ width: 20, height: 20, background: 'linear-gradient(135deg,#1E3A8A,#3B82F6)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 900, color: '#fff' }}>O</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 7, fontWeight: 800, color: '#0F172A' }}>The Oxford System</div>
              <div style={{ fontSize: 5, color: '#64748B' }}>Lahore Campus · Annual Exam 2026</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 6.5, fontWeight: 800, color: '#1E3A8A' }}>Class IV</div>
              <div style={{ fontSize: 5, color: '#64748B' }}>English (A)</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 2, marginBottom: 3 }}>
            <div style={{ flex: 1, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 3, padding: '2px 4px' }}>
              <div style={{ fontSize: 4, fontWeight: 700, color: '#93C5FD' }}>OBJECTIVE</div>
              <div style={{ fontSize: 5.5, fontWeight: 700, color: '#1E3A8A' }}>40 Marks · 40m</div>
            </div>
            <div style={{ flex: 1, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 3, padding: '2px 4px' }}>
              <div style={{ fontSize: 4, fontWeight: 700, color: '#6EE7B7' }}>SUBJECTIVE</div>
              <div style={{ fontSize: 5.5, fontWeight: 700, color: '#15803D' }}>60 Marks · 60m</div>
            </div>
            <div style={{ flex: '0 0 28px', background: '#1E3A8A', borderRadius: 3, padding: '2px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 4, fontWeight: 700, color: '#93C5FD' }}>TOTAL</div>
              <div style={{ fontSize: 7, fontWeight: 900, color: '#fff' }}>100</div>
            </div>
          </div>
          {[92, 77, 84, 68].map((w, i) => (
            <div key={i} style={{ height: 3.5, borderRadius: 2, background: i === 0 ? '#DBEAFE' : '#EEF2FF', width: `${w}%` }} />
          ))}
        </div>
      </div>
    );
  }
  // id === 3 — Formal
  return (
    <div className="pg-tmpl-static">
      <div className="pg-tmpl-content" style={{ gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
          <div style={{ width: 16, height: 16, background: 'linear-gradient(135deg,#1E3A8A,#3B82F6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 5, fontWeight: 900, color: '#fff', border: '1.5px solid #60A5FA' }}>OX</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 6.5, fontWeight: 900, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '.04em' }}>The Oxford System</div>
            <div style={{ fontSize: 4.5, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.04em' }}>Lahore Campus · Est. 2004</div>
          </div>
          <div style={{ background: '#1E3A8A', color: '#fff', fontSize: 4, fontWeight: 800, padding: '2px 4px', borderRadius: 2, letterSpacing: '.06em' }}>BOARD</div>
        </div>
        <div style={{ height: 1.5, background: 'linear-gradient(90deg,#1E3A8A,#60A5FA,transparent)', borderRadius: 1, marginBottom: 2 }} />
        <div style={{ textAlign: 'center', fontSize: 5, fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '.08em', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0', padding: '2px 0', marginBottom: 2 }}>
          Annual Examination — 2026
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', border: '1px solid #CBD5E1', borderRadius: 3, overflow: 'hidden', marginBottom: 2 }}>
          {[['SUBJ','EngA'],['CLASS','IV'],['MARKS','100'],['OBJ','40'],['TIME','100m']].map(([k, v], i) => (
            <div key={i} style={{ padding: '2px 3px', borderRight: i < 4 ? '1px solid #E2E8F0' : 'none', background: i === 2 ? '#EFF6FF' : '#FAFBFF' }}>
              <div style={{ fontSize: 4, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>{k}</div>
              <div style={{ fontSize: i === 2 ? 6.5 : 5.5, fontWeight: i === 2 ? 900 : 700, color: i === 2 ? '#1E3A8A' : '#0F172A' }}>{v}</div>
            </div>
          ))}
        </div>
        {[90, 75, 82].map((w, i) => (
          <div key={i} style={{ height: 3.5, borderRadius: 2, background: i === 0 ? '#DBEAFE' : '#EEF2FF', width: `${w}%`, marginTop: 3 }} />
        ))}
      </div>
    </div>
  );
}

const PG_CSS = `
/* ── Paper Generator — module styles ── */
.pg-tabs-row {
  display:grid; grid-template-columns:1fr 1fr; gap:4px;
  background:var(--bg-muted); border:1px solid var(--border-light);
  border-radius:var(--radius-lg); padding:4px;
  margin-bottom:20px;
}
.pg-tab {
  display:flex; align-items:center; justify-content:center; gap:8px;
  padding:10px 20px; font-family:inherit; font-size:13px; font-weight:600;
  color:var(--text-muted); background:transparent; border:none;
  border-radius:var(--radius-md); cursor:pointer; transition:.18s ease;
}
.pg-tab:hover { color:#1E40AF; background:var(--bg-card); }
.pg-tab.active {
  background:#1E40AF; color:#fff;
  box-shadow:0 2px 8px rgba(30,64,175,.25);
}

.pg-card-head {
  padding:18px 20px 14px;
  border-bottom:1px solid var(--border-light);
}
.pg-card-title {
  display:flex; align-items:center; gap:8px;
  font-size:15px; font-weight:700; color:var(--text-primary);
}
.pg-card-sub { font-size:12px; color:var(--text-muted); margin-top:3px; }

/* Template grid */
.pg-tmpl-grid {
  display:grid; grid-template-columns:repeat(3, 1fr); gap:16px;
}
.pg-tmpl-card {
  background:var(--bg-card);
  border:2px solid var(--border-light);
  border-radius:var(--radius-lg);
  overflow:hidden; cursor:pointer; transition:.2s ease;
  position:relative;
  display:flex; flex-direction:column;
}
.pg-tmpl-card:hover {
  border-color:#1E40AF;
  box-shadow:0 4px 18px rgba(30,58,138,.12);
  transform:translateY(-2px);
}
.pg-tmpl-card.selected {
  border-color:#1E40AF;
  box-shadow:0 0 0 3px rgba(30,58,138,.15), 0 4px 16px rgba(30,58,138,.18);
}
.pg-tmpl-top-strip {
  height:5px; width:100%;
  background:var(--border-light);
  transition:.2s ease;
}
.pg-tmpl-card.selected .pg-tmpl-top-strip {
  background:linear-gradient(90deg,#1E3A8A,#3B82F6);
}
.pg-tmpl-badge {
  position:absolute; top:14px; right:14px;
  display:inline-flex; align-items:center; gap:4px;
  padding:3px 10px; border-radius:999px;
  background:#1E40AF; color:#fff;
  font-size:9.5px; font-weight:800; letter-spacing:.4px;
  box-shadow:0 2px 8px rgba(30,64,175,.3);
  z-index:5;
}
.pg-tmpl-body {
  padding:16px; display:flex; flex-direction:column; gap:12px;
  flex:1;
}
.pg-tmpl-num {
  font-size:34px; font-weight:900; color:var(--border-med);
  line-height:1; letter-spacing:-.04em;
}
.pg-tmpl-card.selected .pg-tmpl-num { color:#1E40AF; }

.pg-tmpl-static {
  background:linear-gradient(160deg,#F8FAFF 0%,#EFF6FF 100%);
  border:1px solid var(--border-light);
  border-radius:8px; overflow:hidden;
  min-height:130px; padding:0;
  font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;
}
.pg-tmpl-hbar {
  background:linear-gradient(90deg,#1E3A8A,#3B82F6);
  color:#fff; text-align:center;
  padding:4px 6px;
  font-weight:700; font-size:7px;
  letter-spacing:.05em;
}
.pg-tmpl-content { padding:8px; }

.pg-tmpl-name {
  font-size:14px; font-weight:800;
  color:var(--text-primary);
  display:flex; align-items:center; gap:8px;
}
.pg-tmpl-name-bar {
  flex:1; height:2px; border-radius:2px;
  background:var(--border-med);
}
.pg-tmpl-card.selected .pg-tmpl-name-bar {
  background:linear-gradient(90deg,#1E40AF,transparent);
}
.pg-tmpl-desc {
  font-size:11.5px; color:var(--text-muted);
  line-height:1.5; margin-top:4px;
}

.pg-tmpl-prev-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:6px;
  padding:7px 14px; border-radius:8px;
  background:var(--bg-muted); border:1.5px solid var(--border-light);
  color:var(--text-muted);
  font-family:inherit; font-size:12px; font-weight:700;
  cursor:pointer; transition:.18s ease;
}
.pg-tmpl-prev-btn:hover {
  border-color:#1E40AF; color:#1E40AF;
  background:rgba(30,64,175,.06);
}

@media (max-width: 820px) {
  .pg-tmpl-grid { grid-template-columns:repeat(2, 1fr); }
  .pg-tabs-row { grid-template-columns:1fr; }
}
@media (max-width: 540px) {
  .pg-tmpl-grid { grid-template-columns:1fr; }
}

[data-theme="dark"].pg-tabs-row { background:var(--bg-muted); }
[data-theme="dark"].pg-tab { color:var(--text-muted); }
[data-theme="dark"].pg-tab:hover { background:var(--bg-card); color:#93C5FD; }
[data-theme="dark"].pg-tmpl-card { background:var(--bg-card); }
[data-theme="dark"].pg-tmpl-static {
  background:linear-gradient(160deg,#0E1628 0%,#131F38 100%);
}
[data-theme="dark"].pg-tmpl-num { color:var(--border-med); }
[data-theme="dark"].pg-tmpl-prev-btn {
  background:var(--bg-muted); color:var(--text-muted);
  border-color:var(--border-light);
}
[data-theme="dark"].pg-tmpl-prev-btn:hover {
  border-color:#3B82F6; color:#3B82F6;
  background:rgba(59,130,246,.08);
}

/* ── Toggle pills inside the preview toolbar ── */
.pg-toggle-btn {
  display:inline-flex; align-items:center; gap:6px;
  padding:8px 14px;
  border:1.5px solid var(--border-light);
  border-radius:var(--radius-md);
  background:var(--bg-muted); color:var(--text-muted);
  font-family:inherit; font-size:12.5px; font-weight:600;
  cursor:pointer; transition:.18s ease;
}
.pg-toggle-btn:hover { border-color:#1E40AF; color:#1E40AF; }
.pg-toggle-btn.active {
  border-color:#1E40AF; background:rgba(30,64,175,.08); color:#1E40AF;
}
.pg-toggle-btn:disabled { opacity:.5; cursor:not-allowed; }
.pg-toggle-btn:disabled:hover { border-color:var(--border-light); color:var(--text-muted); }

/* ── Footer buttons ── */
.pg-btn-primary {
  display:inline-flex; align-items:center; gap:7px;
  padding:10px 22px;
  background:#1E40AF; color:#fff;
  border:none; border-radius:var(--radius-md);
  font-family:inherit; font-size:13px; font-weight:700;
  cursor:pointer; transition:.18s ease;
}
.pg-btn-primary:hover { background:#1E3A8A; box-shadow:0 4px 14px rgba(30,64,175,.3); }
.pg-btn-secondary {
  display:inline-flex; align-items:center; gap:7px;
  padding:10px 22px;
  background:transparent; color:var(--text-secondary);
  border:1.5px solid var(--border-light);
  border-radius:var(--radius-md);
  font-family:inherit; font-size:13px; font-weight:600;
  cursor:pointer; transition:.18s ease;
}
.pg-btn-secondary:hover {
  border-color:#1E40AF; color:#1E40AF; background:var(--bg-muted);
}

/* ── Template Preview modal shell ── */
.pg-tmpl-prev-overlay {
  position:fixed; inset:0;
  background:rgba(10,20,50,.65);
  backdrop-filter:blur(6px);
  display:flex; align-items:center; justify-content:center;
  z-index:9100; opacity:0; pointer-events:none;
  transition:opacity .22s ease;
  padding:20px;
}
.pg-tmpl-prev-overlay.open { opacity:1; pointer-events:all; }
.pg-tmpl-prev-modal {
  background:var(--bg-card);
  border-radius:20px;
  width:100%; max-width:720px; max-height:90vh;
  overflow:hidden; display:flex; flex-direction:column;
  box-shadow:0 32px 80px rgba(10,20,50,.3), 0 8px 24px rgba(0,0,0,.12);
  transform:scale(.95) translateY(20px);
  transition:all .24s cubic-bezier(.34,1.56,.64,1);
}
.pg-tmpl-prev-overlay.open .pg-tmpl-prev-modal { transform:scale(1) translateY(0); }
.pg-tmpl-prev-header {
  padding:16px 22px 14px;
  border-bottom:1px solid var(--border-light);
  display:flex; align-items:center; justify-content:space-between;
  background:var(--bg-muted);
  flex-shrink:0;
}
.pg-tmpl-prev-title {
  font-size:15px; font-weight:700; color:#1E40AF;
  display:flex; align-items:center; gap:8px;
}
.pg-tmpl-prev-title::before {
  content:''; display:inline-block;
  width:4px; height:18px;
  background:linear-gradient(180deg,#1E40AF,#1E3A8A);
  border-radius:3px;
}
.pg-modal-close {
  width:32px; height:32px; border-radius:50%;
  border:1.5px solid var(--border-light);
  background:transparent; color:var(--text-muted);
  cursor:pointer; display:flex; align-items:center; justify-content:center;
  transition:.18s ease; font-size:13px;
}
.pg-modal-close:hover { background:var(--error, #DC2626); border-color:var(--error, #DC2626); color:#fff; }

.pg-tmpl-prev-body {
  padding:20px 24px; overflow-y:auto;
  flex:1; background:#EEF2FF;
}
.pg-tmpl-prev-footer {
  padding:14px 22px;
  border-top:1px solid var(--border-light);
  display:flex; justify-content:flex-end; gap:10px;
  background:var(--bg-muted);
  flex-shrink:0;
}

/* ── Paper preview box (the "sheet") ── */
.pg-paper-preview-box {
  background:#fff;
  border:none; border-radius:4px;
  padding:28px 30px;
  font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;
  color:#0F172A;
  box-shadow:0 1px 3px rgba(0,0,0,.08),
             0 6px 24px rgba(30,58,138,.12),
             0 0 0 1px rgba(0,0,0,.04),
             8px 8px 0 rgba(30,58,138,.06);
  position:relative;
}
.pg-paper-preview-box::before {
  content:''; position:absolute;
  top:0; left:0; right:0; height:3px;
  background:linear-gradient(90deg,#1E3A8A,#2563EB,#1E3A8A);
  border-radius:4px 4px 0 0;
}

/* Classic */
.pg-pp-school-bar {
  background:linear-gradient(135deg,#1E3A8A,#1D4ED8);
  color:#fff; text-align:center;
  padding:12px 16px;
  margin:-28px -30px 14px;
  font-size:12.5px; font-weight:800;
  letter-spacing:.08em; text-transform:uppercase;
  border-radius:4px 4px 0 0;
}
.pg-pp-exam-line {
  text-align:center;
  font-size:11.5px; font-weight:600;
  color:#334155; margin-bottom:12px;
  letter-spacing:.01em;
}
.pg-pp-student-grid {
  display:grid; grid-template-columns:1fr 1fr; gap:8px;
  font-size:11px; color:#334155; margin-bottom:10px;
}
.pg-pp-student-field {
  border-bottom:1px solid #CBD5E1;
  padding-bottom:5px;
}
.pg-pp-marks-grid {
  display:grid; grid-template-columns:repeat(4,1fr); gap:6px;
  margin-bottom:10px;
}
.pg-pp-marks-cell {
  border:1px solid #E2E8F0; border-radius:6px;
  padding:6px 8px; background:#F8FAFF;
}
.pg-pp-marks-cell--accent { background:#EFF6FF; border-color:#BFDBFE; }
.pg-pp-marks-label {
  display:block; font-size:9px; font-weight:700;
  color:#94A3B8; text-transform:uppercase;
  letter-spacing:.06em; margin-bottom:3px;
}
.pg-pp-marks-val {
  display:block; font-size:12px; font-weight:700;
  color:#1E3A8A;
}
.pg-pp-meta-bar {
  display:flex; justify-content:space-between;
  border-top:2px solid #1E3A8A;
  padding-top:8px; margin-top:6px;
  font-size:11px; font-weight:600; color:#1E3A8A;
}

/* Formal */
.pg-pp-formal-wrap { font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif; }
.pg-pp-formal-top {
  display:flex; align-items:center; gap:12px;
  margin-bottom:10px;
}
.pg-pp-formal-seal {
  width:50px; height:50px; border-radius:50%;
  background:linear-gradient(135deg,#1E3A8A,#1D4ED8);
  display:flex; align-items:center; justify-content:center;
  flex-shrink:0;
  box-shadow:0 3px 10px rgba(30,58,138,.35);
}
.pg-pp-formal-seal-inner {
  font-size:15px; font-weight:900; color:#fff;
  letter-spacing:.02em;
}
.pg-pp-formal-school-block { flex:1; }
.pg-pp-formal-school-name {
  font-size:14px; font-weight:900; color:#0F172A;
  letter-spacing:.08em; text-transform:uppercase;
}
.pg-pp-formal-school-sub {
  font-size:9.5px; color:#64748B;
  letter-spacing:.06em; text-transform:uppercase;
  margin-top:2px;
}
.pg-pp-formal-board-tag {
  background:#1E3A8A; color:#fff;
  font-size:8.5px; font-weight:800;
  letter-spacing:.1em;
  padding:4px 9px; border-radius:5px;
  text-transform:uppercase; flex-shrink:0;
}
.pg-pp-formal-divider {
  height:2px;
  background:linear-gradient(90deg,#1E3A8A 60%,#60A5FA,transparent);
  margin:8px 0; border-radius:2px;
}
.pg-pp-formal-exam-title {
  text-align:center;
  font-size:11px; font-weight:800;
  letter-spacing:.16em; color:#0F172A;
  text-transform:uppercase;
  margin-bottom:10px; padding:5px 0;
  border-top:1px solid #E2E8F0;
  border-bottom:1px solid #E2E8F0;
}
.pg-pp-formal-meta-grid {
  display:grid; grid-template-columns:repeat(5,1fr); gap:0;
  border:1.5px solid #CBD5E1; border-radius:7px;
  overflow:hidden; margin-bottom:10px;
}
.pg-pp-formal-meta-cell {
  padding:6px 9px;
  border-right:1px solid #E2E8F0;
  background:#FAFBFF;
}
.pg-pp-formal-meta-cell:last-child { border-right:none; }
.pg-pp-formal-meta-label {
  display:block; font-size:8px; font-weight:800;
  color:#94A3B8; text-transform:uppercase;
  letter-spacing:.08em; margin-bottom:3px;
}
.pg-pp-formal-meta-val {
  display:block; font-size:12px; font-weight:700;
  color:#0F172A;
}
.pg-pp-formal-meta-accent { color:#1E3A8A; font-size:14px !important; }
.pg-pp-formal-student-grid {
  display:grid; grid-template-columns:2fr 1fr 1fr 1fr;
  border:1.5px solid #CBD5E1; border-radius:7px;
  overflow:hidden; margin-bottom:8px;
}
.pg-pp-formal-student-field {
  display:flex; flex-direction:column; gap:3px;
  padding:6px 9px;
  border-right:1px solid #E2E8F0;
  background:#fff;
}
.pg-pp-formal-student-field:last-child { border-right:none; }
.pg-pp-formal-field-label {
  font-size:8.5px; font-weight:800; color:#94A3B8;
  text-transform:uppercase; letter-spacing:.06em;
}
.pg-pp-formal-field-line {
  display:block;
  border-bottom:1px solid #CBD5E1;
  margin-top:10px;
}
.pg-pp-formal-obtained-row {
  display:flex; gap:10px; margin-top:6px;
}
.pg-pp-formal-obtained-cell {
  display:flex; align-items:center; gap:8px;
  flex:1; font-size:10px;
}

/* Answer sheet */
.pg-pp-section-label {
  font-size:10.5px; font-weight:700;
  text-transform:uppercase; letter-spacing:.06em;
  color:#64748B;
  margin:16px 0 8px;
  padding-bottom:5px;
  border-bottom:1px solid #e2e8f0;
}
.pg-pp-answer-lines-single {
  height:28px; border-bottom:1.5px solid #cbd5e1;
  margin-bottom:10px;
}
.pg-pp-answer-lines-four {
  height:56px; border:1px solid #cbd5e1;
  border-radius:4px; margin-bottom:10px;
  display:grid; grid-template-rows:repeat(4,1fr);
  padding:3px 6px;
}
.pg-pp-answer-lines-four > div { border-bottom:1px solid #e2e8f0; }
.pg-pp-answer-lines-four > div:last-child { border-bottom:none; }

@media (max-width: 540px) {
  .pg-paper-preview-box { padding:16px 14px; }
  .pg-pp-school-bar { margin:-16px -14px 12px; font-size:10.5px; padding:9px; }
  .pg-pp-marks-grid { grid-template-columns:repeat(2,1fr); }
  .pg-pp-formal-meta-grid { grid-template-columns:repeat(2,1fr); }
  .pg-pp-formal-student-grid { grid-template-columns:1fr 1fr; }
  .pg-pp-formal-obtained-row { flex-direction:column; gap:6px; }
  .pg-tmpl-prev-modal { max-height:95vh; }
  .pg-tmpl-prev-body { padding:14px 12px; }
}
/* ── Modal shells + delete dialog must not overflow on tablet/phone ── */
@media (max-width: 820px) {
  .pg-modal,
  .pg-delete-dialog { max-width:96vw !important; }
  /* Paper preview wrapper — allow horizontal scroll so wide tables don't break the page */
  .pg-tmpl-prev-body { overflow-x:auto; }
}

/* Dark mode for the paper sheet */
[data-theme="dark"].pg-tmpl-prev-body { background:#0B1224; }
[data-theme="dark"].pg-paper-preview-box {
  background:#0F172A; color:#E2E8F8;
  box-shadow:0 1px 3px rgba(0,0,0,.4),
             0 6px 24px rgba(30,58,138,.25),
             0 0 0 1px rgba(255,255,255,.05),
             8px 8px 0 rgba(30,58,138,.18);
}
[data-theme="dark"].pg-pp-school-bar { background:linear-gradient(135deg,#1E3A8A,#2563EB); }
[data-theme="dark"].pg-pp-exam-line { color:#CBD5E1; }
[data-theme="dark"].pg-pp-student-grid { color:#CBD5E1; }
[data-theme="dark"].pg-pp-marks-cell {
  background:rgba(255,255,255,.02);
  border-color:rgba(255,255,255,.08);
}
[data-theme="dark"].pg-pp-marks-cell--accent {
  background:rgba(30,64,175,.18); border-color:rgba(59,130,246,.3);
}
[data-theme="dark"].pg-pp-marks-val { color:#93C5FD; }
[data-theme="dark"].pg-pp-meta-bar { color:#93C5FD; border-top-color:#2563EB; }
[data-theme="dark"].pg-pp-formal-school-name { color:#E2E8F8; }
[data-theme="dark"].pg-pp-formal-school-sub  { color:#94A3B8; }
[data-theme="dark"].pg-pp-formal-meta-cell { background:rgba(255,255,255,.02); }
[data-theme="dark"].pg-pp-formal-meta-val  { color:#E2E8F8; }
[data-theme="dark"].pg-pp-formal-meta-accent { color:#93C5FD; }
[data-theme="dark"].pg-pp-formal-student-field { background:rgba(255,255,255,.02); }
[data-theme="dark"].pg-pp-section-label { color:#94A3B8; border-bottom-color:rgba(255,255,255,.06); }
[data-theme="dark"].pg-toggle-btn { background:var(--bg-muted); color:var(--text-muted); }
[data-theme="dark"].pg-toggle-btn:hover { border-color:#3B82F6; color:#3B82F6; }
[data-theme="dark"].pg-toggle-btn.active { border-color:#3B82F6; background:rgba(59,130,246,.12); color:#93C5FD; }

/* ── Global defaults bar (header of Class-wise card) ── */
.pg-global-defaults-row {
  display:flex; align-items:center; justify-content:space-between;
  flex-wrap:wrap; gap:12px;
}
.pg-global-defaults-controls {
  display:flex; align-items:center; gap:8px; flex-wrap:wrap;
}
.pg-global-lbl {
  font-size:11px; font-weight:700; color:var(--text-muted);
  text-transform:uppercase; letter-spacing:.04em; white-space:nowrap;
}
.pg-seg {
  display:flex; border:1.5px solid var(--border-light);
  border-radius:var(--radius-md); overflow:hidden; flex-shrink:0;
}
.pg-seg-btn {
  display:inline-flex; align-items:center; gap:6px;
  padding:7px 14px; border:none; background:var(--bg-muted);
  color:var(--text-muted);
  font-family:inherit; font-size:12.5px; font-weight:600;
  cursor:pointer; transition:.15s ease;
  border-right:1px solid var(--border-light);
  white-space:nowrap;
}
.pg-seg-btn:last-child { border-right:none; }
.pg-seg-btn:hover { color:#1E40AF; }
.pg-seg-btn.active { background:#EFF6FF; color:#1E40AF; }
.pg-seg-divider { width:1px; height:24px; background:var(--border-light); flex-shrink:0; }

/* ── Class accordion block ── */
.pg-subj-class-block {
  margin-bottom:8px;
  border:1.5px solid var(--border-light);
  border-radius:var(--radius-lg);
  overflow:hidden;
  box-shadow:0 1px 2px rgba(15,23,42,.04);
  transition:box-shadow .2s;
}
.pg-subj-class-block:hover { box-shadow:0 2px 8px rgba(15,23,42,.06); }
.pg-subj-class-header {
  display:flex; flex-direction:column; gap:0;
  padding:12px 16px;
  background:var(--bg-card);
  cursor:pointer; user-select:none;
  transition:background .15s ease;
}
.pg-subj-class-header:hover { background:var(--bg-muted); }
.pg-subj-class-block.open .pg-subj-class-header {
  background:var(--bg-muted);
  border-bottom:1.5px solid var(--border-light);
}
.pg-subj-class-header-top {
  display:flex; align-items:center; gap:10px; width:100%;
}
.pg-subj-class-name {
  font-size:13px; font-weight:700; color:var(--text-primary);
}
.pg-subj-class-section {
  font-size:10.5px; color:#1E40AF;
  background:rgba(30,64,175,.1);
  border:1px solid rgba(30,64,175,.2);
  padding:2px 8px;
  border-radius:999px; font-weight:700;
}
.pg-subj-count-pill {
  font-size:10px; font-weight:700;
  padding:2px 8px; border-radius:999px;
  background:rgba(124,58,237,.1); color:#7C3AED;
  border:1px solid rgba(124,58,237,.2);
}
.pg-cls-chevron {
  width:28px; height:28px; border-radius:50%;
  border:1.5px solid var(--border-light);
  background:transparent; color:var(--text-muted);
  cursor:pointer; display:flex; align-items:center; justify-content:center;
  font-size:11px; transition:.18s ease;
}
.pg-cls-chevron:hover { border-color:#1E40AF; color:#1E40AF; }
.pg-subj-class-block.open .pg-cls-chevron {
  background:#1E40AF; border-color:#1E40AF; color:#fff;
  transform:rotate(180deg);
}

/* Class-level defaults chip row */
.pg-cls-defaults {
  display:flex; align-items:center; gap:6px;
  margin-top:8px; padding-top:8px;
  border-top:1px dashed var(--border-light);
  overflow-x:auto;
}
.pg-cls-chip {
  display:inline-flex; align-items:center; gap:4px;
  padding:3px 9px; border-radius:999px;
  font-size:10.5px; font-weight:600;
  border:1.5px solid var(--border-light);
  background:var(--bg-muted);
  color:var(--text-muted);
  cursor:pointer; transition:.15s ease;
  white-space:nowrap; flex-shrink:0;
  font-family:inherit;
}
.pg-cls-chip i { font-size:9px; }
.pg-cls-chip:hover { color:#1E40AF; border-color:#BFDBFE; }
.pg-cls-chip.active-fmt {
  border-color:#1E40AF; background:#EFF6FF; color:#1E40AF;
}
.pg-cls-chip.active-line {
  border-color:#0284C7; background:#E0F2FE; color:#0284C7;
}

/* Subject rows inside the open class */
.pg-subj-rows {
  display:flex; flex-direction:column;
  background:var(--bg-card);
}
.pg-subj-row {
  display:grid;
  grid-template-columns:1fr auto auto;
  align-items:center;
  padding:10px 16px; gap:16px;
  border-bottom:1px solid var(--border-light);
  transition:background .15s ease;
}
.pg-subj-row:last-child { border-bottom:none; }
.pg-subj-row:hover { background:var(--bg-muted); }
.pg-subj-row-left {
  display:flex; align-items:center; gap:10px;
}
.pg-subj-icon {
  width:32px; height:32px; border-radius:8px;
  background:linear-gradient(135deg,#DBEAFE,#BFDBFE);
  color:#1E40AF;
  display:flex; align-items:center; justify-content:center;
  font-size:13px; flex-shrink:0;
}
.pg-subj-name {
  font-size:12.5px; font-weight:700; color:var(--text-primary);
}
.pg-subj-toggle-col {
  display:flex; flex-direction:column; gap:4px;
  align-items:flex-start;
}
.pg-subj-toggle-lbl {
  font-size:9px; font-weight:700; color:var(--text-muted);
  text-transform:uppercase; letter-spacing:.04em;
  display:inline-flex; align-items:center;
}
.pg-subj-toggle {
  display:flex; border:1.5px solid var(--border-light);
  border-radius:var(--radius-md); overflow:hidden;
}
.pg-subj-toggle-btn {
  display:inline-flex; align-items:center; gap:5px;
  padding:5px 10px; border:none;
  background:var(--bg-muted); color:var(--text-muted);
  font-family:inherit; font-size:10.5px; font-weight:600;
  cursor:pointer; transition:.15s ease;
  border-right:1px solid var(--border-light);
  white-space:nowrap;
}
.pg-subj-toggle-btn:last-child { border-right:none; }
.pg-subj-toggle-btn:hover { color:#1E40AF; }
.pg-subj-toggle-btn.active-fmt {
  background:#EFF6FF; color:#1E40AF;
}
.pg-subj-toggle-btn.active-line {
  background:#E0F2FE; color:#0284C7;
}

@media (max-width: 720px) {
  .pg-subj-row { grid-template-columns:1fr; gap:10px; }
  .pg-subj-toggle-col { width:100%; }
  .pg-subj-toggle { width:100%; }
  .pg-subj-toggle-btn { flex:1; justify-content:center; }
  .pg-global-defaults-controls { width:100%; justify-content:flex-start; }
}

/* Dark mode */
[data-theme="dark"].pg-seg-btn { background:var(--bg-muted); color:var(--text-muted); }
[data-theme="dark"].pg-seg-btn.active { background:rgba(59,130,246,.15); color:#93C5FD; }
[data-theme="dark"].pg-subj-class-block { border-color:var(--border-light); }
[data-theme="dark"].pg-subj-class-header { background:var(--bg-card); }
[data-theme="dark"].pg-subj-class-header:hover { background:var(--bg-muted); }
[data-theme="dark"].pg-subj-class-block.open .pg-subj-class-header { background:var(--bg-muted); }
[data-theme="dark"].pg-subj-class-section { background:rgba(59,130,246,.12); border-color:rgba(59,130,246,.3); color:#93C5FD; }
[data-theme="dark"].pg-cls-chip { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"].pg-cls-chip.active-fmt { border-color:#3B82F6; background:rgba(59,130,246,.12); color:#93C5FD; }
[data-theme="dark"].pg-cls-chip.active-line { border-color:#0EA5E9; background:rgba(14,165,233,.15); color:#38BDF8; }
[data-theme="dark"].pg-subj-rows { background:var(--bg-card); }
[data-theme="dark"].pg-subj-row { border-color:var(--border-light); }
[data-theme="dark"].pg-subj-row:hover { background:var(--bg-muted); }
[data-theme="dark"].pg-subj-toggle-btn { background:var(--bg-muted); color:var(--text-muted); }
[data-theme="dark"].pg-subj-toggle-btn.active-fmt { background:rgba(59,130,246,.15); color:#93C5FD; }
[data-theme="dark"].pg-subj-toggle-btn.active-line { background:rgba(14,165,233,.2); color:#38BDF8; }

/* ═══════════════════════════════════════════════════════════════════
   PAPER GENERATOR tab — class table + papers grid
   ═══════════════════════════════════════════════════════════════════ */
.pg-class-table-head {
  display:grid;
  grid-template-columns:60px 1fr 1fr 160px 100px 70px;
  padding:11px 18px;
  background:var(--bg-muted);
  border-bottom:1px solid var(--border-light);
  font-size:11px; font-weight:700; color:var(--text-muted);
  text-transform:uppercase; letter-spacing:.04em;
}
.pg-class-row {
  display:grid;
  grid-template-columns:60px 1fr 1fr 160px 100px 70px;
  padding:14px 18px;
  border-bottom:1px solid var(--border-light);
  align-items:center;
  transition:background .15s ease;
  font-size:13px;
}
.pg-class-row:hover { background:var(--bg-muted); }
.pg-class-row:last-of-type { border-bottom:none; }

.pg-make-paper-btn {
  display:inline-flex; align-items:center; gap:7px;
  padding:8px 18px;
  background:linear-gradient(135deg,#1E3A8A 0%,#2563EB 50%,#1D4ED8 100%);
  background-size:200% 200%;
  border:none; border-radius:999px;
  color:#fff;
  font-family:inherit; font-size:12px; font-weight:700;
  cursor:pointer; letter-spacing:.02em;
  box-shadow:0 2px 10px rgba(37,99,235,.35), 0 1px 3px rgba(0,0,0,.1);
  transition:all .22s cubic-bezier(.4,0,.2,1);
  position:relative; overflow:hidden;
  animation:pgMakePaperPulse 3s ease-in-out infinite;
}
.pg-make-paper-btn::before {
  content:''; position:absolute; inset:0;
  background:linear-gradient(135deg,rgba(255,255,255,.18),transparent 60%);
  border-radius:inherit;
}
.pg-make-paper-btn::after {
  content:''; position:absolute;
  top:-50%; left:-60%; width:40%; height:200%;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent);
  transform:skewX(-20deg);
  transition:left .5s ease;
}
.pg-make-paper-btn:hover::after { left:120%; }
.pg-make-paper-btn:hover {
  background:linear-gradient(135deg,#1D4ED8 0%,#3B82F6 50%,#1E40AF 100%);
  box-shadow:0 4px 20px rgba(37,99,235,.5), 0 2px 6px rgba(0,0,0,.15);
  transform:translateY(-2px) scale(1.03);
}
.pg-make-paper-btn:active { transform:translateY(0) scale(.98); }
.pg-make-paper-btn i {
  font-size:11px;
  animation:pgBtnIconSpin 2.5s ease-in-out infinite;
}
@keyframes pgMakePaperPulse {
  0%,100% { box-shadow:0 2px 10px rgba(37,99,235,.35), 0 1px 3px rgba(0,0,0,.1); }
  50%     { box-shadow:0 2px 18px rgba(37,99,235,.6),  0 1px 3px rgba(0,0,0,.1); }
}
@keyframes pgBtnIconSpin {
  0%,80%,100% { transform:rotate(0deg) scale(1); }
  90%         { transform:rotate(-15deg) scale(1.2); }
}

.pg-paper-count {
  font-size:14px; font-weight:700; color:#1E40AF;
}
.pg-paper-count.zero { color:var(--text-muted); }

.pg-chevron-btn {
  width:32px; height:32px; border-radius:50%;
  border:1.5px solid var(--border-light);
  background:transparent; color:var(--text-muted);
  cursor:pointer;
  display:inline-flex; align-items:center; justify-content:center;
  transition:.18s ease;
}
.pg-chevron-btn:hover { border-color:#1E40AF; color:#1E40AF; background:#EFF6FF; }
.pg-chevron-btn.open {
  background:#1E40AF; border-color:#1E40AF; color:#fff;
  transform:rotate(180deg);
}

/* Dropdown that holds the papers grid */
.pg-papers-dropdown {
  display:none;
  background:var(--bg-muted);
  border-top:1px solid var(--border-light);
  padding:16px 18px;
}
.pg-papers-dropdown.open {
  display:block;
  animation:fadeSlide .2s ease both;
}

.pg-pc-count {
  font-size:12px; font-weight:700;
  color:var(--text-muted);
  margin-bottom:12px;
}

/* 4-col grid */
.pg-papers-grid-v2 {
  display:grid;
  grid-template-columns:repeat(4, 1fr);
  gap:14px; align-items:start;
}

/* Paper card */
.pg-paper-card-v2 {
  background:var(--bg-card);
  border:1.5px solid var(--border-light);
  border-radius:12px;
  padding:0;
  display:flex; flex-direction:column;
  overflow:hidden;
  transition:box-shadow .18s, transform .18s, border-color .18s;
}
.pg-paper-card-v2:hover {
  border-color:#93C5FD;
  box-shadow:0 4px 16px rgba(30,58,138,.1);
  transform:translateY(-2px);
}
.pg-pc-strip { height:5px; width:100%; flex-shrink:0; }
.pg-pc-strip.eng  { background:linear-gradient(90deg,#1E3A8A,#3B82F6); }
.pg-pc-strip.sci  { background:linear-gradient(90deg,#15803D,#22C55E); }
.pg-pc-strip.math { background:linear-gradient(90deg,#C2410C,#F97316); }
.pg-pc-strip.urdu { background:linear-gradient(90deg,#6D28D9,#A78BFA); }
.pg-pc-strip.sst  { background:linear-gradient(90deg,#B45309,#FBBF24); }

.pg-pc-body {
  padding:12px 14px 10px;
  display:flex; flex-direction:column; gap:7px;
  flex:1;
}
.pg-pc-subject-row { display:flex; align-items:center; gap:8px; min-width:0; }
.pg-pc-icon {
  width:32px; height:32px; border-radius:8px;
  display:flex; align-items:center; justify-content:center;
  font-size:14px; flex-shrink:0;
}
.pg-pc-subject {
  font-size:13px; font-weight:700; color:var(--text-primary);
  flex:1; min-width:0;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  line-height:1.3;
}
.pg-pc-type-badge {
  padding:2px 7px; border-radius:20px;
  font-size:9.5px; font-weight:700;
  white-space:nowrap; flex-shrink:0; line-height:1.6;
}
.pg-pc-title {
  font-size:11.5px; font-weight:600; color:var(--text-secondary);
  line-height:1.5;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;
}
.pg-pc-fmt-badge {
  display:inline-flex; align-items:center; gap:4px;
  padding:2px 9px; border-radius:6px;
  font-size:10px; font-weight:700; white-space:nowrap;
  width:fit-content;
}
.pg-pc-chips { display:flex; flex-direction:column; gap:3px; }
.pg-pc-chip {
  display:inline-flex; align-items:center; gap:5px;
  padding:2px 8px; border-radius:6px;
  font-size:10.5px; font-weight:600; white-space:nowrap;
}
.pg-pc-meta {
  display:flex; align-items:center; justify-content:space-between;
  font-size:10px; color:var(--text-muted);
  padding-top:7px;
  border-top:1px solid var(--border-light);
  flex-wrap:wrap; gap:2px;
}
.pg-pc-actions {
  display:flex; align-items:center; justify-content:center; gap:5px;
  padding:8px 12px;
  border-top:1px solid var(--border-light);
  background:var(--bg-muted);
}
.pg-action-icon {
  width:26px; height:26px; border-radius:6px;
  border:1px solid var(--border-light);
  background:transparent;
  display:inline-flex; align-items:center; justify-content:center;
  cursor:pointer; transition:.15s ease;
  font-size:11px; color:var(--text-muted);
}
.pg-action-icon:hover { box-shadow:0 1px 3px rgba(15,23,42,.08); }
.pg-action-icon.shuffle:hover  { color:#7C3AED; border-color:#7C3AED; background:#F5F3FF; }
.pg-action-icon.edit:hover     { color:#1E40AF; border-color:#1E40AF; background:#EFF6FF; }
.pg-action-icon.view:hover     { color:#0891B2; border-color:#0891B2; background:#ECFEFF; }
.pg-action-icon.download:hover { color:#16A34A; border-color:#16A34A; background:#F0FDF4; }
.pg-action-icon.delete:hover   { color:#DC2626; border-color:#DC2626; background:#FEF2F2; }

@media (max-width: 1100px) {
  .pg-papers-grid-v2 { grid-template-columns:repeat(3, 1fr); }
}
@media (max-width: 820px) {
  .pg-papers-grid-v2 { grid-template-columns:repeat(2, 1fr); }
  .pg-class-table-head { display:none; }
  .pg-class-row {
    grid-template-columns:1fr 1fr;
    gap:8px;
    padding:14px 14px;
  }
  .pg-class-row > div:nth-child(3) { display:none; }
  .pg-class-row > div:nth-child(4) { grid-column:1 / -1; }
  .pg-class-row > div:nth-child(5),
  .pg-class-row > div:nth-child(6) { justify-self:end; }
}
@media (max-width: 540px) {
  .pg-papers-grid-v2 { grid-template-columns:1fr; }
}

[data-theme="dark"].pg-class-row:hover { background:var(--bg-muted); }
[data-theme="dark"].pg-class-table-head { background:var(--bg-muted); }
[data-theme="dark"].pg-papers-dropdown { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"].pg-paper-card-v2 { background:var(--bg-card); }
[data-theme="dark"].pg-paper-card-v2:hover { border-color:#3B82F6; }
[data-theme="dark"].pg-action-icon { color:var(--text-muted); border-color:var(--border-light); }

/* ═══════════════════════════════════════════════════════════════════
   MAKE PAPER modal
   ═══════════════════════════════════════════════════════════════════ */
.pg-modal-overlay {
  position:fixed; inset:0;
  background:rgba(10,20,50,.55);
  backdrop-filter:blur(4px);
  display:flex; align-items:flex-start; justify-content:center;
  z-index:9000; padding:24px 16px; overflow-y:auto;
  opacity:0; pointer-events:none;
  transition:opacity .2s ease;
}
.pg-modal-overlay.open { opacity:1; pointer-events:all; }
.pg-modal {
  background:var(--bg-card);
  border-radius:var(--radius-xl);
  width:100%; max-width:760px;
  box-shadow:0 32px 80px rgba(10,20,50,.3), 0 8px 24px rgba(0,0,0,.12);
  transform:scale(.95) translateY(20px);
  transition:all .2s cubic-bezier(.34,1.56,.64,1);
  margin:auto;
}
.pg-modal-overlay.open .pg-modal { transform:scale(1) translateY(0); }
.pg-modal-header {
  padding:18px 22px 14px;
  border-bottom:1px solid var(--border-light);
  display:flex; align-items:center; justify-content:space-between;
  background:var(--bg-card);
  border-radius:var(--radius-xl) var(--radius-xl) 0 0;
}
.pg-modal-title {
  font-size:16px; font-weight:800; color:#1E40AF;
  display:flex; align-items:center; gap:8px;
}
.pg-modal-sub { font-size:11.5px; color:var(--text-muted); margin-top:2px; }
.pg-modal-body { padding:16px 20px; }
.pg-modal-footer {
  padding:14px 22px;
  border-top:1px solid var(--border-light);
  display:flex; align-items:center; justify-content:space-between;
  gap:10px;
  background:var(--bg-muted);
  border-radius:0 0 var(--radius-xl) var(--radius-xl);
  flex-wrap:wrap;
}

.pg-info-notice {
  display:flex; align-items:flex-start; gap:10px;
  background:#EFF6FF;
  border:1px solid #BFDBFE;
  border-radius:var(--radius-md);
  padding:10px 14px; margin-bottom:14px;
}

/* Settings rows */
.pg-settings-compact {
  background:var(--bg-muted);
  border:1px solid var(--border-light);
  border-radius:var(--radius-md);
  padding:12px;
  margin-bottom:10px;
}
.pg-settings-row {
  display:grid;
  grid-template-columns:1fr 1fr 1fr 1.6fr;
  gap:10px;
}
.pg-marks-compact-row {
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:10px;
  margin-top:10px;
  padding-top:10px;
  border-top:1px dashed var(--border-light);
}
.pg-sc-field { min-width:0; }
.pg-sc-field--wide { grid-column:span 1; }
.pg-field-label {
  font-size:11px; font-weight:700;
  color:var(--text-secondary);
  text-transform:uppercase; letter-spacing:.04em;
  margin-bottom:5px;
}
.pg-input, .pg-select {
  width:100%; box-sizing:border-box;
  padding:9px 12px;
  border:1.5px solid var(--border-light);
  border-radius:var(--radius-md);
  background:var(--bg-card);
  color:var(--text-primary);
  font-family:inherit; font-size:13px;
  outline:none; transition:.18s ease;
}
.pg-input:focus, .pg-select:focus {
  border-color:#1E40AF;
  box-shadow:0 0 0 3px rgba(30,64,175,.1);
}

.pg-fetch-hint {
  display:flex; align-items:center; gap:8px;
  font-size:11px; color:var(--text-muted);
  margin-bottom:8px; padding:0 2px;
}

.pg-fetch-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  padding:10px 24px;
  background:transparent;
  border:2px solid #1E40AF;
  border-radius:var(--radius-md);
  color:#1E40AF;
  font-family:inherit; font-size:13px; font-weight:700;
  cursor:pointer; transition:.18s ease;
  min-width:170px;
}
.pg-fetch-btn:hover { background:#1E40AF; color:#fff; box-shadow:0 2px 10px rgba(30,64,175,.25); }
.pg-fetch-btn:disabled { opacity:.5; cursor:not-allowed; }
.pg-fetch-btn:disabled:hover { background:transparent; color:#1E40AF; box-shadow:none; }

/* Marks tracker bars */
.pg-marks-bar {
  border:1.5px solid var(--border-light);
  border-radius:var(--radius-md);
  padding:10px 16px;
  display:flex; align-items:center; justify-content:space-between;
  gap:10px; flex-wrap:wrap;
  background:var(--bg-muted);
}
.pg-marks-label {
  font-size:12px; font-weight:700; color:var(--text-secondary);
  display:flex; align-items:center; gap:6px;
}
.pg-marks-status {
  font-size:12px; font-weight:600;
  padding:4px 12px; border-radius:999px;
}
.pg-marks-status.ok    { background:#DCFCE7; color:#16A34A; }
.pg-marks-status.over  { background:#FEE2E2; color:#DC2626; }
.pg-marks-status.under { background:#FEF9C3; color:#92400E; }

/* Obj/Subj tabs inside builder */
.pg-qtype-tabs {
  display:flex; gap:0;
  border:1.5px solid var(--border-light);
  border-radius:var(--radius-md);
  overflow:hidden;
}
.pg-qtype-tab {
  flex:1; padding:9px 14px;
  font-family:inherit; font-size:13px; font-weight:600;
  border:none; cursor:pointer;
  transition:.18s ease;
  background:var(--bg-muted); color:var(--text-muted);
  display:inline-flex; align-items:center; justify-content:center; gap:6px;
}
.pg-qtype-tab:hover { color:#1E40AF; }
.pg-qtype-tab.active { background:#1E40AF; color:#fff; }

.pg-section-label {
  font-size:11px; font-weight:700;
  text-transform:uppercase; letter-spacing:.06em;
  color:var(--text-muted);
  margin:14px 0 10px;
  padding-bottom:6px;
  border-bottom:1px solid var(--border-light);
}

/* Question-type block */
.pg-qblock {
  background:var(--bg-card);
  border:1px solid var(--border-light);
  border-radius:var(--radius-md);
  margin-bottom:8px;
  overflow:hidden;
  transition:border-color .18s;
}
.pg-qblock:hover { border-color:var(--border-med); }
.pg-qblock-header {
  display:flex; align-items:center; justify-content:space-between;
  padding:12px 14px;
  cursor:pointer; user-select:none;
}
.pg-qblock-title {
  font-size:13px; font-weight:700; color:var(--text-primary);
}
.pg-qblock-badge {
  font-size:11.5px; font-weight:700;
  padding:3px 9px; border-radius:999px;
}
.pg-qblock-body {
  padding:14px;
  border-top:1px solid var(--border-light);
  background:var(--bg-muted);
}

@media (max-width: 720px) {
  .pg-settings-row { grid-template-columns:1fr 1fr; }
  .pg-marks-compact-row { grid-template-columns:1fr 1fr; }
}
@media (max-width: 540px) {
  .pg-settings-row { grid-template-columns:1fr; }
  .pg-marks-compact-row { grid-template-columns:1fr; }
  .pg-modal-footer { justify-content:flex-end; }
}

[data-theme="dark"].pg-modal { background:var(--bg-card); }
[data-theme="dark"].pg-modal-header { background:var(--bg-card); }
[data-theme="dark"].pg-modal-footer { background:var(--bg-muted); }
[data-theme="dark"].pg-info-notice { background:rgba(59,130,246,.12); border-color:rgba(59,130,246,.3); }
[data-theme="dark"].pg-settings-compact { background:var(--bg-muted); }
[data-theme="dark"].pg-input, [data-theme="dark"].pg-select { background:var(--bg-card); color:var(--text-primary); }
[data-theme="dark"].pg-fetch-btn { border-color:#3B82F6; color:#3B82F6; }
[data-theme="dark"].pg-fetch-btn:hover { background:#3B82F6; color:#fff; }
[data-theme="dark"].pg-qblock { background:var(--bg-card); }
[data-theme="dark"].pg-qblock-body { background:var(--bg-muted); }
[data-theme="dark"].pg-qtype-tab { background:var(--bg-muted); color:var(--text-muted); }
[data-theme="dark"].pg-qtype-tab.active { background:#1E40AF; color:#fff; }

/* ═══════════════════════════════════════════════════════════════════
   QUESTION BUILDER — accordion tabs + side-by-side workspace
   ═══════════════════════════════════════════════════════════════════ */

/* Per-type config badge (accordion header summary) */
.pg-type-config-badge {
  display:inline-flex; align-items:center; gap:4px;
  padding:3px 10px;
  background:linear-gradient(135deg,#1E3A8A,#1D4ED8);
  color:#fff;
  font-size:10.5px; font-weight:700;
  border-radius:999px; white-space:nowrap;
  box-shadow:0 1px 4px rgba(30,58,138,.25);
}

/* qblock open body */
.pg-qblock-body { padding:10px 12px 12px; }
.pg-qblock-body.open { animation:fadeSlide .15s ease both; }

/* Marks bar status borders */
.pg-marks-bar.ok    { border-color:#86efac; background:#F0FDF4; }
.pg-marks-bar.over  { border-color:#fca5a5; background:#FEF2F2; }
.pg-marks-bar.under { border-color:#fde68a; background:#FFFBEB; }

/* Tab nav row */
.pg-qtab-nav {
  display:flex; align-items:center; gap:6px; flex-wrap:wrap;
  margin-bottom:10px; padding:10px 12px;
  background:var(--bg-muted); border-radius:var(--radius-md);
}
.pg-qtab-pill {
  display:inline-flex; align-items:center; gap:5px;
  padding:5px 12px;
  border:1.5px solid var(--border-light);
  border-radius:999px;
  background:var(--bg-card);
  color:var(--text-muted);
  font-family:inherit; font-size:12px; font-weight:600;
  cursor:pointer; transition:.18s ease; white-space:nowrap;
}
.pg-qtab-pill:hover { border-color:#1E40AF; color:#1E40AF; }
.pg-qtab-pill.active {
  background:#1E40AF; border-color:#1E40AF; color:#fff;
  box-shadow:0 2px 6px rgba(30,64,175,.25);
}
.pg-qtab-pill.saved:not(.active) { border-color:#16A34A; color:#16A34A; background:#F0FDF4; }
.pg-qtab-pill.saved.active { background:#1E40AF; }
.pg-qtab-close {
  display:inline-flex; align-items:center; justify-content:center;
  width:16px; height:16px; border-radius:50%;
  background:rgba(255,255,255,.25);
  font-size:12px; line-height:1; cursor:pointer; margin-left:2px;
  font-weight:700;
}
.pg-qtab-pill:not(.active) .pg-qtab-close {
  background:var(--bg-muted); color:var(--text-muted);
}
.pg-qtab-pill.active .pg-qtab-close:hover { background:rgba(255,255,255,.4); }
.pg-qtab-pill:not(.active) .pg-qtab-close:hover { background:#FECACA; color:#DC2626; }
.pg-qtab-add-btn {
  display:inline-flex; align-items:center; gap:5px;
  padding:5px 12px;
  border:1.5px dashed #1E40AF;
  border-radius:999px;
  background:transparent;
  color:#1E40AF;
  font-family:inherit; font-size:12px; font-weight:600;
  cursor:pointer; transition:.18s ease; white-space:nowrap;
}
.pg-qtab-add-btn:hover { background:#EFF6FF; }

/* Workspace container */
.pg-qworkspace {
  border:1.5px solid var(--border-light);
  border-radius:var(--radius-md);
  overflow:hidden; background:var(--bg-card);
  animation:fadeSlide .15s ease both;
  margin-top:6px;
}
.pg-qws-panel { display:block; }
.pg-qws-inner {
  display:flex; gap:0; min-height:240px;
}
.pg-qws-left {
  flex:0 0 46%;
  padding:14px;
  border-right:1px solid var(--border-light);
  overflow-y:auto; max-height:380px;
}
.pg-qws-right {
  flex:1; padding:14px;
  background:var(--bg-muted);
  overflow-y:auto; max-height:380px;
}
.pg-qws-section-label {
  font-size:10.5px; font-weight:700;
  text-transform:uppercase; letter-spacing:.06em;
  color:var(--text-muted);
  margin-bottom:8px;
  display:flex; align-items:center; gap:5px;
}
.pg-qws-right-empty {
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  color:var(--text-muted); font-size:12px;
  gap:8px; text-align:center; padding:20px; opacity:.6;
}

/* Unit rows */
.pg-unit-rows-container { display:flex; flex-direction:column; gap:5px; }
.pg-unit-row-wrap {
  border:1px solid var(--border-light);
  border-radius:var(--radius-md);
  overflow:hidden;
  transition:border-color .15s;
}
.pg-unit-row-wrap:has(.pg-unit-row.active) { border-color:#1E40AF; }
.pg-unit-row {
  display:flex; align-items:center; gap:8px;
  padding:9px 12px;
  cursor:pointer;
  background:var(--bg-card);
  transition:background .15s; user-select:none;
}
.pg-unit-row:hover { background:var(--bg-muted); }
.pg-unit-row.active { background:#EEF4FF; }
.pg-unit-row-dot {
  width:11px; height:11px; border-radius:50%;
  border:2px solid var(--border-med);
  flex-shrink:0; transition:all .15s;
}
.pg-unit-row-dot.active {
  background:#1E40AF; border-color:#1E40AF;
  box-shadow:0 0 0 2px rgba(30,58,138,.15);
}
.pg-unit-row-name {
  font-size:12.5px; font-weight:600;
  color:var(--text-primary); flex:1;
}
.pg-unit-chip-count {
  font-size:11px; font-weight:600;
  color:var(--text-muted);
  background:var(--bg-card);
  border:1px solid var(--border-light);
  padding:2px 8px; border-radius:999px;
}
.pg-unit-row.active + * .pg-unit-chip-count,
.pg-unit-row.active .pg-unit-chip-count {
  color:#1E40AF; border-color:#1E40AF; background:#EFF6FF;
}

/* Instruction cards inside an active unit */
.pg-unit-instr-list {
  padding:8px 10px 6px;
  background:var(--bg-muted);
  border-top:1px solid var(--border-light);
  display:flex; flex-direction:column; gap:5px;
}
.pg-instr-card {
  display:flex; align-items:flex-start; gap:8px;
  padding:8px 10px;
  border:1.5px solid var(--border-light);
  border-radius:var(--radius-sm);
  cursor:pointer; transition:all .15s;
  background:var(--bg-card);
}
.pg-instr-card:hover { border-color:#3B82F6; background:#EFF6FF; }
.pg-instr-card.active { border-color:#1E40AF; background:#EEF4FF; }
.pg-instr-card-radio {
  width:13px; height:13px; border-radius:50%;
  border:2px solid var(--border-med);
  flex-shrink:0; margin-top:2px; transition:all .15s;
}
.pg-instr-card.active .pg-instr-card-radio {
  border-color:#1E40AF; background:#1E40AF;
}
.pg-instr-card-body { flex:1; }
.pg-instr-card-text {
  font-size:12px; font-weight:600;
  color:var(--text-primary);
  margin-bottom:4px; line-height:1.4;
}
.pg-instr-card-meta { display:flex; gap:5px; flex-wrap:wrap; }
.pg-q-info-chip {
  font-size:11px; padding:4px 8px;
  border-radius:var(--radius-sm);
  font-weight:600;
}
.pg-q-info-chip.total     { background:#F0FDF4; color:#15803D; }
.pg-q-info-chip.available { background:#EFF6FF; color:#1E40AF; }

/* Eligible bar */
.pg-eligible-bar {
  display:flex; align-items:center; gap:8px;
  background:var(--bg-muted);
  border:1px solid var(--border-light);
  border-radius:var(--radius-sm);
  padding:8px 12px;
  margin-top:8px; font-size:12px;
}

/* Right config fields */
.pg-qws-fields {
  display:grid; grid-template-columns:1fr 1fr; gap:8px;
  margin-bottom:10px;
}
.pg-q-instruction, .pg-q-input {
  width:100%; box-sizing:border-box;
  padding:7px 10px;
  border:1.5px solid var(--border-light);
  border-radius:var(--radius-md);
  background:var(--bg-card);
  color:var(--text-primary);
  font-family:inherit; font-size:12.5px;
  outline:none; transition:.18s ease;
}
.pg-q-instruction:focus, .pg-q-input:focus {
  border-color:#1E40AF;
  box-shadow:0 0 0 3px rgba(30,64,175,.09);
}
.pg-q-field-label {
  font-size:10.5px; color:var(--text-muted);
  font-weight:700; text-transform:uppercase;
  letter-spacing:.04em; margin-bottom:3px;
}
.pg-q-calc {
  font-size:11.5px; color:#1E40AF;
  background:#EFF6FF;
  padding:5px 10px;
  border-radius:var(--radius-sm);
  font-weight:600; margin-top:4px;
}
.pg-q-warn {
  display:flex; align-items:center; gap:8px;
  background:#FEF2F2;
  border:1px solid #FECACA;
  border-radius:var(--radius-sm);
  padding:7px 10px;
  font-size:11.5px; font-weight:600;
  color:#DC2626; margin-top:6px;
}
.pg-q-warn i { font-size:12px; flex-shrink:0; }

/* Saved summary card */
.pg-qws-saved-card { padding:14px; animation:fadeSlide .2s ease both; }
.pg-qws-saved-header {
  display:flex; align-items:center; gap:12px;
  margin-bottom:10px; padding-bottom:10px;
  border-bottom:1px solid var(--border-light);
}
.pg-qws-saved-icon {
  width:32px; height:32px; border-radius:50%;
  background:linear-gradient(135deg,#16A34A,#15803D);
  color:#fff;
  display:flex; align-items:center; justify-content:center;
  font-size:13px; flex-shrink:0;
}
.pg-qws-edit-btn {
  display:inline-flex; align-items:center; gap:6px;
  padding:6px 14px;
  border:1.5px solid #1E40AF;
  border-radius:var(--radius-md);
  background:transparent; color:#1E40AF;
  font-family:inherit; font-size:12px; font-weight:600;
  cursor:pointer; transition:.18s ease; white-space:nowrap; flex-shrink:0;
}
.pg-qws-edit-btn:hover { background:#1E40AF; color:#fff; }
.pg-qws-saved-chips { display:flex; flex-wrap:wrap; gap:6px; }
.pg-qws-chip {
  display:inline-flex; align-items:center; gap:4px;
  padding:3px 9px; border-radius:999px;
  font-size:11px; font-weight:600;
}
.pg-qws-chip.blue  { background:#EFF6FF; color:#1E40AF; }
.pg-qws-chip.teal  { background:#ECFEFF; color:#0E7490; }
.pg-qws-chip.green { background:#F0FDF4; color:#15803D; }
.pg-qws-chip.amber { background:#FFFBEB; color:#B45309; }
.pg-qws-chip.gray  { background:var(--bg-muted); color:var(--text-muted); }

@keyframes fadeSlide {
  from { opacity:0; transform:translateY(-3px); }
  to   { opacity:1; transform:none; }
}

@media (max-width: 820px) {
  .pg-qws-inner { flex-direction:column; }
  .pg-qws-left  { flex:1 1 auto; border-right:none; border-bottom:1px solid var(--border-light); max-height:none; }
  .pg-qws-right { max-height:none; }
}
@media (max-width: 540px) {
  .pg-qws-fields { grid-template-columns:1fr 1fr; }
}

[data-theme="dark"].pg-qtab-nav { background:var(--bg-muted); }
[data-theme="dark"].pg-qtab-pill { background:var(--bg-card); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"].pg-qtab-pill:hover { border-color:#3B82F6; color:#3B82F6; }
[data-theme="dark"].pg-qtab-pill.active { background:#1E40AF; border-color:#1E40AF; color:#fff; }
[data-theme="dark"].pg-qworkspace { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"].pg-qws-right  { background:var(--bg-muted); }
[data-theme="dark"].pg-unit-row   { background:var(--bg-muted); }
[data-theme="dark"].pg-unit-row:hover  { background:rgba(59,130,246,.12); }
[data-theme="dark"].pg-unit-row.active { background:rgba(59,130,246,.18); }
[data-theme="dark"].pg-instr-card { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"].pg-instr-card:hover { border-color:#3B82F6; background:rgba(59,130,246,.12); }
[data-theme="dark"].pg-instr-card.active { border-color:#3B82F6; background:rgba(59,130,246,.18); }
[data-theme="dark"].pg-eligible-bar { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"].pg-q-instruction, [data-theme="dark"].pg-q-input { background:var(--bg-card); color:var(--text-primary); border-color:var(--border-light); }
[data-theme="dark"].pg-q-calc  { background:rgba(59,130,246,.15); color:#93C5FD; }
[data-theme="dark"].pg-q-warn  { background:rgba(220,38,38,.12); border-color:rgba(239,68,68,.3); color:#F87171; }
[data-theme="dark"].pg-qws-saved-card { background:var(--bg-card); }
[data-theme="dark"].pg-qws-chip.blue  { background:rgba(30,64,175,.2); color:#93C5FD; }
[data-theme="dark"].pg-qws-chip.teal  { background:rgba(14,116,144,.2); color:#67E8F9; }
[data-theme="dark"].pg-qws-chip.green { background:rgba(21,128,61,.2); color:#4ADE80; }
[data-theme="dark"].pg-qws-chip.amber { background:rgba(180,83,9,.2); color:#FCD34D; }
[data-theme="dark"].pg-qws-chip.gray  { background:var(--bg-muted); color:var(--text-muted); }
[data-theme="dark"].pg-marks-bar.ok    { background:rgba(34,197,94,.12); border-color:rgba(34,197,94,.3); }
[data-theme="dark"].pg-marks-bar.over  { background:rgba(220,38,38,.12); border-color:rgba(239,68,68,.3); }
[data-theme="dark"].pg-marks-bar.under { background:rgba(245,158,11,.12); border-color:rgba(245,158,11,.3); }

/* ═══════════════════════════════════════════════════════════════════
   DOWNLOAD MODAL — Print Style + File Format cards
   ═══════════════════════════════════════════════════════════════════ */
.pg-dl-grid {
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px;
  margin-bottom:14px;
}
.pg-dl-card {
  border:2px solid var(--border-light);
  border-radius:var(--radius-md);
  padding:14px;
  cursor:pointer;
  transition:.18s ease;
  text-align:center;
  background:var(--bg-card);
}
.pg-dl-card:hover { border-color:#3B82F6; box-shadow:0 1px 3px rgba(15,23,42,.06); }
.pg-dl-card.selected {
  border-color:#1E40AF;
  background:#EFF6FF;
  box-shadow:0 0 0 3px rgba(30,64,175,.12);
}
.pg-dl-card-icon { font-size:22px; margin-bottom:6px; }
.pg-dl-card-label { font-size:12.5px; font-weight:700; color:var(--text-primary); }
.pg-dl-card-desc  { font-size:11px;  color:var(--text-muted); margin-top:2px; }
/* Keyboard focus ring for radio-style download cards */
.pg-dl-card:focus-visible {
  outline:none;
  border-color:#1E40AF;
  box-shadow:0 0 0 3px rgba(30,64,175,.22);
}
[data-theme="dark"] .pg-dl-card:focus-visible {
  border-color:#3B82F6;
  box-shadow:0 0 0 3px rgba(59,130,246,.32);
}

@media (max-width: 520px) {
  .pg-dl-grid { grid-template-columns:1fr; gap:8px; }
  .pg-dl-card { padding:11px 12px; }
}

[data-theme="dark"].pg-dl-card { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"].pg-dl-card:hover { border-color:#3B82F6; }
[data-theme="dark"].pg-dl-card.selected { border-color:#3B82F6; background:rgba(59,130,246,.12); }
[data-theme="dark"].pg-dl-card-label { color:var(--text-primary); }
[data-theme="dark"].pg-dl-card-desc  { color:var(--text-muted); }

/* ═══════════════════════════════════════════════════════════════════
   DELETE CONFIRMATION DIALOG
   ═══════════════════════════════════════════════════════════════════ */
.pg-delete-overlay {
  position:fixed; inset:0;
  background:rgba(0,0,0,.45);
  backdrop-filter:blur(4px);
  z-index:9999;
  display:none;
  align-items:center; justify-content:center;
  padding:20px;
}
.pg-delete-overlay.open { display:flex; }
.pg-delete-dialog {
  background:#fff;
  border-radius:20px;
  width:100%; max-width:420px;
  padding:32px 28px 24px;
  box-shadow:0 30px 80px rgba(0,0,0,.22), 0 8px 24px rgba(0,0,0,.1);
  animation:pgDelIn .3s cubic-bezier(.34,1.2,.64,1) both;
  display:flex; flex-direction:column; align-items:center; gap:0;
}
@keyframes pgDelIn {
  from { opacity:0; transform:scale(.88) translateY(18px); }
  to   { opacity:1; transform:none; }
}
.pg-del-icon-wrap { margin-bottom:18px; }
.pg-del-icon-bg {
  width:64px; height:64px;
  border-radius:16px;
  background:#FEE2E2;
  display:flex; align-items:center; justify-content:center;
}
.pg-del-icon { font-size:26px; color:#DC2626; }
.pg-del-title {
  font-size:19px; font-weight:800; color:#111827;
  text-align:center; margin-bottom:8px;
  font-family:inherit;
}
.pg-del-subtitle {
  font-size:13px; color:#6B7280;
  text-align:center; line-height:1.55;
  margin-bottom:18px;
  font-family:inherit;
}
.pg-del-subtitle strong { color:#374151; }
.pg-del-detail-pill {
  width:100%;
  background:#F9FAFB;
  border:1.5px solid #E5E7EB;
  border-radius:10px;
  padding:12px 16px;
  font-size:13px; font-weight:600; color:#374151;
  text-align:center;
  margin-bottom:14px;
  letter-spacing:.01em;
}
.pg-del-warning {
  width:100%;
  background:#FEF2F2;
  border:1.5px solid #FECACA;
  border-radius:10px;
  padding:12px 14px;
  display:flex; align-items:flex-start; gap:10px;
  margin-bottom:24px;
}
.pg-del-warning span {
  font-size:12.5px; font-weight:500;
  color:#991B1B; line-height:1.5;
}
.pg-del-footer {
  display:flex; gap:12px; width:100%;
}
.pg-del-btn-cancel {
  flex:1; padding:13px;
  border:1.5px solid #D1D5DB;
  border-radius:12px;
  background:#fff; color:#374151;
  font-size:14px; font-weight:700;
  font-family:inherit;
  cursor:pointer; transition:all .15s;
}
.pg-del-btn-cancel:hover { background:#F9FAFB; border-color:#9CA3AF; }
.pg-del-btn-confirm {
  flex:1; padding:13px;
  border:none; border-radius:12px;
  background:linear-gradient(135deg,#DC2626,#B91C1C);
  color:#fff;
  font-size:14px; font-weight:700;
  font-family:inherit;
  cursor:pointer;
  display:flex; align-items:center; justify-content:center; gap:7px;
  transition:all .15s;
  box-shadow:0 4px 14px rgba(220,38,38,.35);
}
.pg-del-btn-confirm:hover {
  background:linear-gradient(135deg,#B91C1C,#991B1B);
  transform:translateY(-1px);
  box-shadow:0 6px 18px rgba(220,38,38,.45);
}

[data-theme="dark"].pg-delete-dialog { background:var(--bg-card); }
[data-theme="dark"].pg-del-title     { color:var(--text-primary); }
[data-theme="dark"].pg-del-subtitle  { color:var(--text-muted); }
[data-theme="dark"].pg-del-subtitle strong { color:var(--text-secondary); }
[data-theme="dark"].pg-del-detail-pill {
  background:var(--bg-muted);
  border-color:var(--border-light);
  color:var(--text-secondary);
}
[data-theme="dark"].pg-del-warning {
  background:rgba(220,38,38,.12);
  border-color:rgba(239,68,68,.3);
}
[data-theme="dark"].pg-del-warning span { color:#F87171; }
[data-theme="dark"].pg-del-btn-cancel {
  background:var(--bg-card);
  border-color:var(--border-light);
  color:var(--text-secondary);
}
[data-theme="dark"].pg-del-btn-cancel:hover {
  background:var(--bg-muted);
  border-color:var(--border-med);
}

/* ═══════════════════════════════════════════════════════════════════
   DARK MODE — Paper Generator coverage beyond the existing rules.
   Brand-gradient buttons + delete (red) buttons keep their look.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Top tabs (Paper Setup / Paper Generator) ─── */
[data-theme="dark"] .pg-card-head { background:linear-gradient(135deg,rgba(59,130,246,.06),transparent); border-bottom-color:var(--border-light); }
[data-theme="dark"] .pg-card-title { color:var(--text-primary); }
[data-theme="dark"] .pg-card-sub { color:var(--text-muted); }
[data-theme="dark"] .pg-section-label { color:var(--text-secondary); }
[data-theme="dark"] .pg-field-label,
[data-theme="dark"] .pg-q-field-label,
[data-theme="dark"] .pg-marks-label,
[data-theme="dark"] .pg-pp-marks-label { color:var(--text-secondary); }

/* ─── Tutorial button (page header) ─── */
[data-theme="dark"] .tutorial-btn,
[data-theme="dark"] .page-tutorial-btn { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .tutorial-btn:hover,
[data-theme="dark"] .page-tutorial-btn:hover { border-color:#3B82F6; color:#3B82F6; }

/* ─── Paper Setup — Template selector ─── */
[data-theme="dark"] .pg-tmpl-grid { background:transparent; }
[data-theme="dark"] .pg-tmpl-content { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .pg-tmpl-content:hover { border-color:var(--border-med); }
[data-theme="dark"] .pg-tmpl-content.selected { border-color:#3B82F6; background:linear-gradient(135deg,rgba(59,130,246,.12),rgba(37,99,235,.06)); }
[data-theme="dark"] .pg-tmpl-body { background:transparent; color:var(--text-primary); }
[data-theme="dark"] .pg-tmpl-top-strip { background:var(--bg-muted); }
[data-theme="dark"] .pg-tmpl-name { color:var(--text-primary); }
[data-theme="dark"] .pg-tmpl-desc { color:var(--text-muted); }
[data-theme="dark"] .pg-tmpl-name-bar { background:linear-gradient(90deg,#3B82F6,transparent); }
[data-theme="dark"] .pg-tmpl-badge { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }
[data-theme="dark"] .pg-tmpl-hbar { background:var(--border-light); }
[data-theme="dark"] .pg-tmpl-prev-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .pg-tmpl-prev-btn:hover { background:var(--bg-card); border-color:#3B82F6; color:#3B82F6; }

/* ─── Paper Setup — Class-wise Paper Format & Line Settings ─── */
[data-theme="dark"] .pg-global-defaults-row { color:var(--text-primary); }
[data-theme="dark"] .pg-global-defaults-controls { color:var(--text-secondary); }
[data-theme="dark"] .pg-global-lbl { color:var(--text-muted); }
[data-theme="dark"] .pg-seg { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .pg-seg-divider { background:var(--border-light); }
[data-theme="dark"] .pg-seg-btn { color:var(--text-muted); }
[data-theme="dark"] .pg-seg-btn:hover:not(.active) { background:var(--bg-card); color:var(--text-primary); }
[data-theme="dark"] .pg-seg-btn.active { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }

/* Per-class block in Paper Setup */
[data-theme="dark"] .pg-subj-class-block { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .pg-subj-class-block.open { background:var(--bg-card); }
[data-theme="dark"] .pg-subj-class-header { background:var(--bg-card); border-bottom-color:var(--border-light); }
[data-theme="dark"] .pg-subj-class-block.open .pg-subj-class-header { background:var(--bg-muted); }
[data-theme="dark"] .pg-subj-class-header-top { color:var(--text-primary); }
[data-theme="dark"] .pg-subj-class-name { color:var(--text-primary); }
[data-theme="dark"] .pg-subj-class-section { background:rgba(59,130,246,.15); color:#93C5FD; border-color:rgba(59,130,246,.3); }
[data-theme="dark"] .pg-subj-count-pill { background:var(--bg-muted); color:var(--text-secondary); border-color:var(--border-light); }
[data-theme="dark"] .pg-cls-chevron { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .pg-cls-chevron:hover { background:var(--bg-card); border-color:#3B82F6; color:#3B82F6; }
[data-theme="dark"] .pg-cls-defaults { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .pg-cls-chip { background:var(--bg-card); border-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .pg-cls-chip:hover:not(.active-fmt):not(.active-line) { background:var(--bg-muted); color:var(--text-primary); }
[data-theme="dark"] .pg-cls-chip.active-fmt,
[data-theme="dark"] .pg-cls-chip.active-line { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; border-color:transparent; }

/* Per-subject rows */
[data-theme="dark"] .pg-subj-rows { background:var(--bg-muted); border-top-color:var(--border-light); }
[data-theme="dark"] .pg-subj-row { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .pg-subj-row:hover { background:var(--bg-muted); }
[data-theme="dark"] .pg-subj-row-left { color:var(--text-primary); }
[data-theme="dark"] .pg-subj-icon { background:rgba(59,130,246,.12); color:#93C5FD; }
[data-theme="dark"] .pg-subj-name { color:var(--text-primary); }
[data-theme="dark"] .pg-subj-toggle-col { color:var(--text-secondary); }
[data-theme="dark"] .pg-subj-toggle-lbl { color:var(--text-muted); }
[data-theme="dark"] .pg-subj-toggle { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .pg-subj-toggle-btn { color:var(--text-muted); }
[data-theme="dark"] .pg-subj-toggle-btn:hover:not(.active-fmt):not(.active-line) { background:var(--bg-card); color:var(--text-primary); }
[data-theme="dark"] .pg-subj-toggle-btn.active-fmt,
[data-theme="dark"] .pg-subj-toggle-btn.active-line { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }

/* ─── Paper Generator — Class cards (Make Paper) ─── */
[data-theme="dark"] .pg-papers-grid-v2 { background:transparent; }
[data-theme="dark"] .pg-pc-strip { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .pg-pc-strip:hover { background:var(--bg-muted); }
[data-theme="dark"] .pg-pc-body { color:var(--text-primary); }
[data-theme="dark"] .pg-pc-icon { background:rgba(59,130,246,.12); color:#93C5FD; }
[data-theme="dark"] .pg-pc-title { color:var(--text-primary); }
[data-theme="dark"] .pg-pc-meta { color:var(--text-muted); }
[data-theme="dark"] .pg-pc-chips { background:transparent; }
[data-theme="dark"] .pg-pc-chip { background:var(--bg-muted); color:var(--text-secondary); border-color:var(--border-light); }
[data-theme="dark"] .pg-pc-fmt-badge { background:rgba(34,197,94,.15); color:#86EFAC; border-color:rgba(34,197,94,.3); }
[data-theme="dark"] .pg-pc-type-badge { background:rgba(124,58,237,.15); color:#C4B5FD; border-color:rgba(124,58,237,.3); }
[data-theme="dark"] .pg-pc-subject-row { color:var(--text-primary); border-bottom-color:var(--border-light); }
[data-theme="dark"] .pg-pc-subject { color:var(--text-primary); }
[data-theme="dark"] .pg-pc-count { color:var(--text-secondary); }
[data-theme="dark"] .pg-pc-actions { background:transparent; }
[data-theme="dark"] .pg-make-paper-btn { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }
[data-theme="dark"] .pg-make-paper-btn:hover { background:linear-gradient(135deg,#1E40AF,#3B82F6); }
[data-theme="dark"] .pg-paper-count { background:var(--bg-muted); color:var(--text-secondary); border-color:var(--border-light); }
[data-theme="dark"] .pg-paper-count.zero { background:var(--bg-card); color:var(--text-muted); }
[data-theme="dark"] .pg-chevron-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .pg-chevron-btn:hover { background:var(--bg-card); border-color:#3B82F6; color:#3B82F6; }

/* Subject colour chips */
[data-theme="dark"] .pg-pc-chip.eng,
[data-theme="dark"] .pg-subj-strip.eng { background:rgba(59,130,246,.18); color:#93C5FD; border-color:rgba(59,130,246,.3); }
[data-theme="dark"] .pg-pc-chip.urdu,
[data-theme="dark"] .pg-subj-strip.urdu { background:rgba(124,58,237,.18); color:#C4B5FD; border-color:rgba(124,58,237,.3); }
[data-theme="dark"] .pg-pc-chip.math,
[data-theme="dark"] .pg-subj-strip.math { background:rgba(217,119,6,.18); color:#FCD34D; border-color:rgba(217,119,6,.3); }
[data-theme="dark"] .pg-pc-chip.sci,
[data-theme="dark"] .pg-subj-strip.sci { background:rgba(34,197,94,.18); color:#86EFAC; border-color:rgba(34,197,94,.3); }
[data-theme="dark"] .pg-pc-chip.sst,
[data-theme="dark"] .pg-subj-strip.sst { background:rgba(225,29,72,.18); color:#FDA4AF; border-color:rgba(225,29,72,.3); }

/* ─── Modals (Make Paper / Edit / Preview / Download / Delete / Template Preview) ─── */
[data-theme="dark"] .pg-modal-overlay { background:rgba(0,0,0,.6); }
[data-theme="dark"] .pg-modal { background:var(--bg-card); border-color:var(--border-light); box-shadow:var(--shadow-xl); }
[data-theme="dark"] .pg-modal-header { background:linear-gradient(135deg,rgba(59,130,246,.06),transparent); border-bottom-color:var(--border-light); }
[data-theme="dark"] .pg-modal-title { color:var(--text-primary); }
[data-theme="dark"] .pg-modal-sub { color:var(--text-muted); }
[data-theme="dark"] .pg-modal-close { background:var(--bg-muted); color:var(--text-muted); }
[data-theme="dark"] .pg-modal-close:hover { background:rgba(220,38,38,.18); color:#FCA5A5; }
[data-theme="dark"] .pg-modal-body { background:var(--bg-card); color:var(--text-primary); }
[data-theme="dark"] .pg-btn-primary { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }
[data-theme="dark"] .pg-btn-primary:hover { background:linear-gradient(135deg,#1E40AF,#3B82F6); }
[data-theme="dark"] .pg-btn-secondary { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .pg-btn-secondary:hover { background:var(--bg-muted); border-color:var(--border-med); }

/* Make Paper — settings row + Fetch */
[data-theme="dark"] .pg-settings-row { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .pg-sc-field,
[data-theme="dark"] .pg-sc-field--wide { color:var(--text-primary); }
[data-theme="dark"] .pg-fetch-hint { color:var(--text-muted); }

/* Make Paper — Objective / Subjective tabs */
[data-theme="dark"] .pg-qtype-tabs { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .pg-marks-compact-row { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .pg-marks-status.complete { color:#86EFAC; }
[data-theme="dark"] .pg-marks-status.incomplete { color:#FCD34D; }
[data-theme="dark"] .pg-marks-status.over { color:#FCA5A5; }

/* Question block tabs (qtab-) inside Make Paper */
[data-theme="dark"] .pg-qblock-header { background:var(--bg-muted); border-bottom-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .pg-qblock-title { color:var(--text-primary); }
[data-theme="dark"] .pg-qblock-badge { background:rgba(59,130,246,.15); color:#93C5FD; border-color:rgba(59,130,246,.3); }
[data-theme="dark"] .pg-qtab-add-btn { background:rgba(59,130,246,.12); color:#93C5FD; border-color:rgba(59,130,246,.3); }
[data-theme="dark"] .pg-qtab-add-btn:hover { background:rgba(59,130,246,.2); border-color:#3B82F6; }
[data-theme="dark"] .pg-qtab-close { color:var(--text-muted); }
[data-theme="dark"] .pg-qtab-close:hover { color:#FCA5A5; }

/* Question-block working area (qws-) and saved state */
[data-theme="dark"] .pg-qws-panel { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .pg-qws-inner { background:transparent; }
[data-theme="dark"] .pg-qws-left,
[data-theme="dark"] .pg-qws-right-empty { color:var(--text-primary); }
[data-theme="dark"] .pg-qws-section-label { color:var(--text-secondary); }
[data-theme="dark"] .pg-qws-fields { color:var(--text-primary); }
[data-theme="dark"] .pg-qws-saved-card { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .pg-qws-saved-header { color:var(--text-primary); }
[data-theme="dark"] .pg-qws-saved-icon { background:rgba(34,197,94,.15); color:#86EFAC; }
[data-theme="dark"] .pg-qws-saved-chips { color:var(--text-secondary); }
[data-theme="dark"] .pg-qws-edit-btn { background:rgba(59,130,246,.12); color:#93C5FD; border-color:rgba(59,130,246,.3); }
[data-theme="dark"] .pg-qws-edit-btn:hover { background:rgba(59,130,246,.2); border-color:#3B82F6; }
[data-theme="dark"] .pg-q-info-chip { background:var(--bg-card); color:var(--text-secondary); border-color:var(--border-light); }
[data-theme="dark"] .pg-q-info-chip.total { background:rgba(59,130,246,.12); color:#93C5FD; border-color:rgba(59,130,246,.3); }
[data-theme="dark"] .pg-q-info-chip.available { background:rgba(34,197,94,.12); color:#86EFAC; border-color:rgba(34,197,94,.3); }
[data-theme="dark"] .pg-type-config-badge { background:rgba(124,58,237,.15); color:#C4B5FD; border-color:rgba(124,58,237,.3); }

/* Make Paper — unit selector */
[data-theme="dark"] .pg-unit-rows-container { background:transparent; border-color:var(--border-light); }
[data-theme="dark"] .pg-unit-row-wrap { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .pg-unit-row { background:var(--bg-card); color:var(--text-primary); }
[data-theme="dark"] .pg-unit-row.active { background:linear-gradient(135deg,rgba(59,130,246,.18),rgba(37,99,235,.10)); border-color:#3B82F6; }
[data-theme="dark"] .pg-unit-row-dot { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .pg-unit-row-dot.active { background:#3B82F6; border-color:#3B82F6; }
[data-theme="dark"] .pg-unit-row-name { color:var(--text-primary); }
[data-theme="dark"] .pg-unit-chip-count { background:var(--bg-muted); color:var(--text-secondary); border-color:var(--border-light); }
[data-theme="dark"] .pg-unit-instr-list { background:var(--bg-muted); border-top-color:var(--border-light); }
[data-theme="dark"] .pg-instr-card { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .pg-instr-card:hover { background:var(--bg-muted); border-color:var(--border-med); }
[data-theme="dark"] .pg-instr-card.active { background:linear-gradient(135deg,rgba(59,130,246,.18),rgba(37,99,235,.10)); border-color:#3B82F6; }
[data-theme="dark"] .pg-instr-card-radio { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .pg-instr-card.active .pg-instr-card-radio { background:#3B82F6; border-color:#3B82F6; }
[data-theme="dark"] .pg-instr-card-body { color:var(--text-primary); }
[data-theme="dark"] .pg-instr-card-text { color:var(--text-primary); }
[data-theme="dark"] .pg-instr-card-meta { color:var(--text-muted); }

/* Preview modal — colour mode toggles + paper preview */
[data-theme="dark"] .pg-toggle-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .pg-toggle-btn:hover:not(.active) { background:var(--bg-card); color:var(--text-primary); }
[data-theme="dark"] .pg-toggle-btn.active { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; border-color:transparent; }
[data-theme="dark"] .pg-paper-preview-box { background:#F8FAFC; }   /* keep paper on white so it looks like real paper */
[data-theme="dark"] .pg-pp-formal-wrap { background:#fff; color:#0F172A; }
[data-theme="dark"] .pg-pp-formal-top,
[data-theme="dark"] .pg-pp-formal-school-block,
[data-theme="dark"] .pg-pp-formal-board-tag,
[data-theme="dark"] .pg-pp-formal-divider,
[data-theme="dark"] .pg-pp-formal-exam-title,
[data-theme="dark"] .pg-pp-formal-field-label,
[data-theme="dark"] .pg-pp-formal-field-line,
[data-theme="dark"] .pg-pp-formal-meta-grid,
[data-theme="dark"] .pg-pp-formal-meta-label,
[data-theme="dark"] .pg-pp-formal-obtained-cell,
[data-theme="dark"] .pg-pp-formal-obtained-row,
[data-theme="dark"] .pg-pp-formal-seal,
[data-theme="dark"] .pg-pp-formal-seal-inner,
[data-theme="dark"] .pg-pp-formal-student-grid,
[data-theme="dark"] .pg-pp-marks-grid,
[data-theme="dark"] .pg-pp-marks-label,
[data-theme="dark"] .pg-pp-student-field,
[data-theme="dark"] .pg-pp-answer-lines-single,
[data-theme="dark"] .pg-pp-answer-lines-four { color:#0F172A; }   /* paper content stays dark-on-white */

/* Download modal — print style + format cards */
[data-theme="dark"] .pg-dl-grid { background:transparent; }
[data-theme="dark"] .pg-dl-card { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .pg-dl-card:hover { background:var(--bg-card); border-color:var(--border-med); }
[data-theme="dark"] .pg-dl-card.selected { background:linear-gradient(135deg,rgba(59,130,246,.18),rgba(37,99,235,.10)); border-color:#3B82F6; }
[data-theme="dark"] .pg-dl-card-icon { background:transparent; }
[data-theme="dark"] .pg-dl-card-label { color:var(--text-primary); }
[data-theme="dark"] .pg-dl-card-desc { color:var(--text-muted); }

/* Delete confirmation modal */
[data-theme="dark"] .pg-delete-overlay { background:rgba(0,0,0,.6); }
[data-theme="dark"] .pg-del-icon-wrap { background:transparent; }
[data-theme="dark"] .pg-del-icon-bg { background:rgba(220,38,38,.15); }
[data-theme="dark"] .pg-del-icon { color:#FCA5A5; }
[data-theme="dark"] .pg-del-footer { background:var(--bg-muted); border-top-color:var(--border-light); }
[data-theme="dark"] .pg-del-btn-confirm { background:linear-gradient(135deg,#DC2626,#B91C1C); color:#fff; }

/* Template preview modal */
[data-theme="dark"] .pg-tmpl-prev-overlay { background:rgba(0,0,0,.6); }
[data-theme="dark"] .pg-tmpl-prev-modal { background:var(--bg-card); border-color:var(--border-light); box-shadow:var(--shadow-xl); }
[data-theme="dark"] .pg-tmpl-prev-header { background:linear-gradient(135deg,rgba(59,130,246,.06),transparent); border-bottom-color:var(--border-light); }
[data-theme="dark"] .pg-tmpl-prev-title { color:var(--text-primary); }
[data-theme="dark"] .pg-tmpl-prev-footer { background:var(--bg-muted); border-top-color:var(--border-light); }

/* Per-paper action icons — Shuffle / Edit / View / Download / Delete */
[data-theme="dark"] .pg-action-icon { background:var(--bg-card); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .pg-action-icon:hover { box-shadow:var(--shadow-sm); }
[data-theme="dark"] .pg-action-icon.shuffle:hover  { color:#C4B5FD; border-color:#7C3AED; background:rgba(124,58,237,.15); }
[data-theme="dark"] .pg-action-icon.edit:hover     { color:#93C5FD; border-color:#3B82F6; background:rgba(59,130,246,.15); }
[data-theme="dark"] .pg-action-icon.view:hover     { color:#22D3EE; border-color:#0891B2; background:rgba(8,145,178,.15); }
[data-theme="dark"] .pg-action-icon.download:hover { color:#86EFAC; border-color:#16A34A; background:rgba(34,197,94,.15); }
[data-theme="dark"] .pg-action-icon.delete:hover   { color:#FCA5A5; border-color:#DC2626; background:rgba(220,38,38,.15); }

/* Saved-state pill (e.g. on question block tabs) */
[data-theme="dark"] .pg-qtab-pill.saved::after { background:#86EFAC; }
[data-theme="dark"] .saved { color:#86EFAC; }

/* ═══════════════════════════════════════════════════════════════════
   DARK MODE — patch for hardcoded inline-style overrides
   Inline style={{}} beats normal CSS, so these rules use !important to
   override the light hex colours/backgrounds left in JSX. Targets the
   small chips, badges, icons and accent borders that were still showing
   their light-mode colours on dark backgrounds.
   Paper template previews (ClassicHeader / ModernHeader / FormalHeader /
   TemplatePreview / PaperViewModal preview area) are intentionally NOT
   targeted — those mimic real printed paper and must stay light.
   ═══════════════════════════════════════════════════════════════════ */

/* — Class section badge inside .pg-class-row (Generator tab rows) — */
[data-theme="dark"] .pg-section-badge-inline {
  background: rgba(59,130,246,.18) !important;
  color: #93C5FD !important;
  border-color: rgba(59,130,246,.32) !important;
}

/* — Obj/Subj chips inside .pg-paper-card-v2 (inline-styled in JSX) — */
[data-theme="dark"] .pg-pc-chip[style*="EFF6FF"],
[data-theme="dark"] .pg-pc-chip[style*="#1E40AF"] {
  background: rgba(59,130,246,.18) !important;
  color: #93C5FD !important;
  border-color: rgba(59,130,246,.3) !important;
}
[data-theme="dark"] .pg-pc-chip[style*="ECFEFF"],
[data-theme="dark"] .pg-pc-chip[style*="#0E7490"] {
  background: rgba(8,145,178,.18) !important;
  color: #67E8F9 !important;
  border-color: rgba(8,145,178,.3) !important;
}

/* — Paper card outer container — JS sets inline border via :hover, but
     the base background is class-driven. Reinforce here so the card body
     stays dark even when child inline styles paint light tints. — */
[data-theme="dark"] .pg-paper-card-v2 {
  background: var(--bg-card) !important;
  border-color: var(--border-light) !important;
  color: var(--text-primary) !important;
}
[data-theme="dark"] .pg-paper-card-v2:hover { border-color: #3B82F6 !important; }
[data-theme="dark"] .pg-pc-body { background: transparent !important; color: var(--text-primary) !important; }
[data-theme="dark"] .pg-pc-subject { color: var(--text-primary) !important; }
[data-theme="dark"] .pg-pc-title    { color: var(--text-secondary) !important; }

/* — Subject-icon tile (PG_SUBJ_TILE light bg overrides) — */
[data-theme="dark"] .pg-pc-icon[style*="EFF6FF"]  { background: rgba(59,130,246,.18) !important; color: #93C5FD !important; }
[data-theme="dark"] .pg-pc-icon[style*="FDF4FF"]  { background: rgba(124,58,237,.18) !important; color: #C4B5FD !important; }
[data-theme="dark"] .pg-pc-icon[style*="FFF7ED"]  { background: rgba(217,119,6,.18) !important; color: #FCD34D !important; }
[data-theme="dark"] .pg-pc-icon[style*="F0FDF4"]  { background: rgba(34,197,94,.18) !important; color: #86EFAC !important; }
[data-theme="dark"] .pg-pc-icon[style*="FFFBEB"]  { background: rgba(180,83,9,.18)  !important; color: #FCD34D !important; }

/* — Type badge (Obj / Subj / Obj+Subj inline-styled) — */
[data-theme="dark"] .pg-pc-type-badge[style*="EFF6FF"] { background: rgba(59,130,246,.18) !important; color: #93C5FD !important; }
[data-theme="dark"] .pg-pc-type-badge[style*="ECFEFF"] { background: rgba(8,145,178,.18) !important; color: #67E8F9 !important; }
[data-theme="dark"] .pg-pc-type-badge[style*="F5F3FF"] { background: rgba(124,58,237,.18) !important; color: #C4B5FD !important; }

/* — Format badge (With / Without Answer Sheet inline-styled) — */
[data-theme="dark"] .pg-pc-fmt-badge[style*="F0FDF4"] { background: rgba(34,197,94,.18) !important; color: #86EFAC !important; }
[data-theme="dark"] .pg-pc-fmt-badge[style*="FFFBEB"] { background: rgba(217,119,6,.18) !important; color: #FCD34D !important; }

/* — Subject-row bottom border inside paper card — */
[data-theme="dark"] .pg-pc-subject-row { border-bottom-color: var(--border-light) !important; }

/* — Make Paper modal — info notice + form section now activate via the
     selector swap above; reinforce text + field colours here. — */
[data-theme="dark"] .pg-info-notice {
  background: rgba(59,130,246,.10) !important;
  border-color: rgba(59,130,246,.30) !important;
  color: var(--text-secondary) !important;
}
[data-theme="dark"] .pg-info-notice > div { color: var(--text-secondary) !important; }
[data-theme="dark"] .pg-settings-compact {
  background: var(--bg-muted) !important;
  border-color: var(--border-light) !important;
  color: var(--text-primary) !important;
}
[data-theme="dark"] .pg-field-label,
[data-theme="dark"] .pg-sc-field .pg-field-label {
  color: var(--text-secondary) !important;
}
[data-theme="dark"] .pg-input,
[data-theme="dark"] .pg-select {
  background: var(--input-bg, var(--bg-card)) !important;
  color: var(--text-primary) !important;
  border-color: var(--border-light) !important;
}
[data-theme="dark"] .pg-input::placeholder { color: var(--text-muted) !important; }
[data-theme="dark"] .pg-input:focus,
[data-theme="dark"] .pg-select:focus { border-color: #3B82F6 !important; }
[data-theme="dark"] .pg-select option { background: var(--bg-card) !important; color: var(--text-primary) !important; }

/* — Info-notice strong text colour ("How paper generation works:") — */
[data-theme="dark"] .pg-info-notice strong { color: #93C5FD !important; }
[data-theme="dark"] .pg-info-notice > i.fa-solid { color: #93C5FD !important; }

/* — Header / section-title icons inside .section-card cards — */
[data-theme="dark"] .pg-card-title > i.fa-solid { color: #93C5FD !important; }

/* — Icons inside the Generator tab class rows — */
[data-theme="dark"] .pg-class-row > div > i.fa-school { color: #93C5FD !important; }
[data-theme="dark"] .pg-class-row > div > i.fa-sitemap { color: var(--text-muted) !important; }

/* — Icons inside Paper Setup subject-class headers — */
[data-theme="dark"] .pg-subj-class-header i.fa-school { color: #93C5FD !important; }

/* — Modal headings icons (Make Paper modal section labels) — */
[data-theme="dark"] .pg-qws-section-label i.fa-layer-group,
[data-theme="dark"] .pg-qws-section-label i.fa-sliders { color: #93C5FD !important; }

/* — Lightbulb / circle-info hint icons that were ambered/blued inline — */
[data-theme="dark"] .pg-fetch-hint i.fa-lightbulb,
[data-theme="dark"] .pg-qws-fields i.fa-lightbulb,
[data-theme="dark"] .pg-qws-right i.fa-lightbulb { color: #FCD34D !important; }
[data-theme="dark"] .pg-qws-left i.fa-circle-info,
[data-theme="dark"] .pg-modal-body i.fa-circle-info { color: #93C5FD !important; }

/* — Eligible bar success icon stays green (good in dark) — */
[data-theme="dark"] .pg-eligible-bar i.fa-check-circle { color: #4ADE80 !important; }

/* — Download modal — icon colours per format card — */
[data-theme="dark"] .pg-dl-card-icon[style*="#1E40AF"] { color: #93C5FD !important; }
[data-theme="dark"] .pg-dl-card-icon[style*="#374151"] { color: #CBD5E1 !important; }
[data-theme="dark"] .pg-dl-card-icon[style*="#DC2626"] { color: #FCA5A5 !important; }

/* — Delete confirmation dialog — meta-row icons — */
[data-theme="dark"] .pg-delete-dialog i.fa-school,
[data-theme="dark"] .pg-delete-dialog i.fa-file-lines { color: var(--text-muted) !important; }
[data-theme="dark"] .pg-delete-dialog i.fa-triangle-exclamation { color: #FCA5A5 !important; }

/* — Inline "select-units hint" card (line 1504 — div with inline blue
     border-left) is hard to target by class. Use parent + attribute. — */
[data-theme="dark"] .pg-qws-left > div[style*="border-left"] {
  background: var(--bg-muted) !important;
  border-left-color: #3B82F6 !important;
  color: var(--text-muted) !important;
}
[data-theme="dark"] .pg-qws-left > div[style*="border-left"] strong { color: var(--text-primary) !important; }

/* — Right-empty workspace placeholder text colour — */
[data-theme="dark"] .pg-qws-right-empty i.fa-arrow-left { color: var(--text-muted) !important; opacity: .6 !important; }

/* — Marks-fetch / chart-bar small icons used in QBlockAccordion — */
[data-theme="dark"] .pg-qblock i.fa-chart-bar { color: #93C5FD !important; }

/* ═══════════════════════════════════════════════════════════════════
   MOBILE RESPONSIVE — internal PaperGenerator screens (≤ 600px)
   Add-only. Per-paper formal-board preview / signed-letter / 80mm /
   print CSS deliberately untouched.
   ═══════════════════════════════════════════════════════════════════ */
@media (max-width: 600px) {
  /* Page header — stack */
  .page-header { flex-direction: column; align-items: stretch; gap: 10px; margin-bottom: 14px; }
  .page-title { font-size: 20px; }
  .page-title-icon { width: 40px; height: 40px; font-size: 17px; }

  /* Top tabs (Saved Papers / Question Bank / Templates / Settings) — scroll */
  .pg-tabs-row { overflow-x: auto; flex-wrap: nowrap; scrollbar-width: none; -ms-overflow-style: none; gap: 4px; padding: 4px; }
  .pg-tabs-row::-webkit-scrollbar { display: none; }
  .pg-tabs-row > * { flex: 0 0 auto; white-space: nowrap; font-size: 12px; padding: 8px 12px; }

  /* Saved papers grid — 1 col */
  .pg-papers-grid-v2 { grid-template-columns: 1fr !important; gap: 10px; }
  .pg-paper-card-v2 { padding: 14px 12px; }
  .pg-pc-subject-row,
  .pg-pc-chips { flex-wrap: wrap; gap: 6px; }
  .pg-pc-actions { flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
  .pg-pc-actions > .pg-action-icon { width: 32px; height: 32px; font-size: 13px; }
  .pg-pc-title { font-size: 13.5px; }
  .pg-pc-subject { font-size: 12px; }
  .pg-pc-meta { font-size: 11px; flex-wrap: wrap; gap: 4px 8px; }
  .pg-pc-count { font-size: 11px; }

  /* Question Bank list — class/subject rows */
  .pg-class-table-head { display: none !important; }
  .pg-class-row { padding: 12px; flex-wrap: wrap; gap: 8px; }
  .pg-cls-defaults { flex-wrap: wrap; gap: 6px; }
  .pg-subj-class-header { flex-direction: column; align-items: stretch; gap: 8px; padding: 12px; }
  .pg-subj-class-header-top { flex-wrap: wrap; gap: 8px; }
  .pg-subj-rows { gap: 6px; }
  .pg-subj-row { flex-wrap: wrap; gap: 8px; padding: 10px 12px; }
  .pg-subj-row-left { flex: 1 1 100%; min-width: 0; }
  .pg-subj-name { font-size: 13px; }
  .pg-subj-toggle-col { flex-wrap: wrap; gap: 6px; }

  /* Question workspace (qws) — preview pane full-width */
  .pg-qws-panel { padding: 12px; }
  .pg-qws-inner { grid-template-columns: 1fr !important; gap: 12px; }
  .pg-qws-left, .pg-qws-right { width: 100%; }
  .pg-qws-fields { grid-template-columns: 1fr !important; gap: 10px; }
  .pg-qws-saved-card { padding: 12px; }
  .pg-qws-saved-header { flex-wrap: wrap; gap: 6px; }
  .pg-qws-saved-chips { flex-wrap: wrap; gap: 4px; }

  /* Question block (qblock) header + types */
  .pg-qblock { padding: 10px; }
  .pg-qblock-header { flex-wrap: wrap; gap: 8px; padding: 10px 12px; }
  .pg-qblock-title { font-size: 13px; }
  .pg-qtype-tabs { overflow-x: auto; flex-wrap: nowrap; scrollbar-width: none; -ms-overflow-style: none; gap: 4px; padding: 4px; }
  .pg-qtype-tabs::-webkit-scrollbar { display: none; }
  .pg-qtype-tabs > * { flex: 0 0 auto; white-space: nowrap; font-size: 12px; padding: 7px 11px; }
  .pg-qtab-nav { overflow-x: auto; flex-wrap: nowrap; scrollbar-width: none; -ms-overflow-style: none; gap: 4px; }
  .pg-qtab-nav::-webkit-scrollbar { display: none; }
  .pg-qtab-nav > * { flex: 0 0 auto; white-space: nowrap; }

  /* Template grid — 1 col */
  .pg-tmpl-grid { grid-template-columns: 1fr !important; gap: 10px; }
  .pg-tmpl-body { padding: 14px 12px; }
  .pg-tmpl-content { gap: 8px; }
  .pg-tmpl-name { font-size: 13.5px; }
  .pg-tmpl-desc { font-size: 11.5px; }
  .pg-tmpl-prev-header { padding: 12px 14px; }
  .pg-tmpl-prev-body { padding: 14px; }
  .pg-tmpl-prev-footer { padding: 12px 14px; flex-wrap: wrap; gap: 8px; }
  .pg-tmpl-prev-footer > * { flex: 1 1 auto; }

  /* Download grid */
  .pg-dl-grid { grid-template-columns: 1fr 1fr !important; gap: 8px; }
  .pg-dl-card-label { font-size: 11.5px; }
  .pg-dl-card-desc { font-size: 10.5px; }

  /* Settings rows */
  .pg-settings-row { flex-wrap: wrap; gap: 8px; padding: 10px 12px; }
  .pg-global-defaults-row { flex-wrap: wrap; gap: 8px; }
  .pg-global-defaults-controls { flex-wrap: wrap; gap: 8px; width: 100%; }

  /* Instruction cards */
  .pg-instr-card-body { flex-wrap: wrap; gap: 8px; padding: 10px; }
  .pg-instr-card-meta { flex-wrap: wrap; gap: 6px; }

  /* Unit instructions list */
  .pg-unit-rows-container { gap: 6px; }
  .pg-unit-row-wrap { flex-wrap: wrap; gap: 6px; padding: 8px 10px; }
  .pg-unit-instr-list { gap: 6px; }
  .pg-unit-row-name { font-size: 12px; }

  /* Compact marks rows */
  .pg-marks-compact-row { flex-wrap: wrap; gap: 6px; }

  /* Modals — slim padding */
  .pg-modal { max-width: 96vw !important; max-height: 95dvh; }
  .pg-modal-header { padding: 12px 14px; flex-wrap: wrap; gap: 8px; }
  .pg-modal-title { font-size: 14px; }
  .pg-modal-sub { font-size: 11px; }
  .pg-modal-body { padding: 14px !important; }
  .pg-modal-footer { padding: 12px 14px; flex-wrap: wrap; gap: 8px; }
  .pg-modal-footer > * { flex: 1 1 auto; min-width: 0; }
  .pg-btn-primary,
  .pg-btn-secondary { padding: 10px 14px; font-size: 13px; }
  .pg-modal-footer > .pg-btn-primary { width: 100%; flex: 1 1 100%; }

  /* Paper preview box — full width, scroll wide content */
  .pg-paper-preview-box { padding: 12px; overflow-x: auto; -webkit-overflow-scrolling: touch; }

  /* Eligible bar */
  .pg-eligible-bar { flex-wrap: wrap; gap: 6px; padding: 10px 12px; font-size: 11.5px; }

  /* Fetch / make paper CTA */
  .pg-fetch-btn,
  .pg-make-paper-btn { width: 100%; justify-content: center; }
  .pg-fetch-hint { font-size: 11px; }

  /* Section card */
  .section-card { border-radius: 12px; }

  /* Tutorial button on header — match Academics / Examination pattern */
  .page-title-row { flex-direction: column; align-items: flex-start; gap: 8px; width: 100%; }
  .tutorial-btn.page-tutorial-btn {
    width: 100%;
    justify-content: center;
    padding: 8px 12px;
    font-size: 12px;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   MOBILE RESPONSIVE — Paper Generator (≤ 767px)
   Pure CSS, no JSX/logic changes. Targets exact classNames from JSX:
     .pg-tabs-row + .pg-tab           — main 2-tab strip
     .pg-tmpl-grid + .pg-tmpl-card    — template preview cards
     .pg-global-defaults-controls     — Global Default segment row
     .pg-subj-class-block / -header   — class-wise format card
   Inserted AFTER the existing (max-width: 600px) block so these rules
   override conflicting earlier mobile rules. Desktop (≥ 1024 px) and
   tablet (768–1023 px) are untouched.
   ═══════════════════════════════════════════════════════════════════ */
@media (max-width: 767px) {

  /* ─── FIX 1 — MAIN TABS (Paper Setup / Paper Generator) ───
     Desktop has display: grid + grid-template-columns: 1fr 1fr (line
     2702). Existing 820px mobile rule at line 2825 sets it to
     grid-template-columns: 1fr which stacks them vertically. Override
     here: switch to flex row so the 2 tabs sit side-by-side, compact. */
  .pg-tabs-row {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    width: 100% !important;
    gap: 4px !important;
    padding: 4px !important;
    grid-template-columns: none !important;
    overflow: visible !important;
  }
  .pg-tab {
    flex: 1 1 0 !important;
    min-width: 0 !important;
    padding: 8px 12px !important;
    font-size: 13px !important;
    height: auto !important;
    min-height: unset !important;
    text-align: center !important;
    white-space: nowrap !important;
    justify-content: center !important;
  }

  /* ─── FIX 2 — TEMPLATE PREVIEW CARDS (horizontal scroll) ───
     Each .pg-tmpl-card becomes a 75vw snap-card so users can swipe
     through templates instead of stacking them all vertically. */
  .pg-tmpl-grid {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    overflow-x: auto !important;
    overflow-y: visible !important;
    -webkit-overflow-scrolling: touch !important;
    scrollbar-width: none !important;
    gap: 12px !important;
    padding-bottom: 8px !important;
    scroll-snap-type: x mandatory !important;
    grid-template-columns: none !important;
  }
  .pg-tmpl-grid::-webkit-scrollbar { display: none !important; }
  .pg-tmpl-card {
    flex-shrink: 0 !important;
    width: 75vw !important;
    max-width: 300px !important;
    scroll-snap-align: start !important;
  }

  /* ─── FIX 3 — GLOBAL DEFAULT row ───
     Layout achieved via flex-wrap:
       Row 1: .pg-global-lbl + first .pg-seg (With Sheet + No Sheet)
       Row 2: second .pg-seg (Single + Four Line)
     The .pg-seg-divider is forced to wrap (full-width zero-height
     spacer) so the second .pg-seg drops to its own row.
     The full .pg-global-defaults-row also stacks vertically:
       title block on top, controls below. */
  .pg-global-defaults-row {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 8px !important;
    width: 100% !important;
  }
  .pg-global-defaults-controls {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    gap: 6px !important;
    width: 100% !important;
  }
  .pg-global-defaults-controls .pg-global-lbl {
    font-size: 11px !important;
    white-space: nowrap !important;
    flex: 0 0 auto !important;
    margin-right: 4px;
  }
  /* First .pg-seg (Sheet toggle) — takes remaining row 1 width */
  .pg-global-defaults-controls .pg-seg {
    flex: 1 1 0 !important;
    min-width: 0 !important;
    display: flex !important;
    flex-direction: row !important;
    gap: 6px !important;
  }
  /* Divider forces row 2 by becoming a full-width zero-height spacer */
  .pg-global-defaults-controls .pg-seg-divider {
    flex: 1 1 100% !important;
    width: 100% !important;
    height: 0 !important;
    background: transparent !important;
    margin: 0 !important;
  }
  /* All .pg-seg-btn (With Sheet / No Sheet / Single / Four Line) share row width */
  .pg-global-defaults-controls .pg-seg-btn {
    flex: 1 1 0 !important;
    min-width: 0 !important;
    width: 0 !important;
    padding: 6px 10px !important;
    font-size: 12px !important;
    justify-content: center !important;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ─── FIX 4 — CLASS-WISE PAPER FORMAT CARD ───
     Layout target:
       Row 1: school icon + class name + section badge + count pill +
              chevron — all in one inline row (icon left, chevron right)
       Row 2: Default: label + 4 chip buttons wrapped neatly
     The desktop .pg-subj-class-header is a flex column wrapping
     .pg-subj-class-header-top (top row) and .pg-cls-defaults (bottom).
     We override the 600px rules that stacked these. */
  .pg-subj-class-block {
    border-radius: 10px;
    margin-bottom: 8px !important;
    overflow: visible !important;
  }
  .pg-subj-class-header {
    display: flex !important;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 8px !important;
    padding: 10px 12px !important;
    min-height: unset !important;
    height: auto !important;
  }
  /* Top row — school icon + class + section + count + chevron ONE row */
  .pg-subj-class-header-top {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    align-items: center !important;
    gap: 6px !important;
    width: 100% !important;
  }
  .pg-subj-class-header-top .pg-subj-class-name {
    font-size: 13.5px !important;
    flex-shrink: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pg-subj-class-header-top .pg-subj-class-section,
  .pg-subj-class-header-top .pg-subj-count-pill {
    flex-shrink: 0 !important;
    font-size: 10px !important;
    padding: 2px 6px !important;
  }
  .pg-subj-class-header-top .pg-cls-chevron {
    margin-left: auto !important;
    flex-shrink: 0 !important;
    width: 30px !important;
    height: 30px !important;
    padding: 4px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  /* Default row — Default: label + 4 chip buttons all on ONE single line.
     Chips use flex: 1 1 0 + width: 0 so they share the row width
     equally; combined with text-overflow: ellipsis they always fit. */
  .pg-subj-class-header .pg-cls-defaults {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    align-items: center !important;
    gap: 5px !important;
    width: 100% !important;
    margin: 0 !important;
    overflow: hidden !important;
  }
  /* Hide the "Default:" label on mobile — the 4 chips below are self-explanatory */
  .pg-subj-class-header .pg-cls-defaults > span {
    display: none !important;
  }
  /* 4 chip buttons share full row width equally */
  .pg-subj-class-header .pg-cls-defaults .pg-cls-chip {
    flex: 1 1 0 !important;
    width: 0 !important;
    min-width: 0 !important;
    padding: 5px 4px !important;
    font-size: 10.5px !important;
    gap: 3px !important;
    justify-content: center !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
  /* Tighten the chip icons so labels have more room */
  .pg-subj-class-header .pg-cls-defaults .pg-cls-chip i { font-size: 9px !important; }
  /* Hide the vertical divider between Sheet and Line chip groups on mobile */
  .pg-subj-class-header .pg-cls-defaults > div:not([class]) {
    display: none !important;
  }

  /* Remove any empty spacer divs inside the class card */
  .pg-subj-class-block > div:empty,
  .pg-subj-class-header > div:empty { display: none !important; }

  /* ─── FIX 5 — PAPER GENERATOR TAB rows (compact card layout) ───
     JSX (lines 432–471): each row is .pg-class-row with 6 cells:
       1. <div>             — # number
       2. <div>             — school icon + class name + .pg-section-badge-inline
       3. <div>             — sitemap icon + section letter (duplicate)
       4. <div>             — .pg-make-paper-btn
       5. <div>             — .pg-paper-count (generated count)
       6. <div>             — .pg-chevron-btn
     Target layout:
       Row 1: [🏫] class 1A  [A]                  [⌄]
       Row 2: Generated: 5 papers
       Row 3: [────── Make Paper ──────]            */
  .pg-class-row {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    gap: 8px !important;
    padding: 10px 12px !important;
    grid-template-columns: none !important;
    min-height: unset !important;
    height: auto !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    border-bottom: 1px solid var(--border-light) !important;
  }

  /* Hide cell 1 (# number) and cell 3 (section duplicate) on mobile —
     the class name in cell 2 already carries the section badge. */
  .pg-class-row > div:nth-of-type(1),
  .pg-class-row > div:nth-of-type(3) {
    display: none !important;
  }

  /* Row 1 — class name + section badge + count pill + chevron (all in one line) */
  .pg-class-row > div:nth-of-type(2) {
    flex: 1 1 auto !important;
    min-width: 0 !important;
    width: auto !important;
    padding: 0 !important;
    font-size: 14px !important;
    font-weight: 700 !important;
    gap: 7px !important;
  }
  .pg-class-row .pg-section-badge-inline {
    font-size: 10px !important;
    padding: 1px 6px !important;
    flex-shrink: 0 !important;
  }
  /* Generated count — pulled UP onto Row 1, compact pill, no label */
  .pg-class-row > div:nth-of-type(5) {
    flex: 0 0 auto !important;
    width: auto !important;
    padding: 0 !important;
    text-align: center !important;
    margin-left: auto !important;
  }
  .pg-class-row > div:nth-of-type(5)::before {
    content: none !important;
  }
  .pg-class-row .pg-paper-count {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 11px !important;
    padding: 2px 7px !important;
    min-width: 22px !important;
    font-weight: 700 !important;
  }
  /* Chevron — also on Row 1, pinned to far right */
  .pg-class-row > div:nth-of-type(6) {
    flex: 0 0 auto !important;
    width: auto !important;
    padding: 0 !important;
    text-align: right !important;
  }
  .pg-class-row .pg-chevron-btn {
    width: 30px !important;
    height: 30px !important;
    padding: 4px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  /* Row 2 — Make Paper button full width */
  .pg-class-row > div:nth-of-type(4) {
    flex: 1 1 100% !important;
    width: 100% !important;
    padding: 0 !important;
    margin-top: 4px;
  }
  .pg-class-row .pg-make-paper-btn {
    width: 100% !important;
    justify-content: center !important;
    padding: 9px 14px !important;
    font-size: 13px !important;
  }

  /* Strip any empty spacer divs */
  .pg-class-row > div:empty { display: none !important; }
}

@media (max-width: 480px) {
  .pg-dl-grid { grid-template-columns: 1fr !important; }
  .pg-pc-actions > .pg-action-icon { width: 30px; height: 30px; }
  .page-title { font-size: 18px; }
}
`;
