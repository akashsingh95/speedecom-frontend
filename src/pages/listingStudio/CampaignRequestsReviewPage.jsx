import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, Check, CheckCircle2, Clock, Inbox, X, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { listingStudioApi } from '../../components/listingStudio/api';
import { formatRelativeTime } from '../../components/listingStudio/helpers';
import {
  PAGE_HEAD, PAGE_TITLE, MUTED, CARD, EMPTY_STATE, BTN_PRIMARY, BTN_DANGER, BTN_SMALL,
  BADGE_GOOD, BADGE_BAD, STAT_TILES_GRID, STAT_TILE, STAT_TILE_VALUE, STAT_TILE_LABEL,
  TABLE_WRAP, TABLE, TH, TD,
} from '../../components/listingStudio/ui/classNames';

const tenantLabel = (r) => (r.tenantName ? `${r.tenantName}${r.tenantNumericId != null ? ` (#${r.tenantNumericId})` : ''}` : r.tenantId);

/** SuperAdmin-only review queue for campaignQuotaRequests (see NewCampaignPage/RequestMoreCampaignsPage
 *  on the tenant side). Approving grants the requested slots via campaignQuotaService.resolveRequest;
 *  rejecting just records the decision — the tenant's limit doesn't change either way. */
export default function CampaignRequestsReviewPage() {
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [actingId, setActingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listingStudioApi
      .listCampaignQuotaRequests()
      .then(({ pending: p, history: h }) => {
        if (cancelled) return;
        setPending(p);
        setHistory(h);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const act = async (id, action) => {
    setActingId(id);
    try {
      const fn = action === 'approve' ? listingStudioApi.approveCampaignQuotaRequest : listingStudioApi.rejectCampaignQuotaRequest;
      const { request } = await fn(id);
      setPending((prev) => prev.filter((r) => r.id !== id));
      setHistory((prev) => [request, ...prev]);
      toast.success(action === 'approve' ? 'Request approved' : 'Request rejected');
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
    } finally {
      setActingId(null);
    }
  };

  const approvedCount = history.filter((r) => r.status === 'approved').length;
  const rejectedCount = history.filter((r) => r.status === 'rejected').length;

  return (
    <div>
      <div className={PAGE_HEAD}>
        <div className="flex items-center gap-2">
          <Link
            to="/listing-studio/campaigns"
            aria-label="Back to campaigns"
            className="flex-shrink-0 w-8 h-8 rounded-lg grid place-items-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className={PAGE_TITLE}>Campaign requests</h1>
            <p className={MUTED}>Tenants asking for more campaigns than their limit allows.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <p className={MUTED}>Loading…</p>
      ) : (
        <>
          <div className={STAT_TILES_GRID}>
            <div className={`${STAT_TILE} bg-amber-50`}>
              <strong className={`${STAT_TILE_VALUE} text-amber-600`}>{pending.length}</strong>
              <span className={STAT_TILE_LABEL}>Pending review</span>
            </div>
            <div className={`${STAT_TILE} bg-emerald-50`}>
              <strong className={`${STAT_TILE_VALUE} text-emerald-600`}>{approvedCount}</strong>
              <span className={STAT_TILE_LABEL}>Approved</span>
            </div>
            <div className={`${STAT_TILE} bg-red-50`}>
              <strong className={`${STAT_TILE_VALUE} text-red-600`}>{rejectedCount}</strong>
              <span className={STAT_TILE_LABEL}>Rejected</span>
            </div>
          </div>

          <h2 className="text-sm font-semibold text-slate-900 mb-3 mt-1 flex items-center gap-1.5">
            <Inbox size={15} className="text-slate-400" /> Pending
          </h2>
          {pending.length === 0 ? (
            <div className={EMPTY_STATE}>
              <CheckCircle2 size={28} className="text-emerald-500 mx-auto mb-2" />
              <p>All caught up — no campaign requests waiting on review.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 mb-6">
              {pending.map((r) => (
                <div key={r.id} className={`${CARD} !mb-0 flex items-center gap-3.5 flex-wrap sm:flex-nowrap`}>
                  <span className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 grid place-items-center flex-shrink-0">
                    <Building2 size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 truncate">{tenantLabel(r)}</div>
                    <div className="text-slate-500 text-xs flex items-center gap-1.5 mt-0.5">
                      <span>
                        Wants <strong className="text-slate-700">{r.requestedCount}</strong> more campaign
                        {r.requestedCount === 1 ? '' : 's'}
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} /> {formatRelativeTime(r.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      className={`${BTN_PRIMARY} ${BTN_SMALL}`}
                      disabled={actingId === r.id}
                      onClick={() => act(r.id, 'approve')}
                    >
                      <Check size={13} /> Approve
                    </button>
                    <button
                      type="button"
                      className={`${BTN_DANGER} ${BTN_SMALL}`}
                      disabled={actingId === r.id}
                      onClick={() => act(r.id, 'reject')}
                    >
                      <X size={13} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h2 className="text-sm font-semibold text-slate-900 mb-3">History</h2>
          {history.length === 0 ? (
            <div className={EMPTY_STATE}>
              <p>No requests reviewed yet.</p>
            </div>
          ) : (
            <div className={CARD}>
              <div className={TABLE_WRAP}>
                <table className={TABLE}>
                  <thead>
                    <tr>
                      <th className={TH}>Tenant</th>
                      <th className={TH}>Requested</th>
                      <th className={TH}>Status</th>
                      <th className={TH}>Resolved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((r) => (
                      <tr key={r.id}>
                        <td className={TD}>{tenantLabel(r)}</td>
                        <td className={TD}>
                          {r.requestedCount} campaign{r.requestedCount === 1 ? '' : 's'}
                        </td>
                        <td className={TD}>
                          <span className={`${r.status === 'approved' ? BADGE_GOOD : BADGE_BAD} inline-flex items-center gap-1`}>
                            {r.status === 'approved' ? <CheckCircle2 size={11} /> : <XCircle size={11} />} {r.status}
                          </span>
                        </td>
                        <td className={TD} title={r.resolvedAt ? new Date(r.resolvedAt).toLocaleString() : ''}>
                          {r.resolvedAt ? formatRelativeTime(r.resolvedAt) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
