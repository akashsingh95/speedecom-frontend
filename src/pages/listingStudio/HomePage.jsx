import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkle, Link2, NotebookPen, ArrowRight } from 'lucide-react';
import { useProjects } from '../../components/listingStudio/useProjects';
import { BTN_GHOST, SKELETON_BLOCK, EMPTY_STATE } from '../../components/listingStudio/ui/classNames';

const RECENT_COUNT = 5;

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

function statusOf(p) {
  if (p.aplus) return 'A+ content ready';
  if (p.listing) return 'Listing ready';
  if (p.research) return 'Researched';
  return 'New';
}

export default function HomePage() {
  const projects = useProjects();
  const navigate = useNavigate();

  const recent = (projects ?? [])
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, RECENT_COUNT);

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

        <div className="grid grid-cols-2 gap-4 mt-8 text-left">
          <button
            className="flex flex-col items-start gap-1 p-5 rounded-2xl bg-white border border-slate-200 shadow-card text-left transition-colors hover:border-brand-500 hover:shadow-md"
            onClick={() => navigate('/listing-studio/new')}
          >
            <span className="w-10 h-10 rounded-lg flex items-center justify-center text-brand-600 bg-brand-50">
              <Link2 size={20} />
            </span>
            <span className="font-medium text-base mt-2.5 text-slate-900">Import an existing listing</span>
            <span className="text-sm leading-relaxed text-slate-500">
              Paste an ASIN or product URL — we scrape it and start researching the competition right away.
            </span>
            <span className="flex items-center gap-1.5 mt-2.5 text-brand-600 text-sm font-medium">
              Import a listing <ArrowRight size={14} />
            </span>
          </button>
          <button
            className="flex flex-col items-start gap-1 p-5 rounded-2xl bg-white border border-slate-200 shadow-card text-left transition-colors hover:border-brand-500 hover:shadow-md"
            onClick={() => navigate('/listing-studio/new?mode=manual')}
          >
            <span className="w-10 h-10 rounded-lg flex items-center justify-center text-brand-600 bg-brand-50">
              <NotebookPen size={20} />
            </span>
            <span className="font-medium text-base mt-2.5 text-slate-900">Start from a brief</span>
            <span className="text-sm leading-relaxed text-slate-500">
              No live listing yet? Describe the product and photos, and we build the campaign from scratch.
            </span>
            <span className="flex items-center gap-1.5 mt-2.5 text-brand-600 text-sm font-medium">
              Start manually <ArrowRight size={14} />
            </span>
          </button>
        </div>
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
          <div className="flex flex-col gap-px">
            {recent.map((p) => (
              <Link
                key={p.id}
                to={`/listing-studio/p/${p.id}`}
                className="grid [grid-template-columns:40px_1fr_130px_90px] items-center gap-3.5 px-3.5 py-3 rounded-lg bg-white border border-slate-200 text-slate-900 transition-colors hover:bg-brand-50"
              >
                {p.images[0] ? (
                  <img src={p.images[0]} alt="" className="w-10 h-10 rounded-md object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-md bg-white border border-slate-200" />
                )}
                <span className="flex flex-col gap-0.5 min-w-0">
                  <strong className="text-sm whitespace-nowrap overflow-hidden text-ellipsis">{p.input.name}</strong>
                  <span className="text-slate-500 text-xs">{p.sourceAsin ?? p.input.brand}</span>
                </span>
                <span className="text-slate-500 text-xs">{statusOf(p)}</span>
                <span className="text-slate-500 text-xs text-right">{relativeTime(p.createdAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
