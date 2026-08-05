/* ════════════════════════════════════════════════════════════════════
   Reusable chat-media display bits, used by both the school widget and the
   agent console so voice/video render identically. Self-contained inline
   styles → no dependency on either component's CSS classes.
   ════════════════════════════════════════════════════════════════════ */
import React, { useRef, useState } from 'react';

function fmt(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Voice-note player: circular play/pause + progress bar + time. */
export function VoicePlayer({ src, duration = 0, accent = '#128C7E' }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [total, setTotal] = useState(duration || 0);

  const toggle = () => {
    const a = audioRef.current;
    if (!a || !src) return;
    if (playing) { a.pause(); } else { a.play().catch(() => {}); }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 170 }}>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Play'}
        style={{
          width: 30, height: 30, borderRadius: '50%', border: 'none', flexShrink: 0,
          background: accent, color: '#fff', cursor: src ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
        }}
      >
        <i className={`fa-solid ${playing ? 'fa-pause' : 'fa-play'}`} aria-hidden="true" />
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ height: 3, background: 'rgba(100,116,139,.28)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${total ? (cur / total) * 100 : 0}%`, height: '100%', background: accent, borderRadius: 3 }} />
        </div>
        <div style={{ fontSize: 9, color: '#64748B', marginTop: 3 }}>
          {playing || cur ? `${fmt(cur)} / ${fmt(total)}` : fmt(total)}
        </div>
      </div>
      <i className="fa-solid fa-microphone" style={{ color: '#64748B', fontSize: 11 }} aria-hidden="true" />
      {src && (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setCur(0); }}
          onTimeUpdate={(e) => setCur(e.target.currentTime)}
          onLoadedMetadata={(e) => {
            const d = e.target.duration;
            if (Number.isFinite(d) && d > 0) setTotal(d);
          }}
          style={{ display: 'none' }}
        />
      )}
    </div>
  );
}

/** Image gallery grid (1 col for 1, 2 cols for 2/4, 3 cols otherwise).
    Responsive + capped tile height so large batches never overflow a bubble. */
export function ImageGallery({ items }) {
  const n = items.length;
  const cols = n === 1 ? 1 : (n === 2 || n === 4) ? 2 : 3;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 4,
        maxWidth: 260,
        marginBottom: 4,
      }}
    >
      {items.map((it, i) => (
        <a
          key={i}
          href={it.src}
          target="_blank"
          rel="noreferrer"
          style={{ display: 'block', lineHeight: 0 }}
        >
          <img
            src={it.src}
            alt={it.name || ''}
            loading="lazy"
            style={{
              width: '100%',
              aspectRatio: '1 / 1',
              objectFit: 'cover',
              borderRadius: 8,
              display: 'block',
            }}
          />
        </a>
      ))}
    </div>
  );
}

/** Inline video player. Falls back to a card placeholder when no real src. */
export function VideoBubble({ src, name }) {
  if (!src) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, minWidth: 170,
        background: 'rgba(15,23,42,.04)', border: '1.5px solid rgba(100,116,139,.25)',
        borderRadius: 10, padding: '9px 11px',
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8, flexShrink: 0, color: '#fff',
          background: 'linear-gradient(135deg,#7C3AED,#A855F7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
        }}>
          <i className="fa-solid fa-play" aria-hidden="true" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || 'Video'}</div>
          <div style={{ fontSize: 10, color: '#64748B' }}>Video</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ maxWidth: 260 }}>
      <video
        src={src}
        controls
        preload="metadata"
        style={{ width: '100%', maxHeight: 260, borderRadius: 10, display: 'block', background: '#000' }}
      />
      {name && <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 4 }}>{name}</div>}
    </div>
  );
}
