import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api';
import { getSocket } from '../socket';
import { useTicketRoom } from './useSupportSocket';

const TYPING_CLEAR_MS = 4000;
const TYPING_THROTTLE_MS = 2000;

const useLiveTicket = (ticketId, seed = null) => {
  const [ticket, setTicket] = useState(seed);
  const [loadError, setLoadError] = useState(null);
  const [typingName, setTypingName] = useState(null);
  const typingClearRef = useRef(null);
  const lastTypingSentRef = useRef(0);

  const reload = useCallback(async () => {
    if (!ticketId) return;
    try {
      const res = await api.get(`/support/${ticketId}`);
      setTicket(res.data);
      setLoadError(null);
    } catch (error) {
      setLoadError(error);
    }
  }, [ticketId]);

  useEffect(() => {
    setTicket(seed && seed._id === ticketId ? seed : null);
    setTypingName(null);
    // seed is only the first frame for a newly opened ticket; later seeds must not reset it.
  }, [ticketId]);

  useEffect(() => () => clearTimeout(typingClearRef.current), []);

  const addMessage = useCallback((message) => {
    setTicket((current) => {
      if (!current || (current.messages || []).some((m) => m._id === message._id)) return current;
      return { ...current, messages: [...(current.messages || []), message] };
    });
  }, []);

  useTicketRoom(ticketId, {
    onMessage: (message) => {
      // Live payloads carry raw storage paths; a reload returns signed attachment URLs.
      if (message.attachments?.length) reload();
      else addMessage(message);
      setTypingName(null);
    },
    onUpdated: reload,
    onSync: reload,
    onTyping: ({ name, isTyping }) => {
      clearTimeout(typingClearRef.current);
      if (!isTyping) {
        setTypingName(null);
        return;
      }
      setTypingName(name || 'Someone');
      typingClearRef.current = setTimeout(() => setTypingName(null), TYPING_CLEAR_MS);
    },
  });

  const sendMessage = useCallback(async (text, clientId, attachments = []) => {
    const res = await api.post(`/support/${ticketId}/message`, { message: text, clientId, attachments });
    if (attachments.length) await reload();
    else addMessage(res.data);
  }, [ticketId, addMessage, reload]);

  const emitTyping = useCallback((isTyping) => {
    const socket = getSocket();
    if (!socket || !ticketId) return;
    const now = Date.now();
    if (isTyping && now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return;
    lastTypingSentRef.current = isTyping ? now : 0;
    socket.emit('ticket:typing', { ticketId, isTyping });
  }, [ticketId]);

  return { ticket, setTicket, reload, loadError, sendMessage, emitTyping, typingName };
};

export default useLiveTicket;
