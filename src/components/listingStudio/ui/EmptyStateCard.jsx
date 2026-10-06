import React from 'react';
import { EMPTY_STATE, CARD_TITLE } from './classNames';

const TONES = {
  amber: { iconBg: 'bg-gradient-to-br from-amber-400 to-amber-500', ring: 'ring-amber-100', pill: 'bg-amber-100 text-amber-700' },
  violet: { iconBg: 'bg-gradient-to-br from-violet-400 to-violet-500', ring: 'ring-violet-100', pill: 'bg-violet-100 text-violet-700' },
  blue: { iconBg: 'bg-gradient-to-br from-brand-400 to-brand-500', ring: 'ring-brand-100', pill: 'bg-brand-100 text-brand-700' },
};

/**
 * Richer empty state for an AI pipeline stage that hasn't been generated yet (Creative
 * Strategy, A+ Content, ...) — a colored icon badge, heading/description, a row of pill
 * "what you'll get" previews, and the actual generate action, so a blank stage reads as an
 * inviting next step instead of looking broken. A plain "nothing found" empty state (no
 * search results, no saved projects) should keep using the bare EMPTY_STATE class instead —
 * this component is specifically for "you haven't run this AI step yet".
 */
export function EmptyStateCard({ tone = 'blue', icon: Icon, title, description, features, action }) {
  const t = TONES[tone] || TONES.blue;
  return (
    <div className={`${EMPTY_STATE} !py-14`}>
      <span className={`inline-grid w-14 h-14 rounded-2xl place-items-center mb-4 text-white shadow-sm ring-8 ${t.ring} ${t.iconBg}`}>
        <Icon size={24} />
      </span>
      <h2 className={`${CARD_TITLE} mb-1.5`}>{title}</h2>
      <p className="text-slate-500 max-w-md mx-auto mb-5">{description}</p>
      {features?.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {features.map(({ icon: FeatureIcon, label }) => (
            <span key={label} className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${t.pill}`}>
              <FeatureIcon size={13} /> {label}
            </span>
          ))}
        </div>
      )}
      {action}
    </div>
  );
}
