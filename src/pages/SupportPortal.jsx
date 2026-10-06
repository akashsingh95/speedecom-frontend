import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useAuth } from '../AuthContext';
import api from '../api';
import DashboardLayout from '../components/DashboardLayout';
import { LifeBuoy, X, Paperclip, CheckCircle2, Clock, Plus, Image as ImageIcon, Send, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown } from 'lucide-react';
import StarRating from '../components/StarRating';
import RatingModal from '../components/RatingModal';

const SupportPortal = () => {
    const { user } = useAuth();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [statusFilters, setStatusFilters] = useState([]);
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const statusDropdownRef = useRef(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalTickets, setTotalTickets] = useState(0);
    const [gotoInput, setGotoInput] = useState('');
    const [gotoError, setGotoError] = useState(false);
    const [showRatingModal, setShowRatingModal] = useState(false);

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);

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
    }, [statusFilters]);

    useEffect(() => {
        fetchTickets();
    }, [statusFilters, page]);

    useEffect(() => {
        const delay = setTimeout(() => {
            const p = parseInt(gotoInput, 10);
            if (gotoInput && (p < 1 || p > totalPages)) setGotoError(true);
            else { setGotoError(false); if (p >= 1 && p <= totalPages) setPage(p); }
        }, 400);
        return () => clearTimeout(delay);
    }, [gotoInput, totalPages]);

    // Real-time polling for messages when a ticket is open.
    // Uses recursive setTimeout so a slow request can't overlap with the next tick.
    useEffect(() => {
        if (!selectedTicket) return;
        let cancelled = false;
        let timeoutId;
        const poll = async () => {
            await fetchTicketDetails(selectedTicket._id, true);
            if (!cancelled) timeoutId = setTimeout(poll, 3000);
        };
        timeoutId = setTimeout(poll, 3000);
        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [selectedTicket?._id]);

    const fetchTickets = async () => {
        try {
            setLoading(true);
            const params = { page, limit: 20 };
            if (statusFilters.length > 0) params.status = statusFilters.join(',');
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

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        setUploading(true);
        let uploadedUrls = [];

        try {
            if (files && files.length > 0) {
                uploadedUrls = await Promise.all(files.map(async (file) => {
                    // Get pre-signed URL
                    const response = await api.post('/support/upload-url', {
                        fileName: file.name,
                        contentType: file.type,
                    });
                    const responseData = response.data?.data || response.data;
                    const { uploadUrl, fileUrl } = responseData;

                    // Upload direct to GCS
                    await fetch(uploadUrl, {
                        method: 'PUT',
                        body: file,
                        headers: { 'Content-Type': file.type }
                    });
                    return fileUrl;
                }));
            }

            await api.post('/support', {
                title,
                description,
                screenshots: uploadedUrls,
            });

            toast.success("Support ticket created successfully!");
            setIsCreateModalOpen(false);
            setTitle('');
            setDescription('');
            setFiles([]);
            fetchTickets();
        } catch (error) {
            toast.error("Failed to create support ticket.");
            console.error(error);
        } finally {
            setUploading(false);
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files) {
            const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            const selectedFiles = Array.from(e.target.files);
            
            const validFiles = selectedFiles.filter(file => allowedTypes.includes(file.type));
            const invalidFiles = selectedFiles.filter(file => !allowedTypes.includes(file.type));
            
            if (invalidFiles.length > 0) {
                toast.error("Only PNG and JPG files are allowed");
            }
            
            if (validFiles.length > 0) {
                setFiles(prev => [...prev, ...validFiles]);
            }
        }
    };

    const removeFile = (indexToRemove) => {
        setFiles(prev => prev.filter((_, index) => index !== indexToRemove));
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

    const handleCreateClick = () => {
        const unrated = Array.isArray(tickets)
            ? tickets.filter(t => ['Resolved', 'Closed'].includes(t.status) && !t.rating?.stars)
            : [];
        if (unrated.length > 0) {
            setRatingState({ current: unrated[0], queue: unrated.slice(1) });
            return;
        }
        setIsCreateModalOpen(true);
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

    // Stored attachment paths are `support-screenshots/<scope>/<timestamp>-<uuid>.<ext>` —
    // the original filename isn't kept, so synthesize a clean label.
    const attachmentLabel = (url, index) => {
        const base = String(url || '').split('?')[0].split('/').pop() || '';
        const ext = (base.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
        return `screenshot_${String(index + 1).padStart(2, '0')}${ext ? '.' + ext : ''}`;
    };

    // Build a chronological list combining the original description (as an opening tenant
    // bubble) with all messages, then group by day for date-divider rendering.
    const buildConversationGroups = (ticket) => {
        if (!ticket) return [];
        const items = [];
        if (ticket.description) {
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
                    senderName: m.senderId?.fullName || (isUser ? (user?.fullName || 'You') : 'Support Team'),
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
                    <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-blue-800 rounded-2xl p-7 text-white shadow-lg mb-6">
                        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl"></div>
                        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm border border-white/10">
                                    <LifeBuoy size={20} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold tracking-tight">Support Portal</h1>
                                    <p className="mt-1 text-sm text-blue-100">Create and manage your support requests.</p>
                                </div>
                            </div>
                            <button
                                onClick={handleCreateClick}
                                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm rounded-xl font-medium transition-all shadow-sm hover:shadow-md"
                            >
                                <Plus size={18} />
                                Create Ticket
                            </button>
                        </div>
                    </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden transition-all duration-300">
                    <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
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
                                <h3 className="font-semibold text-slate-700">{statusFilters.length === 0 ? 'No support tickets' : 'No tickets match this filter'}</h3>
                                <p className="mt-1 text-sm text-slate-500">{statusFilters.length === 0 ? "You haven't created any support requests yet." : 'Try a different status to see more tickets.'}</p>
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

                {/* Create Modal */}
                {isCreateModalOpen && createPortal(
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsCreateModalOpen(false)}></div>
                            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
                            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full border border-slate-200">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <div className="flex items-center justify-between mb-6">
                                                <h3 className="text-xl font-bold text-slate-800">Create New Support Ticket</h3>
                                                <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                                                    <X size={20} />
                                                </button>
                                            </div>
                                            <form onSubmit={handleCreateSubmit} className="space-y-5">
                                                <div>
                                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Issue Title</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={title}
                                                        onChange={(e) => setTitle(e.target.value)}
                                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-shadow text-[15px]"
                                                        placeholder="Brief summary of the issue"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Detailed Description</label>
                                                    <textarea
                                                        required
                                                        rows={4}
                                                        value={description}
                                                        onChange={(e) => setDescription(e.target.value)}
                                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-shadow resize-none text-[15px]"
                                                        placeholder="Please describe the issue you are facing in detail..."
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Attach Screenshots (Optional)</label>
                                                    <div className="mt-1 flex justify-center px-6 pt-6 pb-7 border-2 border-slate-300 border-dashed rounded-xl hover:border-brand-400 transition-colors bg-slate-50/50 group">
                                                        <div className="space-y-2 text-center">
                                                            <ImageIcon className="mx-auto h-12 w-12 text-slate-400 group-hover:text-brand-500 transition-colors" />
                                                            <div className="flex text-sm text-slate-600 justify-center">
                                                                <label className="relative cursor-pointer rounded-md font-semibold text-brand-600 hover:text-brand-500 focus-within:outline-none">
                                                                    <span>Upload files</span>
                                                                    <input type="file" multiple className="sr-only" accept="image/png,image/jpeg,image/jpg" onChange={handleFileChange} />
                                                                </label>
                                                                <p className="pl-1">or drag and drop</p>
                                                            </div>
                                                            <p className="text-xs text-slate-500 font-medium">PNG, JPG up to 10MB</p>
                                                        </div>
                                                    </div>
                                                    
                                                    {files.length > 0 && (
                                                        <div className="mt-4">
                                                            <h4 className="text-sm font-semibold text-slate-700 mb-2">Selected files ({files.length}):</h4>
                                                            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                                {files.map((f, index) => (
                                                                    <li key={index} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square">
                                                                        <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-full object-cover" />
                                                                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                                                            <button 
                                                                                type="button" 
                                                                                onClick={() => removeFile(index)} 
                                                                                className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 focus:outline-none transform scale-90 group-hover:scale-100 transition-all shadow-lg"
                                                                            >
                                                                                <X size={16} strokeWidth={2.5} />
                                                                            </button>
                                                                        </div>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="bg-slate-50 px-4 py-4 sm:px-6 sm:flex sm:flex-row-reverse -mx-4 sm:-mx-6 rounded-b-2xl mt-8 border-t border-slate-100">
                                                    <button
                                                        type="submit"
                                                        disabled={uploading}
                                                        className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-6 py-2.5 bg-brand-600 text-[15px] font-semibold text-white hover:bg-brand-700 focus:outline-none sm:ml-3 sm:w-auto transition-all disabled:opacity-50 disabled:hover:bg-brand-600"
                                                    >
                                                        {uploading ? 'Submitting...' : 'Submit Ticket'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsCreateModalOpen(false)}
                                                        className="mt-3 w-full inline-flex justify-center rounded-xl border border-slate-300 shadow-sm px-6 py-2.5 bg-white text-[15px] font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto transition-all"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* Details Drawer */}
                {selectedTicket && createPortal(
                    <div className="fixed inset-0 z-50 overflow-hidden">
                        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={() => setSelectedTicket(null)}></div>
                        <div className="fixed inset-y-0 right-0 max-w-full flex">
                            <div className="w-screen max-w-2xl transform transition-transform bg-white shadow-2xl flex flex-col h-full">
                                {/* Header */}
                                <div className="relative px-6 pt-5 pb-4 border-b border-slate-200 bg-gradient-to-br from-white via-white to-slate-50">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2.5 flex-wrap">
                                                <span className="text-[11px] font-bold tracking-wider text-white bg-gradient-to-br from-brand-500 to-brand-700 px-2.5 py-1 rounded-lg shadow-sm">{selectedTicket.ticketId}</span>
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
                                        {selectedTicket.screenshots.map((screenshotUrl, index) => (
                                            <a
                                                key={index}
                                                href={screenshotUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-brand-50 hover:border-brand-200 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium transition-all hover:-translate-y-px hover:shadow-sm"
                                            >
                                                <ImageIcon size={12} className="text-slate-400" />
                                                {attachmentLabel(screenshotUrl, index)}
                                            </a>
                                        ))}
                                    </div>
                                )}

                                {/* Conversation */}
                                <div className="flex-1 overflow-y-auto px-6 py-6 bg-gradient-to-b from-slate-50/60 via-white to-white">
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
                                                                    ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white'
                                                                    : 'bg-gradient-to-br from-slate-500 to-slate-700 text-white'
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

                                                            <div className={`px-4 py-2.5 text-[14.5px] leading-relaxed transition-shadow ${
                                                                item.isUser
                                                                    ? `bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-md shadow-brand-500/20 rounded-2xl ${isLastOfRun ? 'rounded-br-md' : ''} ${!isFirstOfRun ? 'rounded-tr-md' : ''}`
                                                                    : `bg-white text-slate-800 border border-slate-200/80 shadow-sm rounded-2xl ${isLastOfRun ? 'rounded-bl-md' : ''} ${!isFirstOfRun ? 'rounded-tl-md' : ''}`
                                                            }`}>
                                                                <p className="whitespace-pre-wrap break-words">{item.message}</p>
                                                            </div>

                                                            {Array.isArray(item.attachments) && item.attachments.length > 0 && item.kind !== 'description' && (
                                                                <div className={`mt-2 flex flex-wrap gap-1.5 ${item.isUser ? 'justify-end' : 'justify-start'}`}>
                                                                    {item.attachments.map((attUrl, aIdx) => (
                                                                        <a key={aIdx} href={attUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-brand-50 hover:border-brand-200 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium transition-all">
                                                                            <ImageIcon size={12} className="text-slate-400" />
                                                                            {attachmentLabel(attUrl, aIdx)}
                                                                        </a>
                                                                    ))}
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
                                                        <p className="text-slate-500">Please create a new ticket if you need further assistance.</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        handleCreateClick();
                                                        setSelectedTicket(null);
                                                    }}
                                                    className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white rounded-xl transition-all font-semibold shadow-md shadow-brand-500/20 text-sm"
                                                >
                                                    <Plus size={16} />
                                                    New Ticket
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
                                                className="w-11 h-11 shrink-0 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all shadow-md shadow-brand-500/30 hover:shadow-lg hover:shadow-brand-500/40 active:scale-95"
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
