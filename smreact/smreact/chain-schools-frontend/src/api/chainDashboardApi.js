/* ═══════════════════════════════════════════════════════════════════
   CHAIN DASHBOARD — Head Office ke poore network ke aankre.

     GET {chain}/api/Network_Setup/GetDashboard?networkID=<id>

   Ek hi call me saare sections aate hain (usage analytics, module usage,
   ranking, chain overview, finance, HR/attendance, growth). Pehle ye
   screen config/dashboardData.js ke dummy schools par chalti thi.

   networkSchoolsApi ki tarah ye bhi axios client se nahi jaata: wo `/api`
   par ERP backend ki taraf jaata hai, jabke ye endpoint chain base par hai.
   ═══════════════════════════════════════════════════════════════════ */

import { CHAIN_API_BASE, ERP_API_BASE } from '@/config/env'
import { currentNetworkId, fetchConnectedSchools } from './networkSchoolsApi'

const URL = `${CHAIN_API_BASE}/api/Network_Setup/GetDashboard`

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const arr = (v) => (Array.isArray(v) ? v : [])

/* Module usage API me "1/3" (istemal karne wale / kul schools) ki shakl me
   aata hai — screen ko dono adad aur %age chahiye. */
function toModule(label, icon, raw) {
  const [used, total] = String(raw ?? '').split('/').map(num)
  return {
    label,
    icon,
    schoolsUsing: used,
    totalSchools: total,
    usagePct: total ? Math.round((used / total) * 100) : 0,
  }
}

/* API response → screen ki shape. Har jagah defaults rakhe hain taake koi
   section API me na aaye to dashboard khali card dikhaye, tootay nahi. */
function toDashboard(d) {
  const usage = d?.UsageAnalytics || {}
  const mods = d?.ModuleUsageAcrossChain || {}
  const chain = d?.ChainOverview || {}
  const fin = d?.FinancialOverview || {}
  const hr = d?.HRAttendanceOverview || {}

  const ranking = arr(d?.SchoolsActivityRanking)
    .map((r) => ({ name: r.SchoolName || '—', usagePct: num(r.PercentageUsage) }))
    .sort((a, b) => b.usagePct - a.usagePct)

  const payable = num(fin.TotalPayAbleThisMonth)
  const received = num(fin.TotalReceivedThisMonth)

  return {
    usage: {
      totalSchools:  num(usage.TotalConnectedSchools),
      erpActive:     num(usage.ERPActiveSchools),
      erpInactive:   num(usage.ERPInactiveSchools),
      loginsMonth:   num(usage.TotalLoginsThisMonth),
    },
    modules: [
      toModule('Academics',      'fa-graduation-cap', mods.Academics),
      toModule('Attendance',     'fa-user-check',     mods.Attendance),
      toModule('Accounts',       'fa-file-invoice-dollar', mods.Accounts),
      toModule('Human Resource', 'fa-users-gear',     mods.HumanResource),
    ],
    ranking,
    mostActive:  ranking[0] || null,
    leastActive: ranking.length > 1 ? ranking[ranking.length - 1] : null,
    /* Key me `&` hai is liye bracket notation. */
    studentTrend: arr(d?.['School&StudentTrend'])
      .map((r) => ({ name: r.BranchName || '—', students: num(r.TotalStudents) }))
      .sort((a, b) => b.students - a.students),
    chain: {
      totalSchools:     num(chain.TotalSchools),
      students:         num(chain.TotalStudents),
      staff:            num(chain.TotalStaff),
      activeStudents:   num(chain.ActiveStudents),
      inactiveStudents: num(chain.InActiveStudents),
      male:             num(chain.MaleStudents),
      female:           num(chain.FemaleStudents),
      unspecified:      0,
      activeStaff:      num(chain.ActiveStaff),
      inactiveStaff:    num(chain.InactiveStaff),
      erpActive:        num(chain.ERPActiveSchools),
      erpInactive:      num(chain.ERPInActiveSchools),
    },
    finance: {
      challans:      num(fin.ChallanGeneratedThisMonth),
      payable,
      received,
      pending:       num(fin.PendingAmount),
      paidSchools:   num(fin.PaidSchools),
      unpaidSchools: num(fin.UnpaidPartialSchools),
      outstanding:   num(fin.OutStandingAmount),
      lastPayment:   fin.LastPayment
        ? { name: fin.LastPayment.SchoolName || '—', amount: num(fin.LastPayment.Amount) }
        : null,
    },
    hr: {
      employees:     num(hr.TotalEmployees),
      teaching:      num(hr.TeachingStaff),
      nonTeaching:   num(hr.NonTeachingStaff),
      activeStaff:   num(hr.ActiveStaff),
      inactiveStaff: num(hr.InactiveStaff),
      newJoinings:   num(hr.NewJoiningThisMonth),
      attStaff:      num(hr.TodayStaffAttendanceRate),
      attStudent:    num(hr.TodayStudentAttendanceRate),
      absentStudents: num(hr.AbsentStudentsToday),
      absentStaff:    num(hr.AbsentStaffToday),
      highestAtt: hr.HighestAttendance
        ? { name: hr.HighestAttendance.SchoolName || '—', pct: num(hr.HighestAttendance.Percentage) }
        : null,
      lowestAtt: hr.LowestAttendance
        ? { name: hr.LowestAttendance.SchoolName || '—', pct: num(hr.LowestAttendance.Percentage) }
        : null,
    },
    /* Mahina-war logins — API sirf guzray hue mahine bhejti hai. */
    growth: arr(d?.ChainGrowthStudents).map((m) => ({
      month: (m.MonthName || '').slice(0, 3),
      value: num(m.LoggedInCount),
    })),
  }
}

/* School ERP "Total Students / Total Employees" active roster hai.
   Chain GetDashboard inactive ko total mein jor deta hai (28+7=35, 13+17=30)
   aur gender khali chhor deta hai (field `gander`). Yahan har connected
   school ki asal class-list aur employee-list se wahi ginti banate hain
   jo school dashboard dikhata hai. */
async function readList(url) {
  const res = await fetch(url, { headers: { Accept: '*/*' } })
  const json = await res.json().catch(() => null)
  if (!res.ok || json?.success === false) return []
  return Array.isArray(json?.data) ? json.data : []
}

function flattenStudents(classes) {
  const seen = new Set()
  const out = []
  for (const grade of classes) {
    for (const section of grade.sections || grade.Sections || []) {
      for (const student of section.students || section.Students || []) {
        const id = student.id ?? student.studentID
        if (id != null) {
          if (seen.has(id)) continue
          seen.add(id)
        }
        out.push(student)
      }
    }
  }
  return out
}

function genderOf(student) {
  const g = String(student.gander ?? student.gender ?? student.Gender ?? '').trim().toLowerCase()
  if (g === 'male' || g === 'm' || g === 'boy') return 'male'
  if (g === 'female' || g === 'f' || g === 'girl') return 'female'
  return 'other'
}

async function recountSchool(branchId) {
  const base = `${ERP_API_BASE}/api/LaunchSetup`
  const [activeClasses, inactiveClasses, activeStaff, inactiveStaff] = await Promise.all([
    readList(`${base}/get-class-section-studentlist-by-branch/${branchId}`),
    readList(`${base}/get-class-section-studentlist-by-branch/${branchId}?isActive=false`),
    readList(`${base}/get-employees-by-branch/${branchId}`),
    readList(`${base}/get-employees-by-branch/${branchId}?isActive=false`),
  ])
  const activeStudents = flattenStudents(activeClasses)
  let male = 0
  let female = 0
  let unspecified = 0
  for (const student of activeStudents) {
    const g = genderOf(student)
    if (g === 'male') male += 1
    else if (g === 'female') female += 1
    else unspecified += 1
  }
  return {
    activeStudents: activeStudents.length,
    inactiveStudents: flattenStudents(inactiveClasses).length,
    male,
    female,
    unspecified,
    activeStaff: activeStaff.length,
    inactiveStaff: inactiveStaff.length,
  }
}

/* GetDashboard unmarked attendance ko "sab absent" likh deta hai
   (rate 0 aur absent = active headcount). School dashboard par woh 0 hai. */
function clearUnmarkedAbsence(dash) {
  const { chain, hr } = dash
  if (hr.attStudent === 0 && hr.absentStudents > 0 && hr.absentStudents === chain.activeStudents) {
    hr.absentStudents = 0
  }
  if (hr.attStaff === 0 && hr.absentStaff > 0 && hr.absentStaff === chain.activeStaff) {
    hr.absentStaff = 0
  }
}

async function applySchoolCounts(dash, networkId) {
  const schools = await fetchConnectedSchools(networkId)
  if (!schools.length) return dash
  const rows = await Promise.all(schools.map(async (school) => {
    try {
      return { school, counts: await recountSchool(school.branchId) }
    } catch (err) {
      console.error('School count failed:', school.name, err)
      return null
    }
  }))
  const counted = rows.filter(Boolean)
  if (!counted.length) return dash

  const sum = counted.reduce((n, row) => {
    n.activeStudents += row.counts.activeStudents
    n.inactiveStudents += row.counts.inactiveStudents
    n.male += row.counts.male
    n.female += row.counts.female
    n.unspecified += row.counts.unspecified
    n.activeStaff += row.counts.activeStaff
    n.inactiveStaff += row.counts.inactiveStaff
    return n
  }, { activeStudents: 0, inactiveStudents: 0, male: 0, female: 0, unspecified: 0, activeStaff: 0, inactiveStaff: 0 })

  dash.chain.totalSchools = schools.length
  dash.chain.students = sum.activeStudents
  dash.chain.activeStudents = sum.activeStudents
  dash.chain.inactiveStudents = sum.inactiveStudents
  dash.chain.male = sum.male
  dash.chain.female = sum.female
  dash.chain.unspecified = sum.unspecified
  dash.chain.staff = sum.activeStaff
  dash.chain.activeStaff = sum.activeStaff
  dash.chain.inactiveStaff = sum.inactiveStaff
  dash.hr.employees = sum.activeStaff
  dash.hr.activeStaff = sum.activeStaff
  dash.hr.inactiveStaff = sum.inactiveStaff
  dash.studentTrend = counted
    .map((row) => ({ name: row.school.name, students: row.counts.activeStudents }))
    .sort((a, b) => b.students - a.students)
  clearUnmarkedAbsence(dash)
  return dash
}

/** Poore network ka dashboard — aik call, normalised shape. */
export async function fetchChainDashboard(networkId = currentNetworkId()) {
  if (!networkId) return toDashboard({})
  const res = await fetch(`${URL}?networkID=${encodeURIComponent(networkId)}`, {
    headers: { Accept: '*/*' },
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.message || json?.title || 'Could not load dashboard')
  const dash = toDashboard(json?.data && json.data.ChainOverview ? json.data : json)
  try {
    return await applySchoolCounts(dash, networkId)
  } catch (err) {
    console.error('Could not recount chain schools:', err)
    return dash
  }
}
