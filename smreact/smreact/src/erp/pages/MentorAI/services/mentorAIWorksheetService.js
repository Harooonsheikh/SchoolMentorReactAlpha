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
  const hasPages = Array.isArray(w.pageContent) || Array.isArray(w.page_content);
  return (hasPages || w.pdf_url || w.pdfUrl) ? w : null;
}

export function normalizeWorksheet(w) {
  const pages = Array.isArray(w?.pageContent) ? w.pageContent : Array.isArray(w?.page_content) ? w.page_content : [];
  return {
    ...w,
pdfUrl: secureMentorUrl(w?.pdf_url || w?.pdfUrl) || null,
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