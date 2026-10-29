import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import { useSettings } from './settingsStore';
import * as branchClassMappingService from '../../services/branchClassMappingService';

/* ═══════════════════════════════════════════════════════════════════
   BRANCH CLASS MAPPING — a card inside Settings → Chain School, right
   below "Head Office Module Permissions" (not a separate Settings
   tab — it's driven by the exact same payload that card applies, so
   it lives next to it instead of making the admin jump between tabs).

   Maps this school's own local classes to the Chain School Portal's
   standard "central academic classes", so Head Office can create an
   exam against a central class (e.g. "Class 1") and this school's
   matching local class (e.g. "Grade 1") is found automatically —
   with no name-matching guesswork, since both sides use the same
   stable class ids (see useChainPermissions.js's centralClasses).

   Gated on a Head Office permission payload actually being applied
   via the card right above this one ("Paste Permission Payload") AND
   that payload including centralClasses — this is the SAME payload/
   useChainPermissions() mechanism that card uses, independent of the
   separate Send-Invite/Accept connection flow further down this same
   screen (a payload can be applied without ever sending an invite —
   see useChainPermissions.js). A school with no payload yet, or an
   older one from before this field existed, has nothing real to map
   against — this card says so plainly instead of inventing a list.

   Wrapped in the same .cs-card shell ChainSchool.jsx's own sections
   use (CS_CSS, defined in that file) for every state below, so it
   reads as one more section of that screen, not a bolted-on page.
   The .settings-table/.settings-modal/.settings-badge/.settings-btn
   classes inside it are the same shared ones SettingsModule.jsx
   mounts — no new stylesheet either way.
   ═══════════════════════════════════════════════════════════════════ */
export default function BranchClassMapping({ toast = () => {} }) {
  const { sessions, currentSession } = useSettings();

  const [sessionId, setSessionId] = useState(currentSession?.id || sessions[0]?.id || null);
  const [centralClasses, setCentralClasses] = useState([]);   // the network's classes
  const [networkId, setNetworkId] = useState(null);           // null = resolving, 0 = not in a network
  const [netLoading, setNetLoading] = useState(true);
  const [localClasses, setLocalClasses] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [mapModal, setMapModal] = useState(null);   // { localClass, existing? }

  const ready = centralClasses.length > 0;

  /* Network's central classes (get-grades-by-network) — the list every local
     class is mapped against. No Head Office payload needed. */
  useEffect(() => {
    let alive = true;
    setNetLoading(true);
    branchClassMappingService.getNetworkClasses()
      .then(({ networkId: nid, classes }) => { if (alive) { setNetworkId(nid); setCentralClasses(classes); } })
      .catch(() => { if (alive) { setNetworkId(0); setCentralClasses([]); } })
      .finally(() => { if (alive) setNetLoading(false); });
    return () => { alive = false; };
  }, []);

  const load = async (sid) => {
    if (!ready || !sid) { setLoading(false); return; }
    setLoading(true);
    try {
      const [lc, mp] = await Promise.all([
        branchClassMappingService.getLocalClasses(),
        branchClassMappingService.getMappings(sid),
      ]);
      setLocalClasses(lc);
      setMappings(mp);
    } catch (e) {
      toast(e.message || 'Failed to load Branch Class Mapping', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(sessionId); }, [sessionId, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const centralNameOf = (id) => centralClasses.find(c => c.id === id)?.name || '—';

  const rows = useMemo(() => localClasses.map(lc => {
    const mapping = mappings.find(m => m.localClassId === lc.id) || null;
    return { local: lc, mapping, status: mapping ? 'mapped' : 'required' };
  }), [localClasses, mappings]);

  const mappedCount = rows.filter(r => r.status === 'mapped').length;
  const requiredCount = rows.length - mappedCount;

  const openMap = (row) => setMapModal({ localClass: row.local, existing: row.mapping });

  const saveMapping = async (centralClassId) => {
    try {
      await branchClassMappingService.saveMapping({
        localClassId: mapModal.localClass.id,
        centralClassId,
        branchClassName: mapModal.localClass.name,
        id: mapModal.existing?.id || 0,
      });
      toast(`"${mapModal.localClass.name}" mapped successfully.`, 'success');
      setMapModal(null);
      load(sessionId);
    } catch (e) {
      toast(e.message || 'Could not save this mapping.', 'error');
    }
  };

  const CardHead = ({ sub }) => (
    <div className="cs-card-head">
      <div className="cs-status-badge" style={{ background: 'rgba(var(--brand-dark-rgb), .1)', color: 'var(--brand-solid, #1E40AF)' }}>
        <i className="fa-solid fa-sitemap" aria-hidden="true"></i> Branch Mapping
      </div>
      <div>
        <div className="cs-card-title">Branch Class Mapping</div>
        <div className="cs-card-sub">{sub}</div>
      </div>
    </div>
  );

  /* ── Still resolving the network / its classes ── */
  if (netLoading) {
    return (
      <div className="cs-card" style={{ marginBottom: 18 }}>
        <CardHead sub="Links this school's own class names to the standard classes the network (Head Office) uses." />
        <div className="settings-empty">
          <div className="settings-empty-ic"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i></div>
          <div className="settings-empty-title">Loading network classes…</div>
        </div>
      </div>
    );
  }

  /* ── This school isn't part of a network ── */
  if (!networkId) {
    return (
      <div className="cs-card" style={{ marginBottom: 18 }}>
        <CardHead sub="Links this school's own class names to the standard classes the network (Head Office) uses." />
        <div className="settings-empty">
          <div className="settings-empty-ic"><i className="fa-solid fa-link-slash" aria-hidden="true"></i></div>
          <div className="settings-empty-title">This school isn't part of a network yet</div>
          <div className="settings-empty-sub">
            Once this school joins a chain / network, that network's central classes will appear here to map against.
          </div>
        </div>
      </div>
    );
  }

  /* ── In a network, but the network has no classes yet ── */
  if (!centralClasses.length) {
    return (
      <div className="cs-card" style={{ marginBottom: 18 }}>
        <CardHead sub="Links this school's own class names to the standard classes the network (Head Office) uses." />
        <div className="settings-empty">
          <div className="settings-empty-ic"><i className="fa-solid fa-chalkboard" aria-hidden="true"></i></div>
          <div className="settings-empty-title">No network classes defined yet</div>
          <div className="settings-empty-sub">
            The network (Head Office) hasn't set up any central classes yet — once it does, they'll be ready to map here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cs-card" style={{ marginBottom: 18 }}>
      <CardHead sub="Map each of this school's own classes to the standard classes your Head Office uses, so an exam Head Office assigns to a central class reaches the right class here automatically." />

      <div className="settings-stats">
        <div className="settings-stat settings-stat--blue">
          <div className="settings-stat-ic"><i className="fa-solid fa-chalkboard" aria-hidden="true"></i></div>
          <div className="settings-stat-lbl">Local Classes</div>
          <div className="settings-stat-val">{rows.length}</div>
        </div>
        <div className="settings-stat settings-stat--green">
          <div className="settings-stat-ic"><i className="fa-solid fa-circle-check" aria-hidden="true"></i></div>
          <div className="settings-stat-lbl">Mapped</div>
          <div className="settings-stat-val">{mappedCount}</div>
        </div>
        <div className="settings-stat settings-stat--amber">
          <div className="settings-stat-ic"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></div>
          <div className="settings-stat-lbl">Mapping Required</div>
          <div className="settings-stat-val">{requiredCount}</div>
        </div>
      </div>

      <div className="settings-filters">
        <div></div>
        <select
          className="settings-select"
          value={sessionId || ''}
          onChange={(e) => setSessionId(Number(e.target.value))}
          aria-label="Academic session"
        >
          {sessions.map(s => (
            <option key={s.id} value={s.id}>{s.name}{s.status === 'current' ? ' (Current)' : ''}</option>
          ))}
        </select>
        <div></div>
      </div>

      {!loading && rows.length === 0 ? (
        <div className="settings-empty">
          <div className="settings-empty-ic"><i className="fa-solid fa-chalkboard" aria-hidden="true"></i></div>
          <div className="settings-empty-title">No local classes found</div>
          <div className="settings-empty-sub">Add classes in Students before mapping them here.</div>
        </div>
      ) : (
        <div className="settings-table">
          <div className="settings-table-head" style={{ gridTemplateColumns: '1fr 1fr 160px 130px' }}>
            <div className="th">Network Class</div>
            <div className="th">Local School Class</div>
            <div className="th c">Mapping Status</div>
            <div className="th c">Actions</div>
          </div>
          {rows.map(row => (
            <div key={row.local.id} className="settings-table-row" style={{ gridTemplateColumns: '1fr 1fr 160px 130px' }}>
              <div className="td">
                {row.mapping ? <b>{centralNameOf(row.mapping.centralClassId)}</b> : <span style={{ color: '#94A3B8' }}>—</span>}
              </div>
              <div className="td"><b>{row.local.name}</b></div>
              <div className="td c">
                {row.status === 'mapped'
                  ? <span className="settings-badge settings-badge--green"><i className="fa-solid fa-check" aria-hidden="true"></i> Mapped</span>
                  : <span className="settings-badge settings-badge--amber"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Mapping Required</span>}
              </div>
              <div className="td c settings-actions">
                {row.status === 'mapped' ? (
                  <Tooltip text={`Change the network class for ${row.local.name}`}>
                    <button type="button" className="settings-act" onClick={() => openMap(row)} aria-label={`Edit mapping for ${row.local.name}`}>
                      <i className="fa-solid fa-pen" aria-hidden="true"></i>
                    </button>
                  </Tooltip>
                ) : (
                  <Tooltip text={`Map ${row.local.name} to a network class`}>
                    <button type="button" className="settings-btn settings-btn-primary" style={{ height: 32, padding: '0 12px', fontSize: 12 }} onClick={() => openMap(row)}>
                      <i className="fa-solid fa-link" aria-hidden="true"></i> Map Class
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {mapModal && (
        <MapClassModal
          localClass={mapModal.localClass}
          existing={mapModal.existing}
          centralClasses={centralClasses}
          onClose={() => setMapModal(null)}
          onSave={saveMapping}
        />
      )}
    </div>
  );
}

/* ─── Add / edit one mapping ─── */
function MapClassModal({ localClass, existing, centralClasses, onClose, onSave }) {
  const [centralClassId, setCentralClassId] = useState(existing?.centralClassId || '');
  const isEdit = !!existing;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return createPortal((
    <div className="settings-modal-back" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="settings-modal settings-modal--sm">
        <div className="settings-modal-head">
          <div className="settings-modal-head-l">
            <div className="settings-modal-icn"><i className="fa-solid fa-link" aria-hidden="true"></i></div>
            <div>
              <div className="settings-modal-title">{isEdit ? 'Edit Mapping' : 'Map Class'}</div>
              <div className="settings-modal-sub">{localClass.name}</div>
            </div>
          </div>
          <Tooltip text="Close (Esc)">
            <button className="settings-modal-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true"></i></button>
          </Tooltip>
        </div>
        <div className="settings-modal-body">
          <div className="settings-field">
            <label>Local School Class</label>
            <input className="settings-input" value={localClass.name} disabled />
            <span className="settings-field-helper">This is the class already set up in Students — it can't be changed here.</span>
          </div>
          <div className="settings-field" style={{ marginTop: 14 }}>
            <label htmlFor="bcm-central">Network Class <span className="settings-field-req">*</span></label>
            <select id="bcm-central" className="settings-input" value={centralClassId} onChange={(e) => setCentralClassId(Number(e.target.value) || '')}>
              <option value="">Choose a network class…</option>
              {centralClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span className="settings-field-helper">The standard class the network (Head Office) uses — content assigned to it will reach {localClass.name} here.</span>
          </div>
        </div>
        <div className="settings-modal-foot">
          <Tooltip text="Discard and close"><button type="button" className="settings-btn settings-btn-ghost" onClick={onClose}>Cancel</button></Tooltip>
          <Tooltip text="Save this mapping">
            <button type="button" className="settings-btn settings-btn-primary" disabled={!centralClassId} onClick={() => onSave(centralClassId)}>
              <i className="fa-solid fa-floppy-disk" aria-hidden="true"></i> Save Mapping
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  ), document.body);
}
