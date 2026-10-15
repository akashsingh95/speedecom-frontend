/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import { getSocket } from '../../socket';
import { useSocketEvent } from '../../hooks/useSupportSocket';
import { isSoundReady, subscribeSound, unlockSound } from './offerSound';

const LABELS = { online: 'Online', away: 'Away', offline: 'Offline' };
const DOT = { online: 'bg-emerald-500', away: 'bg-amber-400', offline: 'bg-slate-400' };

// Staff availability for support chats: only "Online" staff are rung.
const PresenceToggle = () => {
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const soundReady = useSyncExternalStore(subscribeSound, isSoundReady);

  useSocketEvent('presence:status', ({ status: next }) => setStatus(next));

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const load = () => socket.emit('presence:get', {}, (res) => {
      if (res?.success) setStatus(res.status);
    });
    if (socket.connected) load();
    socket.on('connect', load);
    return () => socket.off('connect', load);
  }, []);

  const toggle = () => {
    const socket = getSocket();
    if (!socket?.connected) {
      toast.error('Not connected. Check your connection and try again.');
      return;
    }
    setSaving(true);
    socket.emit('presence:set', { status: status === 'away' ? 'online' : 'away' }, (res) => {
      setSaving(false);
      if (res?.success) setStatus(res.status);
      else toast.error(res?.message || 'Could not update your status');
    });
  };

  const enableAlerts = async () => {
    const unlocked = await unlockSound();
    if (!unlocked) toast.error('This browser blocked sound. Allow sound for this site and try again.');
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  const current = status || 'offline';
  return (
    <div className="mx-4 mb-1 bg-white/60 rounded-xl px-3 py-2 border border-slate-100/50 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${DOT[current]}`} />
        <span className="text-xs font-semibold text-slate-700">Support: {LABELS[current]}</span>
        <button
          onClick={toggle}
          disabled={saving || !status}
          className="ml-auto text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50"
        >
          {status === 'away' ? 'Go online' : 'Set away'}
        </button>
      </div>
      {!soundReady && (
        <button onClick={enableAlerts} className="mt-1.5 w-full inline-flex items-center justify-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-800">
          <Bell size={12} /> Enable ring sound &amp; alerts
        </button>
      )}
    </div>
  );
};

export default PresenceToggle;
