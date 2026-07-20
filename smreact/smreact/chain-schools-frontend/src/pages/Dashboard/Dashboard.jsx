import { useNavigate } from 'react-router-dom'
import { useView } from '../../config/viewContext'
import TutorialButton from '../../components/TutorialButton'
import {
  SCHOOLS, schoolById, chainAggregates, MODULE_USAGE, CHAIN_GROWTH,
  fmtMoney, fmtShort,
} from '../../config/dashboardData'
import './Dashboard.css'

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

function BarChart({ rows }) {
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
  if (isViewOnly && selectedSchool) return <SchoolDashboard school={schoolById(selectedSchool.id) || selectedSchool} />
  return <HeadOfficeDashboard />
}

/* ── Head Office (chain-wide) ───────────────────────────────────── */
function HeadOfficeDashboard() {
  const navigate = useNavigate()
  const a = chainAggregates()
  const absentStudents = a.students - Math.round(a.students * a.attStudent / 100)
  const absentStaff = a.staff - Math.round(a.staff * a.attStaff / 100)
  const teaching = Math.round(a.staff * 0.68)

  return (
    <>
      {/* Hero */}
      <div className="hero-card">
        <div className="hero-inner">
          <div className="hero-text">
            <div className="hero-badge"><i className="fa-solid fa-building-shield" /> Head Office · Chain Admin</div>
            <div className="hero-title">Network Executive Overview</div>
            <div className="hero-sub">Aggregated platform usage and operational performance across all {a.totalSchools} connected schools — usage analytics, finances, HR and attendance at a glance.</div>
            <div className="hero-actions">
              <button className="hero-btn-white" onClick={() => navigate('/school-progress')}><i className="fa-solid fa-chart-line" /> School Progress</button>
              <button className="hero-btn-outline" onClick={() => navigate('/school-payments')}><i className="fa-solid fa-credit-card" /> Payments</button>
              <TutorialButton />
            </div>
          </div>
          <div className="hero-stats-row" style={{ alignSelf: 'flex-end', marginTop: 16 }}>
            <div className="hero-stat"><div className="hero-stat-val">{a.totalSchools}</div><div className="hero-stat-lbl">Schools</div></div>
            <div className="hero-stat"><div className="hero-stat-val">{fmtShort(a.students)}</div><div className="hero-stat-lbl">Students</div></div>
            <div className="hero-stat"><div className="hero-stat-val">{a.staff}</div><div className="hero-stat-lbl">Staff</div></div>
            <div className="hero-stat"><div className="hero-stat-val">{a.erpActive}</div><div className="hero-stat-lbl">ERP Active</div></div>
          </div>
        </div>
      </div>

      {/* ══ PLATFORM USAGE ANALYTICS ══ */}
      <SectionHead icon="fa-chart-pie" title="Platform Usage Analytics" sub="How connected schools are using the ERP this month" />
      <div className="mini-grid">
        <MiniCard accent="m-info" icon="fa-school" val={a.totalSchools} lbl="Total Connected Schools" />
        <MiniCard accent="m-green" icon="fa-circle-check" val={a.erpActive} lbl="ERP Active Schools" delta={{ dir: 'up', text: '+1' }} />
        <MiniCard accent="m-red" icon="fa-circle-xmark" val={a.erpInactive} lbl="ERP Inactive Schools" />
        <MiniCard accent="m-purple" icon="fa-right-to-bracket" val={a.loggedInToday} lbl="Schools Logged In Today" />
        <MiniCard accent="" icon="fa-arrow-right-to-bracket" val={a.loginsMonth.toLocaleString()} lbl="Total Logins This Month" delta={{ dir: 'up', text: '8%' }} />
        <MiniCard accent="m-teal" icon="fa-clock" val={`${a.workingHrs.toLocaleString()}h`} lbl="Working Time This Month" />
        <MiniCard accent="m-green" icon="fa-trophy" val={(a.mostActive?.name || '—').split(' ')[0]} lbl={`Most Active · ${a.mostActive?.erpUsage ?? 0}%`} />
        <MiniCard accent="m-amber" icon="fa-triangle-exclamation" val={(a.leastActive?.name || '—').split(' ')[0]} lbl={`Least Active · ${a.leastActive?.erpUsage ?? 0}%`} />
      </div>

      <div className="chart-grid c-21" style={{ marginTop: 16 }}>
        <ChartCard icon="fa-chart-column" title="Module Usage Across Chain" right={<span className="badge b-blue">{SCHOOLS.length} schools</span>} scroll>
          <BarChart rows={MODULE_USAGE.map((m) => ({ name: m.label, icon: m.icon, pct: m.usagePct, val: `${m.schoolsUsing}/${SCHOOLS.length} · ${m.usagePct}%`, sub: `${m.visits.toLocaleString()} visits · avg ${m.avgTime}`, color: m.usagePct >= 80 ? 'green' : m.usagePct >= 50 ? '' : 'amber' }))} />
        </ChartCard>
        <ChartCard icon="fa-ranking-star" title="School Activity Ranking" right={<span className="badge b-blue">{SCHOOLS.length} schools</span>} scroll>
          {[...SCHOOLS].sort((a, b) => b.erpUsage - a.erpUsage).map((s, i) => (
            <div className="rank-row" key={s.id} title={`#${i + 1} ${s.name} · ${s.city} — ERP usage ${s.erpUsage}% · ${s.loginsMonth} logins this month`} tabIndex={0}>
              <div className={`rank-no${i === 0 ? ' top' : ''}`}>{i + 1}</div>
              <div className="rank-main"><div className="rank-name">{s.name}</div><div className="rank-city">{s.city}</div></div>
              <div className="rank-bar"><div className="bar-track"><div className="bar-fill green" style={{ width: `${s.erpUsage}%` }} /></div></div>
              <span className="bar-val">{s.erpUsage}%</span>
            </div>
          ))}
        </ChartCard>
      </div>

      <div style={{ marginTop: 16 }}>
        <ChartCard icon="fa-school-flag" title="Schools & Students Trend" right={<span className="badge b-blue">{SCHOOLS.length} schools</span>} scroll>
          <BarChart rows={[...SCHOOLS].sort((x, y) => y.students - x.students).map((s) => ({ name: s.name, pct: s.students, val: s.students.toLocaleString(), color: '' }))} />
        </ChartCard>
      </div>

      {/* ══ CHAIN OVERVIEW ══ */}
      <SectionHead icon="fa-network-wired" title="Chain Overview" sub="Network-wide students, staff and ERP status" />
      <div className="mini-grid">
        <MiniCard accent="m-info" icon="fa-school" val={a.totalSchools} lbl="Total Schools" />
        <MiniCard accent="" icon="fa-user-graduate" val={a.students.toLocaleString()} lbl="Total Students" delta={{ dir: 'up', text: '6%' }} />
        <MiniCard accent="m-teal" icon="fa-users-gear" val={a.staff} lbl="Total Staff" />
        <MiniCard accent="m-green" icon="fa-user-check" val={a.activeStudents.toLocaleString()} lbl="Active Students" />
        <MiniCard accent="m-slate" icon="fa-user-xmark" val={a.inactiveStudents.toLocaleString()} lbl="Inactive Students" />
        <MiniCard accent="m-info" icon="fa-person" val={a.male.toLocaleString()} lbl="Male Students" />
        <MiniCard accent="m-pink" icon="fa-person-dress" val={a.female.toLocaleString()} lbl="Female Students" />
        <MiniCard accent="m-green" icon="fa-user-tie" val={a.activeStaff} lbl="Active Staff" />
        <MiniCard accent="m-slate" icon="fa-user-slash" val={a.inactiveStaff} lbl="Inactive Staff" />
        <MiniCard accent="m-green" icon="fa-plug-circle-check" val={a.erpActive} lbl="ERP Active Schools" />
        <MiniCard accent="m-red" icon="fa-plug-circle-xmark" val={a.erpInactive} lbl="ERP Inactive Schools" />
      </div>

      <div className="chart-grid" style={{ marginTop: 16 }}>
        <ChartCard icon="fa-venus-mars" title="Gender Distribution">
          <div className="donut-wrap">
            <Donut big={fmtShort(a.students)} cap="Students" segments={[{ value: a.male, color: '#0284c7' }, { value: a.female, color: '#db2777' }]} />
            <Legend items={[{ name: 'Male', val: a.male.toLocaleString(), color: '#0284c7' }, { name: 'Female', val: a.female.toLocaleString(), color: '#db2777' }]} />
          </div>
        </ChartCard>
        <ChartCard icon="fa-arrow-trend-up" title="Chain Growth (Students)">
          <LineChart id="growth" values={CHAIN_GROWTH.map((m) => m.students)} labels={CHAIN_GROWTH.map((m) => m.m)} color="var(--success)" />
        </ChartCard>
      </div>

      {/* ══ FINANCIAL OVERVIEW ══ */}
      <SectionHead icon="fa-sack-dollar" title="Financial Overview" sub="School payments & royalty collection this month" />
      <div className="mini-grid">
        <MiniCard accent="m-info" icon="fa-file-invoice" val={a.totalSchools} lbl="Challans Generated This Month" />
        <MiniCard accent="" icon="fa-money-check-dollar" val={`Rs ${fmtShort(a.payable)}`} lbl="Total Payable This Month" />
        <MiniCard accent="m-green" icon="fa-hand-holding-dollar" val={`Rs ${fmtShort(a.received)}`} lbl="Total Received This Month" delta={{ dir: 'up', text: '12%' }} />
        <MiniCard accent="m-red" icon="fa-clock-rotate-left" val={`Rs ${fmtShort(a.pending)}`} lbl="Total Pending This Month" />
        <MiniCard accent="m-green" icon="fa-circle-check" val={a.paidSchools} lbl="Paid Schools" />
        <MiniCard accent="m-amber" icon="fa-circle-exclamation" val={a.unpaidSchools} lbl="Unpaid / Partial Schools" />
        <MiniCard accent="m-red" icon="fa-triangle-exclamation" val={`Rs ${fmtShort(a.pending)}`} lbl="Outstanding Amount" />
        <MiniCard accent="m-teal" icon="fa-receipt" val="Rs 1.64 Cr" lbl="Last Payment · City Scholars" />
      </div>
      <div style={{ marginTop: 16 }}>
        <ChartCard icon="fa-chart-column" title="Payment Collection" right={<span className="badge b-blue">{fmtMoney(a.payable)}</span>} scroll>
          <BarChart rows={[
            { name: 'Payable', pct: 100, val: fmtMoney(a.payable), color: '' },
            { name: 'Received', pct: a.payable ? Math.round(a.received / a.payable * 100) : 0, val: fmtMoney(a.received), color: 'green' },
            { name: 'Pending', pct: a.payable ? Math.round(a.pending / a.payable * 100) : 0, val: fmtMoney(a.pending), color: 'red' },
          ]} />
        </ChartCard>
      </div>

      {/* ══ HR & ATTENDANCE ══ */}
      <SectionHead icon="fa-users-between-lines" title="HR & Attendance Overview" sub="Workforce and today's attendance across the chain" />
      <div className="mini-grid">
        <MiniCard accent="m-teal" icon="fa-id-badge" val={a.staff} lbl="Total Employees" />
        <MiniCard accent="m-info" icon="fa-person-chalkboard" val={teaching} lbl="Teaching Staff" />
        <MiniCard accent="m-slate" icon="fa-user-gear" val={a.staff - teaching} lbl="Non-Teaching Staff" />
        <MiniCard accent="m-green" icon="fa-user-check" val={a.activeStaff} lbl="Active Employees" />
        <MiniCard accent="m-red" icon="fa-user-xmark" val={a.inactiveStaff} lbl="Inactive Employees" />
        <MiniCard accent="m-purple" icon="fa-user-plus" val={a.newJoinings} lbl="New Joinings This Month" />
        <MiniCard accent="m-green" icon="fa-percent" val={`${a.attStaff}%`} lbl="Staff Attendance Rate" />
        <MiniCard accent="" icon="fa-user-clock" val={`${a.attStudent}%`} lbl="Today's Student Attendance" />
      </div>
      <div className="mini-grid" style={{ marginTop: 13 }}>
        <MiniCard accent="m-green" icon="fa-arrow-up" val={(a.highestAtt?.name || '—').split(' ')[0]} lbl={`Highest Attendance · ${a.highestAtt?.attStudent ?? 0}%`} />
        <MiniCard accent="m-red" icon="fa-arrow-down" val={(a.lowestAtt?.name || '—').split(' ')[0]} lbl={`Lowest Attendance · ${a.lowestAtt?.attStudent ?? 0}%`} />
        <MiniCard accent="m-amber" icon="fa-user-large-slash" val={absentStudents.toLocaleString()} lbl="Absent Students Today" />
        <MiniCard accent="m-amber" icon="fa-user-slash" val={absentStaff} lbl="Absent Staff Today" />
      </div>
      <div style={{ marginTop: 16 }}>
        <ChartCard icon="fa-user-check" title="Attendance Overview (Today)">
          <BarChart rows={[
            { name: 'Student Attendance', pct: a.attStudent, val: `${a.attStudent}%`, color: 'green' },
            { name: 'Staff Attendance', pct: a.attStaff, val: `${a.attStaff}%`, color: '' },
          ]} />
        </ChartCard>
      </div>
    </>
  )
}

/* ── Selected School (view-only, school-level) ──────────────────── */
function SchoolDashboard({ school: s }) {
  const pending = s.payable - s.received
  const inactiveStudents = s.students - s.activeStudents
  const usedModules = Object.entries(s.modules).filter(([, v]) => v).length
  const MOD_LABELS = { academics: 'Academics', attendance: 'Attendance', payments: 'Payments', accounts: 'Accounts', inventory: 'Inventory', trainings: 'Trainings', hr: 'HR', sops: 'SOPs' }

  return (
    <>
      <div className="hero-card" style={{ background: 'linear-gradient(135deg,#b45309 0%,#d97706 55%,#f59e0b 100%)' }}>
        <div className="hero-inner">
          <div className="hero-text">
            <div className="hero-badge"><i className="fa-solid fa-eye" /> View Only · School Dashboard</div>
            <div className="hero-title">{s.name}</div>
            <div className="hero-sub"><i className="fa-solid fa-location-dot" /> {s.city} · ERP {s.status === 'active' ? 'Active' : 'Inactive'} · Last login {s.lastLogin}. You are viewing this school in read-only mode — switch back to Head Office to make changes.</div>
          </div>
          <div className="hero-stats-row" style={{ alignSelf: 'flex-end', marginTop: 16 }}>
            <div className="hero-stat"><div className="hero-stat-val">{fmtShort(s.students)}</div><div className="hero-stat-lbl">Students</div></div>
            <div className="hero-stat"><div className="hero-stat-val">{s.staff}</div><div className="hero-stat-lbl">Staff</div></div>
            <div className="hero-stat"><div className="hero-stat-val">{s.erpUsage}%</div><div className="hero-stat-lbl">ERP Usage</div></div>
            <div className="hero-stat"><div className="hero-stat-val">{s.attStudent}%</div><div className="hero-stat-lbl">Attendance</div></div>
          </div>
        </div>
      </div>

      <SectionHead icon="fa-chart-pie" title="School Overview" sub={`${s.name} · students, staff and ERP usage`} />
      <div className="mini-grid">
        <MiniCard accent="" icon="fa-user-graduate" val={s.students.toLocaleString()} lbl="Total Students" />
        <MiniCard accent="m-green" icon="fa-user-check" val={s.activeStudents.toLocaleString()} lbl="Active Students" />
        <MiniCard accent="m-info" icon="fa-person" val={s.male.toLocaleString()} lbl="Male Students" />
        <MiniCard accent="m-pink" icon="fa-person-dress" val={s.female.toLocaleString()} lbl="Female Students" />
        <MiniCard accent="m-teal" icon="fa-users-gear" val={s.staff} lbl="Total Staff" />
        <MiniCard accent="m-green" icon="fa-user-tie" val={s.activeStaff} lbl="Active Staff" />
        <MiniCard accent="m-purple" icon="fa-arrow-right-to-bracket" val={s.loginsMonth} lbl="Logins This Month" />
        <MiniCard accent="m-info" icon="fa-clock" val={`${s.workingHrs}h`} lbl="Working Time" />
      </div>

      <div className="chart-grid c-3" style={{ marginTop: 16 }}>
        <ChartCard icon="fa-venus-mars" title="Gender Distribution">
          <div className="donut-wrap">
            <Donut big={fmtShort(s.students)} cap="Students" segments={[{ value: s.male, color: '#0284c7' }, { value: s.female, color: '#db2777' }]} />
            <Legend items={[{ name: 'Male', val: s.male.toLocaleString(), color: '#0284c7' }, { name: 'Female', val: s.female.toLocaleString(), color: '#db2777' }]} />
          </div>
        </ChartCard>
        <ChartCard icon="fa-user-check" title="Student Status">
          <div className="donut-wrap">
            <Donut big={`${Math.round(s.activeStudents / s.students * 100)}%`} cap="Active" segments={[{ value: s.activeStudents, color: 'var(--success)' }, { value: inactiveStudents, color: '#cbd5e1' }]} />
            <Legend items={[{ name: 'Active', val: s.activeStudents.toLocaleString(), color: 'var(--success)' }, { name: 'Inactive', val: inactiveStudents.toLocaleString(), color: '#cbd5e1' }]} />
          </div>
        </ChartCard>
        <ChartCard icon="fa-user-clock" title="Attendance & Onboarding">
          <BarChart rows={[
            { name: 'Student Attendance', pct: s.attStudent, val: `${s.attStudent}%`, color: 'green' },
            { name: 'Staff Attendance', pct: s.attStaff, val: `${s.attStaff}%`, color: '' },
            { name: 'Onboarding', pct: s.onboarding, val: `${s.onboarding}%`, color: s.onboarding >= 90 ? 'green' : 'amber' },
            { name: 'ERP Usage', pct: s.erpUsage, val: `${s.erpUsage}%`, color: s.erpUsage >= 60 ? '' : 'red' },
          ]} />
        </ChartCard>
      </div>

      <SectionHead icon="fa-sack-dollar" title="Financial Summary" sub="Royalty / payment status for this school" />
      <div className="mini-grid">
        <MiniCard accent="" icon="fa-money-check-dollar" val={`Rs ${fmtShort(s.payable)}`} lbl="Payable This Month" />
        <MiniCard accent="m-green" icon="fa-hand-holding-dollar" val={`Rs ${fmtShort(s.received)}`} lbl="Received" />
        <MiniCard accent="m-red" icon="fa-clock-rotate-left" val={`Rs ${fmtShort(pending)}`} lbl="Pending" />
        <MiniCard accent={s.paymentStatus === 'paid' ? 'm-green' : 'm-amber'} icon="fa-receipt" val={s.paymentStatus === 'paid' ? 'Paid' : s.paymentStatus === 'partial' ? 'Partial' : 'Unpaid'} lbl="Payment Status" />
      </div>
      <div className="chart-grid c-21" style={{ marginTop: 16 }}>
        <ChartCard icon="fa-chart-column" title="Payment Collection" scroll>
          <BarChart rows={[
            { name: 'Payable', pct: 100, val: fmtMoney(s.payable), color: '' },
            { name: 'Received', pct: s.payable ? Math.round(s.received / s.payable * 100) : 0, val: fmtMoney(s.received), color: 'green' },
            { name: 'Pending', pct: s.payable ? Math.round(pending / s.payable * 100) : 0, val: fmtMoney(pending), color: 'red' },
          ]} />
        </ChartCard>
        <ChartCard icon="fa-grip" title={`Modules Adopted · ${usedModules}/8`} scroll>
          {Object.entries(MOD_LABELS).map(([k, lbl]) => (
            <div className="rank-row" key={k} title={`${lbl} — ${s.modules[k] ? 'In use at this school' : 'Not adopted yet'}`} tabIndex={0}>
              <div className={`feed-ic ${s.modules[k] ? 'success' : 'red'}`} style={{ width: 28, height: 28, fontSize: 11 }}><i className={`fa-solid ${s.modules[k] ? 'fa-check' : 'fa-xmark'}`} /></div>
              <div className="rank-main"><div className="rank-name">{lbl}</div></div>
              <span className={`badge ${s.modules[k] ? 'b-green' : 'b-gray'}`}>{s.modules[k] ? 'In Use' : 'Not Used'}</span>
            </div>
          ))}
        </ChartCard>
      </div>
    </>
  )
}
