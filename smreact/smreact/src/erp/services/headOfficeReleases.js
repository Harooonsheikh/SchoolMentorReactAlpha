import { buildUrl, buildChainApiUrl, resolveMediaUrl } from '../../utils/apiConfig';
import { fetchBranchNetworkId } from './chainBranch';

/* ═══════════════════════════════════════════════════════════════════
   RELEASES FROM HEAD OFFICE — school side.

   Chain (Head Office) apne Academics me Master ya Sub Release banata hai;
   wo release Chain-Management API par is tarah baithta hai:

     POST {chain}/api/Network_Setup/manage-release   { action: "get", … }
       Master     → har release ki tafseel (ReleaseType, DueDate, Duration)
       Child1     → kin branches ko gaya (BranchID)
       Child2Raw  → kya kya gaya: Type + TypeID + GradeID + SubjectID

   ── Ahem: content ki tafseel is jawab me NAHI aati ──
   Jawab me Activity / LessonPlanMaster / ResourceFile waghera ke khaane
   to hain magar server unhe khali hi bhejta hai (jaanch kar likha gaya).
   Sirf ids milti hain. Is liye har section ki asli tafseel network ke
   apne (wahi jo chain portal parhta hai) raston se laate hain aur
   Child2Raw ki ids par milaate hain:

     ActivityCalendar     → /api/getactivitycalendarbynetwork
     classworklessonplan  → /api/getulpforclassmasterbynetwork
     notebooklessonplan   → /api/getulpfornotebookmasterbynetwork
     resourcelibrary      → /api/manage-resource-library (getbynetwork)

   Class/subject ke naam LaunchSetup ke network wale raston se aate hain —
   GradeID/SubjectID chain ki ids hain, school ki apni nahi.

   ── Tareekhein ──
   "Released on" = Master ki CreationDate (chain portal ka Release Date),
   "Valid until" = DueDate, aur Duration validity ke din hain.
   ═══════════════════════════════════════════════════════════════════ */

const RELEASE_URL = () => buildChainApiUrl('/api/Network_Setup/manage-release');
const NETWORKS_URL = () => buildChainApiUrl('/api/Network_Setup/get_all_networks');

const branchId = () => Number(sessionStorage.getItem('branchID')) || 0;
const num = (v) => Number(v) || 0;
const str = (v) => String(v == null ? '' : v).trim();
const list = (v) => (Array.isArray(v) ? v : []);

async function getJson(url, opt) {
  const token = sessionStorage.getItem('token');
  const res = await fetch(url, {
    ...opt,
    headers: { Accept: '*/*', ...(opt && opt.headers), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new Error((json && (json.message || json.title)) || `Request failed (${res.status})`);
  }
  return json;
}

const postJson = (url, body) => getJson(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

/* manage-release har action par ye chaar fields maangta hai — get par bhi,
   warna 400 (validation) aata hai. Ye natije par asar nahi daalte. */
const GET_STUB = {
  releaseType: 'Release',
  dueDate: new Date().toISOString(),
  creationDate: new Date().toISOString(),
  duration: '0',
};

/* ───────────────────── Ye branch kis network me hai ─────────────────────
   Yahan pehle isi ka apna copy tha; ab wo chainBranch me rehta hai (wahi
   jagah jahan chain-membership ka faisla hota hai) aur session bhar cache
   hota hai — School SOPs bhi wahi padhti hai. */
export { fetchBranchNetworkId };

/** Head Office ka naam — "Released by" par yehi dikhta hai. */
async function fetchNetworkName(networkId) {
  try {
    const json = await getJson(NETWORKS_URL());
    const row = list(json && json.data).find((n) => num(n.id) === num(networkId));
    return (row && str(row.schoolNetwork)) || '';
  } catch (e) {
    return '';                       // naam na mile to card par generic naam
  }
}

/* ───────────────────── Network ka poora content ───────────────────── */

const toDateOnly = (v) => {
  const s = str(v);
  if (!s) return '';
  return s.length >= 10 ? s.slice(0, 10) : s;
};

const activityStatus = (from, to) => {
  const today = new Date().toISOString().slice(0, 10);
  const end = to || from;
  if (end && end < today) return 'completed';
  if (from && from <= today && (!end || end >= today)) return 'ongoing';
  return 'upcoming';
};

async function fetchNetworkContent(networkId) {
  const rl = new FormData();
  rl.append('Action', 'getbynetwork');
  rl.append('NetworkID', String(networkId));
  rl.append('BranchID', '0');
  rl.append('SectionID', '0');

  /* Har section apni alag call par — ek gir jaye to baqi release phir bhi
     dikhe, is liye har ek ka apna catch. */
  const [acts, lessons, notebooks, resources, classes] = await Promise.all([
    getJson(buildUrl(`/api/getactivitycalendarbynetwork?NetworkID=${networkId}&SessionYearID=0&pageNo=1`)).catch(() => null),
    getJson(buildUrl(`/api/getulpforclassmasterbynetwork?NetworkID=${networkId}`)).catch(() => null),
    getJson(buildUrl(`/api/getulpfornotebookmasterbynetwork?NetworkID=${networkId}`)).catch(() => null),
    getJson(buildUrl('/api/manage-resource-library'), { method: 'POST', body: rl }).catch(() => null),
    getJson(buildUrl(`/api/LaunchSetup/get-grades-by-network/${networkId}`)).catch(() => null),
  ]);

  const rows = (j) => (Array.isArray(j) ? j : list(j && j.data));

  /* Subject ke naam class ke neeche hi milte hain — har class ke liye ek call. */
  const classRows = rows(classes);
  const subjLists = await Promise.all(classRows.map((c) => (
    getJson(buildUrl(`/api/LaunchSetup/get-subjects-by-network-grade/${networkId}/${num(c.id)}`)).catch(() => null)
  )));
  const subjectName = new Map();
  subjLists.forEach((j) => rows(j).forEach((s) => subjectName.set(num(s.subjectID), str(s.subjectName))));
  const className = new Map(classRows.map((c) => [num(c.id), str(c.name)]));

  const byId = (arr, map) => {
    const m = new Map();
    arr.forEach((r) => { const v = map(r); if (v) m.set(v.id, v); });
    return m;
  };

  const activities = byId(rows(acts), (r) => {
    const id = num(r.id);
    if (!id) return null;
    const from = toDateOnly(r.startAt || r.startDate);
    const to = toDateOnly(r.endAt || r.endDate) || from;
    return {
      id,
      title: str(r.name) || 'Activity',
      from, to,
      purpose: str(r.activityPurpose),
      development: str(r.activityDevelopment),
      /* Backend ki spelling `resourseMaterial` hai — typo wahin se hai. */
      resource: str(r.resourseMaterial),
      status: activityStatus(from, to),
    };
  });

  /* Lesson aur notebook ki master row ka dhancha ek jaisa hai. */
  const planOf = (r) => {
    const id = num(r.id);
    if (!id) return null;
    const gid = num(r.classID);
    const sid = num(r.subjectID);
    return {
      id,
      unitNo: str(r.unitNo),
      unitTitle: str(r.unitName) || `Unit ${str(r.unitNo)}`,
      lessonTitle: str(r.lessonPlanTopic) || 'Untitled lesson',
      hoClass: className.get(gid) || (gid ? `Class #${gid}` : '—'),
      hoSubject: subjectName.get(sid) || (sid ? `Subject #${sid}` : '—'),
      medium: str(r.medium) || 'English',
    };
  };

  const resourceOf = (r) => {
    const id = num(r.id);
    if (!id) return null;
    const raw = str(r.uploadedPDF);
    const gid = num(r.classID);
    const sid = num(r.subjectID);
    return {
      id,
      title: str(r.resourceTitle) || 'Untitled resource',
      description: str(r.resourceDescription),
      category: str(r.category).toLowerCase() || 'other',
      fileName: raw ? raw.split(/[\\/]/).pop() : '',
      fileUrl: raw ? resolveMediaUrl(raw) : '',
      /* Server list par class/subject ka naam khud join kar deta hai. */
      hoClass: str(r.className) || className.get(gid) || (gid ? `Class #${gid}` : '—'),
      hoSubject: str(r.subjectName) || subjectName.get(sid) || (sid ? `Subject #${sid}` : '—'),
    };
  };

  return {
    activities,
    lessons: byId(rows(lessons), planOf),
    notebooks: byId(rows(notebooks), planOf),
    resources: byId(rows(resources), resourceOf),
  };
}

/* ───────────────────────────── Releases ───────────────────────────── */

/* child2 ka `type` — Head Office 'Activity' / 'Lesson Plan' / 'NoteBook Plan'
   / 'Resource File' bhejta hai (dekhein chain portal ka releaseApi.js).
   Purane releases DB me purani spelling ('ActivityCalendar',
   'classworklessonplan' waghera) ke sath pade hain, is liye milaan se pehle
   sirf harf-o-adad rakhe jate hain — bara/chhota harf, space aur
   singular/plural ka farq mit jata hai. */
const normType = (v) => String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9]/g, '');
const TYPE_ALIASES = {
  activity: ['Activity', 'Activities', 'ActivityCalendar'],
  lesson: ['Lesson Plan', 'Lesson Plans', 'classworklessonplan'],
  notebook: ['NoteBook Plan', 'NoteBook Plans', 'notebooklessonplan'],
  resource: ['Resource File', 'Resource Files', 'resourcelibrary'],
};
const TYPE_KEY = new Map();
Object.entries(TYPE_ALIASES).forEach(([key, names]) => names.forEach((n) => TYPE_KEY.set(normType(n), key)));
const typeKeyOf = (raw) => TYPE_KEY.get(normType(raw)) || '';

const TYPE = { activity: 'activity', lesson: 'lesson', notebook: 'notebook', resource: 'resource' };

const groupBy = (arr, key) => {
  const m = new Map();
  list(arr).forEach((r) => {
    const k = num(r[key]);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  });
  return m;
};

/**
 * Is school ke liye Head Office ki releases — sirf wahi jin ke Child1 me
 * is branch ki id hai (Master sab branches ko jata hai, Sub sirf chuni
 * hui ko; dono soorton me faisla Child1 hi karta hai).
 *
 * Chain ka hissa na ho to khali list — koi error nahi.
 */
export async function fetchHeadOfficeReleases() {
  const bid = branchId();
  const networkId = await fetchBranchNetworkId();
  if (!bid || !networkId) return { releases: [], headOfficeName: '' };

  const [json, headOfficeName] = await Promise.all([
    postJson(RELEASE_URL(), { action: 'get', id: 0, networkID: networkId, ...GET_STUB }),
    fetchNetworkName(networkId),
  ]);
  const data = (json && json.data) || {};
  const branchesOf = groupBy(data.Child1, 'MasterID');
  const itemsOf = groupBy(data.Child2Raw, 'MasterID');

  /* Sirf wo releases jo is branch ko gaye — content tab hi laate hain. */
  const mine = list(data.Master).filter((m) => (
    (branchesOf.get(num(m.ID)) || []).some((c) => num(c.BranchID) === bid)
  ));
  if (mine.length === 0) return { releases: [], headOfficeName };

  const content = await fetchNetworkContent(networkId);

  /* Naya release pehle — server id hi tarteeb hai. */
  const ordered = mine.slice().sort((x, y) => num(y.ID) - num(x.ID));

  const releases = ordered.map((m, i) => {
    const id = num(m.ID);
    const isSub = str(m.ReleaseType).toLowerCase() === 'subrelease';
    const items = itemsOf.get(id) || [];
    const pick = (type, from) => items
      .filter((it) => typeKeyOf(it.Type) === type)
      .map((it) => {
        const row = from.get(num(it.TypeID));
        /* Content jo release ke baad HO se mit gaya — us ki sirf id bachi
           hai, is liye us ko chhupa dete hain (khali card se behtar). */
        return row ? { ...row, id: `${type}-${num(it.TypeID)}` } : null;
      })
      .filter(Boolean);

    return {
      id: `HO-${id}`,
      apiId: id,
      no: ordered.length - i,
      title: `${isSub ? 'Sub' : 'Master'} Release ${id}`,
      type: isSub ? 'SUB_RELEASE' : 'MASTER_RELEASE',
      releasedBy: headOfficeName || 'Head Office',
      /* Head Office ne jis din release kiya — server ki CreationDate.
         (Pehle ye khaana server ko bheja hi nahi jata tha, is liye yahan
         null likha hua tha aur card par "Released on" khali rehta tha.) */
      releasedOn: toDateOnly(m.CreationDate ?? m.creationDate) || null,
      validUntil: toDateOnly(m.DueDate),
      validityDays: num(m.Duration),
      status: 'ACTIVE',
      appliesToAllSchools: !isSub,
      selectedSchoolIds: (branchesOf.get(id) || []).map((c) => num(c.BranchID)),
      activities: pick(TYPE.activity, content.activities),
      lessonPlans: pick(TYPE.lesson, content.lessons),
      notebookPlans: pick(TYPE.notebook, content.notebooks),
      resources: pick(TYPE.resource, content.resources),
    };
  });

  return { releases, headOfficeName };
}
