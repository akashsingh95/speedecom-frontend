import React, { useEffect, useRef, useState } from 'react';
import { Link2, Copy, Check, Clock, Eye, Globe, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { listingStudioApi } from './api';

// Matches <Router basename="/client"> in App.jsx — the public page lives at /client/preview/:token.
const publicUrl = (token) => `${window.location.origin}/client/preview/${token}`;

// "23h 40m left" / "12m left" — computed on render, and the popover re-mounts its contents on open.
function timeLeft(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 'expired';
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h}h ${mins % 60}m left` : `${Math.max(mins, 1)}m left`;
}

const PILL = 'px-3 py-2 rounded-full bg-white shadow-lg text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 inline-flex items-center gap-1.5 disabled:opacity-50';

/** "Share" button for the Amazon Preview — opens a small popover to create, copy or stop a public
 *  view-only link. The link is live (shows the project's latest edits) and expires 24 hours after
 *  it is created; "Stop sharing" kills it earlier, so it stays one click away while a link exists. */
export function SharePreviewButton({ projectId }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    setCopied(false);
    listingStudioApi
      .getShare(projectId)
      .then((r) => {
        if (!cancelled) {
          setToken(r.token);
          setExpiresAt(r.expiresAt);
        }
      })
      .catch(() => {
        // The shared axios instance's response interceptor already shows a toast for this.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => {
      cancelled = true;
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, projectId]);

  const create = async () => {
    setBusy(true);
    try {
      const r = await listingStudioApi.createShare(projectId);
      setToken(r.token);
      setExpiresAt(r.expiresAt);
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      await listingStudioApi.revokeShare(projectId);
      setToken(null);
      setExpiresAt(null);
      toast.success('Sharing stopped — the old link no longer works');
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
    } finally {
      setBusy(false);
    }
  };

  // navigator.clipboard only exists on secure origins (https / localhost); on plain http it is
  // undefined, so fall back to a temporary textarea + execCommand.
  const copyViaTextarea = (text) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      return document.execCommand('copy');
    } finally {
      document.body.removeChild(ta);
    }
  };

  const markCopied = () => {
    setCopied(true);
    toast.success('Link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const copy = async () => {
    const url = publicUrl(token);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else if (!copyViaTextarea(url)) {
        throw new Error('copy command failed');
      }
      markCopied();
    } catch {
      try {
        if (copyViaTextarea(url)) {
          markCopied();
          return;
        }
      } catch {
        // fall through to the manual-copy message
      }
      toast.error('Could not copy — select the link and copy it manually');
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button type="button" className={PILL} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Link2 size={15} />
        Share
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 p-5 text-sm text-slate-700 z-50">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              Checking share status…
            </div>
          ) : token ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Globe size={18} />
                </span>
                <div>
                  <p className="font-semibold text-slate-900 leading-tight">Link is live</p>
                  <p className="text-xs text-slate-500">Anyone with this link can view</p>
                </div>
              </div>
              <div className="flex gap-2 mb-3">
                <input
                  readOnly
                  value={publicUrl(token)}
                  onFocus={(e) => e.target.select()}
                  aria-label="Public preview link"
                  className="flex-1 min-w-0 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                />
                <button
                  type="button"
                  onClick={() => void copy()}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    copied ? 'bg-emerald-600 text-white' : 'bg-brand-600 text-white hover:bg-brand-700'
                  }`}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mb-4 text-[11px] font-medium">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                  <Eye size={12} /> View only
                </span>
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-700"
                  title={expiresAt ? `Expires ${new Date(expiresAt).toLocaleString()}` : undefined}
                >
                  <Clock size={12} /> {expiresAt ? timeLeft(expiresAt) : 'Expires in 24h'}
                </span>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void stop()}
                className="w-full rounded-lg border border-red-200 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {busy ? 'Stopping…' : 'Stop sharing'}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                  <Link2 size={18} />
                </span>
                <p className="font-semibold text-slate-900">Share this preview</p>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Create a public, view-only link. Anyone who has it can see this preview without logging in. The link expires after 24 hours.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void create()}
                className="w-full rounded-lg bg-brand-600 text-white py-2.5 text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
              >
                {busy ? 'Creating…' : 'Create public link'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
