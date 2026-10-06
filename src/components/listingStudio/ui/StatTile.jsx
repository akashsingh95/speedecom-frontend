import React from 'react';

const TONES = {
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', bar: 'bg-violet-500' },
  blue: { bg: 'bg-brand-50', text: 'text-brand-600', bar: 'bg-brand-500' },
  green: { bg: 'bg-emerald-50', text: 'text-emerald-600', bar: 'bg-emerald-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', bar: 'bg-amber-500' },
  red: { bg: 'bg-red-50', text: 'text-red-600', bar: 'bg-red-500' },
  // Placeholder tone for a stat tile previewing a metric that hasn't been computed yet (e.g.
  // Alexa Readiness's tiles before the first analysis) — deliberately flat/inert so it reads
  // as "not run yet", not as an actual 0% score.
  slate: { bg: 'bg-slate-100', text: 'text-slate-400', bar: 'bg-slate-300' },
};

/** Green/amber/red by value, so a card's color always tells you at a glance whether the
 *  number behind it is good or bad — instead of a fixed hue per metric that doesn't. */
export function toneForValue(value) {
  if (value >= 70) return 'green';
  if (value >= 30) return 'amber';
  return 'red';
}

/** `progress` (0-100) renders the progress-bar variant (used by Alexa Readiness); omit for a plain tile. */
export function StatTile({ tone, value, label, progress }) {
  const t = TONES[tone] || TONES.blue;
  return (
    <div className={`rounded-xl px-4 py-4 flex flex-col gap-1 ${t.bg}`}>
      <span className={`text-[11px] font-semibold uppercase tracking-wide ${t.text}`}>{label}</span>
      <strong className={`text-3xl leading-tight ${t.text}`}>{value}</strong>
      {progress !== undefined && (
        <div className="mt-1 h-1.5 rounded-full bg-black/[0.08] overflow-hidden">
          <div className={`h-full ${t.bar}`} style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}
    </div>
  );
}
