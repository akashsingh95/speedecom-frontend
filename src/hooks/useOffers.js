import { useCallback, useEffect, useState } from 'react';
import { getSocket } from '../socket';
import { useSocketEvent } from './useSupportSocket';

const TICK_MS = 1000;

/**
 * Support chats currently ringing for this staff user.
 * Live offers arrive as socket events; on every (re)connect the server is asked for the
 * offers still ringing, since any sent while the socket was down were missed.
 */
const useOffers = (enabled) => {
  const [offers, setOffers] = useState([]);
  const [now, setNow] = useState(Date.now());

  const remove = useCallback((ticketId) => {
    setOffers((current) => current.filter((o) => o.ticket._id !== ticketId));
  }, []);

  // `now` only ticks while offers exist, so refresh it with each arrival or the first
  // countdown frame would be computed against a stale clock.
  useSocketEvent('support:offer', (offer) => {
    setNow(Date.now());
    setOffers((current) => [...current.filter((o) => o.ticket._id !== offer.ticket._id), offer]);
  }, enabled);

  useSocketEvent('support:offer:ended', ({ ticketId }) => remove(ticketId), enabled);

  useEffect(() => {
    if (!enabled) return undefined;
    const socket = getSocket();
    if (!socket) return undefined;
    const sync = () => socket.emit('support:offers:pending', {}, (res) => {
      if (!res?.success) return;
      setNow(Date.now());
      setOffers(res.offers);
    });
    if (socket.connected) sync();
    socket.on('connect', sync);
    return () => socket.off('connect', sync);
  }, [enabled]);

  const hasOffers = offers.length > 0;
  useEffect(() => {
    if (!hasOffers) return undefined;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [hasOffers]);

  const live = offers.filter((o) => new Date(o.expiresAt).getTime() > now);
  return { offers: live, now, remove };
};

export default useOffers;
