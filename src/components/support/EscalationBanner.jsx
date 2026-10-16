/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { PhoneIncoming, X } from 'lucide-react';
import api from '../../api';
import { useAuth } from '../../AuthContext';
import useOffers from '../../hooks/useOffers';
import { isSoundReady, startRinging, stopRinging, subscribeSound } from './offerSound';
import { openSupportDrawer } from './SupportChatDrawer';
import { PRODUCT_BADGE_CLASSES, productLabel } from './products';

const STAFF_ROLES = ['RM', 'SBM', 'SuperAdmin'];
const LEVEL_LABELS = ['Your seller', 'Backup for another RM', 'No RM available', 'No RM or SBM available'];

// One ring of one chat; "Not now" hides this ring only, so a later ring of the same chat still shows.
const offerKey = (offer) => `${offer.ticket._id}:${offer.offeredAt}`;

const showDesktopNotification = (offer) => {
  if (!document.hidden || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const notification = new Notification(`Incoming support chat · ${offer.ticket.ticketId}`, {
    body: `${offer.tenantName || 'A seller'}: ${offer.preview || offer.ticket.title}`,
    tag: offer.ticket._id,
  });
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
};

// Ringing banner for chats offered to this staff user: countdown, Accept, sound, desktop alert.
const EscalationBanner = () => {
  const { user } = useAuth();
  const isStaff = STAFF_ROLES.includes(user?.role)
    && (user.role !== 'SBM' || user.permissions?.viewSupport !== false);

  const { offers, now, remove } = useOffers(isStaff);
  const [dismissed, setDismissed] = useState(() => new Set());
  const [accepting, setAccepting] = useState(null);
  const notifiedRef = useRef(new Set());
  const soundReady = useSyncExternalStore(subscribeSound, isSoundReady);

  const visible = offers.filter((o) => !dismissed.has(offerKey(o)));

  useEffect(() => {
    for (const offer of visible) {
      const key = offerKey(offer);
      if (notifiedRef.current.has(key)) continue;
      notifiedRef.current.add(key);
      showDesktopNotification(offer);
    }
  }, [visible]);

  const ringing = visible.length > 0 && soundReady;
  useEffect(() => {
    if (ringing) startRinging();
    else stopRinging();
    return stopRinging;
  }, [ringing]);

  if (!isStaff || visible.length === 0) return null;

  const accept = async (offer) => {
    const id = offer.ticket._id;
    setAccepting(id);
    try {
      await api.post(`/support/${id}/claim`);
      remove(id);
      openSupportDrawer(id);
    } catch (error) {
      // api.js showed why (someone else accepted, or the ring moved on).
      if (error.response?.status === 409 || error.response?.status === 404) remove(id);
    } finally {
      setAccepting(null);
    }
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] w-[min(440px,calc(100vw-2rem))] space-y-2" role="alert" aria-live="assertive">
      {visible.map((offer) => {
        const secondsLeft = Math.max(0, Math.ceil((new Date(offer.expiresAt).getTime() - now) / 1000));
        return (
          <div key={offer.ticket._id} className="bg-white rounded-2xl shadow-2xl border-2 border-emerald-400 p-4 flex gap-3">
            <div className="w-10 h-10 shrink-0 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center animate-pulse">
              <PhoneIncoming size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-slate-800 truncate">Incoming chat · {offer.ticket.ticketId}</p>
                <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${PRODUCT_BADGE_CLASSES[offer.ticket.product] || PRODUCT_BADGE_CLASSES.reconciliation}`}>
                  {productLabel(offer.ticket.product)}
                </span>
                <span className="ml-auto text-xs font-semibold tabular-nums text-amber-700">{secondsLeft}s</span>
              </div>
              <p className="text-xs text-slate-600 truncate">
                {offer.tenantName}{offer.sellerName ? ` · ${offer.sellerName}` : ''}
                {LEVEL_LABELS[offer.level] ? ` · ${LEVEL_LABELS[offer.level]}` : ''}
              </p>
              {(offer.preview || offer.reason) && (
                <p className="mt-1 text-sm text-slate-700 line-clamp-2">{offer.preview || offer.reason}</p>
              )}
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => accept(offer)}
                  disabled={accepting === offer.ticket._id}
                  className="px-4 py-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-lg"
                >
                  Accept
                </button>
                <button
                  onClick={() => setDismissed((d) => new Set(d).add(offerKey(offer)))}
                  className="px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Not now
                </button>
              </div>
            </div>
            <button
              onClick={() => setDismissed((d) => new Set(d).add(offerKey(offer)))}
              aria-label="Dismiss"
              className="self-start p-1 text-slate-400 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default EscalationBanner;
