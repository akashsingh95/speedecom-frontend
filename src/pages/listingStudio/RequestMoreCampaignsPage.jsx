import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Lock, Sparkles, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { listingStudioApi } from '../../components/listingStudio/api';
import { Button } from '../../components/listingStudio/ui/Button';
import { PAGE_HEAD, PAGE_TITLE, MUTED, CARD, NOTICE_WARN, FIELD_INPUT } from '../../components/listingStudio/ui/classNames';

const FALLBACK_ALLOWED_COUNTS = [1, 2, 3, 5, 10];

// Same shape as NOTICE_WARN, just a different palette per outcome — the tenant needs to
// immediately tell approved/rejected/pending apart at a glance.
const NOTICE_GOOD = 'flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-3.5 py-2.5 mb-4 text-sm';
const NOTICE_BAD = 'flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3.5 py-2.5 mb-4 text-sm';

function StatusNotice({ request }) {
  const count = request.requestedCount;
  const plural = count === 1 ? '' : 's';
  if (request.status === 'pending') {
    return (
      <div className={NOTICE_WARN}>
        <Clock size={16} className="mt-0.5 flex-shrink-0" />
        <span>
          Your request for <strong>{count}</strong> more campaign{plural} is pending review. You'll be able to create
          new campaigns once it's approved.
        </span>
      </div>
    );
  }
  if (request.status === 'approved') {
    return (
      <div className={NOTICE_GOOD}>
        <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
        <span>
          Your request for <strong>{count}</strong> more campaign{plural} was approved — you can create new campaigns
          now.
        </span>
      </div>
    );
  }
  return (
    <div className={NOTICE_BAD}>
      <XCircle size={16} className="mt-0.5 flex-shrink-0" />
      <span>
        Your request for <strong>{count}</strong> more campaign{plural} was rejected. You can submit a new request
        below.
      </span>
    </div>
  );
}

/** Reached when a tenant hits its campaign limit (see NewCampaignPage's "Request more
 *  campaigns" action) — lets them ask for more slots, and always shows how their most recent
 *  ask was resolved (pending/approved/rejected), not just whether one is currently in flight. */
export default function RequestMoreCampaignsPage() {
  const [loading, setLoading] = useState(true);
  const [latestRequest, setLatestRequest] = useState(null);
  const [allowedCounts, setAllowedCounts] = useState(FALLBACK_ALLOWED_COUNTS);
  const [requestedCount, setRequestedCount] = useState(3);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listingStudioApi
      .getCampaignQuotaRequest()
      .then(({ request, allowedCounts: counts }) => {
        if (cancelled) return;
        setLatestRequest(request || null);
        if (counts?.length) {
          setAllowedCounts(counts);
          setRequestedCount(counts.includes(3) ? 3 : counts[0]);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async () => {
    setSubmitting(true);
    try {
      const { request } = await listingStudioApi.requestMoreCampaigns(requestedCount);
      setLatestRequest(request);
      toast.success('Request submitted');
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
    } finally {
      setSubmitting(false);
    }
  };

  const isPending = latestRequest?.status === 'pending';

  return (
    <div className="max-w-2xl mx-auto">
      <div className={PAGE_HEAD}>
        <div className="flex items-center gap-2">
          <Link
            to="/listing-studio/new"
            aria-label="Back"
            className="flex-shrink-0 w-8 h-8 rounded-lg grid place-items-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 grid place-items-center flex-shrink-0">
            <Lock size={16} />
          </span>
          <h1 className={PAGE_TITLE}>Request more campaigns</h1>
        </div>
      </div>

      <div className={CARD}>
        {loading ? (
          <p className={MUTED}>Loading…</p>
        ) : (
          <>
            {latestRequest && <StatusNotice request={latestRequest} />}

            {!isPending && (
              <>
                <p className="text-slate-900 font-medium mb-1">
                  {latestRequest ? 'Need more?' : "You've reached your campaign limit for this account."}
                </p>
                <p className={`${MUTED} mb-5`}>
                  Request additional slots below — an admin needs to review and approve the request first.
                </p>
                <label htmlFor="rc-count" className="block text-sm font-medium text-slate-900 mb-1">
                  How many more campaigns do you need?
                </label>
                <select
                  id="rc-count"
                  value={requestedCount}
                  onChange={(e) => setRequestedCount(Number(e.target.value))}
                  className={`${FIELD_INPUT} block w-full mb-5`}
                >
                  {allowedCounts.map((n) => (
                    <option key={n} value={n}>
                      {n} campaign{n === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
                <Button variant="primary" className="w-full" onClick={submit} loading={submitting}>
                  <Sparkles size={15} /> {submitting ? 'Submitting…' : 'Submit request'}
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
