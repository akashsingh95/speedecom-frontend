import { useEffect, useRef } from 'react';
import { getSocket } from '../socket';

// Keeps the latest handler in a ref so callers can pass inline functions without resubscribing.
const useLatest = (value) => {
  const ref = useRef(value);
  useEffect(() => { ref.current = value; });
  return ref;
};

export const useSocketEvent = (event, handler, enabled = true) => {
  const handlerRef = useLatest(handler);

  useEffect(() => {
    if (!enabled) return undefined;
    const socket = getSocket();
    if (!socket) return undefined;
    const listener = (payload) => handlerRef.current(payload);
    socket.on(event, listener);
    return () => socket.off(event, listener);
  }, [event, enabled, handlerRef]);
};

/**
 * Joins a ticket's live room while `ticketId` is set.
 * onSync fires after every successful (re)join: anything sent before the join — or while
 * the connection was down — was not delivered live, so callers reload the ticket there.
 */
export const useTicketRoom = (ticketId, { onMessage, onUpdated, onTyping, onSync } = {}) => {
  const handlers = useLatest({ onMessage, onUpdated, onTyping, onSync });

  useEffect(() => {
    if (!ticketId) return undefined;
    const socket = getSocket();
    if (!socket) return undefined;

    const join = () => socket.emit('ticket:join', { ticketId }, (res) => {
      if (res?.success) handlers.current.onSync?.();
    });
    if (socket.connected) join();

    const handleMessage = (payload) => {
      if (payload.ticketId === ticketId) handlers.current.onMessage?.(payload.message);
    };
    const handleUpdated = (payload) => {
      if (payload.ticket?._id === ticketId) handlers.current.onUpdated?.(payload.ticket);
    };
    const handleTyping = (payload) => {
      if (payload.ticketId === ticketId) handlers.current.onTyping?.(payload);
    };

    socket.on('connect', join);
    socket.on('support:message', handleMessage);
    socket.on('support:ticket:updated', handleUpdated);
    socket.on('ticket:typing', handleTyping);

    return () => {
      socket.off('connect', join);
      socket.off('support:message', handleMessage);
      socket.off('support:ticket:updated', handleUpdated);
      socket.off('ticket:typing', handleTyping);
      if (socket.connected) socket.emit('ticket:leave', { ticketId });
    };
  }, [ticketId, handlers]);
};
