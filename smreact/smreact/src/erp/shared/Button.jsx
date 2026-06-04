import React from 'react';
import Tooltip from './Tooltip';

const BASE = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '8px 16px',
  borderRadius: 9999,
  border: '1.5px solid transparent',
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all .2s cubic-bezier(.4,0,.2,1)',
  whiteSpace: 'nowrap',
  lineHeight: 1.2,
};

const VARIANTS = {
  primary: {
    background: 'linear-gradient(135deg,#1E3A8A 0%,#1E40AF 50%,#2563EB 100%)',
    color: '#fff',
    border: 'none',
    boxShadow: '0 2px 10px rgba(37,99,235,.3)',
  },
  secondary: {
    background: 'var(--bg-card, #fff)',
    color: 'var(--text-primary, #0F172A)',
    border: '1.5px solid var(--border-light, #E5E7EB)',
  },
  success: {
    background: 'linear-gradient(135deg,#065f46 0%,#059669 50%,#047857 100%)',
    color: '#fff',
    border: 'none',
    boxShadow: '0 2px 10px rgba(5,150,105,.3)',
  },
  danger: {
    background: 'rgba(220,38,38,.06)',
    color: '#DC2626',
    border: '1.5px solid rgba(220,38,38,.25)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary, #475569)',
    border: '1.5px solid var(--border-light, #E5E7EB)',
  },
  link: {
    background: 'transparent',
    color: 'var(--brand-primary, #2563EB)',
    border: 'none',
    padding: '4px 8px',
  },
};

const SIZES = {
  sm: { padding: '6px 12px', fontSize: 11 },
  md: {},
  lg: { padding: '10px 22px', fontSize: 13 },
};

export default function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  tooltip,
  disabled,
  loading,
  fullWidth,
  style,
  children,
  ...rest
}) {
  const merged = {
    ...BASE,
    ...VARIANTS[variant],
    ...SIZES[size],
    ...(fullWidth ? { width: '100%' } : null),
    ...(disabled || loading ? { opacity: 0.55, cursor: 'not-allowed' } : null),
    ...style,
  };

  const btn = (
    <button {...rest} disabled={disabled || loading} style={merged}>
      {loading
        ? <i className="fa-solid fa-circle-notch fa-spin" />
        : icon && <i className={`fa-solid ${icon}`} />}
      {children && <span>{children}</span>}
      {iconRight && <i className={`fa-solid ${iconRight}`} />}
    </button>
  );

  return tooltip ? <Tooltip text={tooltip}>{btn}</Tooltip> : btn;
}
