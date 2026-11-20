import mentorAiApi from "./mentorAiApi";


/* createChatSession(title, mode?)
   mode = { slug?, serverId? } of a mode picked from GET /chat/modes/.
   Without it (or with no serverId) the request is exactly what it always was:
   { title, mode: 'universal' }. With a server mode we ALSO send mode_type_id. */
export async function createChatSession(title, mode) {
    /* Universal = koi mode_type nahi (server par Universal chats ka mode_type null hota hai).
       Koi aur server mode ho to sirf mode_type_id bhejte hain (collection jaisa) — `mode: <slug>`
       nahi, kyunke server us naam ko pehchanta nahi. */
    const isServerMode = mode?.serverId != null && mode.serverId !== '' && mode.slug !== 'universal';
    const body = isServerMode ? { title, mode_type_id: mode.serverId } : { title, mode: CHAT_MODE };

    const res = await mentorAiApi.post(
        "/ai/api/chat/sessions/",
        body
    );

    return res.data;
}


export async function getChatSessions(userId) {
    const res = await mentorAiApi.get(
        "/ai/api/chat/sessions/",
        {
            params: userId ? { user: userId } : {}
        }
    );

    return res.data;
}

export async function updateChatSession(id, data){

    const res = await mentorAiApi.patch(
        `/ai/api/chat/sessions/${id}/`,
        data
    );

    return res.data;
}

/* Rename a chat — PATCH /ai/api/chat/sessions/:id/ { title } */
export async function renameChatSession(id, title) {
    return updateChatSession(id, { title });
}

/* Clear all messages of a chat but keep the session —
   POST /ai/api/chat/sessions/:id/clear/ */
export async function clearChatSession(id) {
    const res = await mentorAiApi.post(
        `/ai/api/chat/sessions/${id}/clear/`
    );

    return res.data;
}

/* Available chat modes — GET /ai/api/chat/modes/ (raw server body). */
export async function getChatModes() {
    const res = await mentorAiApi.get(
        "/ai/api/chat/modes/"
    );

    return res.data;
}

/* Server body → [{ serverId, slug, name, description, category, color? }].
   Accepts an array or { results | data | modes }, with flexible key names.
   Returns [] when nothing usable (the UI then keeps its local mode list). */
export function normalizeChatModes(body) {
    /* Array seedha, ya kisi bhi key me (results / data / modes / mode_types / …); aakhir me
       object ki pehli array-of-objects wali value. */
    let raw = Array.isArray(body) ? body
        : (body?.results || body?.data || body?.modes || body?.mode_types || body?.modeTypes || null);
    if (raw && !Array.isArray(raw) && typeof raw === 'object') raw = raw.results || raw.modes || raw.mode_types || null;
    if (!Array.isArray(raw) && body && typeof body === 'object') {
        raw = Object.values(body).find(v => Array.isArray(v) && v.length && typeof v[0] === 'object') || [];
    }
    if (!Array.isArray(raw)) return [];
    const pick = (o, ...keys) => {
        for (const k of keys) { if (o?.[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]; }
        return undefined;
    };
    return raw.map((m) => {
        if (typeof m === 'string') return { serverId: undefined, slug: m.toLowerCase(), name: m, description: '', category: '' };
        const name = pick(m, 'display_name', 'name', 'title', 'label');
        if (!name) return null;
        return {
            serverId: pick(m, 'id', 'mode_type_id', 'pk'),
            sortOrder: Number(pick(m, 'sort_order', 'order', 'position')) || 0,
            slug: String(pick(m, 'slug', 'key', 'code', 'name') || name).toLowerCase().replace(/\s+/g, '_'),
            name: String(name),
            description: String(pick(m, 'description', 'desc', 'details') || ''),
            category: String(pick(m, 'category', 'group', 'type') || ''),
            color: pick(m, 'color'),
        };
    }).filter(Boolean);
}

export async function getChatSession(id) {
    const res = await mentorAiApi.get(
        `/ai/api/chat/sessions/${id}/`
    );

    return res.data;
}


/* Mentor AI Chat is locked to the Universal mode. Every message sends
   `mode: "universal"` explicitly; the backend must also force it (see
   the handover notes) so a direct API call can't select another mode. */
export const CHAT_MODE = 'universal';

/* sendMessage(id, content, files, opts)
   opts.signal      AbortSignal — Cancel button
   opts.onProgress  ({ stage, fraction, detail }) — real progress:
                    upload bytes → "Sending", request sent → "Analyzing",
                    first response bytes → "Generating", parse → "Formatting"
   opts.onDelta     (fullTextSoFar) — called while the reply streams in,
                    when the server answers with text/event-stream.
   Works unchanged against the current JSON endpoint; if the backend
   starts streaming SSE on the same URL, the UI streams automatically. */
export async function sendMessage(id, content, files = [], opts = {}) {
    const { signal, onProgress, onDelta, timeout = 120000 } = opts;

    const formData = new FormData();

    formData.append("content", content);
    /* opts.mode === false → mode field bhejna hi nahi (chat ka apna mode_type server par hai —
       "mode: universal" bhejne se wo override ho jata). */
    if (opts.mode !== false) formData.append("mode", opts.mode || CHAT_MODE);

    files.forEach(file => {
        formData.append("files", file);
    });

    let streamed = '';
    let consumed = 0;
    let sseCarry = '';
    let isSse = false;
    let uploadDone = false;

    const res = await mentorAiApi.post(
        `/ai/api/chat/sessions/${id}/messages/`,
        formData,
        {
            signal,
            timeout,
            responseType: 'text',
            transformResponse: [d => d],
            // Accept JSON as a fallback so a server without SSE support
            // still content-negotiates normally (no 406).
            headers: { Accept: 'text/event-stream, application/json' },
            onUploadProgress: (e) => {
                if (signal?.aborted) return;
                const total = e?.total;
                if (total) onProgress?.({ stage: 'sending', fraction: (e.loaded || 0) / total });
                if (!uploadDone && (!total || e.loaded >= total)) {
                    uploadDone = true;
                    onProgress?.({ stage: 'analyzing' });
                }
            },
            onDownloadProgress: (e) => {
                if (signal?.aborted) return; // nothing may update a cancelled reply
                const xhr = e?.event?.target || e?.target;
                const ctype = String(xhr?.getResponseHeader?.('content-type') || '');
                const text = typeof xhr?.responseText === 'string' ? xhr.responseText : '';
                isSse = isSse || ctype.includes('text/event-stream');
                if (isSse && text.length > consumed) {
                    const { events, rest } = parseSse(sseCarry + text.slice(consumed));
                    consumed = text.length;
                    sseCarry = rest;
                    events.forEach(ev => {
                        const upd = applySseEvent(ev, streamed);
                        if (upd.stage) onProgress?.({ stage: upd.stage, fraction: upd.fraction, detail: upd.detail });
                        if (upd.text !== streamed) {
                            streamed = upd.text;
                            onProgress?.({ stage: 'generating' });
                            onDelta?.(streamed);
                        }
                    });
                } else {
                    onProgress?.({ stage: 'generating', fraction: e?.total ? (e.loaded || 0) / e.total : undefined });
                }
            },
        }
    );

    onProgress?.({ stage: 'formatting' });
    const ctype = String(res.headers?.['content-type'] || '');
    if (isSse || ctype.includes('text/event-stream')) {
        const { events } = parseSse(`${String(res.data || '')}\n\n`);
        let text = '';
        let meta = {};
        events.forEach(ev => {
            const upd = applySseEvent(ev, text);
            text = upd.text;
            if (upd.meta) meta = { ...meta, ...upd.meta };
        });
        return { ...meta, message: { ...(meta.message || {}), role: 'assistant', content: meta.message?.content || text } };
    }
    return typeof res.data === 'string' && res.data ? JSON.parse(res.data) : res.data;
}

/* ─── SSE helpers (exported for tests) ─── */
export function parseSse(chunk) {
    const parts = chunk.replace(/\r\n?/g, '\n').split('\n\n');
    const rest = parts.pop();
    const events = parts.map(block => {
        let event = 'message';
        const data = [];
        block.split('\n').forEach(line => {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
        });
        return { event, data: data.join('\n') };
    }).filter(e => e.data !== '');
    return { events, rest };
}

/* Understands the common streaming shapes: {delta}, {content},
   {text}, OpenAI {choices:[{delta:{content}}]}, Anthropic
   {delta:{text}}, a stage event {stage, progress}, and a final
   {message, session_id} / [DONE]. */
export function applySseEvent(ev, current) {
    if (ev.data === '[DONE]') return { text: current };
    let d;
    try { d = JSON.parse(ev.data); } catch { return { text: current + ev.data }; }
    if (ev.event === 'stage' || (d && d.stage && d.delta === undefined && d.content === undefined)) {
        const p = d.progress ?? d.percent;
        return { text: current, stage: d.stage, fraction: typeof p === 'number' ? (p > 1 ? p / 100 : p) : undefined, detail: d.label || '' };
    }
    if (d && (d.message || d.session_id) && d.delta === undefined) {
        return { text: d.message?.content || current, meta: d };
    }
    const piece = typeof d === 'string' ? d
        : d?.choices?.[0]?.delta?.content ?? d?.delta?.text ?? (typeof d?.delta === 'string' ? d.delta : undefined)
        ?? d?.content ?? d?.text ?? '';
    return { text: current + (piece || '') };
}


export async function deleteChatSession(id) {

    return mentorAiApi.delete(
        `/ai/api/chat/sessions/${id}/`
    );
}