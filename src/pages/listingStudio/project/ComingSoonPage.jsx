import React from 'react';
import { PAGE_CENTER } from '../../../components/listingStudio/ui/classNames';

// Generic placeholder for a nav tab whose feature isn't built yet — driven entirely by props so
// every future "coming soon" tab reuses this instead of getting its own near-identical page file.
export function ComingSoonPage({ icon: Icon, title, description }) {
  return (
    <div className={PAGE_CENTER}>
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center border border-amber-200">
          <Icon size={28} className="text-amber-500" />
        </div>
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-600 text-[11px] font-semibold uppercase tracking-wider border border-amber-200 mb-3">
            Coming Soon
          </span>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
          <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
}
