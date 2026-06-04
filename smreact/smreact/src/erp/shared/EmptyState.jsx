import React from 'react';

export default function EmptyState({
  icon = 'fa-folder-open',
  title = 'Nothing here yet',
  message,
  action,
  style,
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '36px 24px',
        ...style,
      }}
    >
      <div
        style={{
          width: 60, height: 60, borderRadius: '50%',
          background: 'var(--bg-muted, #F1F5F9)',
          color: 'var(--text-muted, #9CA3AF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, marginBottom: 14,
        }}
      >
        <i className={`fa-solid ${icon}`} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary, #0F172A)', marginBottom: 6 }}>
        {title}
      </div>
      {message && (
        <div style={{ fontSize: 12, color: 'var(--text-muted, #9CA3AF)', maxWidth: 360, lineHeight: 1.5 }}>
          {message}
        </div>
      )}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}
