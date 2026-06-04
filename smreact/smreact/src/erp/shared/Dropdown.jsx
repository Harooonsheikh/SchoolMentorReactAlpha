import React from 'react';

export default function Dropdown({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  disabled,
  width,
  style,
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: width || 'auto',
        display: 'inline-block',
        ...style,
      }}
    >
      <select
        value={value ?? ''}
        onChange={e => onChange?.(e.target.value)}
        disabled={disabled}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          width: '100%',
          padding: '8px 32px 8px 12px',
          borderRadius: 8,
          border: '1.5px solid var(--border-light, #E5E7EB)',
          background: 'var(--bg-card, #fff)',
          color: 'var(--text-primary, #0F172A)',
          fontSize: 12,
          fontFamily: 'inherit',
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
        }}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map(opt =>
          typeof opt === 'string'
            ? <option key={opt} value={opt}>{opt}</option>
            : <option key={opt.value} value={opt.value}>{opt.label}</option>
        )}
      </select>
      <i
        className="fa-solid fa-chevron-down"
        style={{
          position: 'absolute',
          right: 10, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-muted, #9CA3AF)',
          fontSize: 10,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
