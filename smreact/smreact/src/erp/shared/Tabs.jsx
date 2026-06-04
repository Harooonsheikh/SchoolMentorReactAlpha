import React from 'react';

export default function Tabs({
  items = [],
  active,
  onChange,
  style,
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        padding: 4,
        background: 'var(--bg-muted, #F1F5F9)',
        borderRadius: 10,
        ...style,
      }}
    >
      {items.map(it => {
        const isActive = it.key === active;
        return (
          <button
            key={it.key}
            onClick={() => onChange?.(it.key)}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 7,
              border: 'none',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all .2s',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: isActive ? 'var(--bg-card, #fff)' : 'transparent',
              color: isActive ? 'var(--text-primary, #0F172A)' : 'var(--text-muted, #9CA3AF)',
              boxShadow: isActive ? '0 2px 8px rgba(15,23,42,.06)' : 'none',
            }}
          >
            {it.icon && <i className={`fa-solid ${it.icon}`} />}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
