/* ════════════════════════════════════════════════════════════════════
   Render-time grouping of consecutive attachments.

   Multiple files in "one send" are uploaded as individual messages (no
   backend / DB / SignalR change). For display, consecutive attachment
   messages of the SAME type from the SAME sender are folded into one
   gallery / grouped-card bubble (WhatsApp-style album). Single attachments
   collapse back to their normal single rendering, so nothing visual changes
   for existing single sends.
   ════════════════════════════════════════════════════════════════════ */

function categoryOf(m) {
  if (!m || (m.kind !== 'in' && m.kind !== 'out')) return null;
  if (m.image && m.image.src) return 'image';
  if (m.video && (m.video.src || m.video.name)) return 'video';
  if (m.doc) return 'doc';
  return null; // text, voice, system, etc. are never grouped
}

function itemOf(m, cat) {
  if (cat === 'image') return { src: m.image.src, name: m.image.name };
  if (cat === 'video') return { src: m.video.src, name: m.video.name };
  return { name: m.doc.name, size: m.doc.size, ext: m.doc.ext, url: m.doc.url };
}

function singleFrom(group) {
  const base = { id: group.id, kind: group.kind, sender: group.sender, time: group.time, status: group.status, text: group.text };
  if (group._group === 'image') return { ...base, image: group.items[0] };
  if (group._group === 'video') return { ...base, video: group.items[0] };
  return { ...base, doc: group.items[0] };
}

/** Transform a flat message list into a list that may contain group items. */
export function groupChatItems(messages) {
  const out = [];
  for (const m of messages) {
    const cat = categoryOf(m);
    if (cat) {
      const prev = out[out.length - 1];
      if (prev && prev._group === cat && prev.kind === m.kind && prev.sender === m.sender) {
        prev.items.push(itemOf(m, cat));
        prev.time = m.time;
        prev.status = m.status;
        if (m.text) prev.text = m.text;
        continue;
      }
      out.push({
        id: `grp-${m.id}`,
        _group: cat,
        kind: m.kind,
        sender: m.sender,
        time: m.time,
        status: m.status,
        text: m.text || null,
        items: [itemOf(m, cat)],
      });
      continue;
    }
    out.push(m);
  }
  // Collapse single-item groups → keep existing single rendering untouched.
  return out.map((x) => (x._group && x.items.length === 1 ? singleFrom(x) : x));
}
