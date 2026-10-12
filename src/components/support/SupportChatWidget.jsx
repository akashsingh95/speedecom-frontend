/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import { useEffect, useState } from 'react';
import { MessageCircle, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../api';
import { useAuth } from '../../AuthContext';
import useLiveTicket from '../../hooks/useLiveTicket';
import { useSocketEvent } from '../../hooks/useSupportSocket';
import StarRating from '../StarRating';
import ChatThread from './ChatThread';

export const OPEN_SUPPORT_CHAT_EVENT = 'support-chat:open';
export const openSupportChat = () => window.dispatchEvent(new Event(OPEN_SUPPORT_CHAT_EVENT));

const ENDED_STATUSES = ['Resolved', 'Closed'];

const headerStatus = (ticket) => {
  if (!ticket) return 'We usually reply within a few minutes';
  if (ENDED_STATUSES.includes(ticket.status)) return 'Chat ended';
  if (ticket.status === 'Open') return 'Waiting for your account manager…';
  return ticket.assignedRM?.fullName ? `${ticket.assignedRM.fullName} is helping you` : 'Support team is helping you';
};

const RatingPrompt = ({ ticket, onDone }) => {
  const [stars, setStars] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await api.post(`/support/${ticket._id}/rating`, { stars });
      toast.success('Thanks for your feedback');
      onDone();
    } catch {
      // api.js showed the error; keep the prompt so the seller can retry or skip.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 border-t border-slate-200 bg-white text-center space-y-3">
      <p className="text-sm font-semibold text-slate-700">How was this chat?</p>
      <div className="flex justify-center"><StarRating value={stars} onChange={setStars} size={26} /></div>
      <div className="flex gap-2 justify-center">
        <button onClick={onDone} className="px-4 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Skip</button>
        <button
          onClick={submit}
          disabled={!stars || submitting}
          className="px-4 py-1.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 rounded-lg"
        >
          Submit
        </button>
      </div>
    </div>
  );
};

const SupportChatWidget = () => {
  const { user, isImpersonating } = useAuth();
  const isSeller = Boolean(user?.tenantId) && !isImpersonating
    && (user.role === 'Admin' || (user.role === 'User' && user.permissions?.support));

  const [open, setOpen] = useState(false);
  const [checkedActive, setCheckedActive] = useState(false);
  const [ticketId, setTicketId] = useState(null);
  const [seed, setSeed] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [unread, setUnread] = useState(0);
  const { ticket, emitTyping, sendMessage, typingName, reload } = useLiveTicket(ticketId, seed);

  useEffect(() => {
    if (!isSeller) return undefined;
    const handleOpen = () => setOpen(true);
    window.addEventListener(OPEN_SUPPORT_CHAT_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_SUPPORT_CHAT_EVENT, handleOpen);
  }, [isSeller]);

  // Resume the active chat the first time the panel opens.
  useEffect(() => {
    if (!open || checkedActive || !isSeller) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/support/chat/active');
        if (cancelled) return;
        if (res.data.ticket) {
          setSeed(res.data.ticket);
          setTicketId(res.data.ticket._id);
        }
        setCheckedActive(true);
      } catch {
        // api.js showed the error; checkedActive stays false so reopening retries.
      }
    })();
    return () => { cancelled = true; };
  }, [open, checkedActive, isSeller]);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  useSocketEvent('support:message', ({ message }) => {
    if (open || message.senderId?._id === user?._id) return;
    setUnread((n) => n + 1);
  }, isSeller);

  // Picks up a chat started from another tab while this one has no chat loaded.
  useSocketEvent('support:chat:new', ({ ticket: started }) => {
    if (ticketId) return;
    setSeed(null);
    setTicketId(started._id);
  }, isSeller);

  if (!isSeller) return null;

  const ended = ticket && ENDED_STATUSES.includes(ticket.status);

  const handleSend = async (message, clientId, attachments) => {
    if (ticketId) {
      await sendMessage(message, clientId, attachments);
      return;
    }
    const res = await api.post('/support/chat', { message, clientId, attachments });
    setSeed(res.data.ticket);
    setTicketId(res.data.ticket._id);
  };

  const endChat = async () => {
    setConfirmEnd(false);
    try {
      await api.patch(`/support/${ticketId}`, { status: 'Resolved' });
      await reload();
    } catch {
      // api.js showed the error; the chat stays open.
    }
  };

  const resetToNewChat = () => {
    setTicketId(null);
    setSeed(null);
  };

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Support chat"
          className="fixed z-[70] bottom-24 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[380px] h-[min(560px,calc(100vh-8rem))] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        >
          <div className="px-4 py-3 bg-gradient-to-br from-brand-600 to-brand-700 text-white flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-sm">Speed E-Com Support{ticket?.ticketId ? ` · ${ticket.ticketId}` : ''}</p>
              <p className="text-xs text-blue-100 truncate">{headerStatus(ticket)}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {ticket && !ended && (
                confirmEnd ? (
                  <span className="flex items-center gap-1 text-xs">
                    End chat?
                    <button onClick={endChat} className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded font-semibold">Yes</button>
                    <button onClick={() => setConfirmEnd(false)} className="px-2 py-0.5 hover:bg-white/20 rounded">No</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmEnd(true)} className="text-xs px-2 py-1 hover:bg-white/20 rounded font-semibold">End chat</button>
                )
              )}
              <button onClick={() => setOpen(false)} aria-label="Close chat" className="p-1 hover:bg-white/20 rounded">
                <X size={18} />
              </button>
            </div>
          </div>

          {!checkedActive ? (
            <div className="flex-1 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" size={22} /></div>
          ) : (
            <>
              <div className="flex-1 min-h-0">
                <ChatThread
                  ticket={ticket}
                  viewer="seller"
                  typingName={typingName}
                  onSend={handleSend}
                  onTyping={ticketId ? emitTyping : undefined}
                  closedNote={ended ? 'This chat has ended.' : null}
                  placeholder={ticketId ? 'Type a message…' : 'Type your question…'}
                  emptyState={(
                    <div className="text-center text-sm text-slate-500 mt-8 px-6">
                      <p className="font-semibold text-slate-700 mb-1">Hi there! 👋</p>
                      <p>Tell us what you need help with and your account manager will reply here.</p>
                    </div>
                  )}
                />
              </div>
              {ended && (
                ticket.rating?.stars
                  ? (
                    <div className="p-3 border-t border-slate-200 text-center">
                      <button onClick={resetToNewChat} className="px-4 py-1.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg">Start a new chat</button>
                    </div>
                  )
                  : <RatingPrompt ticket={ticket} onDone={resetToNewChat} />
              )}
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close support chat' : 'Open support chat'}
        className="fixed z-[70] bottom-6 right-4 sm:right-6 w-14 h-14 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-xl flex items-center justify-center transition-colors"
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-[11px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </>
  );
};

export default SupportChatWidget;
