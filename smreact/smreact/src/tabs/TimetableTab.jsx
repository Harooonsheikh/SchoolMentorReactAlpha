import React, { useState } from 'react';
import { DAYS } from '../data/initialData';

const PERIOD_COLORS = ['#1E40AF', '#0EA5E9', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#EC4899', '#06B6D4'];

const DEFAULT_SUBJECTS = ['Mathematics', 'Science', 'Urdu', 'English', 'Social Studies', 'Computer', 'Break'];

function EditPeriodsModal({ open, cls, sec, day, periods, subjects, onClose, onSave }) {
  const [localPeriods, setLocalPeriods] = useState([]);

  React.useEffect(() => {
    if (open) setLocalPeriods(periods ? [...periods] : []);
  }, [open, periods]);

  const addPeriod = (type = 'class') => {
    setLocalPeriods(prev => [...prev, {
      periodNum: prev.length + 1,
      type,
      subject: type === 'break' ? 'Break' : '',
      teacher: '',
      startTime: '',
      duration: type === 'break' ? 30 : 40,
    }]);
  };

  const updatePeriod = (idx, key, val) => {
    setLocalPeriods(prev => prev.map((p, i) => i === idx ? { ...p, [key]: val } : p));
  };

  const deletePeriod = (idx) => {
    setLocalPeriods(prev => prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, periodNum: i + 1 })));
  };

  if (!open) return null;

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl" style={{ maxHeight: '90vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 24px', background: 'linear-gradient(135deg,#1E3A8A,#1E40AF,#0EA5E9)', flexShrink: 0, borderRadius: '20px 20px 0 0' }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18 }}>
            <i className="fas fa-calendar-week"></i>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>Edit Timetable — {DAYS[day]}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <span style={{ padding: '3px 12px', borderRadius: 99, background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.25)', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                {cls?.name}
              </span>
              {sec && <span style={{ padding: '3px 12px', borderRadius: 99, background: 'rgba(22,163,74,.2)', border: '1px solid rgba(22,163,74,.3)', fontSize: 11, fontWeight: 700, color: '#4ADE80' }}>{sec}</span>}
            </div>
          </div>
          <button className="modal-close" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={onClose}><i className="fas fa-times"></i></button>
        </div>

        <div className="modal-body" style={{ background: 'var(--bg-base)' }}>
          {!localPeriods.length ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <div className="empty-icon"><i className="fas fa-calendar-plus"></i></div>
              <div className="empty-title">No Periods Yet</div>
              <div className="empty-sub">Add periods to build the timetable for this day.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {localPeriods.map((p, idx) => {
                const col = p.type === 'break' ? '#DC2626' : PERIOD_COLORS[idx % PERIOD_COLORS.length];
                return (
                  <div key={idx} style={{ background: 'var(--bg-card)', border: `2px solid var(--border-light)`, borderRadius: 16, overflow: 'hidden', borderLeft: `4px solid ${col}`, boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: `color-mix(in srgb, ${col} 6%, transparent)`, borderBottom: '1px solid var(--border-light)' }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: col, color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {p.periodNum}
                      </div>
                      <div style={{ flex: 1, fontSize: 13.5, fontWeight: 800, color: 'var(--text-primary)' }}>
                        {p.type === 'break' ? '☕ Break' : `Period ${p.periodNum}`}
                        {p.subject && p.type !== 'break' && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 8 }}>— {p.subject}</span>}
                      </div>
                      <span style={{ padding: '2px 9px', borderRadius: 99, background: 'var(--bg-muted)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, border: '1px solid var(--border-light)' }}>{p.duration}min</span>
                      <button onClick={() => deletePeriod(idx)} style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(220,38,38,.08)', border: '1.5px solid rgba(220,38,38,.2)', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, transition: 'all .18s', flexShrink: 0 }}>
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Type</div>
                        <select style={{ height: 40, border: '1.5px solid var(--border-light)', borderRadius: 10, padding: '0 12px', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', background: 'var(--bg-card)', outline: 'none', cursor: 'pointer', width: '100%', appearance: 'none' }}
                          value={p.type} onChange={e => updatePeriod(idx, 'type', e.target.value)}>
                          <option value="class">Class</option>
                          <option value="break">Break</option>
                          <option value="lab">Lab</option>
                          <option value="activity">Activity</option>
                        </select>
                      </div>
                      {p.type !== 'break' ? (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Subject</div>
                            <select style={{ height: 40, border: '1.5px solid var(--border-light)', borderRadius: 10, padding: '0 12px', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', background: 'var(--bg-card)', outline: 'none', cursor: 'pointer', width: '100%', appearance: 'none' }}
                              value={p.subject} onChange={e => updatePeriod(idx, 'subject', e.target.value)}>
                              <option value="">Select subject</option>
                              {subjects.map(s => <option key={s}>{s}</option>)}
                            </select>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Teacher</div>
                            <input style={{ height: 40, border: '1.5px solid var(--border-light)', borderRadius: 10, padding: '0 12px', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', background: 'var(--bg-card)', outline: 'none', width: '100%' }}
                              placeholder="Teacher name" value={p.teacher || ''} onChange={e => updatePeriod(idx, 'teacher', e.target.value)} />
                          </div>
                        </>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: 'span 2' }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Break Note</div>
                          <input style={{ height: 40, border: '1.5px solid var(--border-light)', borderRadius: 10, padding: '0 12px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-card)', outline: 'none', width: '100%' }}
                            placeholder="e.g. Lunch Break, Recess..." value={p.subject || 'Break'} onChange={e => updatePeriod(idx, 'subject', e.target.value)} />
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Duration (min)</div>
                        <input type="number" style={{ height: 40, border: '1.5px solid var(--border-light)', borderRadius: 10, padding: '0 12px', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', background: 'var(--bg-card)', outline: 'none', width: '100%' }}
                          value={p.duration} onChange={e => updatePeriod(idx, 'duration', parseInt(e.target.value) || 40)} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderTop: '1px solid var(--border-light)', background: 'var(--bg-card)', flexShrink: 0, borderRadius: '0 0 20px 20px', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ padding: '9px 18px', borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1.5px solid var(--border-light)', background: 'var(--bg-muted)', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }} onClick={() => addPeriod('class')}>
              <i className="fas fa-plus" style={{ marginRight: 6 }}></i>Add Period
            </button>
            <button style={{ padding: '9px 18px', borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1.5px solid rgba(220,38,38,.2)', background: 'rgba(220,38,38,.06)', color: '#DC2626', fontFamily: 'var(--font-body)' }} onClick={() => addPeriod('break')}>
              <i className="fas fa-coffee" style={{ marginRight: 6 }}></i>Add Break
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ padding: '9px 18px', borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1.5px solid var(--border-light)', background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }} onClick={onClose}>Cancel</button>
            <button style={{ padding: '9px 18px', borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg,#15803D,#166534)', color: '#fff', fontFamily: 'var(--font-body)', boxShadow: '0 3px 12px rgba(21,128,61,.3)' }} onClick={() => { onSave(localPeriods); onClose(); }}>
              <i className="fas fa-save" style={{ marginRight: 6 }}></i>Save Timetable
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TimetableTab({ classesData, subjectsData, timetableData, setTimetableData, currentTTDay, setCurrentTTDay, showToast }) {
  const [editTarget, setEditTarget] = useState(null); // { cls, sec }
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const getKey = (clsId, sec, day) => `${clsId}_${sec || 'null'}_${day}`;

  const getPeriods = (clsId, sec) => timetableData[getKey(clsId, sec, currentTTDay)] || [];

  const savePeriods = (clsId, sec, periods) => {
    const key = getKey(clsId, sec, currentTTDay);
    setTimetableData(prev => ({ ...prev, [key]: periods }));
    showToast('Timetable saved', 'success');
  };

  const deleteDay = () => {
    const updated = { ...timetableData };
    Object.keys(updated).forEach(k => {
      if (k.endsWith(`_${currentTTDay}`)) delete updated[k];
    });
    setTimetableData(updated);
    setShowDeleteConfirm(false);
    showToast(`${DAYS[currentTTDay]} timetable cleared`, 'info');
  };

  // Build rows: all class-section combinations
  const rows = [];
  classesData.forEach(cls => {
    const secs = cls.sections?.length ? cls.sections : [null];
    secs.forEach(sec => rows.push({ cls, sec }));
  });

  const dayHasData = (day) => rows.some(({ cls, sec }) => (timetableData[getKey(cls.id, sec, day)] || []).length > 0);

  return (
    <div className="tab-panel active">
      {/* Toolbar */}
      <div className="classes-toolbar">
        <div className="toolbar-left">
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            <i className="fas fa-calendar-alt" style={{ color: 'var(--brand-primary)', marginRight: 8 }}></i>Timetable
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Manage daily & weekly class schedules</div>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-md" style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: '#fff', boxShadow: '0 4px 14px rgba(109,40,217,.3)' }}
            onClick={() => showToast('Auto-generate wizard coming soon', 'info')}>
            <i className="fas fa-magic"></i> Auto Generate
          </button>
          <button className="btn-delete-day" onClick={() => setShowDeleteConfirm(true)}>
            <i className="fas fa-trash-alt"></i> Delete Day
          </button>
          <button className="btn btn-pdf btn-md" onClick={() => showToast('Opening PDF report...', 'info')}>
            <i className="fas fa-file-pdf"></i> Download Report
          </button>
        </div>
      </div>

      {/* Day tabs */}
      <div className="tt-day-tabs">
        {DAYS.map((day, idx) => (
          <button key={idx} className={`tt-day-btn${currentTTDay === idx ? ' active' : ''}`} onClick={() => setCurrentTTDay(idx)}>
            {day}
            {dayHasData(idx) && <span className="tt-day-dot" style={{ color: currentTTDay === idx ? 'rgba(255,255,255,.8)' : 'var(--success)' }}>•</span>}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="classes-table-card" style={{ overflowX: 'auto' }}>
        <div className="tt-table-head">
          <div className="th">S. No.</div>
          <div className="th">Class</div>
          <div className="th">Section</div>
          <div className="th">Periods</div>
          <div className="th" style={{ textAlign: 'center' }}>Actions</div>
        </div>
        <div>
          {!rows.length ? (
            <div className="empty-state">
              <div className="empty-icon"><i className="fas fa-calendar-alt"></i></div>
              <div className="empty-title">No Classes Found</div>
              <div className="empty-sub">Add classes and sections in the Classes tab first.</div>
            </div>
          ) : rows.map(({ cls, sec }, i) => {
            const periods = getPeriods(cls.id, sec);
            const classPeriods = periods.filter(p => p.type !== 'break');
            const breakPeriods = periods.filter(p => p.type === 'break');
            return (
              <div key={`${cls.id}_${sec || 'null'}`} className="tt-row">
                <div className="td" style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 11.5 }}>{String(i + 1).padStart(2, '0')}</div>
                <div className="td" style={{ fontWeight: 700, fontSize: 13 }}>{cls.name}</div>
                <div className="td">
                  {sec ? <span className="stu-section-pill">{sec}</span> : <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No section</span>}
                </div>
                <div className="td">
                  {periods.length ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {classPeriods.length > 0 && (
                        <span className="tt-period-pill"><i className="fas fa-book" style={{ fontSize: 10 }}></i>{classPeriods.length} periods</span>
                      )}
                      {breakPeriods.length > 0 && (
                        <span className="tt-period-pill" style={{ background: 'rgba(220,38,38,.07)', borderColor: 'rgba(220,38,38,.15)', color: '#DC2626' }}>
                          <i className="fas fa-coffee" style={{ fontSize: 10 }}></i>{breakPeriods.length} break{breakPeriods.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  ) : <span className="tt-period-pill empty"><i className="fas fa-clock" style={{ fontSize: 10 }}></i>Not set</span>}
                </div>
                <div className="td" style={{ justifyContent: 'center' }}>
                  <button className="btn-edit-tt" onClick={() => setEditTarget({ cls, sec })}>
                    <i className="fas fa-edit"></i> Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Modal */}
      {editTarget && (
        <EditPeriodsModal
          open={!!editTarget}
          cls={editTarget.cls}
          sec={editTarget.sec}
          day={currentTTDay}
          periods={getPeriods(editTarget.cls.id, editTarget.sec)}
          subjects={subjectsData}
          onClose={() => setEditTarget(null)}
          onSave={(periods) => { savePeriods(editTarget.cls.id, editTarget.sec, periods); setEditTarget(null); }}
        />
      )}

      {/* Delete day confirm */}
      {showDeleteConfirm && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setShowDeleteConfirm(false)}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--error)' }}><i className="fas fa-trash-alt" style={{ marginRight: 7 }}></i>Clear Day</div>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(false)}><i className="fas fa-times"></i></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
                Clear all timetable data for <strong>{DAYS[currentTTDay]}</strong>? This action cannot be undone.
              </p>
              <div className="modal-footer">
                <button className="btn btn-secondary btn-md" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                <button className="btn btn-danger btn-md" onClick={deleteDay}><i className="fas fa-trash"></i> Clear Day</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
