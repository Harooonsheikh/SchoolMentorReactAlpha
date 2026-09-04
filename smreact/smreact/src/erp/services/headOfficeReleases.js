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

   ── Content ki tafseel ab isi jawab me aati hai ──
   Jawab me har release ke saath uska APNA content bhi hota hai —
   Activity / LessonPlanMaster / NoteBookPlansMaster / ResourceFile, har
   row par apna MasterID. Yehi pehli tarjeeh hai.

   (Pehle yahan likha tha ke server ye khaane khali bhejta hai aur sirf
   ids milti hain. Ab aisa nahi — aur usi purani baat ki wajah se ye
   screen release ka content Head Office ke MOJOODA index me se dhoondti
   thi. Jo cheez us index me na milti — release ke baad wahan se nikal
   jaye ya kisi aur wajah se na aaye — wo yahan gayab ho jati thi aur har
   release "0, 0, 0" dikhata tha, halanke server par rows maujood thin.)

   Jis release ke saath uska content na aaye (purane records) uske liye
   wahi purana raasta fallback rehta hai — network ke apne (wahi jo chain
   portal parhta hai) raste, Child2Raw ki ids par milaan kar ke:

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

  const { activityOf, planOf, resourceOf } = makeMappers(className, subjectName);
  const byId = (arr, map) => {
    const m = new Map();
    arr.forEach((r) => { const v = map(r); if (v) m.set(v.id, v); });
    return m;
  };

  return {
    className,
    subjectName,
    activities: byId(rows(acts), activityOf),
    lessons: byId(rows(lessons), planOf),
    notebooks: byId(rows(notebooks), planOf),
    resources: byId(rows(resources), resourceOf),
  };
}

/* ── Row → screen ka shape ──────────────────────────────────────────
   Ye mappers DO jagah se chalte hain: network ke apne raste (camelCase
   fields dete hain) aur release GET ka apna content (PascalCase — ID,
   ClassID, UnitNumber…). Is liye har field dono suraton me parhi jati hai,
   warna release wale rows sab khali map hoti hain.

   Class aur subject ke NAAM release jawab me nahi aate — wo LaunchSetup ke
   network raston se aate hain, is liye naam ke do map bahar se milte hain. */
const pick = (r, ...keys) => {
  for (const k of keys) {
    const v = r && r[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
};

function makeMappers(className, subjectName) {
  const activityOf = (r) => {
    const id = num(pick(r, 'id', 'ID', 'Id'));
    if (!id) return null;
    const from = toDateOnly(pick(r, 'startAt', 'StartAt', 'startDate', 'StartDate'));
    const to = toDateOnly(pick(r, 'endAt', 'EndAt', 'endDate', 'EndDate')) || from;
    return {
      id,
      title: str(pick(r, 'name', 'Name')) || 'Activity',
      from, to,
      purpose: str(pick(r, 'activityPurpose', 'ActivityPurpose')),
      development: str(pick(r, 'activityDevelopment', 'ActivityDevelopment')),
      /* Backend ki spelling `resourseMaterial` hai — typo wahin se hai. */
      resource: str(pick(r, 'resourseMaterial', 'ResourseMaterial')),
      status: activityStatus(from, to),
    };
  };

  /* Lesson aur notebook ki master row ka dhancha ek jaisa hai. */
  const planOf = (r) => {
    const id = num(pick(r, 'id', 'ID', 'Id'));
    if (!id) return null;
    const gid = num(pick(r, 'classID', 'ClassID'));
    const sid = num(pick(r, 'subjectID', 'SubjectID'));
    const unitNo = str(pick(r, 'unitNo', 'UnitNo', 'unitNumber', 'UnitNumber'));
    return {
      id,
      unitNo,
      unitTitle: str(pick(r, 'unitName', 'UnitName')) || `Unit ${unitNo}`,
      lessonTitle: str(pick(r, 'lessonPlanTopic', 'LessonPlanTopic')) || 'Untitled lesson',
      hoClass: className.get(gid) || (gid ? `Class #${gid}` : '—'),
      hoSubject: subjectName.get(sid) || (sid ? `Subject #${sid}` : '—'),
      medium: str(pick(r, 'medium', 'Medium')) || 'English',
    };
  };

  const resourceOf = (r) => {
    const id = num(pick(r, 'id', 'ID', 'Id'));
    if (!id) return null;
    const raw = str(pick(r, 'uploadedPDF', 'UploadedPDF', 'uploadedPdf'));
    const gid = num(pick(r, 'classID', 'ClassID'));
    const sid = num(pick(r, 'subjectID', 'SubjectID'));
    return {
      id,
      title: str(pick(r, 'resourceTitle', 'ResourceTitle')) || 'Untitled resource',
      description: str(pick(r, 'resourceDescription', 'ResourceDescription')),
      category: str(pick(r, 'category', 'Category')).toLowerCase() || 'other',
      fileName: raw ? raw.split(/[\\/]/).pop() : '',
      fileUrl: raw ? resolveMediaUrl(raw) : '',
      /* Server list par class/subject ka naam khud join kar deta hai. */
      hoClass: str(pick(r, 'className', 'ClassName')) || className.get(gid) || (gid ? `Class #${gid}` : '—'),
      hoSubject: str(pick(r, 'subjectName', 'SubjectName')) || subjectName.get(sid) || (sid ? `Subject #${sid}` : '—'),
    };
  };

  return { activityOf, planOf, resourceOf };
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
  /* Har release ka APNA content — jawab me saath hi aata hai, har row par
     MasterID. Yehi pehli tarjeeh hai (upar wali sharh dekhein). */
  const inlineOf = {
    activity: groupBy(data.Activity, 'MasterID'),
    lesson: groupBy(data.LessonPlanMaster, 'MasterID'),
    notebook: groupBy(data.NoteBookPlansMaster, 'MasterID'),
    resource: groupBy(data.ResourceFile, 'MasterID'),
  };

  /* Sirf wo releases jo is branch ko gaye — content tab hi laate hain. */
  const mine = list(data.Master).filter((m) => (
    (branchesOf.get(num(m.ID)) || []).some((c) => num(c.BranchID) === bid)
  ));
  if (mine.length === 0) return { releases: [], headOfficeName };

  const content = await fetchNetworkContent(networkId);
  /* Inline rows ko bhi wahi shape dena hai jo screen parhti hai — naam ke
     map network content se aate hain. */
  const mappers = makeMappers(content.className, content.subjectName);
  const MAP_FOR = {
    activity: mappers.activityOf,
    lesson: mappers.planOf,
    notebook: mappers.planOf,
    resource: mappers.resourceOf,
  };

  /* Naya release pehle — server id hi tarteeb hai. */
  const ordered = mine.slice().sort((x, y) => num(y.ID) - num(x.ID));

  const releases = ordered.map((m, i) => {
    const id = num(m.ID);
    const isSub = str(m.ReleaseType).toLowerCase() === 'subrelease';
    const items = itemsOf.get(id) || [];

    /* Is release ke apne content ki id → row. Jo yahan mil jaye wo network
       index se aage rehta hai: network index Head Office ki MOJOODA haalat
       hai, jabke ye release ka apna record. */
    const inlineRows = (type) => {
      const m = new Map();
      const map = MAP_FOR[type];
      (inlineOf[type].get(id) || []).forEach((r) => {
        const v = map(r);
        if (v) m.set(v.id, v);
      });
      return m;
    };

    const pickOf = (type, from) => {
      const own = inlineRows(type);
      return items
        .filter((it) => typeKeyOf(it.Type) === type)
        .map((it) => {
          const tid = num(it.TypeID);
          /* Pehle release ka apna record, phir network index (purane
             releases jin ke saath content na aaya ho). */
          const row = own.get(tid) || from.get(tid);
          /* Dono jagah na mile — us ki sirf id bachi hai, is liye chhupa
             dete hain (khali card se behtar). */
          return row ? { ...row, id: `${type}-${tid}` } : null;
        })
        .filter(Boolean);
    };

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
      activities: pickOf(TYPE.activity, content.activities),
      lessonPlans: pickOf(TYPE.lesson, content.lessons),
      notebookPlans: pickOf(TYPE.notebook, content.notebooks),
      resources: pickOf(TYPE.resource, content.resources),
    };
  });

  return { releases, headOfficeName };
}
