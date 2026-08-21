import { buildUrl } from '../../utils/apiConfig';

/* ═══════════════════════════════════════════════════════════════════
   EXAM SERVICE — LIVE.

   Pehle ye poori file mock/exams.js lautati thi (exams, classes, subjects,
   syllabus, date sheets, result scaffolds…). Us se do nuqsan thay: screen
   khulte hi banawata data asli lagta tha, aur Universal Search me aise
   imtehanat ke natije aate thay jo school me hain hi nahi.

   Ab yahan sirf wo ek cheez hai jo waqai API deti hai aur jiska koi live
   caller hai — branch ke saare terms + exams, ek hi call me:

     GET /api/gettermsandexamsbybranchid?branchID=
       → [{ branchID, termID, examID, termName, examName }]

   Examination screen apna baqi data khud seedha API se lati hai
   (/api/getexamsbybranchidtermid, /api/getexamsyllabus…, /api/getdatesheet…
   waghera) — us ke liye yahan kuch rakhne ki zaroorat nahi.
   ═══════════════════════════════════════════════════════════════════ */

/** Is branch ke saare terms + exams (search aur pickers ke liye). */
export async function getTermsAndExams() {
  const token = sessionStorage.getItem('token');
  const branchID = sessionStorage.getItem('branchID');
  if (!branchID) return [];

  const response = await fetch(
    buildUrl(`/api/gettermsandexamsbybranchid?branchID=${branchID}`),
    {
      method: 'GET',
      headers: {
        Accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );

  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  /* API kabhi seedha array deti hai, kabhi { data: [...] } — dono chalte hain. */
  const json = await response.json();
  const rows = Array.isArray(json) ? json : (json?.data || []);
  return Array.isArray(rows) ? rows : [];
}
