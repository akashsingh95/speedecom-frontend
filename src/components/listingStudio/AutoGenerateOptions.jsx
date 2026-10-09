/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React from 'react';
import { Check } from 'lucide-react';

// What the server auto-generates once the creative strategy (marketing angles) is ready — see
// server/listingStudio/pipeline/strategy.js maybeAutoGenerate. "Top 3" is simply the first
// three angles in the strategy's own order; there is no ranking.
const OPTIONS = [
  { key: 'aplus', title: 'A+ content' },
  { key: 'premiumAplus', title: 'Premium A+ content' },
];

/** Mutually exclusive — exactly one of the two is always selected, never both and never
 *  neither. `value` is `{ aplus: boolean, premiumAplus: boolean }`; callers must default
 *  one of them to `true`. */
export function AutoGenerateOptions({ value, onChange }) {
  const select = (key) => {
    if (value[key]) return; // already the selection — can't deselect down to "neither"
    onChange(OPTIONS.reduce((acc, opt) => ({ ...acc, [opt.key]: opt.key === key }), {}));
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-24 gap-y-2" role="radiogroup">
      {OPTIONS.map((opt) => (
        <label key={opt.key} className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="radio"
            name="autoGenerateOption"
            className="sr-only"
            checked={value[opt.key]}
            onChange={() => select(opt.key)}
          />
          <span
            className={`w-5 h-5 flex-shrink-0 rounded-md grid place-items-center border-[1.5px] transition-colors ${
              value[opt.key] ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-brand-400'
            }`}
          >
            {value[opt.key] && <Check size={12} strokeWidth={3} />}
          </span>
          <span className="min-w-0 text-base font-medium text-slate-900">{opt.title}</span>
        </label>
      ))}
    </div>
  );
}
