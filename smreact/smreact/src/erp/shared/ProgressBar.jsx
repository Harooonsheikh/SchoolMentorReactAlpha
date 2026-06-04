import React from 'react';

export default function ProgressBar({
  value = 0,
  max = 100,
  label,
  color = 'var(--brand-primary, #2563EB)',
  height = 8,
  showValue = false,
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div>
      {(label || showValue) && (
        <div
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 11, fontWeight: 700,
            color: 'var(--text-secondary, #475569)',
            marginBottom: 4,
          }}
        >
          {label && <span>{label}</span>}
          {showValue && <span>{Math.round(pct)}%</span>}
        </div>
      )}
      <div
        style={{
          background: 'var(--bg-muted, #F1F5F9)',
          borderRadius: 999,
          overflow: 'hidden',
          height,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            transition: 'width .3s ease',
          }}
        />
      </div>
    </div>
  );
}
