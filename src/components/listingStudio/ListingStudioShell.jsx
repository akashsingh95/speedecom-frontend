import React, { useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import DashboardLayout from '../DashboardLayout';
import { markCampaignStarted } from './lastCampaign';

/**
 * Persistent app-wide shell for Speedy Listing's top-level pages. Ported from
 * speed-listing's AppShell.tsx — but only its `isEmbedded` branch, unconditionally: this
 * always runs inside speedecom now (never standalone), so the standalone full-sidebar
 * branch (and the mobile Drawer it needed) is dead code, deleted rather than ported.
 *
 * Shows the "SpeedyListing" brand bar on top-level pages only (Home, Campaigns, New
 * Campaign, ...) — not on campaign-scoped pages (/p/:id/*), which have their own sticky
 * header (ProjectLayout's TopNav, with a back arrow + campaign name) that already covers
 * identity/navigation there. Both used to render together on those pages; since both are
 * `sticky top-0` inside the same scroll container, they fought for the same position on
 * scroll instead of stacking, leaving the brand bar half-hidden behind TopNav.
 */
function BrandBar() {
  return (
    <div className="flex items-center gap-2 bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 px-4 py-2.5 sticky top-0 z-40 shadow-[0_2px_12px_-2px_rgba(2,132,199,0.4)]">
      <Link to="/listing-studio" state={{ home: true }} className="flex items-center gap-2 font-heading font-semibold text-[17px] text-white">
        <span className="bg-gradient-to-br from-white/25 to-white/10 backdrop-blur-sm w-[30px] h-[30px] rounded-lg grid place-items-center flex-shrink-0 ring-1 ring-white/30 shadow-inner">
          <Sparkles size={16} className="text-white" strokeWidth={2.25} />
        </span>
        <span>
          Speedy<em className="text-brand-100 not-italic">Listing</em>
        </span>
      </Link>
    </div>
  );
}

export default function ListingStudioShell() {
  const location = useLocation();
  const isHome = location.pathname === '/listing-studio' || location.pathname === '/listing-studio/';
  const isProjectRoute = location.pathname.startsWith('/listing-studio/p/');

  // Opening any campaign means the user has started one this session.
  useEffect(() => {
    if (isProjectRoute) markCampaignStarted();
  }, [isProjectRoute]);

  return (
    <DashboardLayout>
      <div className="flex flex-col min-h-full overflow-y-auto">
        {isHome || isProjectRoute ? null : <BrandBar />}
        <main className={`flex-1 min-w-0 ${isProjectRoute ? "" : "p-6"}`}>
          <Outlet />
        </main>
      </div>
    </DashboardLayout>
  );
}
