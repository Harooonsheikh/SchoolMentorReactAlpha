import { useState, useMemo, useEffect } from 'react';
import { normalizePkPhone } from '../../utils/phone';
import { buildUrl } from '../../utils/apiConfig';
import './PasswordManagerScreen.css';


/* Screens:
     home          → 3 bade buttons
     view          → username daal kar password dekhna
     reset         → 2 options (default / own)
     reset-default → sirf username
     reset-own     → username + naya password
     branches      → table                                                */
export default function PasswordManagerScreen({ onClose }) {
  const [screen, setScreen] = useState('home');

  const back = () => setScreen(screen.startsWith('reset-') ? 'reset' : 'home');

  const titles = {
    home:            ['Password Manager', 'Manage school head credentials across your branches.'],
    view:            ['View Password', 'Enter the username to see its current password.'],
    reset:           ['Reset Password', 'Choose how you want to reset the password.'],
    'reset-default': ['Set Default Password', 'The account will be reset to the system default password.'],
    'reset-own':     ['Set Own Password', 'Enter a new password for this account.'],
    branches:        ['Branches List', 'All branches with their school head credentials.'],
  };
  const [title, subtitle] = titles[screen];

  return (
    <div className="pm-page">
      <div className={`pm-card${screen === 'branches' ? ' is-wide' : ''}`}>
        <header className="pm-header">
          {screen !== 'home' ? (
            <button type="button" className="pm-back" onClick={back} aria-label="Back">
              <i className="fa-solid fa-arrow-left" />
            </button>
          ) : onClose ? (
            <button type="button" className="pm-back" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" />
            </button>
          ) : null}
          <div>
            <h2 className="pm-title">{title}</h2>
            <p className="pm-subtitle">{subtitle}</p>
          </div>
        </header>

        {/* key → screen badalne par halka fade */}
        <div className="pm-body" key={screen}>
          {screen === 'home'          && <HomeView go={setScreen} />}
          {screen === 'view'          && <ViewPassword />}
          {screen === 'reset'         && <ResetChoice go={setScreen} />}
          {screen === 'reset-default' && <ResetDefault />}
          {screen === 'reset-own'     && <ResetOwn />}
          {screen === 'branches'      && <BranchesTable />}
        </div>
      </div>
    </div>
  );
}

/* ───────────── Home: 3 buttons ───────────── */
function HomeView({ go }) {
  const items = [
    { key: 'view',     icon: 'fa-eye',             label: 'View Password',  desc: 'Look up a user’s current password' },
    { key: 'reset',    icon: 'fa-rotate-left',     label: 'Reset Password', desc: 'Set default or a custom password' },
    { key: 'branches', icon: 'fa-building-columns', label: 'Branches List', desc: 'See every branch and its school head' },
  ];
  return (
    <div className="pm-action-grid">
      {items.map((it) => (
        <button key={it.key} type="button" className="pm-action" onClick={() => go(it.key)}>
          <span className="pm-action-icon"><i className={`fa-solid ${it.icon}`} /></span>
          <span className="pm-action-text">
            <strong>{it.label}</strong>
            <small>{it.desc}</small>
          </span>
          <i className="fa-solid fa-chevron-right pm-action-arrow" />
        </button>
      ))}
    </div>
  );
}

/* ───────────── Reset: 2 options ───────────── */
function ResetChoice({ go }) {
  return (
    <div className="pm-choice-grid">
      <button type="button" className="pm-choice" onClick={() => go('reset-default')}>
        <i className="fa-solid fa-key" />
        <strong>Set Default Password</strong>
        <small>Reset to the system default</small>
      </button>
      <button type="button" className="pm-choice" onClick={() => go('reset-own')}>
        <i className="fa-solid fa-pen-to-square" />
        <strong>Set Own Password</strong>
        <small>Choose a new password yourself</small>
      </button>
    </div>
  );
}

/* ───────────── Chhote shared pieces ───────────── */
function UsernameField({ value, onChange, onEnter }) {
  return (
    <>
      <label className="pm-label">Username (Phone Number)</label>
      <div className="pm-input-wrap">
        <span className="pm-input-icon"><i className="fa-solid fa-user" /></span>
        <input className="pm-input" type="tel" placeholder="XXXX XXXXXXX"
          value={value} onChange={(e) => onChange(normalizePkPhone(e.target.value))}
          onKeyDown={(e) => e.key === 'Enter' && onEnter?.()} />
      </div>
    </>
  );
}

/* Sandbox par kuch APIs abhi deploy nahi (404). Pehle app ka apna base URL,
   agar wahan 404 aaye to alphaapi (live) wala URL. */
const FALLBACK_API_BASE = 'https://alphaapi.schoolmentor.ai';
async function apiFetch(path, opts) {
  let res = await fetch(buildUrl(path), opts).catch(() => null);
  if (!res || res.status === 404) {
    /* Sandbox ka token live server par nahi chalta (401) — is liye fallback par token nahi bhejte. */
    const { Authorization, ...headers } = opts?.headers || {};
    res = await fetch(FALLBACK_API_BASE + path, { ...opts, headers });
  }
  return res;
}

function Message({ msg }) {
  if (!msg) return null;
  return <div className={`pm-msg is-${msg.type}`}>{msg.text}</div>;
}

/* ───────────── View Password ───────────── */
/* API: GET /api/Auth/get-password/{phone}
   Response ki shakal pakki nahi — plain text bhi ho sakta hai aur JSON bhi
   ({ password } / { data: { password } } waghera), is liye sab check karte hain. */
function pickPassword(data, raw) {
  if (data == null) return String(raw || '').trim().replace(/^"|"$/g, '');
  if (typeof data === 'string') return data;
  const d = data.data ?? data.Data ?? data.result ?? data;
  const rec = Array.isArray(d) ? d[0] : d;
  if (typeof rec === 'string') return rec;
  return rec?.password ?? rec?.Password ?? rec?.userPassword ?? rec?.pass ?? '';
}
function pickField(data, ...keys) {
  const d = data?.data ?? data?.Data ?? data?.result ?? data;
  const rec = Array.isArray(d) ? d[0] : d;
  if (!rec || typeof rec !== 'object') return '';
  for (const k of keys) if (rec[k]) return rec[k];
  return '';
}

function ViewPassword() {
  const [username, setUsername] = useState('');
  const [result, setResult]     = useState(null);
  const [show, setShow]         = useState(false);
  const [msg, setMsg]           = useState(null);
  const [loading, setLoading]   = useState(false);

  async function handleView() {
    setResult(null); setShow(false);
    const phone = normalizePkPhone(username).trim();
    if (!phone) return setMsg({ type: 'error', text: 'Please enter a username.' });

    setMsg(null);
    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const res = await apiFetch(`/api/Auth/get-password/${encodeURIComponent(phone)}`, {
        method: 'GET',
        headers: {
          Accept: '*/*',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      /* Pehle text padho, phir JSON try karo — plain-text response par bhi chale. */
      const raw = await res.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { /* plain text */ }

      if (!res.ok) {
        const m = data?.message ?? data?.Message ?? data?.title ?? raw;
        setMsg({ type: 'error', text: res.status === 404 ? 'User not found.' : (String(m || '').trim() || 'Could not get password.') });
        return;
      }

      const password = pickPassword(data, raw);
      if (!password) {
        setMsg({ type: 'error', text: data?.message || data?.Message || 'User not found.' });
        return;
      }

      setResult({
        phone,
        password: String(password),
        name:   pickField(data, 'displayName', 'name', 'userName', 'employeeName', 'fullName'),
        branch: pickField(data, 'branchName', 'campusName', 'schoolName'),
      });
    } catch (err) {
      setMsg({ type: 'error', text: err?.message ? `Network error: ${err.message}` : 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Message msg={msg} />
      <UsernameField value={username} onChange={setUsername} onEnter={handleView} />
      <button type="button" className="pm-btn-primary" onClick={handleView} disabled={loading}>
        {loading
          ? <>Loading… <i className="fa-solid fa-spinner fa-spin" /></>
          : <>View Password <i className="fa-solid fa-eye" /></>}
      </button>

      {result && (
        <div className="pm-result">
          <div className="pm-result-row"><span>Username</span><strong>{result.phone}</strong></div>
          {result.name   && <div className="pm-result-row"><span>Name</span><strong>{result.name}</strong></div>}
          {result.branch && <div className="pm-result-row"><span>Branch</span><strong>{result.branch}</strong></div>}
          <div className="pm-result-row">
            <span>Password</span>
            <span className="pm-pass">
              <code>{show ? result.password : '••••••••'}</code>
              <button type="button" onClick={() => setShow((s) => !s)} aria-label="Toggle password">
                <i className={`fa-solid ${show ? 'fa-eye-slash' : 'fa-eye'}`} />
              </button>
              <CopyBtn text={result.password} />
            </span>
          </div>
        </div>
      )}
    </>
  );
}

/* ───────────── Reset → Default ───────────── */
/* Wahi API: POST /api/Auth/change-password  { code, userName, password }
   Frontend par sirf number — password aur code yahin se auto jate hain. */
const DEFAULT_PASSWORD = '123456';
const CHANGE_PASSWORD_CODE = 'AHM_SM_CP_NRP_2026';

function ResetDefault() {
  const [username, setUsername] = useState('');
  const [msg, setMsg]           = useState(null);
  const [saving, setSaving]     = useState(false);

  async function handleReset() {
    const phone = normalizePkPhone(username).trim();
    if (!phone) return setMsg({ type: 'error', text: 'Please enter a username.' });

    setMsg(null);
    setSaving(true);
    try {
      const token = sessionStorage.getItem('token');
      const res = await apiFetch('/api/Auth/change-password', {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          code: CHANGE_PASSWORD_CODE,
          userName: phone,
          password: DEFAULT_PASSWORD,
        }),
      });
      const raw = await res.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { /* plain text */ }
      const serverMsg = String(data?.message || data?.Message || data?.title || (typeof data === 'string' ? data : '') || (data == null ? raw : '') || '').trim();

      if (!res.ok || data?.success === false || data?.status === false || data?.isSuccess === false) {
        setMsg({ type: 'error', text: res.status === 404 ? 'User not found.' : (serverMsg || 'Could not reset password.') });
        return;
      }
      setMsg({ type: 'success', text: `Password for ${phone} has been reset to default (${DEFAULT_PASSWORD}).` });
      setUsername('');
    } catch (err) {
      setMsg({ type: 'error', text: err?.message ? `Network error: ${err.message}` : 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Message msg={msg} />
      <UsernameField value={username} onChange={setUsername} onEnter={handleReset} />
      <div className="pm-note">
        <i className="fa-solid fa-circle-info" />
        The password will be reset to the default: <strong>{DEFAULT_PASSWORD}</strong>
      </div>
      <button type="button" className="pm-btn-primary" onClick={handleReset} disabled={saving}>
        {saving
          ? <>Resetting… <i className="fa-solid fa-spinner fa-spin" /></>
          : <>Set Default Password <i className="fa-solid fa-key" /></>}
      </button>
    </>
  );
}

/* ───────────── Reset → Own ───────────── */
function ResetOwn() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow]         = useState(false);
  const [msg, setMsg]           = useState(null);
  const [code, setCode]         = useState('');
  const [showCode, setShowCode] = useState(false);
  const [saving, setSaving]     = useState(false);

  /* API: POST /api/Auth/change-password  { code, userName, password }
     `code` = Change Password Code — iske baghair backend password nahi badalta. */
  async function handleSave() {
    const phone = normalizePkPhone(username).trim();
    if (!code.trim())
      return setMsg({ type: 'error', text: 'Please enter the change password code.' });
    if (!phone || !password.trim())
      return setMsg({ type: 'error', text: 'Please enter username and new password.' });
    if (password.length < 6)
      return setMsg({ type: 'error', text: 'Password must be at least 6 characters.' });

    setMsg(null);
    setSaving(true);
    try {
      const token = sessionStorage.getItem('token');
      const res = await apiFetch('/api/Auth/change-password', {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code: code.trim(), userName: phone, password }),
      });
      const raw = await res.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { /* plain text */ }
      const serverMsg = String(data?.message || data?.Message || data?.title || (typeof data === 'string' ? data : '') || (data == null ? raw : '') || '').trim();

      /* HTTP ok ho magar body me success:false / status:false aaye to bhi fail. */
      if (!res.ok || data?.success === false || data?.status === false || data?.isSuccess === false) {
        setMsg({ type: 'error', text: res.status === 404 ? 'User not found.' : (serverMsg || 'Could not change password.') });
        return;
      }
      setMsg({ type: 'success', text: serverMsg && serverMsg.length < 160 ? serverMsg : `New password set for ${phone}.` });
      setUsername(''); setPassword(''); setCode('');
    } catch (err) {
      setMsg({ type: 'error', text: err?.message ? `Network error: ${err.message}` : 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <Message msg={msg} />

      <label className="pm-label">Change Password Code</label>
      <div className="pm-input-wrap">
        <span className="pm-input-icon"><i className="fa-solid fa-shield-halved" /></span>
        <input className="pm-input" type={showCode ? 'text' : 'password'} placeholder="Enter change password code"
          autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()} />
        <button type="button" className="pm-eye-btn" onClick={() => setShowCode((s) => !s)} tabIndex={-1}>
          <i className={`fa-solid ${showCode ? 'fa-eye-slash' : 'fa-eye'}`} />
        </button>
      </div>

      <UsernameField value={username} onChange={setUsername} onEnter={handleSave} />

      <label className="pm-label">New Password</label>
      <div className="pm-input-wrap">
        <span className="pm-input-icon"><i className="fa-solid fa-lock" /></span>
        <input className="pm-input" type={show ? 'text' : 'password'} placeholder="Enter new password"
          value={password} onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()} />
        <button type="button" className="pm-eye-btn" onClick={() => setShow((s) => !s)} tabIndex={-1}>
          <i className={`fa-solid ${show ? 'fa-eye-slash' : 'fa-eye'}`} />
        </button>
      </div>

      <button type="button" className="pm-btn-primary" onClick={handleSave} disabled={saving}>
        {saving
          ? <>Saving… <i className="fa-solid fa-spinner fa-spin" /></>
          : <>Save Password <i className="fa-solid fa-check" /></>}
      </button>
    </>
  );
}

/* ───────────── Branches table ───────────── */
const BRANCHES_API_URL = 'https://alphaapi.schoolmentor.ai/api/Auth/branch-school-heads';

function BranchesTable() {
  const [query, setQuery]       = useState('');
  const [visible, setVisible]   = useState({}); // { [id]: true } → us row ka password dikhao
  const [branches, setBranches] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  /* Column sorting: { key: 'name' | 'headName' | 'headUser' | null, dir: 'asc' | 'desc' } */
  const [sort, setSort]         = useState({ key: null, dir: 'asc' });

  /* API: GET /api/Auth/branch-school-heads → { data: [{ branchId, branchName,
     schoolHeadName, headUserName, password }] }. Table ki purani shape me map
     karte hain taake neeche ka render waisa hi rahe. */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = sessionStorage.getItem('token');
        const opts = {
          method: 'GET',
          headers: { Accept: '*/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        };
        /* Pehle app ka apna base URL; agar wahan 404 aaye to seedha alphaapi wala URL. */
        let res = await fetch(buildUrl('/api/Auth/branch-school-heads'), opts).catch(() => null);
        if (!res || res.status === 404) {
          res = await fetch(BRANCHES_API_URL, opts);
        }
        const raw = await res.text();
        let data = null;
        try { data = raw ? JSON.parse(raw) : null; } catch { /* plain text */ }
        if (!res.ok) throw new Error(data?.message || data?.Message || raw || `Request failed (${res.status})`);
        const list = Array.isArray(data) ? data : (data?.data ?? data?.Data ?? []);
        const mapped = (Array.isArray(list) ? list : []).map((r, i) => ({
          id:        r.branchId ?? r.branchID ?? `row-${i}`,
          /* Ek branch ke kai school heads ho sakte hain (221011 do baar aata hai) — is liye
             React key aur password toggle ke liye Branch ID + username + index. */
          rowKey:    `${r.branchId ?? r.branchID ?? 'x'}-${r.headUserName ?? ''}-${i}`,
          branchID:  r.branchId ?? r.branchID ?? '—',
          name:      r.branchName || '—',
          headName:  r.schoolHeadName || '—',
          headUser:  r.headUserName || '—',
          headPass:  r.password ?? '',
        }));
        if (alive) setBranches(mapped);
      } catch (e) {
        if (alive) setError(e?.message ? String(e.message) : 'Could not load branches.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  /* Search:
       • sirf digits, 1–4  → Branch ID (exact) — warna "1" har phone number se match ho jata tha
       • sirf digits, 5+   → School Head Username (phone) — space/dash ignore
       • alfaaz            → Name + School Head Name (har lafz match ho) */
  const rows = useMemo(() => {
    const raw = query.trim().toLowerCase();
    if (!raw) return branches;
    const digits = raw.replace(/[\s-]/g, '');
    if (/^\d+$/.test(digits)) {
      if (digits.length <= 4) return branches.filter((b) => String(b.branchID ?? '') === digits);
      return branches.filter((b) => String(b.headUser || '').replace(/\D/g, '').includes(digits));
    }
    const words = raw.split(/\s+/).filter(Boolean);
    return branches.filter((b) => {
      const hay = `${b.name || ''} ${b.headName || ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [query, branches]);

  /* Search ke BAAD sort — A→Z / Z→A. Bare/chhote huroof ka farq nahi, numbers sahi tarteeb me. */
  const shown = useMemo(() => {
    if (!sort.key) return rows;
    const dir = sort.dir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) =>
      String(a[sort.key] ?? '').localeCompare(String(b[sort.key] ?? ''), undefined, { sensitivity: 'base', numeric: true }) * dir);
  }, [rows, sort]);

  /* Header click: A→Z → Z→A → asal tarteeb */
  const sortBy = (key) => setSort((s) => {
    if (s.key !== key) return { key, dir: 'asc' };
    if (s.dir === 'asc') return { key, dir: 'desc' };
    return { key: null, dir: 'asc' };
  });
  const sortIcon = (key) => (sort.key !== key ? 'fa-sort' : sort.dir === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
  const sortTh = (key, label) => (
    <th onClick={() => sortBy(key)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
      title="Click to sort" aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      {label} <i className={`fa-solid ${sortIcon(key)}`} style={{ marginLeft: 4, opacity: sort.key === key ? 1 : 0.35 }} />
    </th>
  );

  const toggle = (id) => setVisible((v) => ({ ...v, [id]: !v[id] }));

  return (
    <>
      <div className="pm-table-toolbar">
        <div className="pm-input-wrap pm-search">
          <span className="pm-input-icon"><i className="fa-solid fa-magnifying-glass" /></span>
          <input className="pm-input" placeholder="Search by Branch ID, Name, School Head or Username…"
            value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <span className="pm-count">{rows.length} branch{rows.length !== 1 ? 'es' : ''}</span>
      </div>

      <div className="pm-table-wrap">
        <table className="pm-table">
          <thead>
            <tr>
              <th>Branch ID</th>
              {sortTh('name', 'Name')}
              {sortTh('headName', 'School Head Name')}
              {sortTh('headUser', 'School Head Username')}
              <th>School Head Password</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="pm-empty"><i className="fa-solid fa-spinner fa-spin" /> Loading branches…</td></tr>
            ) : error ? (
              <tr><td colSpan={5} className="pm-empty" style={{ color: 'var(--pm-error)' }}>{error}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="pm-empty">No branches found.</td></tr>
            ) : shown.map((b) => (
              <tr key={b.rowKey}>
                <td><code>{b.branchID ?? b.id}</code></td>
                <td className="pm-strong">{b.name}</td>
                <td>{b.headName}</td>
                <td><code>{b.headUser}</code></td>
                <td>
                  <span className="pm-pass">
                    <code>{visible[b.rowKey] ? b.headPass : '••••••••'}</code>
                    <button type="button" onClick={() => toggle(b.rowKey)} aria-label="Toggle password">
                      <i className={`fa-solid ${visible[b.rowKey] ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                    <CopyBtn text={b.headPass} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" aria-label="Copy" onClick={() => {
      navigator.clipboard?.writeText(text).then(() => {
        setDone(true); setTimeout(() => setDone(false), 1200);
      }).catch(() => {});
    }}>
      <i className={`fa-solid ${done ? 'fa-check' : 'fa-copy'}`} />
    </button>
  );
}
