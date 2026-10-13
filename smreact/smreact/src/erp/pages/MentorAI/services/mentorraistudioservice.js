import mentorAiApi from './mentorAiApi';
import { axiosProgressConfig, sleep, stageFromJobStatus } from './aiProgress';

// ===============================
// PLATFORM ID MAPPING
// Frontend ID → API ID
// ===============================

const PLATFORM_API_MAP = {
  'ig-square':   'instagram_1_1',
  'ig-portrait': 'instagram_4_5',
  'ig-story':    'instagram_story',
  'fb':          'facebook',
  'fb-story':    'facebook_story',
  'linkedin':    'linkedin',
  'x':           'x_twitter',
  'yt-thumb':    'youtube_thumb',
  'yt-post':     'youtube_post',
  'tiktok':      'tiktok_post',
  'whatsapp':    'whatsapp_status',
  'custom':      'custom',
};

// ===============================
// CATEGORY ID MAPPING
// Frontend ID → API ID
// ===============================

const CATEGORY_API_MAP = {
  'admission':  'admission_open',
  'jobad':      'staff_job',
  'event':      'event_news',
  'result':     'result_award',
  'course':     'course_programme',
  'timetable':  'timetable',
  'others':     'other_custom',
};

// ===============================
// GENERATE DESIGN POST
// ===============================

/* generate / status / edit calls accept an optional
   `opts = { signal, onProgress }` (Cancel + real progress). */
export async function generateDesignPost(params = {}, opts = {}) {
  const reqConfig = {
    timeout: 180000,
    signal: opts.signal,
    ...axiosProgressConfig(opts.onProgress, { waitStage: 'queued', downloadStage: 'queued' }),
  };
  try {
    const {
      category,
      categoryName,
      platform,
      platformName,
      prompt,
      branding,
      brandColor,
      customSize,
      refImages,
    } = params;

    const apiPlatform = PLATFORM_API_MAP[platform] || platform || 'instagram_1_1';
    const apiCategory = CATEGORY_API_MAP[category] || category || 'other_custom';

    // Determine photo_usage based on reference images
    let photoUsage = 'none';
    const hasFiles = Array.isArray(refImages) && refImages.length > 0;
    if (hasFiles) {
      photoUsage = 'inside_design';
    }

    // Build JSON payload
    const payload = {
      platform: apiPlatform,
      category: apiCategory,
      prompt: prompt || '',
      photo_usage: photoUsage,
      branding: {
        logo:    branding?.logo    ?? true,
        name:    branding?.name    ?? true,
        contact: branding?.contact ?? true,
        address: branding?.address ?? false,
      },
    };

    // Custom size only when platform is custom
    if (apiPlatform === 'custom' && customSize) {
      payload.custom_size = `${customSize.w || 1080}x${customSize.h || 1080}`;
    }

    // Brand color (only if user selected one)
    if (brandColor) {
      payload.brand_color = brandColor;
    }

    // If reference images exist, use FormData instead of JSON
    if (hasFiles) {
      const formData = new FormData();
      formData.append('platform', payload.platform);
      formData.append('category', payload.category);
      formData.append('prompt', payload.prompt);
      formData.append('photo_usage', payload.photo_usage);
      formData.append('branding', JSON.stringify(payload.branding));

      if (payload.custom_size) {
        formData.append('custom_size', payload.custom_size);
      }
      if (payload.brand_color) {
        formData.append('brand_color', payload.brand_color);
      }

      refImages.forEach((item) => {
        const file =
          item.file || item.fileObject || item.originalFile || item.attachment;
        if (file instanceof File) {
          formData.append('reference_images', file, file.name);
        }
      });

      console.log('========== DESIGN STUDIO REQUEST (FormData) ==========');
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(key, { name: value.name, type: value.type, size: value.size });
        } else {
          console.log(key, value);
        }
      }

      const response = await mentorAiApi.post(
        '/api/design-studio/posts/generate/',
        formData,
        reqConfig
      );

      console.log('========== DESIGN STUDIO RESPONSE ==========', response.data);
      return response.data;
    }

    // JSON payload (no reference images)
    console.log('========== DESIGN STUDIO REQUEST (JSON) ==========', payload);

    const response = await mentorAiApi.post(
      '/api/design-studio/posts/generate/',
      payload,
      reqConfig
    );

    console.log('========== DESIGN STUDIO RESPONSE ==========', response.data);
    return response.data;
  } catch (error) {
    console.error('========== DESIGN STUDIO ERROR ==========');
    console.error('Status:', error.response?.status);
    console.error('Backend error:', error.response?.data);
    console.error('Full error:', error);
    throw error;
  }
}

// ===============================
// POLL GENERATION STATUS
// ===============================

export async function getDesignStatus(id, opts = {}) {
  try {
    const response = await mentorAiApi.get(
      `/api/design-studio/generation-status/${id}/`,
      { signal: opts.signal }
    );
    return response.data;
  } catch (error) {
    console.error('Design Status Error:', error.response?.data || error.message);
    throw error;
  }
}

export async function waitForDesignResult(trackingId, designPostId, opts = {}) {
  const { signal, onProgress } = opts;
  const maxAttempts = 120; // 120 × 3s = 6 minutes max
  const delayMs = 3000;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await getDesignStatus(trackingId, { signal });
    const result = response?.data || response;

    console.log(`Design status poll #${attempt + 1}:`, result);

    const status = String(result?.status || '').toLowerCase();

    // Pick up design_post_id from status response if not already known
    const resolvedPostId = designPostId || result?.design_post_id;

    if (
      status === 'completed' ||
      status === 'complete' ||
      status === 'success'
    ) {
      // Status endpoint only returns tracking info, NOT the image.
      // Fetch the full post detail to get image_url.
      onProgress?.({ stage: 'finalizing' });
      if (resolvedPostId) {
        console.log(`Design completed — fetching detail for post ${resolvedPostId}...`);
        const detail = await getDesignPostById(resolvedPostId, { signal });
        const detailData = detail?.data || detail;
        const normalized = normalizeDesignPost(detailData);
        normalized.designPostId = resolvedPostId;
        return normalized;
      }

      // Fallback: normalize whatever the status response gave us
      const post = result?.post || result?.design_post || result?.data || result;
      const normalized = normalizeDesignPost(post);
      normalized.designPostId = resolvedPostId;
      return normalized;
    }

    if (status === 'failed' || status === 'error') {
      throw new Error(
        result?.error || result?.error_message || result?.message || 'Design generation failed on server.'
      );
    }

    onProgress?.(stageFromJobStatus(result));
    await sleep(delayMs, signal);
  }

  const err = new Error('Design generation timed out. Please try again.');
  err.kind = 'timeout';
  throw err;
}

// ===============================
// EDIT DESIGN POST VIA AI
// ===============================

// postId should be the design_post_id (NOT tracking_id)
export async function editDesignPostViaAI(postId, instruction, opts = {}) {
  try {
    console.log(`========== EDIT DESIGN (post ${postId}) ==========`, { instruction });
    const response = await mentorAiApi.post(
      `/api/design-studio/posts/${postId}/edit/`,
      { instruction },
      { timeout: 180000, signal: opts.signal, ...axiosProgressConfig(opts.onProgress, { waitStage: 'queued', downloadStage: 'queued' }) }
    );

    console.log('========== EDIT DESIGN RESPONSE ==========', response.data);
    return response.data;
  } catch (error) {
    console.error('Edit Design Error:', error.response?.data || error.message);
    throw error;
  }
}

// ===============================
// LIST DESIGN POSTS
// ===============================

export async function getDesignPosts(params = {}) {
  try {
    const response = await mentorAiApi.get('/api/design-studio/', { params });
        return response.data;
  } catch (error) {
    console.error('Get Design Posts Error:', error.response?.data || error.message);
    throw error;
  }
}

// ===============================
// GET SINGLE DESIGN POST
// ===============================

export async function getDesignPostById(id, opts = {}) {
  try {
    const response = await mentorAiApi.get(`/api/design-studio/${id}/`, { signal: opts.signal });
        return response.data;
  } catch (error) {
    console.error('Design Detail Error:', error.response?.data || error.message);
    throw error;
  }
}

// ===============================
// NORMALIZE / ADAPTER
// Maps API response fields to what the
// frontend UI components expect.
// ===============================

export function normalizeDesignPost(apiPost) {
  if (!apiPost) return null;

  return {
    // Core identity
    id:             apiPost.id || apiPost.generation_id || apiPost.generationId || `ds-${Date.now()}`,
    designPostId:   apiPost.design_post_id || apiPost.designPostId || apiPost.id || null,
    trackingId:     apiPost.tracking_id || apiPost.trackingId || null,
    generatedAt:    apiPost.created_at || apiPost.createdAt || apiPost.generatedAt || Date.now(),
    version:        apiPost.version || 1,

    // Image / preview — the critical field
    imageUrl:       apiPost.image_url || apiPost.imageUrl || apiPost.preview_url || apiPost.previewUrl || null,
    pdfUrl:         apiPost.pdf_url || apiPost.pdfUrl || null,

    // Content
    headline:       apiPost.headline || apiPost.title || apiPost.library_title || 'School Announcement',
    subtext:        apiPost.subtext || apiPost.caption || apiPost.description || apiPost.prompt || '',

    // Meta (pass through for display)
    categoryName:   apiPost.category_label || apiPost.category_name || apiPost.categoryName || apiPost.category || '',
    platformName:   apiPost.platform_label || apiPost.platform_name || apiPost.platformName || apiPost.platform || '',
    category:       apiPost.category || '',
    platform:       apiPost.platform || '',
    prompt:         apiPost.prompt || '',

    // Branding info
    branding:       apiPost.branding_options || apiPost.branding || {},
    brandColor:     apiPost.brand_color || apiPost.brandColor || '',

    // Library
    savedToLibrary: apiPost.saved_to_library || false,
    libraryTitle:   apiPost.library_title || '',

    // Generation status
    status:         apiPost.status || 'completed',
    errorMessage:   apiPost.error_message || '',
  };
}