import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { AmazonPreviewPanel } from '../../components/listingStudio/AmazonPreviewPanel';

const API_URL = import.meta.env.VITE_API_URL || '/api';

/** Public, view-only Amazon Preview reached through a share link (/preview/:token). Deliberately
 *  uses a bare axios call, not the shared `api` instance: that one attaches the viewer's Bearer
 *  token/tenantId and, on a 401, wipes localStorage and bounces to /login — none of which
 *  belongs on a page whose whole point is that the viewer isn't logged in. */
export default function PublicPreviewPage() {
  const { token } = useParams();
  const [project, setProject] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Keep shared links out of search engines (the server also sends X-Robots-Tag).
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API_URL}/listing-studio/public/preview/${encodeURIComponent(token)}`)
      .then((r) => {
        if (!cancelled) setProject(r.data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.status === 429
          ? 'Too many requests — please wait a minute and reload.'
          : 'This preview link is not available. It may have been turned off.');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) {
    return <div className="min-h-screen grid place-items-center bg-white px-4 text-center text-slate-600">{error}</div>;
  }
  if (!project) {
    return <div className="min-h-screen grid place-items-center bg-white text-slate-500">Loading preview…</div>;
  }

  return (
    <AmazonPreviewPanel
      project={project}
      draft={project.listing}
      readOnly
      premiumDesignsOverride={project.premiumDesigns ?? []}
    />
  );
}
