import LpRichTextEditor from './LpRichTextEditor'
import { nbTr, aqOrdinal } from './lessonPlanConfig'

/* ═══════════════════════════════════════════════════════════════════
   AQ ROW — Notebook "Add Questions" modal ki ek qatar. Har question
   type ka apna layout hai (ERP ke AqRow se hu-ba-hu port).

   Placeholders jaan-boojh kar khaali rakhe gaye hain (ERP me bhi) —
   `ph` argument sirf is liye rehne diya ke callers na badlein.
   ═══════════════════════════════════════════════════════════════════ */

const NUM_S = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,#0369A1,#0891B2)', color: '#fff', fontSize: 12, fontWeight: 800, flexShrink: 0 }
const LABEL = { fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 5 }
const ACT_S = { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12, paddingTop: 10, borderTop: '1px dashed #E0F2FE' }
const ROW_HEAD = { fontSize: 13, fontWeight: 800, color: '#0369A1', marginBottom: 12, padding: '7px 12px', background: 'rgba(3,105,161,.06)', borderLeft: '3px solid #0891B2', borderRadius: '0 9px 9px 0' }

export default function LpAqRow({ i, cfg, row, typeId, onChange, onRemove, onSaveRow, dir = 'ltr', isUrdu = false }) {
  const tr = (s) => nbTr(s, isUrdu)
  const num = <span style={NUM_S}>#{i + 1}</span>
  const lbl = (t) => <span style={LABEL}>{tr(t)}</span>

  const inp = (key, ph, extra) => (
    <input
      type="text"
      className="aq-inp-hover"
      dir={dir}
      style={{ ...(extra || {}), textAlign: isUrdu ? 'right' : undefined }}
      placeholder=""
      value={row[key] || ''}
      onChange={(e) => onChange(key, e.target.value)}
    />
  )

  const ta = (key, ph, rowsCount = 3) => (
    <textarea
      className="aq-ta-hover"
      rows={rowsCount}
      dir={dir}
      style={{ textAlign: isUrdu ? 'right' : undefined }}
      placeholder=""
      value={row[key] || ''}
      onChange={(e) => onChange(key, e.target.value)}
    />
  )

  /* Poora rich-text editor (align, colour, image+resize, table, link, lists…).
     True/False ko chhod kar har jagah yehi editor lagta hai. */
  const richField = (key, ph, minHeight = 90) => (
    <LpRichTextEditor value={row[key] || ''} placeholder="" minHeight={minHeight} dir={dir} onChange={(html) => onChange(key, html)} />
  )
  const rte = (key, ph) => richField(key, ph, 90)

  const acts = (
    <div style={ACT_S}>
      <button type="button" className="aq-rb-btn" onClick={onRemove}>
        <i className="fa-solid fa-trash-can" /> {tr('Remove')}
      </button>
      <button type="button" className="aq-sb-btn" onClick={onSaveRow}>
        <i className="fa-solid fa-floppy-disk" /> {tr('Save')}
      </button>
    </div>
  )

  /* 1. TWO-COL — Word/Opposite, Singular/Plural, Word/Synonyms */
  if (cfg.layout === 'two-col') {
    const f0 = cfg.fields[0]
    const f1 = cfg.fields[1]
    return (
      <div className="aq-row-card-hover">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          {num}
          <div style={{ flex: 1, minWidth: 0 }}>{lbl(f0.label)}{inp(f0.key, f0.ph)}</div>
          <div style={{ fontSize: 22, color: '#0891B2', paddingBottom: 10, flexShrink: 0, display: 'inline-block', transform: isUrdu ? 'scaleX(-1)' : undefined }}>{cfg.arrow || '↔'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>{lbl(f1.label)}{inp(f1.key, f1.ph)}</div>
        </div>
        {acts}
      </div>
    )
  }

  /* 2. WORD SENTENCES */
  if (cfg.layout === 'word-sentence') {
    return (
      <div className="aq-row-card-hover">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {num}
          <div style={{ flex: '0 0 160px' }}>{lbl('Word')}{inp('word', 'Enter word', { height: 40 })}</div>
          <div style={{ fontSize: 18, color: 'var(--text-muted)', paddingTop: 28, flexShrink: 0, display: 'inline-block', transform: isUrdu ? 'scaleX(-1)' : undefined }}>→</div>
          <div style={{ flex: 1, minWidth: 0 }}>{lbl('Sentence')}{ta('sentence', '', 3)}</div>
        </div>
        {acts}
      </div>
    )
  }

  /* 3. MCQ */
  if (cfg.layout === 'mcq') {
    const opts = [['opt1', 'A', '#0369A1', '#EFF6FF'], ['opt2', 'B', '#6D28D9', '#F5F3FF'], ['opt3', 'C', '#0C4A6E', '#EFF9FF'], ['opt4', 'D', '#92400E', '#FFFBEB']]
    return (
      <div className="aq-row-card-hover">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          {num}{inp('question', '', { flex: 1 })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          {opts.map(([key, letter, col, bg]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', borderRadius: 10, border: `1.5px solid ${col}22`, overflow: 'hidden', height: 44 }}>
              <span style={{ width: 36, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: col, color: '#fff', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{letter}</span>
              <input
                type="text"
                style={{ flex: 1, height: 44, border: 'none', background: bg, padding: '0 10px', fontFamily: 'inherit', fontSize: 13, color: '#0F172A', outline: 'none' }}
                placeholder={`${tr('Option')} ${letter}`}
                value={row[key] || ''}
                onChange={(e) => onChange(key, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#F0FDF4', borderRadius: 10, border: '1.5px solid #BBF7D0' }}>
          <i className="fa-solid fa-circle-check" style={{ color: '#16A34A', fontSize: 13, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', whiteSpace: 'nowrap' }}>{tr('CORRECT ANSWER')}</span>
          <input
            type="text"
            style={{ boxSizing: 'border-box', display: 'block', width: '100%', height: 36, border: '1.5px solid #16A34A', borderRadius: 10, padding: '0 13px', fontFamily: 'inherit', fontSize: 14, color: '#0F172A', background: '#F0FDF4', outline: 'none', flex: 1 }}
            placeholder={tr('A / B / C / D or exact text')}
            value={row.correct || ''}
            onChange={(e) => onChange('correct', e.target.value)}
          />
        </div>
        {acts}
      </div>
    )
  }

  /* 4. FILL IN THE BLANKS */
  if (cfg.layout === 'fill-blanks') {
    return (
      <div className="aq-row-card-hover">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>{num}{lbl('Statement (use ___ for blank)')}</div>
        {ta('question', '', 3)}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, padding: '10px 12px', background: '#F0F9FF', borderRadius: 10 }}>
          <i className="fa-solid fa-key" style={{ color: '#0891B2', fontSize: 13, flexShrink: 0 }} />
          {lbl('Blank Answer:')}
          <input
            type="text"
            style={{ boxSizing: 'border-box', display: 'block', width: '100%', maxWidth: 220, height: 36, border: '1.5px solid #0891B2', borderRadius: 10, padding: '0 13px', fontFamily: 'inherit', fontSize: 14, color: '#0F172A', background: '#fff', outline: 'none' }}
            placeholder={tr('One word…')}
            value={row.answer || ''}
            onChange={(e) => onChange('answer', e.target.value)}
          />
        </div>
        {acts}
      </div>
    )
  }

  /* 5. TRUE / FALSE */
  if (cfg.layout === 'true_false') {
    const tActive = row.answer === 'true'
    const fActive = row.answer === 'false'
    return (
      <div className="aq-row-card-hover">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          {num}{inp('question', '', { flex: 1 })}
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
          <button onClick={() => onChange('answer', 'true')} className={`aq-tf-t-hover${tActive ? ' sel' : ''}`}><i className="fa-solid fa-check" /> {tr('True')}</button>
          <button onClick={() => onChange('answer', 'false')} className={`aq-tf-f-hover${fActive ? ' sel' : ''}`}><i className="fa-solid fa-xmark" /> {tr('False')}</button>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {row.answer
            ? <>Answer marked: <strong style={{ color: 'var(--text-secondary)' }}>{tActive ? tr('True') : tr('False')}</strong></>
            : 'Click True or False to mark the correct answer'}
        </div>
        {acts}
      </div>
    )
  }

  /* 6. MATCH THE COLUMNS */
  if (cfg.layout === 'match') {
    return (
      <div className="aq-row-card-hover">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {num}
          <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#0369A1', textTransform: 'uppercase', letterSpacing: '.5px' }}>{tr('Column A')}</div>
          <div style={{ fontSize: 18, color: 'var(--text-muted)', flexShrink: 0 }}>↔</div>
          <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#6D28D9', textTransform: 'uppercase', letterSpacing: '.5px' }}>{tr('Column B (Correct Match)')}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>{richField('colA', '')}</div>
          <div style={{ fontSize: 20, color: 'var(--text-muted)', flexShrink: 0, paddingTop: 24 }}>↔</div>
          <div style={{ flex: 1, minWidth: 0 }}>{richField('colB', '')}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11.5, color: 'var(--text-muted)', background: '#F0F9FF', borderRadius: 9, padding: '9px 12px', lineHeight: 1.5, marginBottom: 4 }}>
          <i className="fa-solid fa-circle-info" style={{ color: '#0891B2', fontSize: 11, flexShrink: 0, marginTop: 2 }} />
          <span>{isUrdu ? tr('Shuffle Column B when writing on board.') : 'Correct matching shown here for setup. While writing on board, shuffle Column B manually.'}</span>
        </div>
        {acts}
      </div>
    )
  }

  /* 7. SHORT QUESTIONS */
  if (cfg.layout === 'short-q') {
    return (
      <div className="aq-row-card-hover">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          {num}<span style={{ fontSize: 13, fontWeight: 700, color: '#0369A1' }}>{isUrdu ? `${tr('Question')} ${i + 1}` : `${aqOrdinal(i + 1)} Question`}</span>
        </div>
        {lbl('Question')}{rte('question', '')}
        <div style={{ marginTop: 12 }}>{lbl('Answer')}{rte('answer', '')}</div>
        {acts}
      </div>
    )
  }

  /* 8. CIRCLE THE CORRECT WORD */
  if (cfg.layout === 'circle') {
    return (
      <div className="aq-row-card-hover">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>{num}{lbl('Statement / Sentence with word choices')}</div>
        {richField('statement', '')}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 10, padding: 12, background: '#F0F9FF', borderRadius: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(6,182,212,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0891B2', fontSize: 16, flexShrink: 0, marginTop: 18 }}>
            <i className="fa-regular fa-circle-dot" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {lbl('Correct Word to Circle')}
            {richField('answer', '', 64)}
          </div>
        </div>
        {acts}
      </div>
    )
  }

  /* 9. PUNCTUATION */
  if (cfg.layout === 'punctuation') {
    return (
      <div className="aq-row-card-hover">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>{num}{lbl('Unpunctuated Sentence')}</div>
        {richField('question', '')}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 10, padding: 10, background: '#F0F9FF', borderRadius: 10 }}>
          <i className="fa-solid fa-pen-nib" style={{ color: '#0891B2', fontSize: 13, flexShrink: 0, marginTop: 4 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {lbl('Correctly Punctuated (Answer)')}
            {richField('answer', '')}
          </div>
        </div>
        {acts}
      </div>
    )
  }

  /* 10. LONG QUESTION */
  if (cfg.layout === 'long') {
    return (
      <div className="aq-row-card-hover">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {num}<span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{tr('Question')} {i + 1}</span>
        </div>
        {lbl('Question')}{rte('question', '')}
        <div style={{ marginTop: 12 }}>{lbl('Answer / Model Answer')}{rte('answer', '')}</div>
        {acts}
      </div>
    )
  }

  /* VERTICAL-EXPAND — Stories, Essays, Letter, Application, Paragraph */
  if (cfg.layout === 'vertical-expand') {
    const rowLabel = typeId === 'stories'
      ? <div style={ROW_HEAD}>{isUrdu ? 'کہانی' : 'Story'} {i + 1}</div>
      : typeId === 'essays'
        ? <div style={ROW_HEAD}>{isUrdu ? 'مضمون' : 'Essay'} {i + 1}</div>
        : null
    return (
      <div className="aq-row-card-hover">
        {rowLabel}
        {(cfg.fields || []).map((f) => (
          <div key={f.key} style={{ marginBottom: 12 }}>
            {f.label ? lbl(f.label) : null}
            {f.rte ? rte(f.key, f.ph) : ta(f.key, f.ph)}
          </div>
        ))}
        {acts}
      </div>
    )
  }

  /* COMPREHENSION row */
  if (cfg.layout === 'comprehension') {
    return (
      <div className="aq-row-card-hover">
        <div style={ROW_HEAD}>{isUrdu ? `${tr('Question')} ${i + 1}` : `${aqOrdinal(i + 1)} Question`}</div>
        {lbl('Question')}{rte('question', '')}
        <div style={{ marginTop: 12 }}>{lbl('Answer')}{rte('answer', '')}</div>
        {acts}
      </div>
    )
  }

  return (
    <div className="aq-row-card-hover">
      <div style={{ padding: 12, color: 'var(--text-muted)' }}>—</div>
    </div>
  )
}
