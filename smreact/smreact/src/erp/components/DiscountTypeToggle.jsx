import React from 'react';
import { DISCOUNT_TYPE_AMOUNT, DISCOUNT_TYPE_PERCENTAGE } from '../utils/feeDiscount';

/* Reusable "Discount Type" pill selector — Fixed Amount / Percentage.
   Styling is left to the host: pass in the host's own active/idle
   button class names so the toggle matches each module's existing
   look (Students.jsx's stu-btn-* vs Fee.jsx's fee-btn-*) instead of
   introducing a third, unrelated visual style. */
export default function DiscountTypeToggle({ value, onChange, activeClassName, idleClassName }) {
  const options = [
    { key: DISCOUNT_TYPE_AMOUNT, label: 'Fixed Amount', icon: 'fa-money-bill-wave' },
    { key: DISCOUNT_TYPE_PERCENTAGE, label: 'Percentage', icon: 'fa-percent' },
  ];
  return (
    <div role="radiogroup" aria-label="Discount Type" style={{ display: 'flex', gap: 8 }}>
      {options.map(o => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          className={value === o.key ? activeClassName : idleClassName}
          onClick={() => onChange(o.key)}
          style={{ padding: '6px 14px', fontSize: 12.5 }}
        >
          <i className={`fa-solid ${o.icon}`} style={{ marginRight: 6 }}></i>{o.label}
        </button>
      ))}
    </div>
  );
}
