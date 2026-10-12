/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import { useEffect, useRef, useState } from 'react';
import { Send, Image as ImageIcon, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../api';
import { newClientId } from '../../socket';

const SELLER_ROLES = ['User', 'Admin'];
const TYPING_IDLE_MS = 3000;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 10;

// Signed-URL upload, same flow the old ticket form used. Returns the storage path.
const uploadScreenshot = async (file) => {
  const res = await api.post('/support/upload-url', { fileName: file.name, contentType: file.type });
  const { uploadUrl, fileUrl } = res.data;
  const put = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  return fileUrl;
};

const fileKey = (f) => `${f.name}:${f.size}:${f.lastModified}`;

const formatTime = (date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Legacy tickets open with a form description; for chats the description is the first message.
const threadItems = (ticket) => {
  if (!ticket) return [];
  const items = [];
  if (ticket.channel !== 'chat' && ticket.description) {
    items.push({
      _id: 'description',
      isSeller: true,
      senderName: ticket.createdBy?.fullName || 'Seller',
      message: ticket.description,
      attachments: ticket.screenshots || [],
      createdAt: ticket.createdAt,
    });
  }
  for (const m of ticket.messages || []) {
    const isSeller = SELLER_ROLES.includes(m.senderId?.role);
    items.push({
      _id: m._id,
      isSeller,
      senderName: m.senderId?.fullName || (isSeller ? 'Seller' : 'Support Team'),
      message: m.message,
      attachments: m.attachments || [],
      createdAt: m.createdAt,
    });
  }
  return items;
};

/**
 * Message list + composer shared by the seller widget and the staff drawer.
 * viewer: 'seller' | 'staff' — decides which side is "mine".
 * onSend(text, clientId, attachments) must reject on failure; the text, uploaded paths and
 * clientId are kept so a retry re-sends with the same clientId and is stored only once.
 */
const ChatThread = ({ ticket, viewer, typingName, onSend, onTyping, closedNote, placeholder = 'Type a message…', emptyState = null }) => {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const pendingRef = useRef(null);
  const bottomRef = useRef(null);
  const idleTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const items = threadItems(ticket);

  // Grow with the text up to the CSS max height instead of showing a scrollbar on one line.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const addFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    const valid = picked.filter((f) => ALLOWED_TYPES.includes(f.type) && f.size <= MAX_FILE_BYTES);
    if (valid.length < picked.length) toast.error('Only PNG or JPG images up to 10 MB can be attached');
    setFiles((prev) => [...prev, ...valid].slice(0, MAX_FILES));
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [items.length, typingName]);

  useEffect(() => () => clearTimeout(idleTimerRef.current), []);

  const handleChange = (e) => {
    setText(e.target.value);
    if (!onTyping) return;
    onTyping(true);
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => onTyping(false), TYPING_IDLE_MS);
  };

  const submit = async () => {
    const message = text.trim();
    if (!message || sending) return;
    const key = [message, ...files.map(fileKey)].join('|');
    if (!pendingRef.current || pendingRef.current.key !== key) {
      pendingRef.current = { key, clientId: newClientId(), paths: null };
    }
    const pending = pendingRef.current;
    setSending(true);
    clearTimeout(idleTimerRef.current);
    onTyping?.(false);
    try {
      if (!pending.paths) pending.paths = await Promise.all(files.map(uploadScreenshot));
      await onSend(message, pending.clientId, pending.paths);
      pendingRef.current = null;
      setText('');
      setFiles([]);
    } catch (error) {
      // API failures were already toasted by api.js; a failed direct-to-storage PUT was not.
      if (!error.response) toast.error(error.message || 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50/60">
        {items.length === 0 && emptyState}
        {items.map((item) => {
          const mine = viewer === 'seller' ? item.isSeller : !item.isSeller;
          return (
            <div key={item._id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              {!mine && (
                <span className="text-[11px] font-semibold text-slate-500 mb-0.5 px-1">{item.senderName}</span>
              )}
              <div className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                mine
                  ? 'bg-brand-600 text-white rounded-br-md'
                  : 'bg-white text-slate-800 border border-slate-200 rounded-bl-md'
              }`}>
                {item.message}
              </div>
              {item.attachments.length > 0 && (
                <div className={`mt-1 flex flex-wrap gap-1.5 ${mine ? 'justify-end' : ''}`}>
                  {item.attachments.map((url, i) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-md text-xs text-slate-600 hover:border-brand-300">
                      <ImageIcon size={11} /> Attachment {i + 1}
                    </a>
                  ))}
                </div>
              )}
              <span className="text-[10px] text-slate-400 mt-0.5 px-1">{formatTime(item.createdAt)}</span>
            </div>
          );
        })}
        {typingName && (
          <div className="text-xs text-slate-500 italic px-1" aria-live="polite">{typingName} is typing…</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-200 bg-white p-3">
        {closedNote ? (
          <div className="text-sm text-slate-500 text-center py-2">{closedNote}</div>
        ) : (
          <>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {files.map((f, i) => (
                <span key={fileKey(f)} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-slate-100 rounded-md text-xs text-slate-600 max-w-[160px]">
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label={`Remove ${f.name}`}
                    className="p-0.5 hover:text-slate-900"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => { e.preventDefault(); submit(); }}
            className="flex items-end gap-2"
          >
            <input ref={fileInputRef} type="file" multiple accept="image/png,image/jpeg" className="hidden" onChange={addFiles} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || files.length >= MAX_FILES}
              aria-label="Attach screenshot"
              title="Attach screenshot"
              className="w-10 h-10 shrink-0 rounded-full text-slate-500 hover:text-brand-600 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center"
            >
              <Paperclip size={18} />
            </button>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              maxLength={5000}
              placeholder={placeholder}
              aria-label="Message"
              className="flex-1 resize-none overflow-y-auto max-h-32 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 focus:bg-white"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              aria-label="Send message"
              className="w-10 h-10 shrink-0 rounded-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors"
            >
              <Send size={16} />
            </button>
          </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ChatThread;
