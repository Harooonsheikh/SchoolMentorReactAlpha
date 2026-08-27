import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useView } from '../../config/viewContext'
import TutorialButton from '../../components/TutorialButton'
import { fetchChainDashboard } from '../../api/chainDashboardApi'
import './Dashboard.css'

/* Ye screen ab poori tarah Network_Setup/GetDashboard se chalti hai —
   pehle config/dashboardData.js ke dummy schools istemal hote thay. */

const fmtMoney = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-PK')
const fmtShort = (n) => {
  const v = Number(n) || 0
  return v >= 1e7 ? (v / 1e7).toFixed(2) + ' Cr'
    : v >= 1e5 ? (v / 1e5).toFixed(2) + ' L'
    : v >= 1e3 ? (v / 1e3).toFixed(1) + 'k'
    : String(v)
}
const fmtNum = (n) => Number(n || 0).toLocaleString()
const fmtPct = (n) => `${Math.round((Number(n) || 0) * 100) / 100}%`
/* Card par poora naam nahi samata — pehla lafz kaafi hai, tooltip me poora. */
const firstWord = (name) => String(name || '—').split(' ')[0]

/* ── Shared building blocks ─────────────────────────────────────── */
function SectionHead({ icon, title, sub }) {
  return (
    <div className="dash-sec">
      <div className="dash-sec-ic"><i className={`fa-solid ${icon}`} /></div>
      <div><div className="dash-sec-tt">{title}</div>{sub && <div className="dash-sec-sub">{sub}</div>}</div>
      <div className="dash-sec-line" />
    </div>
  )
}

function MiniCard({ accent = '', icon, val, lbl, delta, tip }) {
  return (
    <div className={`mini-card ${accent}`} title={tip || `${lbl} — ${val}`} tabIndex={0}>
      <div className="mini-top">
        <div className="mini-ic"><i className={`fa-solid ${icon}`} /></div>
        {delta && <span className={`mini-delta ${delta.dir}`} title={`${delta.dir === 'up' ? 'Up' : delta.dir === 'down' ? 'Down' : 'No change'} ${delta.text} vs last month`}><i className={`fa-solid ${delta.dir === 'up' ? 'fa-arrow-trend-up' : delta.dir === 'down' ? 'fa-arrow-trend-down' : 'fa-minus'}`} /> {delta.text}</span>}
      </div>
      <div className="mini-val">{val}</div>
      <div className="mini-lbl">{lbl}</div>
    </div>
  )
}

const EmptyNote = ({ text }) => (
  <div style={{ padding: '18px 4px', fontSize: 13, color: 'var(--tm)', textAlign: 'center' }}>{text}</div>
)

function BarChart({ rows }) {
  if (!rows.length) return <EmptyNote text="No data yet" />
  const max = Math.max(...rows.map((r) => r.pct), 100)
  return (
    <div>
      {rows.map((r) => (
        <div className="bar-row" key={r.name} title={`${r.name}: ${r.val}${r.sub ? ` · ${r.sub}` : ''}`} tabIndex={0}>
          <div className="bar-head">
            <span className="bar-name">{r.icon && <i className={`fa-solid ${r.icon}`} />} {r.name}</span>
            <span className="bar-val">{r.val}</span>
          </div>
          <div className="bar-track"><div className={`bar-fill ${r.color || ''}`} style={{ width: `${(r.pct / max) * 100}%` }} /></div>
          {r.sub && <div className="bar-sub">{r.sub}</div>}
        </div>
      ))}
    </div>
  )
}

function Donut({ segments, big, cap, size = 150, stroke = 22 }) {
  const r = (size - stroke) / 2
  const c = size / 2
  const C = 2 * Math.PI * r
  const total = segments.reduce((n, s) => n + s.value, 0) || 1
  let acc = 0
  return (
    <div className="donut" style={{ width: size, height: size }} title={`${big} ${cap}`} tabIndex={0}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        {segments.map((s, i) => {
          const len = (s.value / total) * C
          const off = acc; acc += len
          return <circle key={i} cx={c} cy={c} r={r} fill="none" stroke={s.color} strokeWidth={stroke} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform={`rotate(-90 ${c} ${c})`} />
        })}
      </svg>
      <div className="donut-center"><div className="donut-big">{big}</div><div className="donut-cap">{cap}</div></div>
    </div>
  )
}

function Legend({ items }) {
  return (
    <div className="donut-legend">
      {items.map((it) => (
        <div className="dl-item" key={it.name} title={`${it.name}: ${it.val}`} tabIndex={0}>
          <span className="dl-dot" style={{ background: it.color }} /><span className="dl-name">{it.name}</span><span className="dl-val">{it.val}</span>
        </div>
      ))}
    </div>
  )
}

function LineChart({ id, values, labels, color = 'var(--brand)', height = 120 }) {
  /* Aik hi point ho to line ban hi nahi sakti. */
  if (values.length < 2) return <EmptyNote text="Not enough data to plot a trend yet" />
  const W = 320; const H = height; const pad = 10
  const max = Math.max(...values); const min = Math.min(...values, 0)
  const range = (max - min) || 1
  const stepX = (W - pad * 2) / (values.length - 1)
  const pts = values.map((v, i) => [pad + i * stepX, H - pad - ((v - min) / range) * (H - pad * 2)])
  const line = pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')
  const area = `${pad},${H - pad} ${line} ${(W - pad).toFixed(1)},${H - pad}`
  return (
    <>
      <svg className="line-svg" viewBox={`0 0 ${W} ${H}`}>
        <defs><linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".28" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        <polygon points={area} fill={`url(#g-${id})`} />
        <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#fff" stroke={color} strokeWidth="2" />)}
      </svg>
      <div className="line-x">{labels.map((l) => <span key={l}>{l}</span>)}</div>
    </>
  )
}

const ChartCard = ({ icon, title, right, scroll, children }) => (
  <div className="chart-card">
    <div className="chart-hd"><div className="chart-tt"><i className={`fa-solid ${icon}`} /> {title}</div>{right}</div>
    <div className={`chart-bd${scroll ? ' scroll' : ''}`}>{children}</div>
  </div>
)

/* ════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { isViewOnly, selectedSchool } = useView()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await fetchChainDashboard())
    } catch (err) {
      console.error('Chain dashboard load failed:', err)
      setData(null)
      setError(err?.message || 'Could not load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><i className="fa-solid fa-spinner fa-spin" /></div>
        <div className="empty-title">Loading dashboard…</div>
        <div className="empty-sub">Fetching network-wide usage, finance and attendance figures.</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
        <div className="empty-title">Dashboard unavailable</div>
        <div className="empty-sub">{error || 'No dashboard data returned for this network.'}</div>
        <button className="empty-badge" onClick={load}><i className="fa-solid fa-rotate-right" /> Try again</button>
      </div>
    )
  }

  if (isViewOnly && selectedSchool) return <SchoolDashboard school={selectedSchool} d={data} />
  return <HeadOfficeDashboard d={data} />
}

/* ── Head Office (chain-wide) ───────────────────────────────────── */
function HeadOfficeDashboard({ d }) {
  const navigate = useNavigate()
  const { usage, chain, finance, hr, ranking, modules, studentTrend, growth } = d
  const schoolCount = usage.totalSchools || chain.totalSchools

  return (
    <>
      {/* Hero */}
      <div className="hero-card">
        <div className="hero-inner">
          <div className="hero-text">
            <div className="hero-badge"><i className="fa-solid fa-building-shield" /> Head Office · Chain Admin</div>
            <div className="hero-title">Network Executive Overview</div>
            <div className="hero-sub">Aggregated platform usage and operational performance across all {schoolCount} connected schools — usage analytics, finances, HR and attendance at a glance.</div>
            <div className="hero-actions">
              <button className="hero-btn-white" onClick={() => navigate('/school-progress')}><i className="fa-solid fa-chart-line" /> School Progress</button>
              <button className="hero-btn-outline" onClick={() => navigate('/school-payments')}><i className="fa-solid fa-credit-card" /> Payments</button>
              <TutorialButton />
            </div>
          </div>
          <div className="hero-stats-row" style={{ alignSelf: 'flex-end', marginTop: 16 }}>
            <div className="hero-stat"><div className="hero-stat-val">{schoolCount}</div><div className="hero-stat-lbl">Schools</div></div>
            <div className="hero-stat"><div className="hero-stat-val">{fmtShort(chain.students)}</div><div className="hero-stat-lbl">Students</div></div>
            <div className="hero-stat"><div className="hero-stat-val">{chain.staff}</div><div className="hero-stat-lbl">Staff</div></div>
            <div className="hero-stat"><div className="hero-stat-val">{usage.erpActive}</div><div className="hero-stat-lbl">ERP Active</div></div>
          </div>
        </div>
      </div>

      {/* ══ PLATFORM USAGE ANALYTICS ══ */}
      <SectionHead icon="fa-chart-pie" title="Platform Usage Analytics" sub="How connected schools are using the ERP this month" />
      <div className="mini-grid">
        <MiniCard accent="m-info" icon="fa-school" val={usage.totalSchools} lbl="Total Connected Schools" />
        <MiniCard accent="m-green" icon="fa-circle-check" val={usage.erpActive} lbl="ERP Active Schools" />
        <MiniCard accent="m-red" icon="fa-circle-xmark" val={usage.erpInactive} lbl="ERP Inactive Schools" />
        <MiniCard accent="" icon="fa-arrow-right-to-bracket" val={fmtNum(usage.loginsMonth)} lbl="Total Logins This Month" />
        <MiniCard accent="m-green" icon="fa-trophy" val={firstWord(d.mostActive?.name)} lbl={`Most Active · ${fmtPct(d.mostActive?.usagePct)}`} tip={d.mostActive ? `Most active — ${d.mostActive.name} · ${fmtPct(d.mostActive.usagePct)} ERP usage` : 'No activity recorded yet'} />
        <MiniCard accent="m-amber" icon="fa-triangle-exclamation" val={firstWord(d.leastActive?.name)} lbl={`Least Active · ${fmtPct(d.leastActive?.usagePct)}`} tip={d.leastActive ? `Least active — ${d.leastActive.name} · ${fmtPct(d.leastActive.usagePct)} ERP usage` : 'No activity recorded yet'} />
      </div>

      <div className="chart-grid c-21" style={{ marginTop: 16 }}>
        <ChartCard icon="fa-chart-column" title="Module Usage Across Chain" right={<span className="badge b-blue">{schoolCount} schools</span>} scroll>
          <BarChart rows={modules.map((m) => ({
            name: m.label,
            icon: m.icon,
            pct: m.usagePct,
            val: `${m.schoolsUsing}/${m.totalSchools} · ${m.usagePct}%`,
            color: m.usagePct >= 80 ? 'green' : m.usagePct >= 50 ? '' : 'amber',
          }))} />
        </ChartCard>
        <ChartCard icon="fa-ranking-star" title="School Activity Ranking" right={<span className="badge b-blue">{ranking.length} schools</span>} scroll>
          {ranking.length === 0 ? <EmptyNote text="No school activity recorded yet" /> : ranking.map((s, i) => (
            <div className="rank-row" key={`${s.name}-${i}`} title={`#${i + 1} ${s.name} — ERP usage ${fmtPct(s.usagePct)}`} tabIndex={0}>
              <div className={`rank-no${i === 0 ? ' top' : ''}`}>{i + 1}</div>
              <div className="rank-main"><div className="rank-name">{s.name}</div></div>
              <div className="rank-bar"><div className="bar-track"><div className="bar-fill green" style={{ width: `${Math.min(s.usagePct, 100)}%` }} /></div></div>
              <span className="bar-val">{fmtPct(s.usagePct)}</span>
            </div>
          ))}
        </ChartCard>
      </div>

      <div style={{ marginTop: 16 }}>
        <ChartCard icon="fa-school-flag" title="Schools & Students Trend" right={<span className="badge b-blue">{studentTrend.length} schools</span>} scroll>
          <BarChart rows={studentTrend.map((s) => ({ name: s.name, pct: s.students, val: fmtNum(s.students), color: '' }))} />
        </ChartCard>
      </div>

      {/* ══ CHAIN OVERVIEW ══ */}
      <SectionHead icon="fa-network-wired" title="Chain Overview" sub="Network-wide students, staff and ERP status" />
      <div className="mini-grid">
        <MiniCard accent="m-info" icon="fa-school" val={chain.totalSchools} lbl="Total Schools" />
        <MiniCard accent="" icon="fa-user-graduate" val={fmtNum(chain.students)} lbl="Total Students" />
        <MiniCard accent="m-teal" icon="fa-users-gear" val={chain.staff} lbl="Total Staff" />
        <MiniCard accent="m-green" icon="fa-user-check" val={fmtNum(chain.activeStudents)} lbl="Active Students" />
        <MiniCard accent="m-slate" icon="fa-user-xmark" val={fmtNum(chain.inactiveStudents)} lbl="Inactive Students" />
        <MiniCard accent="m-info" icon="fa-person" val={fmtNum(chain.male)} lbl="Male Students" />
        <MiniCard accent="m-pink" icon="fa-person-dress" val={fmtNum(chain.female)} lbl="Female Students" />
        <MiniCard accent="m-green" icon="fa-user-tie" val={chain.activeStaff} lbl="Active Staff" />
        <MiniCard accent="m-slate" icon="fa-user-slash" val={chain.inactiveStaff} lbl="Inactive Staff" />
        <MiniCard accent="m-green" icon="fa-plug-circle-check" val={chain.erpActive} lbl="ERP Active Schools" />
        <MiniCard accent="m-red" icon="fa-plug-circle-xmark" val={chain.erpInactive} lbl="ERP Inactive Schools" />
      </div>

      <div className="chart-grid" style={{ marginTop: 16 }}>
        <ChartCard icon="fa-venus-mars" title="Gender Distribution">
          <div className="donut-wrap">
            <Donut big={fmtShort(chain.students)} cap="Students" segments={[{ value: chain.male, color: '#0284c7' }, { value: chain.female, color: '#db2777' }]} />
            <Legend items={[{ name: 'Male', val: fmtNum(chain.male), color: '#0284c7' }, { name: 'Female', val: fmtNum(chain.female), color: '#db2777' }]} />
          </div>
        </ChartCard>
        <ChartCard icon="fa-arrow-trend-up" title="Chain Growth (Monthly Logins)">
          <LineChart id="growth" values={growth.map((m) => m.value)} labels={growth.map((m) => m.month)} color="var(--success)" />
        </ChartCard>
      </div>

      {/* ══ FINANCIAL OVERVIEW ══ */}
      <SectionHead icon="fa-sack-dollar" title="Financial Overview" sub="School payments & royalty collection this month" />
      <div className="mini-grid">
        <MiniCard accent="m-info" icon="fa-file-invoice" val={finance.challans} lbl="Challans Generated This Month" />
        <MiniCard accent="" icon="fa-money-check-dollar" val={`Rs ${fmtShort(finance.payable)}`} lbl="Total Payable This Month" tip={`Total payable this month — ${fmtMoney(finance.payable)}`} />
        <MiniCard accent="m-green" icon="fa-hand-holding-dollar" val={`Rs ${fmtShort(finance.received)}`} lbl="Total Received This Month" tip={`Total received this month — ${fmtMoney(finance.received)}`} />
        <MiniCard accent="m-red" icon="fa-clock-rotate-left" val={`Rs ${fmtShort(finance.pending)}`} lbl="Total Pending This Month" tip={`Pending this month — ${fmtMoney(finance.pending)}`} />
        <MiniCard accent="m-green" icon="fa-circle-check" val={finance.paidSchools} lbl="Paid Schools" />
        <MiniCard accent="m-amber" icon="fa-circle-exclamation" val={finance.unpaidSchools} lbl="Unpaid / Partial Schools" />
        <MiniCard accent="m-red" icon="fa-triangle-exclamation" val={`Rs ${fmtShort(finance.outstanding)}`} lbl="Outstanding Amount" tip={`Outstanding — ${fmtMoney(finance.outstanding)}`} />
        <MiniCard
          accent="m-teal"
          icon="fa-receipt"
          val={finance.lastPayment ? `Rs ${fmtShort(finance.lastPayment.amount)}` : '—'}
          lbl={finance.lastPayment ? `Last Payment · ${finance.lastPayment.name}` : 'Last Payment'}
          tip={finance.lastPayment ? `Last payment — ${fmtMoney(finance.lastPayment.amount)} from ${finance.lastPayment.name}` : 'No payment received yet'}
        />
      </div>
      <div style={{ marginTop: 16 }}>
        <ChartCard icon="fa-chart-column" title="Payment Collection" right={<span className="badge b-blue">{fmtMoney(finance.payable)}</span>} scroll>
          <BarChart rows={[
            { name: 'Payable', pct: 100, val: fmtMoney(finance.payable), color: '' },
            { name: 'Received', pct: finance.payable ? Math.round(finance.received / finance.payable * 100) : 0, val: fmtMoney(finance.received), color: 'green' },
            { name: 'Pending', pct: finance.payable ? Math.round(finance.pending / finance.payable * 100) : 0, val: fmtMoney(finance.pending), color: 'red' },
          ]} />
        </ChartCard>
      </div>

      {/* ══ HR & ATTENDANCE ══ */}
      <SectionHead icon="fa-users-between-lines" title="HR & Attendance Overview" sub="Workforce and today's attendance across the chain" />
      <div className="mini-grid">
        <MiniCard accent="m-teal" icon="fa-id-badge" val={hr.employees} lbl="Total Employees" />
        <MiniCard accent="m-info" icon="fa-person-chalkboard" val={hr.teaching} lbl="Teaching Staff" />
        <MiniCard accent="m-slate" icon="fa-user-gear" val={hr.nonTeaching} lbl="Non-Teaching Staff" />
        <MiniCard accent="m-green" icon="fa-user-check" val={hr.activeStaff} lbl="Active Employees" />
        <MiniCard accent="m-red" icon="fa-user-xmark" val={hr.inactiveStaff} lbl="Inactive Employees" />
        <MiniCard accent="m-purple" icon="fa-user-plus" val={hr.newJoinings} lbl="New Joinings This Month" />
        <MiniCard accent="m-green" icon="fa-percent" val={fmtPct(hr.attStaff)} lbl="Today's Staff Attendance" />
        <MiniCard accent="" icon="fa-user-clock" val={fmtPct(hr.attStudent)} lbl="Today's Student Attendance" />
      </div>
      <div className="mini-grid" style={{ marginTop: 13 }}>
        <MiniCard accent="m-green" icon="fa-arrow-up" val={firstWord(hr.highestAtt?.name)} lbl={`Highest Attendance · ${fmtPct(hr.highestAtt?.pct)}`} tip={hr.highestAtt ? `Highest attendance — ${hr.highestAtt.name} · ${fmtPct(hr.highestAtt.pct)}` : 'No attendance recorded yet'} />
        <MiniCard accent="m-red" icon="fa-arrow-down" val={firstWord(hr.lowestAtt?.name)} lbl={`Lowest Attendance · ${fmtPct(hr.lowestAtt?.pct)}`} tip={hr.lowestAtt ? `Lowest attendance — ${hr.lowestAtt.name} · ${fmtPct(hr.lowestAtt.pct)}` : 'No attendance recorded yet'} />
        <MiniCard accent="m-amber" icon="fa-user-large-slash" val={fmtNum(hr.absentStudents)} lbl="Absent Students Today" />
        <MiniCard accent="m-amber" icon="fa-user-slash" val={hr.absentStaff} lbl="Absent Staff Today" />
      </div>
      <div style={{ marginTop: 16 }}>
        <ChartCard icon="fa-user-check" title="Attendance Overview (Today)">
          <BarChart rows={[
            { name: 'Student Attendance', pct: hr.attStudent, val: fmtPct(hr.attStudent), color: 'green' },
            { name: 'Staff Attendance', pct: hr.attStaff, val: fmtPct(hr.attStaff), color: '' },
          ]} />
        </ChartCard>
      </div>
    </>
  )
}

/* ── Selected School (view-only, school-level) ──────────────────────
   Chain dashboard API school-wise sirf do cheezein bhejti hai: students
   (School&StudentTrend) aur ERP usage % (SchoolsActivityRanking). Naam se
   milaate hain — school ke apne aankron ka koi alag endpoint abhi nahi hai,
   is liye yahan sirf wahi dikhta hai jo waqai API se aata hai. */
function SchoolDashboard({ school: s, d }) {
  const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()
  const stats = useMemo(() => ({
    students: d.studentTrend.find((r) => same(r.name, s.name))?.students ?? null,
    usagePct: d.ranking.find((r) => same(r.name, s.name))?.usagePct ?? null,
  }), [d, s.name])

  const isErpActive = s.status === 'Connected' && s.networkPermission !== false

  return (
    <>
      <div className="hero-card" style={{ background: 'linear-gradient(135deg,#b45309 0%,#d97706 55%,#f59e0b 100%)' }}>
        <div className="hero-inner">
          <div className="hero-text">
            <div className="hero-badge"><i className="fa-solid fa-eye" /> View Only · School Dashboard</div>
            <div className="hero-title">{s.name}</div>
            <div className="hero-sub">
              {s.address ? <><i className="fa-solid fa-location-dot" /> {s.address} · </> : null}
              ERP {isErpActive ? 'Active' : 'Inactive'}. You are viewing this school in read-only mode — switch back to Head Office to make changes.
            </div>
          </div>
          <div className="hero-stats-row" style={{ alignSelf: 'flex-end', marginTop: 16 }}>
            <div className="hero-stat"><div className="hero-stat-val">{stats.students == null ? '—' : fmtShort(stats.students)}</div><div className="hero-stat-lbl">Students</div></div>
            <div className="hero-stat"><div className="hero-stat-val">{stats.usagePct == null ? '—' : fmtPct(stats.usagePct)}</div><div className="hero-stat-lbl">ERP Usage</div></div>
          </div>
        </div>
      </div>

      <SectionHead icon="fa-chart-pie" title="School Overview" sub={`${s.name} · figures reported by the chain dashboard`} />
      <div className="mini-grid">
        <MiniCard accent="" icon="fa-user-graduate" val={stats.students == null ? '—' : fmtNum(stats.students)} lbl="Total Students" />
        <MiniCard accent="m-green" icon="fa-gauge-high" val={stats.usagePct == null ? '—' : fmtPct(stats.usagePct)} lbl="ERP Usage" />
        <MiniCard accent={isErpActive ? 'm-green' : 'm-red'} icon={isErpActive ? 'fa-plug-circle-check' : 'fa-plug-circle-xmark'} val={isErpActive ? 'Active' : 'Inactive'} lbl="ERP Status" />
        <MiniCard accent="m-info" icon="fa-hashtag" val={s.code || '—'} lbl="School Code" />
      </div>

      <div className="chart-grid c-21" style={{ marginTop: 16 }}>
        <ChartCard icon="fa-ranking-star" title="Position in Chain (ERP Usage)" scroll>
          {d.ranking.length === 0 ? <EmptyNote text="No school activity recorded yet" /> : d.ranking.map((r, i) => {
            const isMe = same(r.name, s.name)
            return (
              <div className="rank-row" key={`${r.name}-${i}`} title={`#${i + 1} ${r.name} — ERP usage ${fmtPct(r.usagePct)}`} tabIndex={0}>
                <div className={`rank-no${isMe ? ' top' : ''}`}>{i + 1}</div>
                <div className="rank-main"><div className="rank-name">{r.name}{isMe ? ' · this school' : ''}</div></div>
                <div className="rank-bar"><div className="bar-track"><div className={`bar-fill ${isMe ? 'green' : ''}`} style={{ width: `${Math.min(r.usagePct, 100)}%` }} /></div></div>
                <span className="bar-val">{fmtPct(r.usagePct)}</span>
              </div>
            )
          })}
        </ChartCard>
        <ChartCard icon="fa-address-card" title="School Details" scroll>
          {[
            { icon: 'fa-phone', lbl: 'Phone', val: s.phone || '—' },
            { icon: 'fa-envelope', lbl: 'Email', val: s.email || '—' },
            { icon: 'fa-location-dot', lbl: 'Address', val: s.address || '—' },
            { icon: 'fa-link', lbl: 'Network Status', val: s.status || '—' },
          ].map((row) => (
            <div className="rank-row" key={row.lbl} title={`${row.lbl}: ${row.val}`} tabIndex={0}>
              <div className="feed-ic" style={{ width: 28, height: 28, fontSize: 11 }}><i className={`fa-solid ${row.icon}`} /></div>
              <div className="rank-main"><div className="rank-name">{row.val}</div><div className="rank-city">{row.lbl}</div></div>
            </div>
          ))}
        </ChartCard>
      </div>
    </>
  )
}
