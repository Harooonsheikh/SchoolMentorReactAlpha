import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { schoolAgreementsApi, schoolDirectoryApi } from './api';
import AgreementsDirectory from './AgreementsDirectory';
import DocumentCenter from './DocumentCenter';
import {
  DOC_CATEGORIES, CUSTOM_CATEGORY, FILE_ACCEPT, FILE_TYPE_FILTERS,
  AGREEMENT_STATUS_OPTIONS, MAX_FILE_MB, agreementStatus, categoryBadge,
  statusBadge, statusLabel, fmtBytes, validateFile, fileMeta, groupOf,
} from './agreementsData';
import { fmtCount, MISSING } from './format';
import { paginate, PAGE_SIZE_OPTIONS } from './pageMath';
import Pagination from './Pagination';

/* ═══════════════════════════════════════════════════════════════════
   SCHOOL AGREEMENTS & LEGAL DOCUMENTS — Super Admin module

   Do screens, ek hi module:

     1. DIRECTORY  — har school aur branch (live par 346), unki poori
        tafseel, tabs (All / Launch Setup / ERP / Inactive), search +
        filters, aur school/branch ka mukammal CRUD.
     2. SCHOOL     — ek school khol kar uske signed agreements /
        contracts / MoU / legal documents upload, preview, download,
        edit, replace aur delete.

   DATA — sab live, koi demo record nahi:
     • Schools/branches  → schoolDirectory.listSchoolDirectory()
       = ERP get-all-branches (poori directory, superset)
       + AHM_School_Progress/branch-report (staff, students, Data
         Status, Assigned To — wohi aankre jo Schools Progress dikhata
         hai; wo module CHHUA bhi nahi gaya, sirf uski service reuse hui)
       + Auth/get-all-users (assigned user ka naam)
     • Documents         → schoolAgreements.* (POST manage_documents)

   ⚠ BACKEND: school/branch ka poora CRUD mojooda live routes par chalta
   hai (Registration signup / update-branch / delete-branch aur
   SchoolPermissions/ToggleBranchStatus). Documents ka manage_documents
   route abhi deploy NAHI hua — us haalat me screen saaf banner dikhati
   hai, document-wale aankre '—' rehte hain aur Upload band rehta hai.
   Required backend changes: SCHOOL_AGREEMENTS_API_HANDOFF.md.
   ═══════════════════════════════════════════════════════════════════ */

/* "The Learning School" → "TL" */
function initials(name) {
  const parts = String(name || '').replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'SM';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

/* Khali value par table/cards '—' dikhate hain, kuch farz nahi karte. */
const orDash = (v) => (String(v ?? '').trim() ? String(v).trim() : MISSING);

/* ── shared bits ─────────────────────────────────────────────────── */

function Ov({ wrap = 'modal', wrapStyle, children, onClose }) {
  return (
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={wrap} style={wrapStyle}>{children}</div>
    </div>
  );
}

function CategoryBadge({ category }) {
  if (!category) return <span className="badge b-gray">{MISSING}</span>;
  return <span className={`badge ${categoryBadge(category)}`}>{category}</span>;
}

/* Agreement status pill — Active / Expiring Soon / Expired / Pending
   Signature, sirf asli signing/expiry tareekhon se. */
function StatusCell({ doc }) {
  const key = agreementStatus(doc);
  return <span className={`badge ${statusBadge(key)}`}>{statusLabel(key)}</span>;
}

/* Expiry column — khali = open-ended, guzri hui tareekh = Expired pill. */
function ExpiryCell({ doc }) {
  if (!doc.expiryDate) return <span className="badge b-gray"><i className="fa-solid fa-infinity" /> No expiry</span>;
  return (
    <span className={`badge ${doc.expired ? 'b-red' : 'b-green'}`}>
      <i className={`fa-solid ${doc.expired ? 'fa-circle-exclamation' : 'fa-circle-check'}`} />
      {doc.expiryDate}
    </span>
  );
}

/* ── the module ──────────────────────────────────────────────────── */

export default function SchoolAgreements({ toast }) {
  const toastRef = useRef(toast);
  toastRef.current = toast;

  /* ── school / branch directory (live, mukammal) ── */
  const [schools, setSchools] = useState([]);
  const [users, setUsers] = useState([]);
  const [dirWarnings, setDirWarnings] = useState([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [schoolsError, setSchoolsError] = useState('');

  /* ── network-wide documents — summary cards + har row ka count ── */
  const [allDocs, setAllDocs] = useState(null);     // null = abhi maloom nahi
  const [statsError, setStatsError] = useState('');

  /* ── selected school + uske documents ── */
  const [selected, setSelected] = useState(null);
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState('');
  /* Route hi mojood nahi (backend deploy pending) — "koi document nahi" se
     alag haalat, aur banner bhi alag. */
  const [backendMissing, setBackendMissing] = useState(false);

  /* ── document filters ── */
  const EMPTY_FILTERS = {
    text: '', category: '', fileType: '', status: '',
    signFrom: '', signTo: '', expFrom: '', expTo: '',
  };
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  /* Directory row se khula Document Center: { school, mode }. */
  const [center, setCenter] = useState(null);

  /* ── loaders ──────────────────────────────────────────────────── */

  const loadSchools = useCallback(async () => {
    setSchoolsLoading(true);
    setSchoolsError('');
    try {
      const { schools: rows, users: list, warnings } = await schoolDirectoryApi.listSchoolDirectory();
      setSchools(rows);
      setUsers(list);
      setDirWarnings(warnings);
      /* Khula hua school list me refresh ho jaye (edit ke baad naya naam). */
      setSelected((cur) => (cur ? rows.find((s) => s.id === cur.id) || cur : cur));
    } catch (err) {
      setSchoolsError(err?.message || 'Could not load the school directory');
    } finally {
      setSchoolsLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    setStatsError('');
    try {
      const rows = await schoolAgreementsApi.listAllDocuments();
      setAllDocs(rows);
      setBackendMissing(false);
    } catch (err) {
      /* Aankra farz nahi karte — null rehta hai aur cards '—' dikhate hain. */
      setAllDocs(null);
      setStatsError(err?.message || 'Could not load document statistics');
      if (schoolAgreementsApi.isMissingEndpoint(err)) setBackendMissing(true);
    }
  }, []);

  const loadDocs = useCallback(async (schoolId) => {
    if (!schoolId) return;
    setDocsLoading(true);
    setDocsError('');
    try {
      const rows = await schoolAgreementsApi.listSchoolDocuments(schoolId);
      setDocs(rows);
      setBackendMissing(false);
    } catch (err) {
      setDocs([]);
      setDocsError(err?.message || 'Could not load documents for this school');
      if (schoolAgreementsApi.isMissingEndpoint(err)) setBackendMissing(true);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => { loadSchools(); loadStats(); }, [loadSchools, loadStats]);

  /* School badalte hi uske documents, filters aur page reset. */
  useEffect(() => {
    if (!selected?.id) { setDocs([]); return; }
    setFilters(EMPTY_FILTERS);
    setPage(1);
    loadDocs(selected.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, loadDocs]);

  /* Documents ki taraf ka refresh — khule school ke rows aur upar ke cards. */
  const refreshAll = useCallback(async () => {
    await Promise.all([
      selected?.id ? loadDocs(selected.id) : Promise.resolve(),
      loadStats(),
    ]);
  }, [selected?.id, loadDocs, loadStats]);

  /* Directory ki taraf ka refresh (school create/update/delete ke baad) —
     document counts bhi dobara, kyunki delete ke saath wo bhi badalte hain. */
  const refreshDirectory = useCallback(async () => {
    await Promise.all([loadSchools(), loadStats()]);
  }, [loadSchools, loadStats]);

  /* ── per-school document index: count + kaun kaun se status ── */
  const docIndex = useMemo(() => {
    const map = new Map();
    (allDocs || []).forEach((d) => {
      if (!d.branchId) return;
      let e = map.get(d.branchId);
      if (!e) { e = { count: 0, statuses: new Set() }; map.set(d.branchId, e); }
      e.count += 1;
      e.statuses.add(agreementStatus(d));
    });
    return map;
  }, [allDocs]);

  /* ── document filters ── */
  const filtered = useMemo(() => {
    const text = filters.text.trim().toLowerCase();
    return docs.filter((d) => {
      if (text) {
        const hay = `${d.title} ${d.category} ${d.fileName} ${d.documentNo}`.toLowerCase();
        if (!hay.includes(text)) return false;
      }
      if (filters.category && groupOf(d.category) !== groupOf(filters.category)) return false;
      if (filters.fileType && d.fileKind !== filters.fileType) return false;
      if (filters.status && agreementStatus(d) !== filters.status) return false;
      /* Date filters: jis document par wo tareekh hi na ho, wo filter lagte
         hi bahar ho jata hai (warna "March ke baad signed" me bina date
         wale bhi aa jate). */
      if (filters.signFrom && (!d.signingDate || d.signingDate < filters.signFrom)) return false;
      if (filters.signTo && (!d.signingDate || d.signingDate > filters.signTo)) return false;
      if (filters.expFrom && (!d.expiryDate || d.expiryDate < filters.expFrom)) return false;
      if (filters.expTo && (!d.expiryDate || d.expiryDate > filters.expTo)) return false;
      return true;
    });
  }, [docs, filters]);

  const pg = paginate(filtered.length, page, pageSize);
  const pageRows = filtered.slice(pg.start, pg.end);
  const filtersOn = Object.values(filters).some(Boolean);

  /* Kis user ne upload kiya — id se naam (users list pehle se load hai). */
  const userName = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);
  const uploaderOf = (d) => d.uploadedByName || (d.uploadedBy ? (userName.get(d.uploadedBy) || `User #${d.uploadedBy}`) : '');

  /* ── actions ──────────────────────────────────────────────────── */

  const download = async (doc) => {
    if (doc.isLink) { window.open(doc.fileUrl, '_blank', 'noopener,noreferrer'); return; }
    try {
      const res = await schoolAgreementsApi.downloadDocumentFile(doc);
      toastRef.current?.(`Downloaded "${res.name}"`, 'success');
    } catch (err) {
      toastRef.current?.(err?.message || 'Could not download this document', 'error');
    }
  };

  const saveDetails = async (form, editId) => {
    setBusy(true);
    try {
      await schoolAgreementsApi.saveDocument(selected.id, form, editId);
      toastRef.current?.('Document details updated', 'success');
      setModal(null);
      await refreshAll();
    } catch (err) {
      toastRef.current?.(err?.message || 'Could not update the document', 'error');
    } finally {
      setBusy(false);
    }
  };

  const replaceFile = async (doc, file) => {
    setBusy(true);
    try {
      await schoolAgreementsApi.saveDocument(doc.branchId || selected?.id, {
        title: doc.title,
        category: doc.category,
        documentNo: doc.documentNo,
        signingDate: doc.signingDate,
        expiryDate: doc.expiryDate,
        description: doc.description,
        uploadedBy: doc.uploadedBy,
        filePath: doc.filePath,
        branchName: doc.branchName || selected?.name || '',
        file,
      }, doc.id);
      toastRef.current?.(`File replaced for "${doc.title}"`, 'success');
      setModal(null);
      await refreshAll();
    } catch (err) {
      toastRef.current?.(err?.message || 'Could not replace the file', 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async (doc) => {
    setBusy(true);
    try {
      await schoolAgreementsApi.deleteDocument(doc.id, doc.branchId || selected?.id);
      toastRef.current?.(`"${doc.title || 'Document'}" deleted`, 'success');
      setModal(null);
      await refreshAll();
    } catch (err) {
      toastRef.current?.(err?.message || 'Could not delete the document', 'error');
    } finally {
      setBusy(false);
    }
  };

  /* ── directory row ke document actions ──
     Har button usi school ka Document Center kholta hai (View / Upload /
     Delete), jahan documents chaar categories me hain. */
  const onDocAction = (mode, school) => setCenter({ mode, school });

  /* ── render ───────────────────────────────────────────────────── */

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon" style={{ background: 'linear-gradient(135deg,#0F766E,#14B8A6)' }}>
            <i className="fa-solid fa-file-contract" />
          </div>
          <div>
            <div className="page-title">School Agreements &amp; Legal Documents</div>
            <div className="page-sub">
              Every school and branch, their full details, and the signed agreements held against each one
            </div>
          </div>
        </div>
        <button
          className="btn-secondary"
          onClick={selected ? refreshAll : refreshDirectory}
          disabled={docsLoading || schoolsLoading}
        >
          <i className={`fa-solid fa-rotate${(docsLoading || schoolsLoading) ? ' fa-spin' : ''}`} /> Refresh
        </button>
      </div>

      {statsError && !backendMissing && (
        <div className="sla-note err">
          <i className="fa-solid fa-circle-exclamation" />
          <div>
            <div className="sla-note-t">Document counts unavailable</div>
            {statsError} — the Documents column shows &ldquo;{MISSING}&rdquo; rather than a guessed number.
          </div>
        </div>
      )}

      {/* ═════════ DIRECTORY (koi school khula na ho) ═════════ */}
      {!selected && (
        <AgreementsDirectory
          schools={schools}
          loading={schoolsLoading}
          error={schoolsError}
          warnings={dirWarnings}
          docIndex={docIndex}
          docsKnown={Boolean(allDocs)}
          users={users}
          onOpen={setSelected}
          onDocAction={onDocAction}
          onReload={refreshDirectory}
          toast={toastRef.current}
        />
      )}

      {/* ═════════ SELECTED SCHOOL ═════════ */}
      {selected && (
        <>
          {/* School information — asli school record se */}
          <div className="section-card">
            <div className="sla-sel-bar">
              <button className="btn-sm" onClick={() => setSelected(null)}>
                <i className="fa-solid fa-arrow-left" /> All Schools
              </button>
              <div className="sla-sel-av">{selected.initials || initials(selected.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="sla-sel-name">{selected.name}</div>
                <div className="sla-sel-sub">School information from the live branch record</div>
              </div>
              <span className={`badge ${selected.isActive ? 'b-green' : 'b-gray'}`}>
                <i className={`fa-solid ${selected.isActive ? 'fa-circle-check' : 'fa-circle-minus'}`} />
                {selected.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="sla-info-grid">
              <div className="sla-info-card">
                <div className="sla-info-lbl"><i className="fa-solid fa-school" /> School / Branch Name</div>
                <div className="sla-info-val">{orDash(selected.name)}</div>
              </div>
              <div className="sla-info-card">
                <div className="sla-info-lbl"><i className="fa-solid fa-hashtag" /> School / Branch ID</div>
                <div className="sla-info-val">{orDash(selected.id)}</div>
              </div>
              <div className="sla-info-card">
                <div className="sla-info-lbl"><i className="fa-solid fa-barcode" /> Branch Code</div>
                <div className="sla-info-val">{orDash(selected.code)}</div>
              </div>
              <div className="sla-info-card">
                <div className="sla-info-lbl"><i className="fa-solid fa-phone" /> Contact Number</div>
                <div className="sla-info-val">{orDash(selected.phone || selected.contact)}</div>
              </div>
              <div className="sla-info-card">
                <div className="sla-info-lbl"><i className="fa-solid fa-user-tie" /> Owner / Principal</div>
                <div className="sla-info-val">{orDash(selected.owner || selected.principal)}</div>
              </div>
              <div className="sla-info-card">
                <div className="sla-info-lbl"><i className="fa-solid fa-envelope" /> Email</div>
                <div className="sla-info-val">{orDash(selected.email)}</div>
              </div>
              <div className="sla-info-card">
                <div className="sla-info-lbl"><i className="fa-solid fa-users" /> Total Staff</div>
                <div className="sla-info-val">{fmtCount(selected.staff)}</div>
              </div>
              <div className="sla-info-card">
                <div className="sla-info-lbl"><i className="fa-solid fa-user-graduate" /> Total Students</div>
                <div className="sla-info-val">{fmtCount(selected.students)}</div>
              </div>
              <div className="sla-info-card">
                <div className="sla-info-lbl"><i className="fa-solid fa-list-check" /> Data Status</div>
                <div className="sla-info-val">{selected.inProgressReport ? orDash(selected.dataStatus) : 'Not reported'}</div>
              </div>
              <div className="sla-info-card">
                <div className="sla-info-lbl"><i className="fa-solid fa-user-check" /> Assigned To</div>
                <div className="sla-info-val">{orDash(selected.assignedName)}</div>
              </div>
              <div className="sla-info-card">
                <div className="sla-info-lbl"><i className="fa-solid fa-layer-group" /> School Type</div>
                <div className="sla-info-val">
                  {selected.group === 'erp' ? 'ERP School' : selected.group === 'launch' ? 'Launch Setup School' : 'Inactive School'}
                </div>
              </div>
              <div className="sla-info-card">
                <div className="sla-info-lbl"><i className="fa-solid fa-location-dot" /> Address</div>
                <div className="sla-info-val">{orDash(selected.address)}</div>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="section-card">
            <div className="card-header">
              <div>
                <div className="card-title"><i className="fa-solid fa-folder-open" /> Documents — {selected.name}</div>
                <div className="card-sub">
                  {docsLoading ? 'Loading…' : `${fmtCount(docs.length)} document(s) on record for this school`}
                </div>
              </div>
              <button
                className="btn-primary"
                onClick={() => setModal({ type: 'upload' })}
              >
                <i className="fa-solid fa-cloud-arrow-up" /> Upload Documents
              </button>
            </div>

            {/* Filters */}
            <div className="filter-bar">
              <div className="f-field f-field-grow">
                <label className="f-label">Search Document</label>
                <div className="search-box">
                  <i className="fa-solid fa-magnifying-glass" />
                  <input
                    className="search-input"
                    placeholder="Search by document title, type or number…"
                    value={filters.text}
                    onChange={(e) => setFilter('text', e.target.value)}
                  />
                </div>
              </div>
              <div className="f-field">
                <label className="f-label">Document Category</label>
                <select className="f-input" value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
                  <option value="">All categories</option>
                  {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="f-field">
                <label className="f-label">Document Type</label>
                <select className="f-input" value={filters.fileType} onChange={(e) => setFilter('fileType', e.target.value)}>
                  <option value="">All file types</option>
                  {FILE_TYPE_FILTERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="f-field">
                <label className="f-label">Agreement Status</label>
                <select className="f-input" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
                  <option value="">All statuses</option>
                  {AGREEMENT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="f-field">
                <label className="f-label">Signed From</label>
                <input type="date" className="f-input" value={filters.signFrom} onChange={(e) => setFilter('signFrom', e.target.value)} />
              </div>
              <div className="f-field">
                <label className="f-label">Signed To</label>
                <input type="date" className="f-input" value={filters.signTo} onChange={(e) => setFilter('signTo', e.target.value)} />
              </div>
              <div className="f-field">
                <label className="f-label">Expiry From</label>
                <input type="date" className="f-input" value={filters.expFrom} onChange={(e) => setFilter('expFrom', e.target.value)} />
              </div>
              <div className="f-field">
                <label className="f-label">Expiry To</label>
                <input type="date" className="f-input" value={filters.expTo} onChange={(e) => setFilter('expTo', e.target.value)} />
              </div>
              <div className="f-field">
                <label className="f-label">Show</label>
                <select
                  className="f-input"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                >
                  {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n} / page</option>)}
                </select>
              </div>
              {filtersOn && (
                <button className="btn-secondary" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }}>
                  <i className="fa-solid fa-filter-circle-xmark" /> Clear Filters
                </button>
              )}
            </div>

            {docsError && !backendMissing && (
              <div style={{ padding: '16px 20px 0' }}>
                <div className="sla-note err" style={{ marginBottom: 0 }}>
                  <i className="fa-solid fa-circle-exclamation" />
                  <div>
                    <div className="sla-note-t">Documents could not be loaded</div>
                    {docsError}
                    <div style={{ marginTop: 8 }}>
                      <button className="btn-sm" onClick={() => loadDocs(selected.id)}>
                        <i className="fa-solid fa-rotate" /> Try again
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="tbl-wrap">
              <table className="sla-table">
                <thead>
                  <tr>
                    <th style={{ width: 54 }}>#</th>
                    <th>Document Title</th>
                    <th>Document Type</th>
                    <th style={{ width: 120 }}>Status</th>
                    <th style={{ width: 110 }}>Signing Date</th>
                    <th style={{ width: 130 }}>Expiry Date</th>
                    <th style={{ width: 110 }}>Uploaded Date</th>
                    <th style={{ width: 130 }}>Uploaded By</th>
                    <th style={{ width: 190 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {docsLoading && (
                    <tr><td colSpan={9} className="td-empty">
                      <i className="fa-solid fa-spinner fa-spin" />Loading documents…
                    </td></tr>
                  )}

                  {!docsLoading && !pageRows.length && (
                    <tr><td colSpan={9} style={{ padding: 0 }}>
                      <div className="sla-empty">
                        <i className="fa-solid fa-folder-open" />
                        {docs.length ? (
                          <>
                            <div className="sla-empty-t">No documents match these filters</div>
                            <div className="sla-empty-s">
                              {fmtCount(docs.length)} document(s) exist for this school — clear the filters to see them.
                            </div>
                          </>
                        ) : docsError && !backendMissing ? (
                          <>
                            <div className="sla-empty-t">Nothing to show</div>
                            <div className="sla-empty-s">Documents could not be loaded — see the message above.</div>
                          </>
                        ) : (
                          <>
                            <div className="sla-empty-t">No documents uploaded for this school yet</div>
                            <div className="sla-empty-s">
                              Upload the signed agreement, contract or MoU to start this school&apos;s record.
                            </div>
                            <button className="btn-sm" style={{ marginTop: 14 }} onClick={() => setModal({ type: 'upload' })}>
                              <i className="fa-solid fa-cloud-arrow-up" /> Upload Documents
                            </button>
                          </>
                        )}
                      </div>
                    </td></tr>
                  )}

                  {!docsLoading && pageRows.map((d, i) => (
                    <tr key={d.id}>
                      <td className="td-center">{pg.start + i + 1}</td>
                      <td>
                        <div className="sla-doc-cell">
                          <div className="sla-doc-icon" style={{ background: d.fileColor }}>
                            <i className={`fa-solid ${d.fileIcon}`} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div className="sla-doc-title">{orDash(d.title)}</div>
                            <div className="sla-doc-file">
                              {d.documentNo && <span><i className="fa-solid fa-hashtag" /> {d.documentNo}</span>}
                              {d.fileName && <span><i className="fa-solid fa-paperclip" /> {d.fileName}</span>}
                              {d.fileSize > 0 && <span>{fmtBytes(d.fileSize)}</span>}
                              {d.description && (
                                <span data-tip={d.description}><i className="fa-solid fa-note-sticky" /> Notes</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td><CategoryBadge category={d.category} /></td>
                      <td><StatusCell doc={d} /></td>
                      <td>{orDash(d.signingDate)}</td>
                      <td><ExpiryCell doc={d} /></td>
                      <td>{orDash(d.uploadedDate)}</td>
                      <td className="sla-ellipsis">{orDash(uploaderOf(d))}</td>
                      <td>
                        <div className="sla-acts">
                          <button
                            className="sla-act" data-tip="View / Preview" aria-label="View document"
                            disabled={!d.fileUrl} onClick={() => setModal({ type: 'preview', doc: d })}
                          ><i className="fa-solid fa-eye" /></button>
                          <button
                            className="sla-act" data-tip="Download" aria-label="Download document"
                            disabled={!d.fileUrl} onClick={() => download(d)}
                          ><i className="fa-solid fa-download" /></button>
                          <button
                            className="sla-act" data-tip="Edit details" aria-label="Edit document details"
                            onClick={() => setModal({ type: 'details', doc: d })}
                          ><i className="fa-solid fa-pen" /></button>
                          <button
                            className="sla-act" data-tip="Replace file" aria-label="Replace document file"
                            onClick={() => setModal({ type: 'replace', doc: d })}
                          ><i className="fa-solid fa-arrows-rotate" /></button>
                          <button
                            className="sla-act danger" data-tip="Delete" aria-label="Delete document"
                            onClick={() => setModal({ type: 'del', doc: d })}
                          ><i className="fa-solid fa-trash-can" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filtered.length > 0 && (
              <Pagination
                page={pg.page} totalPages={pg.totalPages} total={pg.total}
                from={pg.from} to={pg.to} noun="documents"
                disabled={docsLoading} onPageChange={setPage}
              />
            )}
          </div>
        </>
      )}

      {/* ═════════ DIRECTORY ROW — DOCUMENT CENTER ═════════ */}
      {center && (
        <DocumentCenter
          key={`${center.school.id}-${center.mode}`}
          school={center.school}
          initialMode={center.mode}
          onClose={() => setCenter(null)}
          onChanged={loadStats}
          toast={toastRef.current}
        />
      )}

      {/* ═════════ MODALS ═════════ */}
      {modal?.type === 'upload' && (
        <UploadModal
          school={selected}
          onClose={() => setModal(null)}
          onDone={async () => { setModal(null); await refreshAll(); }}
          toast={toastRef.current}
        />
      )}
      {modal?.type === 'details' && (
        <DetailsModal
          doc={modal.doc} saving={busy}
          onClose={() => setModal(null)}
          onSave={(form) => saveDetails(form, modal.doc.id)}
          toast={toastRef.current}
        />
      )}
      {modal?.type === 'replace' && (
        <ReplaceModal
          doc={modal.doc} saving={busy}
          onClose={() => setModal(null)}
          onReplace={(file) => replaceFile(modal.doc, file)}
          toast={toastRef.current}
        />
      )}
      {modal?.type === 'preview' && (
        <PreviewModal doc={modal.doc} onClose={() => setModal(null)} onDownload={() => download(modal.doc)} />
      )}
      {modal?.type === 'del' && (
        <DeleteModal
          doc={modal.doc} busy={busy}
          onClose={() => setModal(null)}
          onConfirm={() => confirmDelete(modal.doc)}
        />
      )}
    </div>
  );
}


/* ═══════════════════════ UPLOAD (multi-file) ═══════════════════════
   Ek hi modal me kayi files: shared metadata (category, dates, notes) aur
   har file ka apna title. Upload ek-ek kar ke hota hai, aur progress wohi
   dikhta hai jo sach me hua — "file 3 of 7" — koi farzi percentage nahi. */
function UploadModal({ school, onClose, onDone, toast }) {
  const [items, setItems] = useState([]);       // { key, file, title, error }
  const [shared, setShared] = useState({
    category: DOC_CATEGORIES[0], customCategory: '', documentNo: '',
    signingDate: '', expiryDate: '', description: '',
  });
  const [over, setOver] = useState(false);
  const [run, setRun] = useState(null);         // { done, total, failures[] }
  const fileRef = useRef(null);
  const seq = useRef(0);

  const set = (k, v) => setShared((p) => ({ ...p, [k]: v }));
  const uploading = Boolean(run) && run.done < run.total;

  const addFiles = (list) => {
    const picked = Array.from(list || []);
    if (!picked.length) return;
    setItems((prev) => [
      ...prev,
      ...picked.map((file) => ({
        key: `f${seq.current++}`,
        file,
        /* Default title = file ka naam (extension ke baghair) — user badal sakta hai. */
        title: file.name.replace(/\.[^.]+$/, '').slice(0, 150),
        error: validateFile(file),
      })),
    ]);
  };

  const removeItem = (key) => setItems((prev) => prev.filter((it) => it.key !== key));
  const setTitle = (key, title) => setItems((prev) => prev.map((it) => (it.key === key ? { ...it, title } : it)));

  const start = async () => {
    if (uploading) return;
    if (!items.length) { toast?.('Choose at least one document to upload', 'warn'); return; }
    const bad = items.find((it) => it.error);
    if (bad) { toast?.(bad.error, 'warn'); return; }
    const untitled = items.find((it) => !it.title.trim());
    if (untitled) { toast?.('Every document needs a title', 'warn'); return; }
    if (!shared.category) { toast?.('Choose a document type', 'warn'); return; }
    /* "Other" chuna ho to apni qism likhna laazmi — warna sab "Other" ban
       jate hain aur filter bekaar ho jata hai. */
    if (shared.category === CUSTOM_CATEGORY && !shared.customCategory.trim()) {
      toast?.('Type the custom document type, or pick one from the list', 'warn'); return;
    }
    const category = shared.category === CUSTOM_CATEGORY
      ? shared.customCategory.trim()
      : shared.category;
    if (shared.signingDate && shared.expiryDate && shared.expiryDate < shared.signingDate) {
      toast?.('The expiry date cannot be before the signing date', 'warn'); return;
    }

    const failures = [];
    setRun({ done: 0, total: items.length, failures });
    /* Sequential — ek saath kayi multipart uploads server par bhejne se
       kuch fail ho kar aadha-adhoora natija chhorte hain. */
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      try {
        // eslint-disable-next-line no-await-in-loop
        await schoolAgreementsApi.saveDocument(school.id, {
          branchName: school.name,
          title: it.title.trim(),
          category,
          documentNo: shared.documentNo.trim(),
          signingDate: shared.signingDate,
          expiryDate: shared.expiryDate,
          description: shared.description.trim(),
          file: it.file,
        });
      } catch (err) {
        failures.push({ name: it.file.name, message: err?.message || 'Upload failed' });
      }
      setRun({ done: i + 1, total: items.length, failures: [...failures] });
    }

    const ok = items.length - failures.length;
    if (ok) toast?.(`${ok} document(s) uploaded to ${school.name}`, 'success');
    if (failures.length) {
      toast?.(`${failures.length} of ${items.length} upload(s) failed — see the dialog`, 'error');
      /* Modal khula rehta hai taake user dekh sake kya fail hua. */
      return;
    }
    onDone();
  };

  const pct = run ? Math.round((run.done / run.total) * 100) : 0;

  return (
    <Ov wrap="modal lg" onClose={uploading ? () => {} : onClose}>
      <div className="modal-head">
        <div>
          <div className="modal-title"><i className="fa-solid fa-cloud-arrow-up" /> Upload Documents</div>
          <div className="modal-sub">{school.name} · School ID {school.id}</div>
        </div>
        <button className="modal-close" onClick={onClose} disabled={uploading}><i className="fa-solid fa-xmark" /></button>
      </div>

      <div className="modal-body">
        {/* File picker */}
        <div
          className={`sla-drop${over ? ' over' : ''}`}
          onClick={() => !uploading && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); if (!uploading) addFiles(e.dataTransfer.files); }}
        >
          <div className="sla-drop-icon"><i className="fa-solid fa-file-arrow-up" /></div>
          <div className="sla-drop-t">Click to choose files, or drop them here</div>
          <div className="sla-drop-s">
            PDF, DOC, DOCX, JPG, JPEG, PNG · up to {MAX_FILE_MB} MB each · multiple files allowed
          </div>
          <input
            ref={fileRef} type="file" multiple accept={FILE_ACCEPT} style={{ display: 'none' }}
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          />
        </div>

        {/* Picked files — har ek ka apna title */}
        {items.length > 0 && (
          <div className="sla-file-list">
            {items.map((it) => {
              const meta = fileMeta(it.file.name);
              return (
                <div key={it.key} className={`sla-file-item${it.error ? ' bad' : ''}`}>
                  <div className="sla-file-icon" style={{ background: meta.color }}>
                    <i className={`fa-solid ${meta.icon}`} />
                  </div>
                  <div className="sla-file-main">
                    <input
                      className="sla-title-input" placeholder="Document title"
                      value={it.title} maxLength={150} disabled={uploading}
                      onChange={(e) => setTitle(it.key, e.target.value)}
                    />
                    <div className={`sla-file-sub${it.error ? ' bad' : ''}`}>
                      {it.error || `${it.file.name} · ${fmtBytes(it.file.size)}`}
                    </div>
                  </div>
                  <button className="sla-file-x" data-tip="Remove" disabled={uploading} onClick={() => removeItem(it.key)}>
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Shared metadata */}
        <div className="modal-grid" style={{ marginTop: 18 }}>
          <div className={shared.category === CUSTOM_CATEGORY ? 'f-field' : 'f-field span2'}>
            <label className="f-label">Document Type <span style={{ color: 'var(--err)' }}>*</span></label>
            <select className="f-input" value={shared.category} disabled={uploading} onChange={(e) => set('category', e.target.value)}>
              {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {shared.category === CUSTOM_CATEGORY && (
            <div className="f-field">
              <label className="f-label">Custom Type <span style={{ color: 'var(--err)' }}>*</span></label>
              <input
                className="f-input" value={shared.customCategory} maxLength={80} disabled={uploading}
                placeholder="e.g. Board Resolution"
                onChange={(e) => set('customCategory', e.target.value)}
              />
            </div>
          )}
          <div className="f-field span2">
            <label className="f-label">Document Number <span style={{ color: 'var(--tm)', fontWeight: 500 }}>(optional)</span></label>
            <input
              className="f-input" value={shared.documentNo} maxLength={80} disabled={uploading}
              placeholder="Reference / registration number printed on the document"
              onChange={(e) => set('documentNo', e.target.value)}
            />
          </div>
          <div className="f-field">
            <label className="f-label">Agreement Signing Date</label>
            <input type="date" className="f-input" value={shared.signingDate} disabled={uploading} onChange={(e) => set('signingDate', e.target.value)} />
          </div>
          <div className="f-field">
            <label className="f-label">Expiry Date <span style={{ color: 'var(--tm)', fontWeight: 500 }}>(optional)</span></label>
            <input type="date" className="f-input" value={shared.expiryDate} disabled={uploading} onChange={(e) => set('expiryDate', e.target.value)} />
          </div>
          <div className="f-field span2">
            <label className="f-label">Description / Notes</label>
            <textarea
              className="f-textarea" placeholder="Anything worth recording about these documents…"
              value={shared.description} disabled={uploading} onChange={(e) => set('description', e.target.value)}
            />
          </div>
        </div>
        <div className="sla-file-sub" style={{ marginTop: 8 }}>
          The type, number, dates and notes above apply to every file in this upload.
          Edit any document afterwards to give it its own details.
        </div>

        {/* Progress — jo sach me hua wahi */}
        {run && (
          <div className="sla-prog">
            <div className="sla-prog-hd">
              <span>{uploading ? `Uploading file ${run.done + 1} of ${run.total}…` : `Finished — ${run.done} of ${run.total} processed`}</span>
              <span>{pct}%</span>
            </div>
            <div className="sla-prog-track"><div className="sla-prog-fill" style={{ width: `${pct}%` }} /></div>
            {!uploading && run.failures.length === 0 && (
              <div className="sla-prog-line ok"><i className="fa-solid fa-circle-check" /> All documents uploaded.</div>
            )}
            {run.failures.map((f) => (
              <div key={f.name} className="sla-prog-line bad">
                <i className="fa-solid fa-circle-xmark" /> {f.name} — {f.message}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="modal-foot">
        <button className="btn-secondary" onClick={onClose} disabled={uploading}>
          <i className="fa-solid fa-xmark" /> {run && !uploading ? 'Close' : 'Cancel'}
        </button>
        <button className="btn-primary" onClick={start} disabled={uploading || !items.length}>
          <i className={`fa-solid ${uploading ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'}`} />
          {uploading ? 'Uploading…' : `Upload ${items.length || ''} Document${items.length === 1 ? '' : 's'}`.trim()}
        </button>
      </div>
    </Ov>
  );
}

/* ═══════════════════════ EDIT DETAILS ═══════════════════════ */
function DetailsModal({ doc, saving, onClose, onSave, toast }) {
  /* Jo category list me nahi (pehle custom type se save hui thi) wo "Other"
     par khulti hai aur uska asal naam custom khane me rehta hai — edit par
     khamoshi se "Other" me nahi badalti. */
  const known = DOC_CATEGORIES.includes(doc.category);
  const [f, setF] = useState({
    title: doc.title,
    category: doc.category
      ? (known ? doc.category : (DOC_CATEGORIES.find((c) => groupOf(c) === groupOf(doc.category)) || DOC_CATEGORIES[0]))
      : DOC_CATEGORIES[0],
    customCategory: doc.category && !known ? doc.category : '',
    documentNo: doc.documentNo || '',
    signingDate: doc.signingDate, expiryDate: doc.expiryDate, description: doc.description,
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const save = () => {
    if (saving) return;
    if (!f.title.trim()) { toast?.('Please enter a document title', 'warn'); return; }
    if (!f.category) { toast?.('Choose a document type', 'warn'); return; }
    if (f.category === CUSTOM_CATEGORY && !f.customCategory.trim()) {
      toast?.('Type the custom document type, or pick one from the list', 'warn'); return;
    }
    if (f.signingDate && f.expiryDate && f.expiryDate < f.signingDate) {
      toast?.('The expiry date cannot be before the signing date', 'warn'); return;
    }
    /* filePath wapas bhejte hain aur koi file nahi — server par file waisi
       hi rehti hai, sirf metadata badalta hai. */
    onSave({
      title: f.title.trim(),
      category: f.category === CUSTOM_CATEGORY ? f.customCategory.trim() : f.category,
      documentNo: f.documentNo.trim(),
      signingDate: f.signingDate, expiryDate: f.expiryDate,
      description: f.description.trim(),
      /* Uploader wohi rehta hai jo pehle tha — edit karne wala use nahi
         badalta (warna "kis ne chadhaya" ka jawab ghalat ho jata hai). */
      uploadedBy: doc.uploadedBy,
      filePath: doc.filePath,
    });
  };

  return (
    <Ov onClose={onClose}>
      <div className="modal-head">
        <div>
          <div className="modal-title"><i className="fa-solid fa-pen" /> Edit Document Details</div>
          <div className="modal-sub">The stored file itself is not changed — use “Replace file” for that.</div>
        </div>
        <button className="modal-close" onClick={onClose} disabled={saving}><i className="fa-solid fa-xmark" /></button>
      </div>
      <div className="modal-body">
        <div className="modal-grid">
          <div className="f-field span2">
            <label className="f-label">Document Title <span style={{ color: 'var(--err)' }}>*</span></label>
            <input className="f-input" value={f.title} maxLength={150} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div className={f.category === CUSTOM_CATEGORY ? 'f-field' : 'f-field span2'}>
            <label className="f-label">Document Type <span style={{ color: 'var(--err)' }}>*</span></label>
            <select className="f-input" value={f.category} onChange={(e) => set('category', e.target.value)}>
              {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {f.category === CUSTOM_CATEGORY && (
            <div className="f-field">
              <label className="f-label">Custom Type <span style={{ color: 'var(--err)' }}>*</span></label>
              <input
                className="f-input" value={f.customCategory} maxLength={80}
                onChange={(e) => set('customCategory', e.target.value)}
              />
            </div>
          )}
          <div className="f-field span2">
            <label className="f-label">Document Number <span style={{ color: 'var(--tm)', fontWeight: 500 }}>(optional)</span></label>
            <input className="f-input" value={f.documentNo} maxLength={80} onChange={(e) => set('documentNo', e.target.value)} />
          </div>
          <div className="f-field">
            <label className="f-label">Agreement Signing Date</label>
            <input type="date" className="f-input" value={f.signingDate} onChange={(e) => set('signingDate', e.target.value)} />
          </div>
          <div className="f-field">
            <label className="f-label">Expiry Date <span style={{ color: 'var(--tm)', fontWeight: 500 }}>(optional)</span></label>
            <input type="date" className="f-input" value={f.expiryDate} onChange={(e) => set('expiryDate', e.target.value)} />
          </div>
          <div className="f-field span2">
            <label className="f-label">Description / Notes</label>
            <textarea className="f-textarea" value={f.description} onChange={(e) => set('description', e.target.value)} />
          </div>
        </div>
        <div className="sla-file-item" style={{ marginTop: 16 }}>
          <div className="sla-file-icon" style={{ background: doc.fileColor }}><i className={`fa-solid ${doc.fileIcon}`} /></div>
          <div className="sla-file-main">
            <div className="sla-doc-title">{doc.fileName || 'No file on record'}</div>
            <div className="sla-file-sub">
              Current file{doc.uploadedDate ? ` · uploaded ${doc.uploadedDate}` : ''}
              {doc.fileSize > 0 ? ` · ${fmtBytes(doc.fileSize)}` : ''}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn-secondary" onClick={onClose} disabled={saving}><i className="fa-solid fa-xmark" /> Cancel</button>
        <button className="btn-primary" onClick={save} disabled={saving}>
          <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </Ov>
  );
}

/* ═══════════════════════ REPLACE FILE ═══════════════════════ */
function ReplaceModal({ doc, saving, onClose, onReplace, toast }) {
  const [file, setFile] = useState(null);
  const [err, setErr] = useState('');
  const ref = useRef(null);

  const pick = (picked) => {
    if (!picked) return;
    const bad = validateFile(picked);
    setErr(bad);
    setFile(bad ? null : picked);
  };

  const go = () => {
    if (saving) return;
    if (!file) { toast?.(err || 'Choose the replacement file first', 'warn'); return; }
    onReplace(file);
  };

  const meta = file ? fileMeta(file.name) : null;
  return (
    <Ov onClose={onClose}>
      <div className="modal-head">
        <div>
          <div className="modal-title"><i className="fa-solid fa-arrows-rotate" /> Replace Document File</div>
          <div className="modal-sub">{doc.title || 'Document'} — the details stay exactly as they are</div>
        </div>
        <button className="modal-close" onClick={onClose} disabled={saving}><i className="fa-solid fa-xmark" /></button>
      </div>
      <div className="modal-body">
        <div className="sla-file-item" style={{ marginBottom: 14 }}>
          <div className="sla-file-icon" style={{ background: doc.fileColor }}><i className={`fa-solid ${doc.fileIcon}`} /></div>
          <div className="sla-file-main">
            <div className="sla-doc-title">{doc.fileName || 'No file on record'}</div>
            <div className="sla-file-sub">Current file — this one will be replaced</div>
          </div>
        </div>

        <div className="sla-drop" onClick={() => !saving && ref.current?.click()}>
          <div className="sla-drop-icon" style={{ background: 'linear-gradient(135deg,#B45309,#D97706)' }}>
            <i className="fa-solid fa-file-arrow-up" />
          </div>
          <div className="sla-drop-t">{file ? file.name : 'Click to choose the replacement file'}</div>
          <div className="sla-drop-s">
            {file ? `${fmtBytes(file.size)} · ready to replace` : `PDF, DOC, DOCX, JPG, JPEG, PNG · up to ${MAX_FILE_MB} MB`}
          </div>
          <input
            ref={ref} type="file" accept={FILE_ACCEPT} style={{ display: 'none' }}
            onChange={(e) => { pick(e.target.files[0]); e.target.value = ''; }}
          />
        </div>

        {file && meta && (
          <div className="sla-file-item" style={{ marginTop: 12 }}>
            <div className="sla-file-icon" style={{ background: meta.color }}><i className={`fa-solid ${meta.icon}`} /></div>
            <div className="sla-file-main">
              <div className="sla-doc-title">{file.name}</div>
              <div className="sla-file-sub">New file · {fmtBytes(file.size)}</div>
            </div>
          </div>
        )}
        {err && <div className="sla-file-sub bad" style={{ marginTop: 10 }}>{err}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn-secondary" onClick={onClose} disabled={saving}><i className="fa-solid fa-xmark" /> Cancel</button>
        <button className="btn-primary" onClick={go} disabled={saving || !file}>
          <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'}`} /> {saving ? 'Replacing…' : 'Replace File'}
        </button>
      </div>
    </Ov>
  );
}

/* ═══════════════════════ PREVIEW ═══════════════════════
   PDF aur images browser me seedhe khul jati hain. DOC/DOCX ko browser
   render nahi karta — us par saaf likh dete hain aur download dete hain,
   koi jhoota viewer nahi. */
function PreviewModal({ doc, onClose, onDownload }) {
  const openInTab = () => {
    if (!doc.fileUrl) return;
    window.open(doc.fileUrl, '_blank', 'noopener,noreferrer');
  };
  return (
    <Ov wrap="sla-prev-wrap" onClose={onClose}>
      <div className="sla-prev-bar">
        <div className="sla-doc-icon" style={{ background: doc.fileColor }}><i className={`fa-solid ${doc.fileIcon}`} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sla-doc-title">{doc.title || doc.fileName || 'Document'}</div>
          <div className="sla-file-sub">
            {doc.category || MISSING}
            {doc.fileName ? ` · ${doc.fileName}` : ''}
            {doc.signingDate ? ` · signed ${doc.signingDate}` : ''}
          </div>
        </div>
        <button className="btn-sm" onClick={openInTab} disabled={!doc.fileUrl}>
          <i className="fa-solid fa-arrow-up-right-from-square" /> Open in tab
        </button>
        <button className="btn-sm" onClick={onDownload} disabled={!doc.fileUrl}>
          <i className="fa-solid fa-download" /> Download
        </button>
        <button className="pm-close" data-tip="Close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
      </div>
      <div className="sla-prev-body">
        {!doc.fileUrl ? (
          <div className="sla-empty">
            <i className="fa-solid fa-file-circle-question" />
            <div className="sla-empty-t">No stored file for this record</div>
            <div className="sla-empty-s">Use “Replace file” to attach the document.</div>
          </div>
        ) : doc.fileKind === 'pdf' ? (
          <iframe className="sla-prev-frame" title={doc.fileName || 'Document'} src={`${doc.fileUrl}#view=FitH`} />
        ) : doc.fileKind === 'image' ? (
          <img className="sla-prev-img" src={doc.fileUrl} alt={doc.title || doc.fileName || 'Document'} />
        ) : (
          <div className="sla-empty">
            <i className="fa-solid fa-file-word" />
            <div className="sla-empty-t">Word documents cannot be previewed in the browser</div>
            <div className="sla-empty-s">Download the file, or open it in a new tab, to read it.</div>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={onDownload}>
              <i className="fa-solid fa-download" /> Download {doc.fileName || 'document'}
            </button>
          </div>
        )}
      </div>
    </Ov>
  );
}

/* ═══════════════════════ DELETE CONFIRM ═══════════════════════ */
function DeleteModal({ doc, busy, onClose, onConfirm }) {
  return (
    <Ov wrapStyle={{ maxWidth: 440 }} onClose={onClose}>
      <div className="modal-body">
        <div className="confirm-icon" style={{ background: 'rgba(220,38,38,.1)', border: '2px solid rgba(220,38,38,.25)', color: '#DC2626' }}>
          <i className="fa-solid fa-trash-can" />
        </div>
        <div className="confirm-title">Delete this document?</div>
        <div className="confirm-sub">
          “{doc.title || doc.fileName || 'Document'}” and its stored file will be permanently
          removed from this school&apos;s record. This action cannot be undone.
        </div>
        <div className="confirm-btns">
          <button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-danger" onClick={onConfirm} disabled={busy}>
            <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-trash-can'}`} /> {busy ? 'Deleting…' : 'Delete Document'}
          </button>
        </div>
      </div>
    </Ov>
  );
}
