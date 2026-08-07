/* ═══════════════════════════════════════════════════════════════════
   DEV RUNNER — ERP aur School Chain Portal dono ek saath chalate hain.

     ERP           → http://localhost:3000   (react-scripts)
     Chain Portal  → http://localhost:3002   (vite, chain-schools-frontend)

   Zaroorat kyun: Network Head Office se login karne par ERP chain portal
   par redirect karta hai (LoginScreen.jsx). Agar 3002 par kuch chal hi na
   raha ho to browser me "site can't be reached" aata hai — login theek hone
   ke bawajood. Ye script dono uthata hai, ek hi terminal me.

   Koi extra package nahi chahiye (concurrently waghera) — Node ka apna
   child_process kaafi hai.

   Chalane ka tareeqa:  npm run dev
   Band karne ka:       Ctrl+C  (dono ek saath band ho jate hain)
   ═══════════════════════════════════════════════════════════════════ */
const { spawn } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

/* Windows par npm asal me npm.cmd hai; shell:true dono platforms par
   theek chalata hai. */
const isWin = process.platform === 'win32';

const APPS = [
  {
    name: 'ERP  ',
    color: '\x1b[36m',                 // cyan
    cmd: 'npm',
    args: ['run', 'start'],
    cwd: ROOT,
    url: 'http://localhost:3000',
  },
  {
    name: 'CHAIN',
    color: '\x1b[35m',                 // magenta
    cmd: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(ROOT, 'chain-schools-frontend'),
    url: 'http://localhost:3002',
  },
];

const RESET = '\x1b[0m';
const children = [];
let shuttingDown = false;

function prefixLines(app, chunk) {
  const text = chunk.toString();
  return text
    .split(/\r?\n/)
    .filter((line, i, arr) => !(i === arr.length - 1 && line === ''))
    .map((line) => `${app.color}[${app.name}]${RESET} ${line}`)
    .join('\n');
}

function start(app) {
  const child = spawn(app.cmd, app.args, {
    cwd: app.cwd,
    shell: isWin,
    env: { ...process.env, FORCE_COLOR: '1', BROWSER: 'none' },
  });

  child.stdout.on('data', (d) => console.log(prefixLines(app, d)));
  child.stderr.on('data', (d) => console.error(prefixLines(app, d)));

  child.on('exit', (code) => {
    if (shuttingDown) return;
    console.log(`${app.color}[${app.name}]${RESET} exited with code ${code}`);
    /* Ek app mar jaye to doosri ko bhi band kar do — warna aadha system
       chalta rehta hai aur wajah samajh nahi aati. */
    shutdown();
  });

  children.push(child);
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    if (c.exitCode === null) {
      /* Windows par tree kill zaroori hai, warna npm ka child (vite /
         react-scripts) zinda reh jata hai aur port busy rehta hai. */
      if (isWin) spawn('taskkill', ['/pid', String(c.pid), '/f', '/t'], { stdio: 'ignore' });
      else c.kill('SIGTERM');
    }
  }
  setTimeout(() => process.exit(0), 400);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('Starting both apps…');
APPS.forEach((a) => console.log(`  ${a.color}${a.name}${RESET} → ${a.url}`));
console.log('Press Ctrl+C to stop both.\n');

APPS.forEach(start);
