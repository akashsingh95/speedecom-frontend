/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import { useEffect, useState } from 'react';
import { MessageCircle, X, Loader2, UserRound, Headset, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../api';
import { useAuth } from '../../AuthContext';
import useLiveTicket from '../../hooks/useLiveTicket';
import { useSocketEvent } from '../../hooks/useSupportSocket';
import StarRating from '../StarRating';
import { newClientId } from '../../socket';
import ChatThread from './ChatThread';

export const OPEN_SUPPORT_CHAT_EVENT = 'support-chat:open';
export const openSupportChat = () => window.dispatchEvent(new Event(OPEN_SUPPORT_CHAT_EVENT));

const ENDED_STATUSES = ['Resolved', 'Closed'];

// One-tap starters for the empty chat; each is sent as the seller's first message.
const QUICK_QUESTIONS = [
  'How do I upload my marketplace reports?',
  'How do I connect a marketplace account?',
  'Which of my orders have pending payments?',
  "I'd like to talk to a person",
];

// { text, dot } for the header status line.
const headerStatus = (ticket) => {
  if (!ticket) return { text: 'Speedy, our AI assistant, replies instantly', dot: 'bg-brand-500' };
  if (ENDED_STATUSES.includes(ticket.status)) return { text: 'Chat ended', dot: 'bg-slate-400' };
  if (ticket.handledBy === 'bot') return { text: 'Speedy · AI assistant', dot: 'bg-brand-500' };
  const claimedBy = ticket.escalation?.claimedBy;
  if (!claimedBy) return { text: 'Waiting for a support executive…', dot: 'bg-amber-400' };
  return {
    text: ticket.assignedRM?.fullName && ticket.assignedRM._id === claimedBy
      ? `${ticket.assignedRM.fullName} is helping you`
      : 'Support team is helping you',
    dot: 'bg-emerald-500',
  };
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
  const [escalating, setEscalating] = useState(false);
  const [startingQuick, setStartingQuick] = useState(false);
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
  const status = headerStatus(ticket);

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

  const sendQuickQuestion = async (question) => {
    setStartingQuick(true);
    try {
      await handleSend(question, newClientId(), []);
    } catch {
      // api.js showed the error (e.g. the new-chat cooldown); the starters stay available.
    } finally {
      setStartingQuick(false);
    }
  };

  const talkToPerson = async () => {
    setEscalating(true);
    try {
      await api.post(`/support/chat/${ticketId}/escalate`);
      await reload();
    } catch {
      // api.js showed the error (e.g. today's limit reached); the bot keeps answering.
    } finally {
      setEscalating(false);
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
          <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                <Headset size={18} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-slate-800 truncate">Speed E-Com Support</p>
                <p className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                  <span className={`w-1.5 h-1.5 shrink-0 rounded-full ${status.dot}`} />
                  {status.text}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {ticket && !ended && (
                confirmEnd ? (
                  <span className="flex items-center gap-1 text-xs text-slate-600">
                    End chat?
                    <button onClick={endChat} className="px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-md font-semibold">Yes</button>
                    <button onClick={() => setConfirmEnd(false)} className="px-2 py-1 hover:bg-slate-100 rounded-md">No</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmEnd(true)} className="text-xs px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md font-semibold">End chat</button>
                )
              )}
              <button onClick={() => setOpen(false)} aria-label="Close chat" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md">
                <X size={18} />
              </button>
            </div>
          </div>

          {!checkedActive ? (
            <div className="flex-1 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" size={22} /></div>
          ) : (
            <>
              {ticket && !ended && ticket.handledBy === 'bot' && (
                <div className="px-4 py-2 border-b border-slate-100 bg-white flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">Need a person instead?</span>
                  <button
                    onClick={talkToPerson}
                    disabled={escalating}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg text-brand-700 bg-white border border-brand-200 hover:bg-brand-50 disabled:opacity-50"
                  >
                    <UserRound size={13} /> Talk to a person
                  </button>
                </div>
              )}
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
                    <div className="px-2 pt-4">
                      <div className="flex items-start gap-2">
                        <div className="w-7 h-7 shrink-0 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center">
                          <Sparkles size={14} />
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm text-slate-700 leading-relaxed">
                          Hi! I&apos;m Speedy. Ask me how to do something in the app, or about your orders, payments, returns and claims. You can talk to a person anytime.
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col items-end gap-2">
                        {QUICK_QUESTIONS.map((question) => (
                          <button
                            key={question}
                            onClick={() => sendQuickQuestion(question)}
                            disabled={startingQuick}
                            className="px-3 py-1.5 text-sm text-brand-700 bg-white border border-brand-200 hover:bg-brand-50 hover:border-brand-300 rounded-full text-left disabled:opacity-50 transition-colors"
                          >
                            {question}
                          </button>
                        ))}
                      </div>
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
