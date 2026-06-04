import React from 'react';

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search…',
  width,
  style,
  autoFocus,
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: width || '100%',
        ...style,
      }}
    >
      <i
        className="fa-solid fa-magnifying-glass"
        style={{
          position: 'absolute',
          left: 12, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-muted, #9CA3AF)',
          fontSize: 11,
          pointerEvents: 'none',
        }}
      />
      <input
        type="text"
        value={value}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{
          width: '100%',
          padding: '8px 12px 8px 32px',
          borderRadius: 8,
          border: '1.5px solid var(--border-light, #E5E7EB)',
          background: 'var(--bg-card, #fff)',
          color: 'var(--text-primary, #0F172A)',
          fontSize: 12,
          fontFamily: 'inherit',
          outline: 'none',
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange?.('')}
          aria-label="Clear search"
          style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            width: 20, height: 20, borderRadius: '50%',
            border: 'none',
            background: 'var(--bg-muted, #F1F5F9)',
            color: 'var(--text-muted, #9CA3AF)',
            cursor: 'pointer',
            fontSize: 10,
          }}
        >
          <i className="fa-solid fa-xmark" />
        </button>
      )}
    </div>
  );
}
