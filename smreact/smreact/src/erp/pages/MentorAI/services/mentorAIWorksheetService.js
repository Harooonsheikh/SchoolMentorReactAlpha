import { axiosProgressConfig, sleep, stageFromJobStatus } from './aiProgress';
import mentorAiApi, { secureMentorUrl } from './mentorAiApi';
/* generate / edit / status calls accept an optional
   `opts = { signal, onProgress }` (Cancel + real progress). */

// ===============================
// GENERATE WORKSHEET
// ===============================

export async function generateWorksheet(params = {}, opts = {}) {
  try {
    const formData = new FormData();

    const gradeLabel = String(
      params.grade ||
      params.cls ||
      params.gradeLabel ||
      ''
    ).trim();

    const subjectLabel = String(
      params.subject ||
      params.subjectLabel ||
      ''
    ).trim();

    const topic = String(
      params.topic || ''
    ).trim();

    const worksheetTypeMap = {
      Practice: 'practice',
      practice: 'practice',
      Assessment: 'assessment',
      assessment: 'assessment',
      Homework: 'homework',
      homework: 'homework',
      Enrichment: 'enrichment',
      enrichment: 'enrichment',
    };

    const difficultyMap = {
      Easy: 'easy',
      easy: 'easy',
      Medium: 'medium',
      medium: 'medium',
      Hard: 'hard',
      hard: 'hard',
    };

    const worksheetFormatMap = {
      'Text Only': 'text_only',
      text_only: 'text_only',
      'Text with Pictures': 'text_with_pictures',
      'Text With Pictures': 'text_with_pictures',
      text_with_pictures: 'text_with_pictures',
    };

    const colourStyleMap = {
      Colourful: 'colourful',
      colourful: 'colourful',
      'Black & White': 'black_white',
      'Black and White': 'black_white',
      black_white: 'black_white',
    };

    const referencePictureModeMap = {
      'Take Photo': 'take_photo',
      take_photo: 'take_photo',
      'Upload Image': 'upload_image',
      upload_image: 'upload_image',
      Skip: 'skip',
      skip: 'skip',
    };

    const worksheetType =
      worksheetTypeMap[params.worksheetType] ||
      worksheetTypeMap[params.type] ||
      'practice';

    const difficulty =
      difficultyMap[params.difficulty] ||
      'medium';

    const worksheetFormat =
      worksheetFormatMap[params.format] ||
      worksheetFormatMap[params.worksheetFormat] ||
      'text_with_pictures';

    const colourStyle =
      colourStyleMap[params.colorStyle] ||
      colourStyleMap[params.colourStyle] ||
      'colourful';

    const referencePictureMode =
      referencePictureModeMap[params.referencePictureMode] ||
      'skip';

    if (!gradeLabel) {
      throw new Error('Please select a grade.');
    }

    if (!subjectLabel) {
      throw new Error('Please select a subject.');
    }

    formData.append(
      'grade_label',
      gradeLabel
    );

    formData.append(
      'subject_label',
      subjectLabel
    );

    formData.append(
      'topic',
      topic
    );

    formData.append(
      'worksheet_type',
      worksheetType
    );

    formData.append(
      'difficulty',
      difficulty
    );

    formData.append(
      'worksheet_format',
      worksheetFormat
    );

    formData.append(
      'colour_style',
      colourStyle
    );

    formData.append(
      'include_branch_branding',
      params.includeBranding === false
        ? 'False'
        : 'True'
    );

    formData.append(
      'instructions',
      String(params.instructions || '')
    );

    formData.append(
      'reference_picture_mode',
      referencePictureMode
    );

    formData.append(
      'number_of_pages',
      String(params.pages || 2)
    );

    // Add reference images only when required
    if (
      referencePictureMode !== 'skip' &&
      Array.isArray(params.referenceImages)
    ) {
      params.referenceImages.forEach((file) => {
        if (file instanceof File) {
          formData.append(
            'reference_images',
            file,
            file.name
          );
        }
      });
    }

    console.log(
      '========== WORKSHEET REQUEST =========='
    );

    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(
          key,
          {
            name: value.name,
            type: value.type,
            size: value.size,
          }
        );
      } else {
        console.log(key, value);
      }
    }

    const response = await mentorAiApi.post(
      '/api/worksheets/generate/',
      formData,
      {
        // Do not manually set Content-Type in browser.
        // Axios/browser adds multipart boundary automatically.
        timeout: 180000,
        signal: opts.signal,
        ...axiosProgressConfig(opts.onProgress, { waitStage: 'queued', downloadStage: 'queued' }),
      }
    );

    console.log(
      '========== WORKSHEET RESPONSE ==========',
      response.data
    );

    return response.data;
  } catch (error) {
    console.error(
      '========== WORKSHEET ERROR =========='
    );

    console.error(
      'Status:',
      error.response?.status
    );

    console.error(
      'Backend error:',
      error.response?.data
    );

    console.error(
      'Full error:',
      error
    );

    throw error;
  }
}

// ===============================
// EDIT WORKSHEET VIA AI
// ===============================

/* Edit via AI for worksheets.

   The Worksheet API has no edit endpoint (Postman collection: only
   POST /api/worksheets/generate/ and GET /api/worksheet-generation-status/
   — the old call to /api/worksheets/edit/ returned 404). So an edit
   re-runs generation with the worksheet's original settings plus the
   requested change, then polls the status endpoint like a normal
   generation. Follow-up instructions build on the previous ones.
   Note: each edit counts as a worksheet generation on the wallet.

   Resolves { worksheet, changes } or throws. */
export async function editWorksheetViaAI(
  worksheet,
  instruction,
  opts = {}
) {
  const base = worksheet?._genParams;
  if (!base) {
    throw new Error('This worksheet can\'t be edited because its original settings are missing. Please generate it again.');
  }
  const change = String(instruction || '').trim();
  const params = {
    ...base,
    instructions: [base.instructions, `Changes requested: ${change}`].filter(Boolean).join('\n\n'),
  };

  try {
    const response = await generateWorksheet(params, {
      signal: opts.signal,
      onProgress: (u) => opts.onProgress?.({ ...u, stage: u.stage === 'queued' ? 'generating' : u.stage }),
    });
    const trackingId = response?.tracking_id || response?.data?.tracking_id;
    const direct = extractWorksheet(response);

    let updated;
    if (trackingId && !direct) {
      updated = await waitForWorksheetResult(trackingId, opts);
    } else {
      opts.onProgress?.({ stage: 'formatting' });
      updated = direct ? normalizeWorksheet(direct) : null;
    }
    if (!updated || (!updated.pdfUrl && !updated.pageContent.length)) {
      throw new Error(response?.error || response?.message || 'Mentor AI returned an incomplete worksheet for this edit. Please try again.');
    }

    const merged = {
      ...updated,
      cls: updated.cls || worksheet.cls,
      subject: updated.subject || worksheet.subject,
      _genParams: params,
    };
    return { worksheet: merged, changes: [`Regenerated with: “${change}”`, ...summarizeWorksheetChanges(worksheet, merged).filter(c => !/refreshed/.test(c))] };
  } catch (error) {
    console.error('Edit Worksheet Error:', error.response?.data || error.message);
    throw error;
  }
}

function extractWorksheet(body) {
  const w = body?.worksheet || body?.data?.worksheet || body?.data || body;
  if (!w || typeof w !== 'object') return null;
  const hasPages = Array.isArray(w.pageContent) || Array.isArray(w.page_content) || Array.isArray(w.sections);
  return (hasPages || w.pdf_url || w.pdfUrl) ? w : null;
}

/* Server kabhi PDF link / pages ke naam badal deta hai (v2). Pehle wahi purane naam,
   phir doosre mumkina naam, aakhir me poore object me .pdf wala link dhoondte hain. */
const PDF_KEYS = ['pdf_url', 'pdfUrl', 'pdf', 'pdf_file', 'pdfFile', 'file_url', 'fileUrl', 'file', 'document_url', 'documentUrl', 'download_url', 'downloadUrl', 'output_pdf', 'worksheet_pdf', 'url'];
const PAGE_KEYS = ['pageContent', 'page_content', 'pages', 'content'];

function deepFindPdf(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 4) return null;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && (/\.pdf(\?|#|$)/i.test(v) || (/pdf/i.test(k) && /^(https?:)?\/\//i.test(v)))) return v;
  }
  for (const v of Object.values(obj)) {
    const hit = deepFindPdf(v, depth + 1);
    if (hit) return hit;
  }
  return null;
}

/* v2 response: worksheet = { title, subtitle, sections:[{ section_label, title, instructions,
   questions:[{ number, page, type, text, options, match_pairs, word_bank, answer_lines }] }] }
   — PDF/pageContent nahi aate. Sawal `page` ke hisab se pages me group karke wohi shakl
   bana dete hain jo WorksheetPages (preview) padhta hai: [{ pageNo, sections:[{ heading, questions:[{ no, text }] }] }]. */
const optText = (o) => (typeof o === 'string' ? o : (o?.text || o?.label || o?.value || ''));
function v2QuestionText(q) {
  let t = String(q?.text || '');
  if (Array.isArray(q?.options) && q.options.length) {
    t += `  ${q.options.map((o, i) => `(${String.fromCharCode(65 + i)}) ${optText(o)}`).join('   ')}`;
  }
  if (Array.isArray(q?.word_bank) && q.word_bank.length) t += `  [Word bank: ${q.word_bank.map(optText).join(', ')}]`;
  if (Array.isArray(q?.match_pairs) && q.match_pairs.length) {
    t += `  ${q.match_pairs.map((p) => (Array.isArray(p) ? p.join(' — ') : `${p?.left ?? p?.a ?? ''} — ${p?.right ?? p?.b ?? ''}`)).join(';  ')}`;
  }
  return t;
}
export function sectionsToPages(sections) {
  const pages = new Map();
  (Array.isArray(sections) ? sections : []).forEach((sec, si) => {
    (Array.isArray(sec?.questions) ? sec.questions : []).forEach((q) => {
      const pg = Number(q?.page) || 1;
      if (!pages.has(pg)) pages.set(pg, new Map());
      const bySec = pages.get(pg);
      if (!bySec.has(si)) {
        const head = [sec.section_label, sec.title].filter(Boolean).join(' — ');
        bySec.set(si, { heading: head + (sec.instructions ? ` (${sec.instructions})` : ''), questions: [] });
      }
      bySec.get(si).questions.push({ no: q.number, text: v2QuestionText(q) });
    });
  });
  return [...pages.entries()].sort((a, b) => a[0] - b[0]).map(([pageNo, bySec]) => ({ pageNo, sections: [...bySec.values()] }));
}

/* PDF link na ho (v2) to worksheet ko printable page ki shakl me naye window me kholte
   hain — wahan se Print / "Save as PDF". Returns false agar popup block ho gaya. */
const escHtml = (s) => String(s ?? '').replace(/[<>&"']/g, (m) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[m]));
export function openWorksheetPrintWindow(ws) {
  const sections = Array.isArray(ws?.sections) ? ws.sections : [];
  if (!sections.length && !(ws?.pageContent || []).length) return false;
  const body = sections.map((sec) => `
    <div class="sec">
      <div class="sec-h">${escHtml([sec.section_label, sec.title].filter(Boolean).join(' — '))}</div>
      ${sec.instructions ? `<div class="sec-i">${escHtml(sec.instructions)}</div>` : ''}
      ${(sec.questions || []).map((q) => `
        <div class="q">
          <div class="q-t"><b>${escHtml(q.number)}.</b> ${escHtml(q.text)}${q.marks != null ? ` <span class="m">[${escHtml(q.marks)}]</span>` : ''}</div>
          ${Array.isArray(q.options) && q.options.length ? `<div class="opts">${q.options.map((o, i) => `<span>(${String.fromCharCode(65 + i)}) ${escHtml(optText(o))}</span>`).join('')}</div>` : ''}
          ${Array.isArray(q.word_bank) && q.word_bank.length ? `<div class="wb">Word bank: ${q.word_bank.map((o) => escHtml(optText(o))).join(', ')}</div>` : ''}
          ${Array.isArray(q.match_pairs) && q.match_pairs.length ? `<div class="wb">${q.match_pairs.map((p) => escHtml(Array.isArray(p) ? p.join(' — ') : `${p?.left ?? p?.a ?? ''} — ${p?.right ?? p?.b ?? ''}`)).join('<br>')}</div>` : ''}
          ${Array.from({ length: Math.min(Math.max(Number(q.answer_lines) || 0, 0), 8) }).map(() => '<div class="ln"></div>').join('')}
        </div>`).join('')}
    </div>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(ws.title || 'Worksheet')}</title>
    <style>
      @page { size: A4; margin: 16mm; }
      body { font-family: Georgia, 'Times New Roman', serif; color:#111; font-size:13px; line-height:1.5; }
      h1 { text-align:center; font-size:20px; margin:0 0 2px; } .sub { text-align:center; color:#555; margin-bottom:10px; }
      .gi { border:1px solid #bbb; border-radius:6px; padding:8px 12px; margin:10px 0 14px; font-size:12px; }
      .sec { margin-bottom:14px; } .sec-h { font-weight:700; font-size:14px; border-bottom:1.5px solid #111; padding-bottom:3px; margin-bottom:4px; }
      .sec-i { font-style:italic; color:#444; margin-bottom:6px; } .q { margin:8px 0; page-break-inside:avoid; }
      .opts { display:flex; flex-wrap:wrap; gap:4px 18px; margin:3px 0 0 18px; } .wb { margin:3px 0 0 18px; color:#444; font-size:12px; }
      .ln { border-bottom:1px solid #777; height:24px; margin-left:18px; } .m { font-weight:700; }
    </style></head><body>
    <h1>${escHtml(ws.title || 'Worksheet')}</h1>
    ${ws.subtitle ? `<div class="sub">${escHtml(ws.subtitle)}</div>` : ''}
    ${ws.general_instructions ? `<div class="gi">${escHtml(ws.general_instructions)}</div>` : ''}
    ${body}
    <script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>
    </body></html>`;
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}

export function normalizeWorksheet(w) {
  let pages = [];
  for (const k of PAGE_KEYS) {
    if (Array.isArray(w?.[k]) && w[k].length && (k !== 'content' || w[k].some(p => p && typeof p === 'object' && Array.isArray(p.sections)))) { pages = w[k]; break; }
  }
  let pdf = null;
  for (const k of PDF_KEYS) {
    if (typeof w?.[k] === 'string' && w[k]) { pdf = w[k]; break; }
  }
  if (!pdf) pdf = deepFindPdf(w);
  if (!pages.length && Array.isArray(w?.sections)) pages = sectionsToPages(w.sections);   // v2 shape
  if (!pdf && !pages.length) console.warn('Worksheet result has no PDF link or pages — raw result:', w);
  return {
    ...w,
    pdfUrl: secureMentorUrl(pdf) || null,
    pageContent: pages,
  };
}

function summarizeWorksheetChanges(before, after) {
  const changes = [];
  const b = before?.pageContent || [];
  const a = after?.pageContent || [];
  if (a.length !== b.length) changes.push(`Pages: ${b.length} → ${a.length}`);
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) changes.push(`Updated page ${i + 1}`);
  }
  if ((after?.pdfUrl || '') !== (before?.pdfUrl || '')) changes.push('Regenerated PDF');
  return changes.length ? changes : ['Worksheet refreshed based on your request.'];
}

/* Polls the generation-status endpoint until the job finishes.
   Progress comes from the server's status (queued → processing →
   completed, plus its own % if it sends one). Abortable. */
export async function waitForWorksheetResult(trackingId, opts = {}) {
  const { signal, onProgress, maxAttempts = 60, delayMs = 3000 } = opts;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await getWorksheetStatus(trackingId, { signal });
    const result = response?.data || response;

    console.log('Worksheet status:', result);

    const status = String(result?.status || '').toLowerCase();

    if (
      status === 'completed' ||
      status === 'complete' ||
      status === 'success' ||
      result?.worksheet ||
      Array.isArray(result?.pageContent)
    ) {
      onProgress?.({ stage: 'formatting' });
      const worksheet =
        result?.worksheet ||
        result?.data?.worksheet ||
        result?.data ||
        result;
      return normalizeWorksheet(worksheet);
    }

    if (status === 'failed' || status === 'error') {
      throw new Error(
        result?.error ||
          result?.message ||
          'Worksheet generation failed on server.'
      );
    }

    onProgress?.(stageFromJobStatus(result));
    await sleep(delayMs, signal);
  }

  const err = new Error('Worksheet generation timed out. Please try again.');
  err.kind = 'timeout';
  throw err;
}

// ===============================
// GET WORKSHEET GENERATION STATUS
// ===============================

export async function getWorksheetStatus(id, opts = {}) {
  try {
    const response = await mentorAiApi.get(
      `/api/worksheet-generation-status/${id}/`,
      { signal: opts.signal }
    );

    return response.data;
  } catch (error) {
    console.error(
      'Worksheet Status Error:',
      error.response?.data || error.message
    );

    throw error;
  }
}

// ===============================
// GET WORKSHEETS LIST
// ===============================

export async function getWorksheets(params = {}) {
  try {
    const response = await mentorAiApi.get(
      '/api/worksheets/',
      {
        params,
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      'Get Worksheets Error:',
      error.response?.data || error.message
    );

    throw error;
  }
}

// ===============================
// GET SINGLE WORKSHEET
// ===============================

export async function getWorksheetById(id) {
  try {
    const response = await mentorAiApi.get(
      `/api/worksheets/${id}/`
    );

    return response.data;
  } catch (error) {
    console.error(
      'Worksheet Detail Error:',
      error.response?.data || error.message
    );

    throw error;
  }
}

// ===============================
// DELETE WORKSHEET
// ===============================

export async function deleteWorksheet(id) {
  try {
    const response = await mentorAiApi.delete(
      `/api/worksheets/${id}/`
    );

    return response.data;
  } catch (error) {
    console.error(
      'Delete Worksheet Error:',
      error.response?.data || error.message
    );

    throw error;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   WORKSHEET V2 — Postman collection "worksheet › v2".

     POST /api/worksheets/v2/generate/              multipart (v1 jaisi fields)
     GET  /api/worksheets/v2/generation-status/:id/
     POST /api/worksheets/v2/:id/edit/              { instruction }  (asli AI edit)

   v1 functions upar jyun ki tyun hain aur fallback ka kaam karti hain:
   v2 route 404 de to wahi request v1 par jati hai. "custom" type me sirf
   grade, subject, instructions, branding aur reference pictures bheji jati hain.
   ═══════════════════════════════════════════════════════════════════ */

const V2_TYPES = ['practice', 'assessment', 'homework', 'enrichment', 'custom'];
const V2_DIFFICULTY = { easy: 'easy', medium: 'medium', hard: 'hard' };
const V2_FORMAT = {
  'text only': 'text_only', text_only: 'text_only',
  'text with pictures': 'text_with_pictures', 'text + pictures': 'text_with_pictures', text_with_pictures: 'text_with_pictures',
};
const V2_COLOUR = {
  colourful: 'colourful', colorful: 'colourful',
  'black & white': 'black_white', 'black and white': 'black_white', black_white: 'black_white',
};
const V2_REF_MODE = { 'take photo': 'take_photo', take_photo: 'take_photo', 'upload image': 'upload_image', upload_image: 'upload_image', skip: 'skip' };
const low = (v) => String(v ?? '').trim().toLowerCase();
const is404 = (e) => e?.response?.status === 404;

function buildWorksheetFormV2(params = {}) {
  const grade = String(params.grade || params.cls || params.gradeLabel || '').trim();
  const subject = String(params.subject || params.subjectLabel || '').trim();
  if (!grade) throw new Error('Please select a grade.');
  if (!subject) throw new Error('Please select a subject.');

  const requested = low(params.worksheetType || params.type);
  const type = V2_TYPES.includes(requested) ? requested : 'practice';
  const refMode = V2_REF_MODE[low(params.referencePictureMode)] || 'skip';

  const fd = new FormData();
  fd.append('grade_label', grade);
  fd.append('subject_label', subject);
  if (type !== 'custom') {
    fd.append('topic', String(params.topic || '').trim());
    fd.append('difficulty', V2_DIFFICULTY[low(params.difficulty)] || 'medium');
    fd.append('worksheet_format', V2_FORMAT[low(params.format || params.worksheetFormat)] || 'text_with_pictures');
    fd.append('colour_style', V2_COLOUR[low(params.colorStyle || params.colourStyle)] || 'colourful');
  }
  fd.append('worksheet_type', type);
  fd.append('include_branch_branding', params.includeBranding === false ? 'False' : 'True');
  fd.append('instructions', String(params.instructions || ''));
  fd.append('reference_picture_mode', refMode);
  if (type !== 'custom') fd.append('number_of_pages', String(params.pages || 2));
  if (refMode !== 'skip' && Array.isArray(params.referenceImages)) {
    params.referenceImages.forEach((file) => { if (file instanceof File) fd.append('reference_images', file, file.name); });
  }
  return fd;
}

/* v2 generate; 404 par v1 generate (same form). Raw response body return hoti hai. */
export async function generateWorksheetV2(params = {}, opts = {}) {
  const fd = buildWorksheetFormV2(params);
  const cfg = {
    timeout: 180000,
    signal: opts.signal,
    ...axiosProgressConfig(opts.onProgress, { waitStage: 'queued', downloadStage: 'queued' }),
  };
  try {
    return (await mentorAiApi.post('/api/worksheets/v2/generate/', fd, cfg)).data;
  } catch (error) {
    if (!is404(error)) throw error;
    return (await mentorAiApi.post('/api/worksheets/generate/', fd, cfg)).data;
  }
}

/* Status: v2 pehle, 404 par v1 (purani tracking ids / fallback generate ke liye). */
export async function getWorksheetStatusV2(id, opts = {}) {
  try {
    return (await mentorAiApi.get(`/api/worksheets/v2/generation-status/${id}/`, { signal: opts.signal })).data;
  } catch (error) {
    if (is404(error)) return getWorksheetStatus(id, opts);
    throw error;
  }
}

export async function waitForWorksheetResultV2(trackingId, opts = {}) {
  const { signal, onProgress, maxAttempts = 60, delayMs = 3000 } = opts;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await getWorksheetStatusV2(trackingId, { signal });
    const result = response?.data || response;
    const status = String(result?.status || '').toLowerCase();

    if (status === 'failed' || status === 'error') {
      throw new Error(result?.error || result?.message || 'Worksheet generation failed on server.');
    }
    if (['completed', 'complete', 'success'].includes(status) || result?.worksheet || Array.isArray(result?.pageContent)) {
      onProgress?.({ stage: 'formatting' });
      console.log('Worksheet v2 status result:', result);
      let ws = normalizeWorksheet(result?.worksheet || result?.data?.worksheet || result?.data || result);
      /* PDF / pages kabhi upar ke level par hote hain (data ke bahar) — poore result se dobara. */
      if (!ws.pdfUrl && !ws.pageContent.length) {
        const whole = normalizeWorksheet(result);
        if (whole.pdfUrl || whole.pageContent.length) ws = { ...ws, pdfUrl: whole.pdfUrl, pageContent: whole.pageContent };
      }
      const wid = ws.id ?? result?.worksheet_id ?? null;
      /* v2 result me PDF link nahi hota — worksheet detail me ho to wahan se le lo (best-effort). */
      if (!ws.pdfUrl && wid != null) {
        try {
          const detail = normalizeWorksheet(await getWorksheetById(wid));
          if (detail.pdfUrl) ws = { ...ws, pdfUrl: detail.pdfUrl };
        } catch { /* detail na mile to sirf on-screen pages */ }
      }
      return wid != null && ws.id == null ? { ...ws, id: wid } : ws;
    }
    onProgress?.(stageFromJobStatus(result));
    await sleep(delayMs, signal);
  }
  const err = new Error('Worksheet generation timed out. Please try again.');
  err.kind = 'timeout';
  throw err;
}

/* Edit via AI (v2): worksheet ki id ho to POST /v2/:id/edit/. Id na ho ya route 404
   de to purana tareeqa: original settings + change ke saath dobara generate.
   Resolves { worksheet, changes } or throws. */
export async function editWorksheetV2(worksheet, instruction, opts = {}) {
  const change = String(instruction || '').trim();
  const id = worksheet?.id ?? worksheet?.worksheet_id ?? null;

  if (id != null) {
    try {
      const res = await mentorAiApi.post(`/api/worksheets/v2/${id}/edit/`, { instruction: change }, { timeout: 180000, signal: opts.signal });
      opts.onProgress?.({ stage: 'generating' });
      const body = res.data;
      const trackingId = body?.tracking_id || body?.data?.tracking_id || body?.generation_id;
      const direct = extractWorksheet(body);
      let updated;
      if (direct) updated = normalizeWorksheet(direct);
      else if (trackingId) updated = await waitForWorksheetResultV2(trackingId, opts);
      else updated = normalizeWorksheet(await getWorksheetById(id));
      if (!updated || (!updated.pdfUrl && !updated.pageContent.length)) {
        throw new Error(body?.error || body?.message || 'Mentor AI returned an incomplete worksheet for this edit. Please try again.');
      }
      const merged = {
        ...worksheet, ...updated,
        id: updated.id ?? id,
        cls: updated.cls || worksheet.cls,
        subject: updated.subject || worksheet.subject,
        _genParams: worksheet._genParams,
      };
      return { worksheet: merged, changes: [`Updated with: “${change}”`, ...summarizeWorksheetChanges(worksheet, merged).filter(c => !/refreshed/.test(c))] };
    } catch (error) {
      if (!is404(error)) throw error;   // 404 → neeche fallback
    }
  }

  const base = worksheet?._genParams;
  if (!base) {
    throw new Error('This worksheet can\'t be edited because its original settings are missing. Please generate it again.');
  }
  const params = { ...base, instructions: [base.instructions, `Changes requested: ${change}`].filter(Boolean).join('\n\n') };
  const response = await generateWorksheetV2(params, {
    signal: opts.signal,
    onProgress: (u) => opts.onProgress?.({ ...u, stage: u.stage === 'queued' ? 'generating' : u.stage }),
  });
  const trackingId = response?.tracking_id || response?.data?.tracking_id;
  const direct = extractWorksheet(response);
  const updated = trackingId && !direct ? await waitForWorksheetResultV2(trackingId, opts) : (direct ? normalizeWorksheet(direct) : null);
  if (!updated || (!updated.pdfUrl && !updated.pageContent.length)) {
    throw new Error(response?.error || response?.message || 'Mentor AI returned an incomplete worksheet for this edit. Please try again.');
  }
  const merged = { ...updated, cls: updated.cls || worksheet.cls, subject: updated.subject || worksheet.subject, _genParams: params };
  return { worksheet: merged, changes: [`Regenerated with: “${change}”`, ...summarizeWorksheetChanges(worksheet, merged).filter(c => !/refreshed/.test(c))] };
}