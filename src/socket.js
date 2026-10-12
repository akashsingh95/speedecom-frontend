import { io } from 'socket.io-client';

// Same host as the API; VITE_API_URL is a full URL in the mobile build and unset on web.
const SOCKET_ORIGIN = import.meta.env.VITE_API_URL
  ? new URL(import.meta.env.VITE_API_URL, window.location.origin).origin
  : window.location.origin;

let socket = null;

// One shared connection per login. A new token (re-login as someone else) replaces it.
export const getSocket = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  if (socket && socket.auth?.token === token) return socket;
  if (socket) socket.disconnect();
  socket = io(SOCKET_ORIGIN, {
    path: '/api/socket.io',
    // The API runs as a Node cluster; long-polling would scatter requests across workers.
    transports: ['websocket'],
    auth: { token },
  });
  return socket;
};

export const disconnectSocket = () => {
  if (!socket) return;
  socket.disconnect();
  socket = null;
};

// crypto.randomUUID needs a secure context; plain-http staging and some WebViews lack it.
export const newClientId = () => (
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
);
