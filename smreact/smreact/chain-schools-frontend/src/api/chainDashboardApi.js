/* ═══════════════════════════════════════════════════════════════════
   CHAIN DASHBOARD — Head Office ke poore network ke aankre.

     GET {chain}/api/Network_Setup/GetDashboard?networkID=<id>

   Ek hi call me saare sections aate hain (usage analytics, module usage,
   ranking, chain overview, finance, HR/attendance, growth). Pehle ye
   screen config/dashboardData.js ke dummy schools par chalti thi.

   networkSchoolsApi ki tarah ye bhi axios client se nahi jaata: wo `/api`
   par ERP backend ki taraf jaata hai, jabke ye endpoint chain base par hai.
   ═══════════════════════════════════════════════════════════════════ */

import { CHAIN_API_BASE } from '@/config/env'
import { currentNetworkId } from './networkSchoolsApi'

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

/** Poore network ka dashboard — aik call, normalised shape. */
export async function fetchChainDashboard(networkId = currentNetworkId()) {
  if (!networkId) return toDashboard({})
  const res = await fetch(`${URL}?networkID=${encodeURIComponent(networkId)}`, {
    headers: { Accept: '*/*' },
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.message || json?.title || 'Could not load dashboard')
  return toDashboard(json)
}
