import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkle } from 'lucide-react';
import { usePaginatedProjects } from '../../components/listingStudio/useProjects';
import { campaignStatus } from '../../components/listingStudio/helpers';
import NewCampaignPage from './NewCampaignPage';
import { BTN_GHOST, SKELETON_BLOCK, EMPTY_STATE, GRID_CARDS, PROJECT_CARD, THUMB_LG, THUMB_LG_PLACEHOLDER,
} from '../../components/listingStudio/ui/classNames';

const RECENT_COUNT = 12;

function relativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function HomePage() {
  // The list endpoint already sorts newest-first, so page 1 is exactly the recent set.
  const { projects } = usePaginatedProjects({ page: 1, limit: RECENT_COUNT });
  const recent = projects ?? [];

  return (
    <div className="relative pb-10">
      <div className="max-w-[720px] mx-auto pt-8 text-center">
        <span className="inline-flex w-14 h-14 items-center justify-center rounded-2xl text-brand-600 bg-brand-50 shadow-[0_0_40px_rgba(2,132,199,0.14)]">
          <Sparkle size={26} />
        </span>
        <h1 className="mt-5 text-[32px] font-medium tracking-tight text-slate-900">
          Welcome to <span className="text-brand-600">SpeedyListing</span>
        </h1>
        <p className="text-slate-500 max-w-[52ch] mx-auto mt-3">
          Bring in an Amazon listing and we research it, write the copy, and build the A+ modules. Start where it
          suits you.
        </p>
      </div>

      <div className="mt-8">
        <NewCampaignPage />
      </div>

      <div className="max-w-[720px] mx-auto mt-11">
        <div className="flex justify-between items-end mb-3.5">
          <h4 className="text-slate-900 font-medium">Recent campaigns</h4>
          <Link to="/listing-studio/campaigns" className={BTN_GHOST}>
            View all
          </Link>
        </div>

        {projects === null && (
          <div className="flex flex-col gap-px">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`${SKELETON_BLOCK} h-14`} />
            ))}
          </div>
        )}

        {projects?.length === 0 && (
          <div className={EMPTY_STATE}>
            <p>No campaigns yet — start your first one above.</p>
          </div>
        )}

        {recent.length > 0 && (
          <div className={GRID_CARDS}>
            {recent.map((p) => (
              <Link key={p.id} to={`/listing-studio/p/${p.id}`} className={PROJECT_CARD}>
                {p.images[0] ? <img src={p.images[0]} alt="" className={THUMB_LG} /> : <div className={THUMB_LG_PLACEHOLDER} />}
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-slate-900">{p.input.name}</strong>
                  <div className="text-slate-500 text-xs flex items-center gap-1 flex-wrap mt-0.5">
                    <span>{p.sourceAsin ?? p.input.brand}</span>
                    <span>·</span>
                    <span>{relativeTime(p.createdAt)}</span>
                  </div>
                  {campaignStatus(p) && (
                    <div className={`mt-2 text-sm font-medium ${campaignStatus(p).className}`}>{campaignStatus(p).label}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
