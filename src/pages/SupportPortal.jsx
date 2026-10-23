/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useAuth } from '../AuthContext';
import api from '../api';
import DashboardLayout from '../components/DashboardLayout';
import { LifeBuoy, X, Paperclip, CheckCircle2, Clock, MessageCircle, Send, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown } from 'lucide-react';
import StarRating from '../components/StarRating';
import RatingModal from '../components/RatingModal';
import { openSupportChat } from '../components/support/SupportChatWidget';
import { useSocketEvent, useTicketRoom } from '../hooks/useSupportSocket';
import AttachmentGallery from '../components/support/AttachmentGallery';
import { PRODUCT_BADGE_CLASSES, PRODUCT_LABELS, productLabel } from '../components/support/products';

const SupportPortal = () => {
    const { user } = useAuth();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [statusFilters, setStatusFilters] = useState([]);
    const [productFilter, setProductFilter] = useState('');
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const statusDropdownRef = useRef(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalTickets, setTotalTickets] = useState(0);
    const [gotoInput, setGotoInput] = useState('');
    const [gotoError, setGotoError] = useState(false);
    const [showRatingModal, setShowRatingModal] = useState(false);

    // Reply state
    const [replyMessage, setReplyMessage] = useState('');
    const [replying, setReplying] = useState(false);
    const replyTextareaRef = useRef(null);

    // Auto-grow the reply textarea to fit its content (capped by CSS max-height).
    useEffect(() => {
        const el = replyTextareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }, [replyMessage, selectedTicket?._id]);

    // Reset reply on ticket switch
    useEffect(() => {
        setReplyMessage('');
    }, [selectedTicket?._id]);

    const toggleStatus = (s) => setStatusFilters(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

    useEffect(() => {
        if (!statusDropdownOpen) return;
        const handleClick = (e) => {
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target)) {
                setStatusDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [statusDropdownOpen]);

    useEffect(() => {
        setPage(1);
    }, [statusFilters, productFilter]);

    useEffect(() => {
        fetchTickets();
    }, [statusFilters, productFilter, page]);

    useEffect(() => {
        const delay = setTimeout(() => {
            const p = parseInt(gotoInput, 10);
            if (gotoInput && (p < 1 || p > totalPages)) setGotoError(true);
            else { setGotoError(false); if (p >= 1 && p <= totalPages) setPage(p); }
        }, 400);
        return () => clearTimeout(delay);
    }, [gotoInput, totalPages]);

    // Live updates for the open ticket; reloading (rather than appending) keeps attachment URLs signed.
    useTicketRoom(selectedTicket?._id, {
        onMessage: () => fetchTicketDetails(selectedTicket._id, true),
        onUpdated: () => {
            fetchTicketDetails(selectedTicket._id, true);
            fetchTickets(true);
        },
        onSync: () => fetchTicketDetails(selectedTicket._id, true),
    });

    useSocketEvent('support:chat:new', () => fetchTickets(true));
    useSocketEvent('support:ticket:updated', () => fetchTickets(true));

    // silent: live refreshes keep the current list on screen instead of flashing the spinner.
    const fetchTickets = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const params = { page, limit: 20 };
            if (statusFilters.length > 0) params.status = statusFilters.join(',');
            if (productFilter) params.product = productFilter;
            const res = await api.get('/support', { params });
            setTickets(res.data?.data || res.data || []);
            const pagination = res.pagination || res.data?.pagination;
            if (pagination) {
                setTotalPages(pagination.pages);
                setTotalTickets(pagination.total);
            }
        } catch (error) {
            toast.error("Failed to load support tickets");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTicketDetails = async (id, silent = false) => {
        try {
            const res = await api.get(`/support/${id}`);
            setSelectedTicket(res.data?.data || res.data);
        } catch (error) {
            if (!silent) toast.error("Failed to load ticket details");
        }
    };

    const handleReplySubmit = async (e) => {
        e.preventDefault();
        if (!replyMessage.trim()) return;

        try {
            setReplying(true);
            await api.post(`/support/${selectedTicket._id}/message`, { message: replyMessage });
            setReplyMessage('');
            fetchTicketDetails(selectedTicket._id);
        } catch (error) {
            toast.error("Failed to send reply");
        } finally {
            setReplying(false);
        }
    };

    const [ratingState, setRatingState] = useState(null);

    const closeRating = () => setRatingState(null);

    const openRating = (ticket) => {
        setRatingState({ current: ticket, queue: [] });
    };

    const handleRated = (ticketId, newRating) => {
        setTickets(prev => prev.map(t =>
            t._id === ticketId ? { ...t, rating: newRating } : t
        ));
        if (selectedTicket?._id === ticketId) {
            setSelectedTicket(prev => ({ ...prev, rating: newRating }));
        }
        toast.success("Rating submitted");
        setRatingState(prev => {
            if (!prev) return null;
            if (prev.queue.length > 0) {
                const [next, ...rest] = prev.queue;
                return { current: next, queue: rest };
            }
            return null;
        });
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Open': return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'In Progress': return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'Resolved': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'Closed': return 'bg-slate-50 text-slate-700 border-slate-200';
            default: return 'bg-slate-50 text-slate-700 border-slate-200';
        }
    };

    // Bold status pill style for the drawer header.
    const getStatusBadgeStyle = (status) => {
        switch (status) {
            case 'Open': return 'bg-amber-100 text-amber-800';
            case 'In Progress': return 'bg-blue-100 text-blue-800';
            case 'Resolved': return 'bg-emerald-100 text-emerald-800';
            case 'Closed': return 'bg-slate-200 text-slate-700';
            default: return 'bg-slate-200 text-slate-700';
        }
    };

    const getPriorityTextColor = (priority) => {
        switch (priority) {
            case 'High': return 'text-red-600';
            case 'Medium': return 'text-amber-600';
            case 'Low': return 'text-blue-600';
            default: return 'text-slate-700';
        }
    };

    const getInitials = (name) => {
        if (!name) return '?';
        const parts = String(name).trim().split(/\s+/);
        const first = parts[0]?.[0] || '';
        const second = parts[1]?.[0] || '';
        return (first + second).toUpperCase() || '?';
    };

    const formatDayLabel = (date) => {
        const d = new Date(date);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const sameDay = (a, b) => a.toDateString() === b.toDateString();
        if (sameDay(d, today)) return 'TODAY';
        if (sameDay(d, yesterday)) return 'YESTERDAY';
        return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
    };

    // Build a chronological list combining the original description (as an opening tenant
    // bubble) with all messages, then group by day for date-divider rendering.
    const buildConversationGroups = (ticket) => {
        if (!ticket) return [];
        const items = [];
        // A chat's description is its first message, which is already in `messages`.
        if (ticket.description && ticket.channel !== 'chat') {
            items.push({
                _key: 'description',
                kind: 'description',
                isUser: true,
                senderName: ticket.createdBy?.fullName || user?.fullName || 'You',
                message: ticket.description,
                attachments: ticket.screenshots || [],
                createdAt: ticket.createdAt,
            });
        }
        if (Array.isArray(ticket.messages)) {
            for (let i = 0; i < ticket.messages.length; i++) {
                const m = ticket.messages[i];
                const isUser = m.senderId?.role === 'User' || m.senderId?.role === 'Admin';
                items.push({
                    _key: `msg-${i}`,
                    kind: 'message',
                    isUser,
                    senderName: m.bot ? 'Speedy · AI assistant' : m.senderId?.fullName || (isUser ? (user?.fullName || 'You') : 'Support Team'),
                    message: m.message,
                    attachments: m.attachments || [],
                    createdAt: m.createdAt,
                });
            }
        }
        const groups = [];
        for (const item of items) {
            const label = formatDayLabel(item.createdAt);
            const last = groups[groups.length - 1];
            if (last && last.label === label) {
                last.items.push(item);
            } else {
                groups.push({ label, items: [item] });
            }
        }
        return groups;
    };

    return (<>
        <DashboardLayout>
            <div className="p-6 lg:p-8 overflow-y-auto h-full custom-scrollbar">
                <div className="max-w-6xl mx-auto space-y-6">
                    {/* ═══════════════ HERO HEADER ═══════════════ */}
                    <div className="relative overflow-hidden bg-brand-600 rounded-2xl p-7 text-white shadow-lg mb-6">
                        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl"></div>
                        <div data-tour={TOUR.support.header} className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm border border-white/10">
                                    <LifeBuoy size={20} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold tracking-tight">Support Portal</h1>
                                    <p className="mt-1 text-sm text-blue-100">Chat with your account manager and see your past requests.</p>
                                </div>
                            </div>
                            <button
                                onClick={openSupportChat}
                                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm rounded-xl font-medium transition-all shadow-sm hover:shadow-md"
                            >
                                <MessageCircle size={18} />
                                Chat with Support
                            </button>
                        </div>
                    </div>

                <div data-tour={TOUR.support.ticketList} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden transition-all duration-300">
                    <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
                        {user?.listingStudioEnabled !== false && (
                            <div role="radiogroup" aria-label="Product" className="inline-flex p-0.5 bg-slate-100 rounded-lg">
                                {[['', 'All'], ...Object.entries(PRODUCT_LABELS)].map(([value, label]) => (
                                    <button
                                        key={value || 'all'}
                                        type="button"
                                        role="radio"
                                        aria-checked={productFilter === value}
                                        onClick={() => setProductFilter(value)}
                                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${productFilter === value ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="relative" ref={statusDropdownRef}>
                            <button
                                onClick={() => setStatusDropdownOpen(o => !o)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors ${statusFilters.length > 0 ? 'bg-brand-50 text-brand-700 border-brand-200' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50 shadow-sm'}`}
                            >
                                <span className="text-xs">{statusFilters.length === 0 ? 'Status' : `${statusFilters.length} status selected`}</span>
                                <ChevronDown size={13} className={statusFilters.length > 0 ? 'text-brand-500' : 'text-slate-400'} />
                            </button>
                            {statusDropdownOpen && (
                                <div className="absolute left-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg min-w-[170px]">
                                    {['Open', 'In Progress', 'Resolved', 'Closed'].map(s => (
                                        <label key={s} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 cursor-pointer text-sm text-slate-700">
                                            <input type="checkbox" checked={statusFilters.includes(s)} onChange={() => toggleStatus(s)} className="rounded accent-brand-600" />
                                            <span>{s}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    {statusFilters.length > 0 && (
                        <div className="px-6 py-2 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Filters</span>
                            {statusFilters.map(s => {
                                const chipStyle = { 'Open': 'bg-blue-50 border-blue-200 text-blue-700', 'In Progress': 'bg-amber-50 border-amber-200 text-amber-700', 'Resolved': 'bg-emerald-50 border-emerald-200 text-emerald-700', 'Closed': 'bg-slate-100 border-slate-300 text-slate-700' }[s] || 'bg-slate-100 border-slate-200 text-slate-700';
                                return (
                                    <div key={s} className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-lg text-xs font-medium shadow-sm ${chipStyle}`}>
                                        {s}
                                        <button onClick={() => toggleStatus(s)} className="p-0.5 hover:bg-black/10 rounded transition-colors"><X size={11} /></button>
                                    </div>
                                );
                            })}
                            {statusFilters.length >= 2 && (
                                <button onClick={() => setStatusFilters([])} className="text-xs font-semibold text-brand-600 hover:text-brand-800 underline decoration-brand-300 underline-offset-2 ml-1 transition-colors">Clear all</button>
                            )}
                        </div>
                    )}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center min-h-[400px]">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mb-4"></div>
                            <p className="text-slate-500">Loading tickets...</p>
                        </div>
                    ) : tickets.length === 0 ? (
                        <div className="bg-white flex flex-col items-center justify-center py-16 text-slate-500 space-y-4">
                            <div className="p-4 bg-slate-100 rounded-2xl">
                                <LifeBuoy className="w-10 h-10 text-slate-400" />
                            </div>
                            <div className="text-center">
                                <h3 className="font-semibold text-slate-700">{statusFilters.length === 0 && !productFilter ? 'No support tickets' : 'No tickets match this filter'}</h3>
                                <p className="mt-1 text-sm text-slate-500">{statusFilters.length === 0 && !productFilter ? "You haven't created any support requests yet." : 'Try a different filter to see more tickets.'}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-100/60">
                                        <th className="py-3.5 px-6 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ticket ID</th>
                                        <th className="py-3.5 px-6 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Title</th>
                                        <th className="py-3.5 px-6 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="py-3.5 px-6 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rating</th>
                                        <th className="py-3.5 px-6 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                                        <th className="py-3.5 px-6 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {Array.isArray(tickets) && tickets.map((ticket) => (
                                        <tr key={ticket._id} className="hover:bg-slate-50/80 transition-colors duration-150">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-800">
                                                {ticket.ticketId}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-700">
                                                <div className="font-medium line-clamp-1">{ticket.title}</div>
                                                <span className={`mt-1 inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${PRODUCT_BADGE_CLASSES[ticket.product] || PRODUCT_BADGE_CLASSES.reconciliation}`}>
                                                    {productLabel(ticket.product)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-md border ${getStatusColor(ticket.status)}`}>
                                                    {ticket.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {['Resolved', 'Closed'].includes(ticket.status) ? (
                                                    ticket.rating?.stars ? (
                                                        <StarRating value={ticket.rating.stars} readOnly size={14} />
                                                    ) : (
                                                        <button
                                                            onClick={() => openRating(ticket)}
                                                            className="text-xs font-semibold text-brand-600 hover:text-brand-800 hover:bg-brand-50 px-2 py-1 rounded transition-colors"
                                                        >
                                                            Rate us
                                                        </button>
                                                    )
                                                ) : (
                                                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Pending</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                {new Date(ticket.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => {
                                                        fetchTicketDetails(ticket._id);
                                                    }}
                                                    className="text-brand-600 hover:text-brand-800 font-medium px-3 py-1.5 rounded-md hover:bg-brand-50 transition-colors"
                                                >
                                                    View Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                )}

                {!loading && totalPages > 1 && (() => {
                    const maxVisible = 10;
                    const startPage = Math.floor((page - 1) / maxVisible) * maxVisible + 1;
                    const endPage = Math.min(totalPages, startPage + maxVisible - 1);
                    return (
                    <div className="flex flex-col items-center gap-3 pt-4 pb-2">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(1)}
                                disabled={page === 1}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                            >
                                <ChevronsLeft size={16} /> First
                            </button>
                            <button
                                onClick={() => setPage(Math.max(1, startPage - maxVisible))}
                                disabled={startPage === 1}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p)}
                                        className={`w-9 h-9 text-sm font-medium rounded-lg transition-all ${
                                            p === page
                                                ? 'bg-brand-600 text-white shadow-sm'
                                                : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                                        }`}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setPage(Math.min(totalPages, startPage + maxVisible))}
                                disabled={startPage + maxVisible > totalPages}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight size={16} />
                            </button>
                            <button
                                onClick={() => setPage(totalPages)}
                                disabled={page === totalPages}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                            >
                                Last <ChevronsRight size={16} />
                            </button>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-slate-400 font-medium">Go to</span>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={gotoInput}
                                        onChange={e => {
                                            setGotoError(false);
                                            setGotoInput(e.target.value.replace(/\D/g, ''));
                                        }}
                                        placeholder="#"
                                        className={`w-14 px-2 py-1.5 bg-white border rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                            gotoError
                                                ? 'border-red-300 text-red-600'
                                                : 'border-slate-200'
                                        }`}
                                    />
                                    {gotoError && (
                                        <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-red-500 whitespace-nowrap">Invalid page</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <span>Page {page} of {totalPages}</span>
                            <span className="text-slate-300">|</span>
                            <span>{totalTickets} total tickets</span>
                        </div>
                    </div>
                    );
                })()}

                {showRatingModal && selectedTicket?.rating?.note && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowRatingModal(false)}>
                        <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full mx-4 p-6 min-w-0" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-slate-800">Rating & Review</h3>
                                <button onClick={() => setShowRatingModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all">
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="flex items-center gap-2 mb-4">
                                <StarRating value={selectedTicket.rating.stars} readOnly size={20} />
                                <span className="text-sm text-slate-600 font-medium">{selectedTicket.rating.stars} / 5</span>
                            </div>
                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-all bg-slate-50 rounded-lg p-4 border border-slate-100">
                                {selectedTicket.rating.note}
                            </p>
                        </div>
                    </div>
                )}
                </div>

                {/* Details Drawer */}
                {selectedTicket && createPortal(
                    <div className="fixed inset-0 z-50 overflow-hidden">
                        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={() => setSelectedTicket(null)}></div>
                        <div className="fixed inset-y-0 right-0 max-w-full flex">
                            <div className="w-screen max-w-2xl transform transition-transform bg-white shadow-2xl flex flex-col h-full">
                                {/* Header */}
                                <div className="relative px-6 pt-5 pb-4 border-b border-slate-200 bg-white">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2.5 flex-wrap">
                                                <span className="text-[11px] font-bold tracking-wider text-white bg-brand-600 px-2.5 py-1 rounded-lg shadow-sm">{selectedTicket.ticketId}</span>
                                                <h2 className="text-xl font-bold text-slate-900 tracking-tight truncate">{selectedTicket.title}</h2>
                                            </div>
                                            <div className="mt-2.5 flex items-center gap-3 flex-wrap">
                                                <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${getStatusBadgeStyle(selectedTicket.status)}`}>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                                    {selectedTicket.status}
                                                </span>
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                    <Clock size={13} className="text-slate-400" />
                                                    <span>Created on <span className="font-semibold text-slate-700">{new Date(selectedTicket.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span></span>
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-slate-700 p-2 rounded-full hover:bg-slate-100 transition-colors shrink-0">
                                            <X size={20} />
                                        </button>
                                    </div>
                                </div>

                                {/* Info strip */}
                                <div className="px-6 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-5 flex-wrap text-xs">
                                    <div className="inline-flex items-center gap-1.5">
                                        <span className="text-slate-500 font-semibold">Priority</span>
                                        <span className={`inline-flex items-center gap-1 font-bold ${getPriorityTextColor(selectedTicket.priority)}`}>
                                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                            {selectedTicket.priority}
                                        </span>
                                    </div>
                                    <span className="h-3 w-px bg-slate-300"></span>
                                    <div className="inline-flex items-center gap-1.5">
                                        <span className="text-slate-500 font-semibold">Category</span>
                                        <span className="font-bold text-slate-800">Tenant Support</span>
                                    </div>

                                </div>

                                {/* Attachments (compact pills) */}
                                {Array.isArray(selectedTicket.screenshots) && selectedTicket.screenshots.length > 0 && (
                                    <div className="px-6 py-3 border-b border-slate-200 bg-white flex items-center gap-2 flex-wrap">
                                        <Paperclip size={14} className="text-slate-400" />
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Attachments</span>
                                        <AttachmentGallery urls={selectedTicket.screenshots} />
                                    </div>
                                )}

                                {/* Conversation */}
                                <div className="flex-1 overflow-y-auto px-6 py-6 bg-slate-50">
                                    {buildConversationGroups(selectedTicket).map((group, gIdx) => (
                                        <div key={gIdx} className="mb-2 last:mb-0">
                                            {/* Date pill */}
                                            <div className="flex items-center justify-center my-4">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                                                    {group.label}
                                                </span>
                                            </div>
                                            {group.items.map((item, mIdx) => {
                                                const prev = mIdx > 0 ? group.items[mIdx - 1] : null;
                                                const isFirstOfRun = !prev || prev.isUser !== item.isUser;
                                                const next = mIdx < group.items.length - 1 ? group.items[mIdx + 1] : null;
                                                const isLastOfRun = !next || next.isUser !== item.isUser;
                                                return (
                                                    <div key={item._key} className={`flex items-end gap-2.5 ${item.isUser ? 'flex-row-reverse' : ''} ${isFirstOfRun ? 'mt-4' : 'mt-1'}`}>
                                                        {/* Avatar (only on last bubble of a run, so it sits beside the bottom of the group) */}
                                                        {isLastOfRun ? (
                                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shadow-md ring-2 ring-white shrink-0 ${
                                                                item.isUser
                                                                    ? 'bg-brand-600 text-white'
                                                                    : 'bg-slate-600 text-white'
                                                            }`}>
                                                                {item.isUser ? getInitials(item.senderName) : 'ST'}
                                                            </div>
                                                        ) : (
                                                            <div className="w-9 shrink-0" />
                                                        )}

                                                        <div className={`flex flex-col max-w-[78%] ${item.isUser ? 'items-end' : 'items-start'}`}>
                                                            {isFirstOfRun && (
                                                                <span className={`text-[11px] font-bold uppercase tracking-wider mb-1 px-1 inline-flex items-center gap-1 ${item.isUser ? 'text-slate-500' : 'text-brand-700'}`}>
                                                                    {!item.isUser && <CheckCircle2 size={11} className="text-brand-500" />}
                                                                    {item.senderName}
                                                                </span>
                                                            )}

                                                            {item.message && (
                                                                <div className={`px-4 py-2.5 text-[14.5px] leading-relaxed transition-shadow ${
                                                                    item.isUser
                                                                        ? `bg-brand-600 text-white shadow-sm rounded-2xl ${isLastOfRun ? 'rounded-br-md' : ''} ${!isFirstOfRun ? 'rounded-tr-md' : ''}`
                                                                        : `bg-white text-slate-800 border border-slate-200/80 shadow-sm rounded-2xl ${isLastOfRun ? 'rounded-bl-md' : ''} ${!isFirstOfRun ? 'rounded-tl-md' : ''}`
                                                                }`}>
                                                                    <p className="whitespace-pre-wrap break-words">{item.message}</p>
                                                                </div>
                                                            )}

                                                            {Array.isArray(item.attachments) && item.attachments.length > 0 && item.kind !== 'description' && (
                                                                <div className={item.message ? 'mt-2' : ''}>
                                                                    <AttachmentGallery urls={item.attachments} align={item.isUser ? 'end' : 'start'} />
                                                                </div>
                                                            )}

                                                            {isLastOfRun && (
                                                                <span className="text-[10px] text-slate-400 mt-1 px-1 font-medium">
                                                                    {new Date(item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>

                                {/* Reply footer */}
                                <div className="border-t border-slate-200 bg-white p-4">
                                    {['Resolved', 'Closed'].includes(selectedTicket.status) ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-slate-200 rounded-lg">
                                                        <CheckCircle2 size={18} className="text-slate-500" />
                                                    </div>
                                                    <div className="text-sm">
                                                        <p className="font-semibold text-slate-800">This ticket is {selectedTicket.status.toLowerCase()}.</p>
                                                        <p className="text-slate-500">Start a new chat if you need further assistance.</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setSelectedTicket(null);
                                                        openSupportChat();
                                                    }}
                                                    className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl transition-colors font-semibold shadow-sm text-sm"
                                                >
                                                    <MessageCircle size={16} />
                                                    New Chat
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-2xl">
                                                <div className="flex items-center gap-3 w-full">
                                                    <div className="text-sm w-full">
                                                        {selectedTicket.rating?.stars ? (
                                                            <>
                                                                <p className="font-semibold text-slate-700 mb-1">Your rating</p>
                                                                <div className="flex items-center gap-2">
                                                                    <StarRating value={selectedTicket.rating.stars} readOnly size={18} />
                                                                    <span className="text-xs text-slate-400">
                                                                        Rated on {new Date(selectedTicket.rating.createdAt).toLocaleDateString()}
                                                                    </span>
                                                                </div>
                                                                {selectedTicket.rating.note && (
                                                                    <div className="flex items-center gap-1.5 mt-1">
                                                                        <p className="text-xs text-slate-500 italic truncate">"{selectedTicket.rating.note}"</p>
                                                                        {selectedTicket.rating.note.length > 60 && (
                                                                            <button onClick={() => setShowRatingModal(true)} className="text-xs font-semibold text-brand-600 hover:text-brand-800 hover:underline shrink-0">
                                                                                See more
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </>
                                                    ) : (
                                                        <button
                                                            onClick={() => openRating(selectedTicket)}
                                                            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-800 hover:bg-brand-50 px-3 py-1.5 rounded-lg transition-colors"
                                                        >
                                                            Rate us
                                                        </button>
                                                    )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleReplySubmit} className="flex items-end gap-2.5">
                                            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl focus-within:ring-2 focus-within:ring-brand-500/30 focus-within:border-brand-400 focus-within:bg-white transition-all shadow-sm">
                                                <textarea
                                                    ref={replyTextareaRef}
                                                    value={replyMessage}
                                                    onChange={(e) => setReplyMessage(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            if (!replying && replyMessage.trim()) {
                                                                handleReplySubmit(e);
                                                            }
                                                        }
                                                    }}
                                                    rows={1}
                                                    placeholder="Type your reply here..."
                                                    className="w-full px-4 py-3 bg-transparent outline-none text-[14.5px] resize-none overflow-y-auto max-h-40 placeholder:text-slate-400"
                                                />
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={replying || !replyMessage.trim()}
                                                className="w-11 h-11 shrink-0 rounded-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors shadow-sm active:scale-95"
                                                aria-label="Send reply"
                                            >
                                                <Send size={16} className="-ml-0.5" />
                                            </button>
                                        </form>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
                </div>
            </div>
        </DashboardLayout>

        {ratingState?.current && (
            <RatingModal
                key={ratingState.current._id}
                ticket={ratingState.current}
                onClose={closeRating}
                onRated={handleRated}
            />
        )}
    </>);
};

export default SupportPortal;