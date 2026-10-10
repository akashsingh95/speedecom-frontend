import React from 'react';
import { Check } from 'lucide-react';

// What the server auto-generates once the creative strategy (marketing angles) is ready — see
// server/listingStudio/pipeline/strategy.js maybeAutoGenerate. "Top 3" is simply the first
// three angles in the strategy's own order; there is no ranking.
const OPTIONS = [
  { key: 'aplus', title: 'Premium A+ content' },
  { key: 'premiumAplus', title: 'Seamless Premium A+ content' },
];

/** Two independent checkboxes — either, both, or neither may be ticked. `value` is
 *  `{ aplus: boolean, premiumAplus: boolean }`. */
export function AutoGenerateOptions({ value, onChange }) {
  const toggle = (key) => onChange({ ...value, [key]: !value[key] });

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-24 gap-y-2">
      {OPTIONS.map((opt) => (
        <label key={opt.key} className="flex items-center gap-3 cursor-pointer select-none">
          <input type="checkbox" className="sr-only" checked={value[opt.key]} onChange={() => toggle(opt.key)} />
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
