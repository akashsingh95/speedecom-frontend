import React from 'react';
import { FIELD_LABEL, FIELD_INPUT } from './classNames';

const VALID_HEX = /^#[0-9A-Fa-f]{6}$/;
const PARTIAL_HEX = /^#[0-9A-Fa-f]{0,6}$/;

/**
 * Label + native `<input type="color">` swatch + paired hex `<input type="text">`, both wired
 * to the same `value`/`onChange` ('#rrggbb'). No color-picker library exists in this codebase
 * (package.json has only lucide-react) — this is the settled replacement.
 *
 * The native color input always emits a valid lowercase '#rrggbb', so it calls onChange
 * directly; the hex text field is the only place a transiently partial/invalid value can exist
 * while typing, so its guard only blocks obviously-wrong characters (soft — not
 * submit-blocking; BrandkitFormModal owns final validation before save).
 */
export function ColorInput({ label, value, onChange }) {
  return (
    <label className={FIELD_LABEL}>
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={VALID_HEX.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} swatch`}
          className="w-9 h-9 p-0.5 rounded-lg border border-slate-200 bg-white cursor-pointer flex-shrink-0"
        />
        <input
          type="text"
          value={value}
          maxLength={7}
          placeholder="#0284C7"
          onChange={(e) => {
            const next = e.target.value;
            if (PARTIAL_HEX.test(next)) onChange(next);
          }}
          className={`${FIELD_INPUT} flex-1`}
        />
      </div>
    </label>
  );
}
