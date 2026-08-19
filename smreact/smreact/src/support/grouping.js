/* ════════════════════════════════════════════════════════════════════
   Render-time grouping of consecutive attachments.

   Multiple files in "one send" are uploaded as individual messages (no
   backend / DB / SignalR change). For display, consecutive attachment
   messages of the SAME type from the SAME sender AND from the same send
   (see GROUP_WINDOW_MS) are folded into one gallery / grouped-card bubble
   (WhatsApp-style album). Single attachments collapse back to their normal
   single rendering, so nothing visual changes for existing single sends.
   ════════════════════════════════════════════════════════════════════ */
import { serverDate } from './time';

/* Ek hi "send" ki saari files chand second ke andar bhej di jati hain. Pehle
   yahan sirf "consecutive + same sender" dekha jata tha, is liye 2:30 par
   bheji hui do tasveerein aur 4:30 par bheji hui nayi tasveer ek hi album ban
   jati thin (agar beech me koi aur message na ho).

   Ab pehla faisla `_batch` karta hai (dekho sameBurst). Ye window sirf un
   messages ke liye bachi hai jin par nishan hai hi nahi — purani guftagu jo
   server se dobara padhi gayi, ya doosri taraf se aaye messages. Chhoti
   rakhi gayi hai taake do alag sends jald alag ho jayein. */
const GROUP_WINDOW_MS = 45 * 1000;

/* Message ka asal waqt: live message apna DTO (raw) saath rakhta hai, locally
   bana bubble sirf dikhne wala waqt ("9:09 AM"). Server ka timestamp
   12-ghante ki clock me aata hai, is liye serverDate se guzarta hai —
   tafseel support/time.js me. */
function stampOf(m) {
  const d = serverDate(m && m.raw && m.raw.createdAt);
  return d ? d.getTime() : null;
}

/* Kya `m` usi send ka hissa hai jo `prev` group me chal raha hai?

   Sab se pukhta nishan `_batch` hai: bhejne wali screen har "send" ko apna
   nishan de deti hai (SupportWidget / AgentSupport → useSupportChat.
   sendAttachment ka `batchId`), is liye do alag sends chahe ek hi minute me
   hon, kabhi ek album nahi bante. Purani guftagu (page refresh ke baad, ya
   doosri taraf se aaye messages) par ye nishan nahi hota — wahan waqt ka
   faasla dekhna parta hai. */
function sameBurst(prev, m) {
  const pb = prev._batch || null;
  const mb = m._batch || null;
  /* Dono me se kisi ek par bhi nishan ho to faisla usi par — aadha nishan
     wala jora (ek batch wala, doosra bina) alag alag sends hi hote hain. */
  if (pb || mb) return pb !== null && pb === mb;

  /* Ek send ki har file apne saath usi send ka caption le kar jati hai, is
     liye alag caption ka matlab alag send hai. */
  if (prev.text && m.text && prev.text !== m.text) return false;

  const a = prev._stamp;
  const b = stampOf(m);
  if (a != null && b != null) return Math.abs(b - a) <= GROUP_WINDOW_MS;
  /* Stamp na ho to dikhaya jane wala minute hi faisla. */
  return Boolean(prev.time) && prev.time === m.time;
}

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
      if (prev && prev._group === cat && prev.kind === m.kind && prev.sender === m.sender
          && sameBurst(prev, m)) {
        prev.items.push(itemOf(m, cat));
        prev.time = m.time;
        const st = stampOf(m);
        if (st != null) prev._stamp = st;
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
        _stamp: stampOf(m),
        _batch: m._batch || null,
        items: [itemOf(m, cat)],
      });
      continue;
    }
    out.push(m);
  }
  // Collapse single-item groups → keep existing single rendering untouched.
  return out.map((x) => (x._group && x.items.length === 1 ? singleFrom(x) : x));
}
