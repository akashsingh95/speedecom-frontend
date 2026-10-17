/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Paperclip, X, Sparkles, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../api';
import { newClientId } from '../../socket';
import AttachmentGallery from './AttachmentGallery';
import TypewriterText from './TypewriterText';

const SELLER_ROLES = ['User', 'Admin'];
const TYPING_IDLE_MS = 3000;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 10;
const MAX_INPUT_HEIGHT_PX = 128;
// Name the server sends with the bot's typing events (socket/supportEvents.js emitBotTyping).
const BOT_TYPING_NAME = 'Speedy';

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
    const isSeller = !m.bot && SELLER_ROLES.includes(m.senderId?.role);
    items.push({
      _id: m._id,
      isSeller,
      isBot: Boolean(m.bot),
      suggestions: m.suggestions || [],
      senderName: m.bot ? 'Speedy · AI assistant' : (m.senderId?.fullName || (isSeller ? 'Seller' : 'Support Team')),
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
 * Screenshots can be attached with the clip button, pasted (Ctrl+V) or dropped on the chat,
 * and a message may be screenshots only.
 * onSuggest(question): when given, the bot's follow-up questions under the latest answer are
 * shown as tap-to-send chips.
 * onSuggest rejects on failure; the chips stay so the seller can tap again.
 */
const ChatThread = ({ ticket, viewer, typingName, onSend, onTyping, onSuggest, closedNote, placeholder = 'Type a message…', emptyState = null }) => {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const pendingRef = useRef(null);
  const bottomRef = useRef(null);
  const idleTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const dragDepthRef = useRef(0);
  const items = threadItems(ticket);

  // Bot replies that arrive while the chat is open are typed out; everything already in the
  // chat when it loads (or reloads) is shown as is.
  const seenRef = useRef({ ticketId: null, ids: new Set() });
  const [typingIds, setTypingIds] = useState(() => new Set());
  useEffect(() => {
    if (!ticket) return;
    const seen = seenRef.current;
    if (seen.ticketId !== ticket._id) {
      seenRef.current = { ticketId: ticket._id, ids: new Set(items.map((i) => i._id)) };
      setTypingIds(new Set());
      return;
    }
    const fresh = items.filter((i) => !seen.ids.has(i._id));
    fresh.forEach((i) => seen.ids.add(i._id));
    const freshBot = fresh.filter((i) => i.isBot && i.message);
    if (freshBot.length) setTypingIds((current) => new Set([...current, ...freshBot.map((i) => i._id)]));
  }, [ticket, items]);
  // Checked during render too, so a new reply never flashes in full before typing starts.
  const typesOut = (item) => item.isBot && Boolean(item.message) && (typingIds.has(item._id)
    || (seenRef.current.ticketId === ticket?._id && !seenRef.current.ids.has(item._id)));
  const doneTyping = (id) => setTypingIds((current) => {
    const next = new Set(current);
    next.delete(id);
    return next;
  });
  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ block: 'end' });

  // Only the latest message can offer follow-ups, and only once its typing animation is over.
  const lastItem = items[items.length - 1];
  const showSuggestions = Boolean(onSuggest) && !closedNote && !sending && lastItem?.isBot
    && lastItem.suggestions.length > 0 && !typesOut(lastItem);
  const [tapped, setTapped] = useState(false);
  useEffect(() => setTapped(false), [lastItem?._id]);
  useEffect(() => { if (showSuggestions) scrollToBottom(); }, [showSuggestions]);
  const tapSuggestion = async (question) => {
    setTapped(true);
    try {
      await onSuggest(question);
    } catch {
      // api.js showed the error; bring the chips back so the seller can try again.
      setTapped(false);
    }
  };

  const previews = useMemo(() => files.map((f) => ({ key: fileKey(f), name: f.name, url: URL.createObjectURL(f) })), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  // Grow with the text up to the max height; only then show a scrollbar.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const border = el.offsetHeight - el.clientHeight;
    const needed = el.scrollHeight + border;
    el.style.height = `${Math.min(needed, MAX_INPUT_HEIGHT_PX)}px`;
    el.style.overflowY = needed > MAX_INPUT_HEIGHT_PX ? 'auto' : 'hidden';
  }, [text]);

  const addFiles = (picked) => {
    if (picked.length === 0) return;
    const valid = picked.filter((f) => ALLOWED_TYPES.includes(f.type) && f.size <= MAX_FILE_BYTES);
    if (valid.length < picked.length) toast.error('Only PNG or JPG images up to 10 MB can be attached');
    setFiles((prev) => {
      const next = [...prev, ...valid];
      if (next.length > MAX_FILES) toast.error(`You can attach up to ${MAX_FILES} screenshots`);
      return next.slice(0, MAX_FILES);
    });
    textareaRef.current?.focus();
  };

  const handlePaste = (e) => {
    const pasted = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
    if (pasted.length === 0) return;
    e.preventDefault();
    addFiles(pasted);
  };

  const dropHandlers = closedNote ? {} : {
    onDragEnter: (e) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      dragDepthRef.current += 1;
      setDragging(true);
    },
    onDragOver: (e) => {
      if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
    },
    onDragLeave: () => {
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setDragging(false);
    },
    onDrop: (e) => {
      e.preventDefault();
      dragDepthRef.current = 0;
      setDragging(false);
      addFiles(Array.from(e.dataTransfer?.files || []));
    },
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

  const canSend = !sending && (text.trim() || files.length > 0);

  const submit = async () => {
    const message = text.trim();
    if (!canSend) return;
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
    <div className="relative flex flex-col h-full min-h-0" {...dropHandlers}>
      {dragging && (
        <div className="absolute inset-2 z-10 rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50/90 flex flex-col items-center justify-center gap-2 text-brand-700 pointer-events-none">
          <ImagePlus size={28} />
          <span className="text-sm font-semibold">Drop screenshots to attach</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
        {items.length === 0 && emptyState}
        {items.map((item) => {
          const mine = viewer === 'seller' ? item.isSeller : !item.isSeller;
          return (
            <div key={item._id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              {!mine && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 mb-1 px-1">
                  {item.isBot && <Sparkles size={11} className="text-brand-600" />}
                  {item.senderName}
                </span>
              )}
              {item.message && (
                <div className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                  mine
                    ? 'bg-brand-600 text-white rounded-br-md'
                    : item.isBot
                      ? 'bg-brand-50 text-slate-800 border border-brand-100 rounded-bl-md'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-md'
                }`}>
                  {typesOut(item)
                    ? <TypewriterText text={item.message} onProgress={scrollToBottom} onDone={() => doneTyping(item._id)} />
                    : item.message}
                </div>
              )}
              {item.attachments.length > 0 && (
                <div className={`max-w-[85%] ${item.message ? 'mt-1.5' : ''}`}>
                  <AttachmentGallery urls={item.attachments} align={mine ? 'end' : 'start'} />
                </div>
              )}
              <span className="text-[10px] text-slate-400 mt-1 px-1">{formatTime(item.createdAt)}</span>
            </div>
          );
        })}
        {typingName && (typingName === BOT_TYPING_NAME ? (
          // Same label and bubble as a bot answer, so the answer replaces it in place without a jump.
          <div className="flex flex-col items-start animate-[fadeIn_0.2s_ease-out]" aria-live="polite" aria-label="Speedy is typing">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 mb-1 px-1">
              <Sparkles size={11} className="text-brand-600" />
              Speedy · AI assistant
            </span>
            <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-brand-50 border border-brand-100 flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-500 px-1 animate-[fadeIn_0.2s_ease-out]" aria-live="polite">
            <span className="flex gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
            </span>
            {typingName} is typing
          </div>
        ))}
        {showSuggestions && !tapped && (
          <div className="flex flex-col items-end gap-1.5 pt-1 animate-[fadeIn_0.25s_ease-out]" aria-label="Suggested questions">
            {lastItem.suggestions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => tapSuggestion(question)}
                className="max-w-[85%] px-3 py-1.5 text-sm text-left text-brand-700 bg-white border border-brand-200 hover:bg-brand-50 hover:border-brand-300 rounded-full transition-colors"
              >
                {question}
              </button>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-200 bg-white p-3">
        {closedNote ? (
          <div className="text-sm text-slate-500 text-center py-2">{closedNote}</div>
        ) : (
          <>
            {previews.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {previews.map((p, i) => (
                  <div key={p.key} className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                    <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label={`Remove ${p.name}`}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white flex items-center justify-center"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <form
              onSubmit={(e) => { e.preventDefault(); submit(); }}
              className="flex items-end gap-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || files.length >= MAX_FILES}
                aria-label="Attach screenshot"
                title="Attach screenshot (or paste / drop one)"
                className="w-10 h-10 shrink-0 rounded-full text-slate-500 hover:text-brand-600 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center"
              >
                <Paperclip size={18} />
              </button>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleChange}
                onPaste={handlePaste}
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
                className="flex-1 resize-none overflow-hidden px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 focus:bg-white"
              />
              <button
                type="submit"
                disabled={!canSend}
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
