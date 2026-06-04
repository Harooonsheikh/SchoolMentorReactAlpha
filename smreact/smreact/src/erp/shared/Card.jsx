import React from 'react';

export default function Card({
  title,
  subtitle,
  icon,
  actions,
  padding = 16,
  bodyStyle,
  style,
  children,
}) {
  return (
    <div
      style={{
        background: 'var(--bg-card, #fff)',
        border: '1px solid var(--border-light, #E5E7EB)',
        borderRadius: 'var(--radius-lg, 14px)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {(title || actions) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-light, #E5E7EB)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {icon && (
              <div
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(37,99,235,.08)',
                  color: 'var(--brand-primary, #2563EB)',
                  fontSize: 13,
                }}
              >
                <i className={`fa-solid ${icon}`} />
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              {title && (
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: 'var(--text-primary, #0F172A)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {title}
                </div>
              )}
              {subtitle && (
                <div style={{ fontSize: 11.5, color: 'var(--text-muted, #9CA3AF)', marginTop: 1 }}>
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
        </div>
      )}
      <div style={{ padding, ...bodyStyle }}>{children}</div>
    </div>
  );
}
