/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, CheckCircle2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../api';
import { useAuth } from '../../AuthContext';
import useLiveTicket from '../../hooks/useLiveTicket';
import { useSocketEvent } from '../../hooks/useSupportSocket';
import ChatThread from './ChatThread';

const STAFF_ROLES = ['RM', 'SBM', 'SuperAdmin'];
const SELLER_ROLES = ['User', 'Admin'];
const ENDED_STATUSES = ['Resolved', 'Closed'];
const TOAST_MS = 15000;

const SupportChatDrawer = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isStaff = STAFF_ROLES.includes(user?.role)
    && (user.role !== 'SBM' || user.permissions?.viewSupport !== false);

  const [ticketId, setTicketId] = useState(null);
  const [resolving, setResolving] = useState(false);
  const { ticket, emitTyping, sendMessage, typingName, reload, loadError } = useLiveTicket(ticketId);

  // The support page already shows these tickets live; toasts there would just be noise.
  const onSupportPage = location.pathname === '/admin/support';

  useSocketEvent('support:chat:new', ({ ticket: started }) => {
    if (onSupportPage) return;
    toast(`New support chat · ${started.ticketId}`, {
      description: started.title,
      duration: TOAST_MS,
      action: { label: 'Open', onClick: () => setTicketId(started._id) },
    });
  }, isStaff);

  useSocketEvent('support:message', ({ ticketId: id, message }) => {
    if (onSupportPage || id === ticketId || !SELLER_ROLES.includes(message.senderId?.role)) return;
    toast(`New message from ${message.senderId?.fullName || 'a seller'}`, {
      description: message.message.length > 90 ? `${message.message.slice(0, 89)}…` : message.message,
      duration: TOAST_MS,
      action: { label: 'Open', onClick: () => setTicketId(id) },
    });
  }, isStaff);

  if (!isStaff || !ticketId) return null;

  const ended = ticket && ENDED_STATUSES.includes(ticket.status);

  const resolve = async () => {
    setResolving(true);
    try {
      await api.patch(`/support/${ticketId}`, { status: 'Resolved' });
      await reload();
    } catch {
      // api.js showed the error; the chat stays open.
    } finally {
      setResolving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Support chat"
      className="fixed inset-y-0 right-0 z-[80] w-full sm:w-[420px] bg-white shadow-2xl border-l border-slate-200 flex flex-col"
    >
      <div className="px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-white bg-brand-600 px-2 py-0.5 rounded-md">{ticket?.ticketId || '…'}</span>
            {ticket && (
              <span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${ended ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {ticket.status}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-800 truncate">{ticket?.tenantId?.name || ''}</p>
          <p className="text-xs text-slate-500 truncate">{ticket?.createdBy?.fullName}{ticket?.title ? ` — ${ticket.title}` : ''}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {ticket && !ended && (
            <button
              onClick={resolve}
              disabled={resolving}
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              <CheckCircle2 size={14} /> Resolve
            </button>
          )}
          <button
            onClick={() => { setTicketId(null); navigate('/admin/support'); }}
            aria-label="Open in support portal"
            title="Open in support portal"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            <ExternalLink size={16} />
          </button>
          <button onClick={() => setTicketId(null)} aria-label="Close chat" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {loadError && !ticket ? (
          <div className="p-6 text-sm text-slate-500 text-center">
            This chat couldn&apos;t be loaded.{' '}
            <button onClick={reload} className="font-semibold text-brand-600 hover:underline">Retry</button>
          </div>
        ) : (
          <ChatThread
            ticket={ticket}
            viewer="staff"
            typingName={typingName}
            onSend={sendMessage}
            onTyping={emitTyping}
            closedNote={ended ? `This chat is ${ticket.status.toLowerCase()}.` : null}
            placeholder="Reply to the seller…"
          />
        )}
      </div>
    </div>
  );
};

export default SupportChatDrawer;
