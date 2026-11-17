import React from 'react';

/* ═══════════════════════════════════════════════════════════════════
   PAPER GENERATOR — Board Pattern (Template 4)
   Ported from School-Mentor-Front-end commit 141f4ef.

   LOCAL CONFIG ONLY: the board catalog below is static reference data
   (there is no backend endpoint for boards). The chosen board / level /
   group live in PaperGenerator state exactly like `templateId` does — they
   are not persisted to the server. Paper data (subject, marks, time, title)
   always comes from the live paper / Make Paper form.

   fam: pj = Punjab style · sd = Sindh style · fb = Federal style ·
        kp = KP/Balochistan style · aku = AKU-EB style.
   ═══════════════════════════════════════════════════════════════════ */

export const PG_BOARD_LEVELS = {
  ssc1:  { k: 'Matric',       exam: 'Secondary School Certificate (SSC) Part-I',          cls: 'Class IX',  short: 'SSC Part-I',   groups: ['Science', 'General'] },
  ssc2:  { k: 'Matric',       exam: 'Secondary School Certificate (SSC) Part-II',         cls: 'Class X',   short: 'SSC Part-II',  groups: ['Science', 'General'] },
  hssc1: { k: 'Intermediate', exam: 'Higher Secondary School Certificate (HSSC) Part-I',  cls: 'Class XI',  short: 'HSSC Part-I',  groups: ['Pre-Medical', 'Pre-Engineering', 'ICS', 'F.A. (Arts)', 'I.Com'] },
  hssc2: { k: 'Intermediate', exam: 'Higher Secondary School Certificate (HSSC) Part-II', cls: 'Class XII', short: 'HSSC Part-II', groups: ['Pre-Medical', 'Pre-Engineering', 'ICS', 'F.A. (Arts)', 'I.Com'] },
};
const PG_BOARD_P = 'Board of Intermediate and Secondary Education, ';
export const PG_BOARDS = [
  { id: 'lhr',      prov: 'Punjab',             name: PG_BOARD_P + 'Lahore',      sh: 'BISE Lahore',      ab: 'LHR',   fam: 'pj',  col: '#0B5D3B', dg: 6 },
  { id: 'rwp',      prov: 'Punjab',             name: PG_BOARD_P + 'Rawalpindi',  sh: 'BISE Rawalpindi',  ab: 'RWP',   fam: 'pj',  col: '#1D4ED8', dg: 6 },
  { id: 'grw',      prov: 'Punjab',             name: PG_BOARD_P + 'Gujranwala',  sh: 'BISE Gujranwala',  ab: 'GRW',   fam: 'pj',  col: '#7C2D12', dg: 6 },
  { id: 'fsd',      prov: 'Punjab',             name: PG_BOARD_P + 'Faisalabad',  sh: 'BISE Faisalabad',  ab: 'FSD',   fam: 'pj',  col: '#6D28D9', dg: 6 },
  { id: 'mtn',      prov: 'Punjab',             name: PG_BOARD_P + 'Multan',      sh: 'BISE Multan',      ab: 'MTN',   fam: 'pj',  col: '#B45309', dg: 6 },
  { id: 'sgd',      prov: 'Punjab',             name: PG_BOARD_P + 'Sargodha',    sh: 'BISE Sargodha',    ab: 'SGD',   fam: 'pj',  col: '#0E7490', dg: 6 },
  { id: 'dgk',      prov: 'Punjab',             name: PG_BOARD_P + 'D.G. Khan',   sh: 'BISE D.G. Khan',   ab: 'DGK',   fam: 'pj',  col: '#9F1239', dg: 6 },
  { id: 'swl',      prov: 'Punjab',             name: PG_BOARD_P + 'Sahiwal',     sh: 'BISE Sahiwal',     ab: 'SWL',   fam: 'pj',  col: '#4D7C0F', dg: 6 },
  { id: 'bwp',      prov: 'Punjab',             name: PG_BOARD_P + 'Bahawalpur',  sh: 'BISE Bahawalpur',  ab: 'BWP',   fam: 'pj',  col: '#334155', dg: 6 },
  { id: 'khi',      prov: 'Sindh',              name: { m: 'Board of Secondary Education, Karachi', i: 'Board of Intermediate Education, Karachi' }, sh: 'BSEK / BIEK Karachi', ab: 'KHI', fam: 'sd', col: '#0F3D91', dg: 6 },
  { id: 'hyd',      prov: 'Sindh',              name: PG_BOARD_P + 'Hyderabad',   sh: 'BISE Hyderabad',   ab: 'HYD',   fam: 'sd',  col: '#14532D', dg: 6 },
  { id: 'skr',      prov: 'Sindh',              name: PG_BOARD_P + 'Sukkur',      sh: 'BISE Sukkur',      ab: 'SKR',   fam: 'sd',  col: '#831843', dg: 6 },
  { id: 'lrk',      prov: 'Sindh',              name: PG_BOARD_P + 'Larkana',     sh: 'BISE Larkana',     ab: 'LRK',   fam: 'sd',  col: '#78350F', dg: 6 },
  { id: 'mpk',      prov: 'Sindh',              name: PG_BOARD_P + 'Mirpurkhas',  sh: 'BISE Mirpurkhas',  ab: 'MPK',   fam: 'sd',  col: '#164E63', dg: 6 },
  { id: 'peshawar', prov: 'Khyber Pakhtunkhwa', name: PG_BOARD_P + 'Peshawar',    sh: 'BISE Peshawar',    ab: 'PSH',   fam: 'kp',  col: '#7F1D1D', dg: 6 },
  { id: 'mdn',      prov: 'Khyber Pakhtunkhwa', name: PG_BOARD_P + 'Mardan',      sh: 'BISE Mardan',      ab: 'MDN',   fam: 'kp',  col: '#1E3A8A', dg: 6 },
  { id: 'swt',      prov: 'Khyber Pakhtunkhwa', name: PG_BOARD_P + 'Swat',        sh: 'BISE Swat',        ab: 'SWT',   fam: 'kp',  col: '#115E59', dg: 6 },
  { id: 'koh',      prov: 'Khyber Pakhtunkhwa', name: PG_BOARD_P + 'Kohat',       sh: 'BISE Kohat',       ab: 'KOH',   fam: 'kp',  col: '#5B21B6', dg: 6 },
  { id: 'abt',      prov: 'Khyber Pakhtunkhwa', name: PG_BOARD_P + 'Abbottabad',  sh: 'BISE Abbottabad',  ab: 'ABT',   fam: 'kp',  col: '#166534', dg: 6 },
  { id: 'ban',      prov: 'Khyber Pakhtunkhwa', name: PG_BOARD_P + 'Bannu',       sh: 'BISE Bannu',       ab: 'BAN',   fam: 'kp',  col: '#9A3412', dg: 6 },
  { id: 'mal',      prov: 'Khyber Pakhtunkhwa', name: PG_BOARD_P + 'Malakand',    sh: 'BISE Malakand',    ab: 'MAL',   fam: 'kp',  col: '#155E75', dg: 6 },
  { id: 'dik',      prov: 'Khyber Pakhtunkhwa', name: PG_BOARD_P + 'D.I. Khan',   sh: 'BISE D.I. Khan',   ab: 'DIK',   fam: 'kp',  col: '#3F3F46', dg: 6 },
  { id: 'qta',      prov: 'Balochistan',        name: 'Balochistan Board of Intermediate and Secondary Education, Quetta', sh: 'BBISE Quetta', ab: 'QTA', fam: 'kp', col: '#0F766E', dg: 6 },
  { id: 'ajk',      prov: 'Azad Kashmir',       name: 'AJK Board of Intermediate and Secondary Education, Mirpur', sh: 'AJK Board Mirpur', ab: 'AJK', fam: 'pj', col: '#166534', dg: 6 },
  { id: 'fbise',    prov: 'Federal & Private',  name: 'Federal Board of Intermediate and Secondary Education, Islamabad', sh: 'FBISE Islamabad', ab: 'FBISE', fam: 'fb', col: '#064E3B', dg: 7 },
  { id: 'aku',      prov: 'Federal & Private',  name: 'Aga Khan University Examination Board', sh: 'AKU-EB', ab: 'AKU-EB', fam: 'aku', col: '#0A5C8A', dg: 6 },
];

export function pgBoardFind(id) { return PG_BOARDS.find(b => b.id === id) || PG_BOARDS[0]; }
export function pgBoardLevel(key) { return PG_BOARD_LEVELS[key] || PG_BOARD_LEVELS.ssc2; }
export function pgBoardName(b, level) { return typeof b.name === 'string' ? b.name : (level.k === 'Matric' ? b.name.m : b.name.i); }
export function pgFmtMinutes(m) {
  if (!m) return '—';
  const h = Math.floor(m / 60), r = m % 60;
  return (h ? h + ' Hour' + (h > 1 ? 's' : '') : '') + (h && r ? ' ' : '') + (r ? r + ' Minutes' : '');
}
function pgHashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
/* Boards grouped by province, in catalog order — feeds the Board select's optgroups */
export function pgBoardOptgroups() {
  const out = [];
  PG_BOARDS.forEach(b => {
    let g = out.find(x => x.prov === b.prov);
    if (!g) { g = { prov: b.prov, boards: [] }; out.push(g); }
    g.boards.push(b);
  });
  return out;
}

/* Normalise the header inputs. `info` uses the ERP header shape
   (subject, objMarks, objTime, subjMarks, subjTime, showObj, showSubj,
   examTitle) — the same object ClassicHeader/ModernHeader/FormalHeader get.
   Without `info` the reference sample values are shown (Paper Setup previews). */
function pgBoardModel(board, level, group, info) {
  const live = !!info;
  const d = info || {};
  const O = d.showObj !== false, S = d.showSubj !== false;
  const subj = d.subject || 'English';
  const oTm = +(d.objTime ?? 20) || 0, sTm = +(d.subjTime ?? 160) || 0;
  const oT = +(d.objMarks ?? 15) || 0,  sT = +(d.subjMarks ?? 60) || 0;
  const code = 1000 + (pgHashStr(subj + level.short + board.id) % 9000);
  const nm = pgBoardName(board, level);
  /* Sample (setup preview) keeps the reference wording; a live paper shows its
     own title instead of a hard-coded "Annual Examination, 2026". */
  const exam = live && d.examTitle
    ? `${level.exam} — ${d.examTitle}`.toUpperCase()
    : level.exam.toUpperCase() + ' ANNUAL EXAMINATION, 2026';
  const examPlain = live && d.examTitle ? `${level.exam} — ${d.examTitle}` : `${level.exam} — Annual Examination 2026`;
  const grp = group || level.groups[0];
  const note = O && !S
    ? 'Note: Four possible answers A, B, C and D to each question are given. Mark the correct answer on the answer sheet. Cutting, overwriting or use of more than one answer will be marked zero.'
    : S && !O
    ? 'Note: Attempt all questions. Write neatly and legibly. Marks are shown against each question.'
    : 'Note: Part-I is compulsory — answer on the question paper in the given time. Then attempt Part-II on the answer book.';
  const tTm = (O ? oTm : 0) + (S ? sTm : 0);
  const tMk = (O ? oT : 0) + (S ? sT : 0);
  return { live, O, S, subj, SUBJ: subj.toUpperCase(), oTm, sTm, oT, sT, tTm, tMk, code, NM: nm.toUpperCase(), exam, examPlain, grp, note };
}

/* ── Board Pattern header (React) ── */
function BoardBoxes({ n }) {
  return <span className="pgx-bd-boxes">{Array.from({ length: n }).map((_, i) => <i key={i}></i>)}</span>;
}
function BoardPartsTable({ O, S, oTm, sTm, oT, sT }) {
  return (
    <table className="pgx-bd-tb">
      <thead>
        <tr><th>Part</th><th>Time Allowed</th><th>Maximum Marks</th></tr>
      </thead>
      <tbody>
        {O && <tr><td>Part-I (Objective)</td><td>{pgFmtMinutes(oTm)}</td><td>{oT || '—'}</td></tr>}
        {S && <tr><td>Part-II (Subjective)</td><td>{pgFmtMinutes(sTm)}</td><td>{sT || '—'}</td></tr>}
        {O && S && <tr className="tt"><td>Total</td><td>{pgFmtMinutes(oTm + sTm)}</td><td>{(oT + sT) || '—'}</td></tr>}
      </tbody>
    </table>
  );
}

export function BoardHeader({ board, level, group, info, isBW = false }) {
  const m = pgBoardModel(board, level, group, info);
  const style0 = { '--bd': isBW ? '#111827' : board.col };

  if (board.fam === 'pj') {
    return (
      <div className="pgx-bd pgx-bd-pj" style={style0}>
        <div className="r1">
          <div className="roll"><b>Roll No.</b><BoardBoxes n={board.dg} /></div>
          <div className="mid"><div className="crest">{board.ab}</div><div className="bn">{m.NM}</div></div>
          <div className="code"><b>Paper Code</b><span>{m.code}</span></div>
        </div>
        <div className="exam">{m.exam}</div>
        <div className="r3">
          <span><b>Subject:</b> {m.SUBJ}</span><span><b>Group:</b> {m.grp}</span>
          {!m.live && <span><b>Session:</b> 2025–2026</span>}
        </div>
        <BoardPartsTable O={m.O} S={m.S} oTm={m.oTm} sTm={m.sTm} oT={m.oT} sT={m.sT} />
        <div className="note">{m.note}</div>
        <div className="sig"><span>Candidate's Name: ________________________</span><span>Signature: ______________</span></div>
      </div>
    );
  }
  if (board.fam === 'sd') {
    return (
      <div className="pgx-bd pgx-bd-sd" style={style0}>
        <div className="top"><span className="seat"><b>Seat No.</b><BoardBoxes n={board.dg} /></span><span className="pg">Page 1 of 4</span></div>
        <div className="bn">{m.NM}</div>
        <div className="ex">{m.exam}</div>
        <div className="rule2"></div>
        <table className="grid">
          <tbody>
            <tr><th>Name of Candidate</th><td colSpan={3}>______________________________________</td></tr>
            <tr><th>Subject</th><td>{m.SUBJ}</td><th>Group</th><td>{m.grp}</td></tr>
            <tr><th>Time Allowed</th><td>{pgFmtMinutes(m.tTm)}</td><th>Maximum Marks</th><td>{m.tMk || '—'}</td></tr>
            <tr><th>Centre Code</th><td>__________</td><th>Paper Code</th><td>{m.code}</td></tr>
          </tbody>
        </table>
        <div className="note">{m.note}</div>
      </div>
    );
  }
  if (board.fam === 'fb') {
    return (
      <div className="pgx-bd pgx-bd-fb" style={style0}>
        <div className="r1">
          <div className="seal">FBISE</div>
          <div className="tt"><div className="bn">{m.NM}</div><div className="ex">{m.exam}</div></div>
          <div className="rbox"><b>Roll No.</b><BoardBoxes n={board.dg} /><small>Paper Code: {m.code}</small></div>
        </div>
        <div className="band">
          <span><b>Subject</b>{m.SUBJ}</span><span><b>Group</b>{m.grp}</span>
          <span><b>Time</b>{pgFmtMinutes(m.tTm)}</span><span><b>Max. Marks</b>{m.tMk || '—'}</span>
        </div>
        <div className="inst"><b>Instructions:</b> {m.note.replace(/^Note:\s*/, '')}</div>
        <div className="sig"><span>Candidate Name: ______________________________</span><span>Signature: ______________</span></div>
      </div>
    );
  }
  if (board.fam === 'kp') {
    return (
      <div className="pgx-bd pgx-bd-kp" style={style0}>
        <div className="frame">
          <div className="r1"><span><b>Roll No.</b><BoardBoxes n={board.dg} /></span><span className="pn">Q. Paper No. {m.code}</span></div>
          <div className="crest">{board.ab}</div>
          <div className="bn">{m.NM}</div>
          <div className="ex">{m.exam}</div>
          <div className="orn"><i></i><em>✦</em><i></i></div>
          <div className="meta">
            <div><b>Subject</b><span>{m.SUBJ}</span></div>
            <div><b>Class / Group</b><span>{level.cls} · {m.grp}</span></div>
            <div><b>Time Allowed</b><span>{pgFmtMinutes(m.tTm)}</span></div>
            <div><b>Maximum Marks</b><span>{m.tMk || '—'}</span></div>
          </div>
          <div className="note">{m.note}</div>
        </div>
      </div>
    );
  }
  /* AKU-EB */
  return (
    <div className="pgx-bd pgx-bd-aku" style={style0}>
      <div className="top">
        <div className="mk">AKU<em>EB</em></div>
        <div className="tt"><div className="bn">{m.NM}</div><div className="ex">{m.examPlain}</div></div>
      </div>
      <div className="subjrow">
        <div className="sj">{m.subj}<small>{level.cls} · {m.grp}</small></div>
        <div className="pill"><b>Time</b>{pgFmtMinutes(m.tTm)}</div>
        <div className="pill"><b>Marks</b>{m.tMk || '—'}</div>
      </div>
      <div className="cand">
        <div><b>Candidate Number</b><BoardBoxes n={board.dg} /></div>
        <div><b>Candidate Name</b><span className="ln"></span></div>
        <div><b>Paper</b>{m.code}</div>
      </div>
      <div className="note">{m.note}</div>
    </div>
  );
}

/* Board / Level / Group selects — used by the Paper Setup panel and the
   template preview modal. `className` picks the wrapper layout. */
export function BoardPicker({ boardId, setBoardId, boardLevel, setBoardLevel, boardGroup, setBoardGroup, className = 'pgx-bp-pick', children }) {
  const level = pgBoardLevel(boardLevel);
  return (
    <div className={className}>
      <div>
        <label>Board</label>
        <select className="pg-select" value={boardId} onChange={e => setBoardId(e.target.value)}>
          {pgBoardOptgroups().map(g => (
            <optgroup key={g.prov} label={g.prov}>
              {g.boards.map(b => <option key={b.id} value={b.id}>{b.sh}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label>Level</label>
        <select className="pg-select" value={boardLevel} onChange={e => setBoardLevel(e.target.value)}>
          {Object.entries(PG_BOARD_LEVELS).map(([k, l]) => (
            <option key={k} value={k}>{l.k} — {l.short} ({l.cls})</option>
          ))}
        </select>
      </div>
      <div>
        <label>Group</label>
        <select className="pg-select" value={boardGroup} onChange={e => setBoardGroup(e.target.value)}>
          {level.groups.map(g => <option key={g}>{g}</option>)}
        </select>
      </div>
      {children}
    </div>
  );
}

/* ── Board Pattern header (download HTML) ──────────────────────────────
   Inline-styled mirror of <BoardHeader/> for buildFullPaperHTML. The
   download document has global table/th/td rules, so every element here
   carries its own inline style. `isBW` = colorless (low-ink) variant. */
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildBoardHeaderHTML(boardCfg, info, isBW) {
  const board = pgBoardFind(boardCfg?.boardId);
  const level = pgBoardLevel(boardCfg?.boardLevel);
  const m = pgBoardModel(board, level, boardCfg?.boardGroup, info || {});
  const C = isBW ? '#111827' : board.col;
  const INK = '#111827';
  const wrap = "font-family:'Plus Jakarta Sans',sans-serif;color:#111827;font-size:11px;line-height:1.35;margin-bottom:10px";
  const boxes = n => `<span style="display:inline-flex;gap:2px;vertical-align:middle">${Array.from({ length: n }).map(() => `<i style="display:inline-block;width:15px;height:19px;border:1.2px solid ${INK};background:#fff"></i>`).join('')}</span>`;
  const note = `<div style="font-size:9.5px;color:#374151;border-top:1px dashed #9CA3AF;padding-top:5px;margin-top:8px">${esc(m.note)}</div>`;
  const cellTd = `border:1px solid ${INK};padding:3px 8px;text-align:left;background:#fff;color:${INK}`;
  const cellTh = `border:1px solid ${INK};padding:3px 8px;text-align:left;background:#F3F4F6;color:${INK};font-size:9.5px;text-transform:uppercase;letter-spacing:.04em`;
  const sig = (a, b) => `<div style="display:flex;justify-content:space-between;gap:10px;margin-top:10px;font-size:10px"><span>${a}</span><span>${b}</span></div>`;

  if (board.fam === 'pj') {
    const rows = [
      m.O ? `<tr><td style="${cellTd}">Part-I (Objective)</td><td style="${cellTd}">${pgFmtMinutes(m.oTm)}</td><td style="${cellTd}">${m.oT || '—'}</td></tr>` : '',
      m.S ? `<tr><td style="${cellTd}">Part-II (Subjective)</td><td style="${cellTd}">${pgFmtMinutes(m.sTm)}</td><td style="${cellTd}">${m.sT || '—'}</td></tr>` : '',
      m.O && m.S ? `<tr><td style="${cellTd};font-weight:800">Total</td><td style="${cellTd};font-weight:800">${pgFmtMinutes(m.oTm + m.sTm)}</td><td style="${cellTd};font-weight:800">${(m.oT + m.sT) || '—'}</td></tr>` : '',
    ].join('');
    const lbl = `display:block;font-size:9px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;color:${C};font-weight:700`;
    return `<div style="${wrap}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
        <div><b style="${lbl}">Roll No.</b>${boxes(board.dg)}</div>
        <div style="flex:1;text-align:center">
          <div style="width:42px;height:42px;border-radius:50%;border:2px solid ${C};color:${C};margin:0 auto 4px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:10px">${esc(board.ab)}</div>
          <div style="font-weight:800;font-size:12px;color:${C}">${esc(m.NM)}</div>
        </div>
        <div><b style="${lbl}">Paper Code</b><span style="display:block;border:1.5px solid ${INK};padding:4px 10px;font-weight:800;font-size:13px;text-align:center">${m.code}</span></div>
      </div>
      <div style="text-align:center;font-weight:800;font-size:10.5px;background:${isBW ? '#fff' : C};color:${isBW ? INK : '#fff'};border:${isBW ? `1px solid ${INK}` : 'none'};padding:4px 8px;margin:8px 0 6px;letter-spacing:.02em">${esc(m.exam)}</div>
      <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;font-size:10.5px">
        <span><b>Subject:</b> ${esc(m.SUBJ)}</span><span><b>Group:</b> ${esc(m.grp)}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:10.5px;margin:0">
        <thead><tr><th style="${cellTh}">Part</th><th style="${cellTh}">Time Allowed</th><th style="${cellTh}">Maximum Marks</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${note}
      ${sig("Candidate's Name: ________________________", 'Signature: ______________')}
    </div>`;
  }
  if (board.fam === 'sd') {
    const th = `border:1px solid ${INK};padding:4px 8px;text-align:left;width:18%;background:#F9FAFB;font-weight:700;color:${INK}`;
    const td = `border:1px solid ${INK};padding:4px 8px;text-align:left;background:#fff;color:${INK}`;
    return `<div style="${wrap};font-family:'Times New Roman',Georgia,serif;font-size:12px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span><b style="margin-right:6px;font-size:11px">Seat No.</b>${boxes(board.dg)}</span>
        <span style="font-size:10px;color:#6B7280">Page 1 of 4</span>
      </div>
      <div style="text-align:center;font-size:15px;color:${C};margin-top:6px;font-weight:800">${esc(m.NM)}</div>
      <div style="text-align:center;font-weight:700;font-size:11.5px;margin-top:2px">${esc(m.exam)}</div>
      <div style="border-top:3px double ${C};margin:7px 0 8px"></div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin:0"><tbody>
        <tr><th style="${th}">Name of Candidate</th><td style="${td}" colspan="3">______________________________________</td></tr>
        <tr><th style="${th}">Subject</th><td style="${td}">${esc(m.SUBJ)}</td><th style="${th}">Group</th><td style="${td}">${esc(m.grp)}</td></tr>
        <tr><th style="${th}">Time Allowed</th><td style="${td}">${pgFmtMinutes(m.tTm)}</td><th style="${th}">Maximum Marks</th><td style="${td}">${m.tMk || '—'}</td></tr>
        <tr><th style="${th}">Centre Code</th><td style="${td}">__________</td><th style="${th}">Paper Code</th><td style="${td}">${m.code}</td></tr>
      </tbody></table>
      ${note}
    </div>`;
  }
  if (board.fam === 'fb') {
    const band = (k, v, last) => `<span style="padding:5px 9px;font-weight:700;font-size:10.5px;${last ? '' : `border-right:1px solid ${isBW ? '#D1D5DB' : 'rgba(255,255,255,.25)'};`}"><b style="display:block;font-size:8px;opacity:.75;text-transform:uppercase;letter-spacing:.06em;font-weight:600">${k}</b>${esc(v)}</span>`;
    return `<div style="${wrap}">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:48px;height:48px;border-radius:50%;background:${isBW ? '#fff' : C};color:${isBW ? INK : '#fff'};border:${isBW ? `1px solid ${INK}` : 'none'};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:9px;flex-shrink:0">FBISE</div>
        <div style="flex:1"><div style="font-weight:800;font-size:11.5px;color:${C}">${esc(m.NM)}</div><div style="font-size:9.5px;font-weight:700;color:#4B5563;margin-top:2px">${esc(m.exam)}</div></div>
        <div style="text-align:right"><b style="display:block;font-size:9px;text-transform:uppercase;margin-bottom:3px">Roll No.</b>${boxes(board.dg)}<small style="display:block;font-size:9.5px;font-weight:700;margin-top:3px">Paper Code: ${m.code}</small></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);background:${isBW ? '#fff' : C};color:${isBW ? INK : '#fff'};border:${isBW ? `1px solid ${INK}` : 'none'};margin:9px 0 6px;border-radius:3px">
        ${band('Subject', m.SUBJ)}${band('Group', m.grp)}${band('Time', pgFmtMinutes(m.tTm))}${band('Max. Marks', m.tMk || '—', true)}
      </div>
      <div style="font-size:9.5px;border:1px solid #D1D5DB;padding:5px 8px;border-radius:3px"><b>Instructions:</b> ${esc(m.note.replace(/^Note:\s*/, ''))}</div>
      ${sig('Candidate Name: ______________________________', 'Signature: ______________')}
    </div>`;
  }
  if (board.fam === 'kp') {
    const meta = (k, v, last) => `<div style="padding:4px 8px;${last ? '' : `border-right:1px solid ${INK};`}"><b style="display:block;font-size:8px;text-transform:uppercase;color:${C};letter-spacing:.05em">${k}</b><span style="font-weight:700;font-size:10.5px">${esc(v)}</span></div>`;
    return `<div style="${wrap}"><div style="border:3px double ${C};padding:10px 14px;text-align:center">
      <div style="display:flex;justify-content:space-between;align-items:center;text-align:left">
        <span><b style="font-size:9px;text-transform:uppercase;margin-right:5px">Roll No.</b>${boxes(board.dg)}</span>
        <span style="font-weight:800;font-size:10px;border:1.2px solid ${INK};padding:3px 8px">Q. Paper No. ${m.code}</span>
      </div>
      <div style="width:38px;height:38px;border-radius:50%;background:${isBW ? '#fff' : C};color:${isBW ? INK : '#fff'};border:${isBW ? `1px solid ${INK}` : 'none'};margin:6px auto 4px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:9px">${esc(board.ab)}</div>
      <div style="font-weight:800;font-size:12px;color:${C}">${esc(m.NM)}</div>
      <div style="font-size:10px;font-weight:700;margin-top:2px">${esc(m.exam)}</div>
      <div style="display:flex;align-items:center;gap:6px;margin:6px 0"><i style="flex:1;border-top:1px solid ${C}"></i><em style="color:${C};font-style:normal;font-size:10px">✦</em><i style="flex:1;border-top:1px solid ${C}"></i></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);border:1px solid ${INK};text-align:left">
        ${meta('Subject', m.SUBJ)}${meta('Class / Group', `${level.cls} · ${m.grp}`)}${meta('Time Allowed', pgFmtMinutes(m.tTm))}${meta('Maximum Marks', m.tMk || '—', true)}
      </div>
      <div style="text-align:left">${note}</div>
    </div></div>`;
  }
  /* AKU-EB */
  const pill = (k, v) => `<div style="background:${isBW ? '#fff' : '#F0F9FF'};border:1px solid ${C};color:${C};border-radius:999px;padding:4px 12px;font-weight:800;font-size:11px;text-align:center"><b style="display:block;font-size:7.5px;text-transform:uppercase;letter-spacing:.07em;opacity:.8">${k}</b>${esc(v)}</div>`;
  const candLbl = 'display:block;font-size:8px;text-transform:uppercase;color:#6B7280;margin-bottom:3px';
  return `<div style="${wrap}">
    <div style="display:flex;align-items:center;gap:12px;padding-bottom:8px;border-bottom:3px solid ${C}">
      <div style="font-weight:900;font-size:19px;color:${C};letter-spacing:-.02em">AKU<em style="font-style:normal;color:${INK};margin-left:3px">EB</em></div>
      <div><div style="font-weight:800;font-size:11.5px">${esc(m.NM)}</div><div style="font-size:9.5px;color:#6B7280;margin-top:1px">${esc(m.examPlain)}</div></div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin:9px 0 6px">
      <div style="flex:1;font-size:16px;font-weight:800">${esc(m.subj)}<small style="display:block;font-size:10px;color:#6B7280;font-weight:600">${esc(level.cls)} · ${esc(m.grp)}</small></div>
      ${pill('Time', pgFmtMinutes(m.tTm))}${pill('Marks', m.tMk || '—')}
    </div>
    <div style="display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:end;background:#F9FAFB;border-radius:6px;padding:7px 10px;font-size:10px">
      <div><b style="${candLbl}">Candidate Number</b>${boxes(board.dg)}</div>
      <div><b style="${candLbl}">Candidate Name</b><span style="display:block;border-bottom:1px solid ${INK};height:16px"></span></div>
      <div><b style="${candLbl}">Paper</b>${m.code}</div>
    </div>
    ${note}
  </div>`;
}
