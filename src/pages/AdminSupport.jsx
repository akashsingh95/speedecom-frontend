import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useAuth } from '../AuthContext';
import api from '../api';
import DashboardLayout from '../components/DashboardLayout';
import { Headphones, X, MessageSquare, Paperclip, CheckCircle2, Clock, AlertCircle, Send, Image as ImageIcon, UserCheck, Search, ChevronDown, History, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import StarRating from '../components/StarRating';
import TicketTimeline from '../components/TicketTimeline';
import DateRangePicker from '../components/DateRangePicker';
import { getClosingTime } from '../utils/formatDuration';

const AdminSupport = () => {
    const { user } = useAuth();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState(null);

    // Reply and Update state
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

    const [statusUpdating, setStatusUpdating] = useState(false);
    const [adminUsers, setAdminUsers] = useState([]);
    const [statusFilters, setStatusFilters] = useState([]);
    const [rmFilters, setRmFilters] = useState([]);
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const statusDropdownRef = useRef(null);
    const [rmDropdownOpen, setRmDropdownOpen] = useState(false);
    const rmDropdownRef = useRef(null);
    const [developerFilters, setDeveloperFilters] = useState([]);
    const [developerDropdownOpen, setDeveloperDropdownOpen] = useState(false);
    const developerDropdownRef = useRef(null);
    const [developers, setDevelopers] = useState([]);
    const [closingStats, setClosingStats] = useState([]);
    const [statsPeriod, setStatsPeriod] = useState('today');
    const [statsLoading, setStatsLoading] = useState(true);
    const [filterType, setFilterType] = useState('none');
    const [sortOrder, setSortOrder] = useState('desc');
    const [dateRanges, setDateRanges] = useState({ created: { start: '', end: '' }, closed: { start: '', end: '' } });
    const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
    const dateFilterRef = useRef(null);
    const filterTypeRef = useRef(filterType);
    const dateRangesRef = useRef(dateRanges);
    useEffect(() => {
        filterTypeRef.current = filterType;
    }, [filterType]);
    useEffect(() => {
        dateRangesRef.current = dateRanges;
    }, [dateRanges]);
    const dropPosRef = useRef({ top: 0, left: 0 });
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [showTimelineModal, setShowTimelineModal] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalTickets, setTotalTickets] = useState(0);
    const [gotoInput, setGotoInput] = useState('');
    const [gotoError, setGotoError] = useState(false);

    useEffect(() => {
        setPage(1);
    }, [statusFilters, rmFilters, developerFilters, filterType, debouncedSearchTerm, sortOrder]);

    useEffect(() => {
        fetchTickets();
    }, [statusFilters, rmFilters, developerFilters, filterType, dateRanges.created.start, dateRanges.created.end, dateRanges.closed.start, dateRanges.closed.end, debouncedSearchTerm, sortOrder, page]);

    // Close date filter dropdown on outside click
    useEffect(() => {
        const handleClick = (e) => {
            if (dateFilterRef.current && !dateFilterRef.current.contains(e.target)) {
                setDateDropdownOpen(false);
                const ft = filterTypeRef.current;
                const dr = dateRangesRef.current;
                if (ft !== 'none' && (!dr[ft]?.start || !dr[ft]?.end)) {
                    const localToday = new Date();
                    const today = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, '0')}-${String(localToday.getDate()).padStart(2, '0')}`;
                    setDateRanges(prev => ({
                        ...prev,
                        [ft]: { start: today, end: today }
                    }));
                }
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    useEffect(() => {
        const delay = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);
        return () => clearTimeout(delay);
    }, [searchTerm]);

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
        if (!rmDropdownOpen) return;
        const handleClick = (e) => {
            if (rmDropdownRef.current && !rmDropdownRef.current.contains(e.target)) {
                setRmDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [rmDropdownOpen]);

    useEffect(() => {
        if (!developerDropdownOpen) return;
        const handleClick = (e) => {
            if (developerDropdownRef.current && !developerDropdownRef.current.contains(e.target)) {
                setDeveloperDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [developerDropdownOpen]);

    const toggleStatus = (s) => setStatusFilters(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    const toggleRM = (id) => setRmFilters(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    const toggleDeveloper = (email) => setDeveloperFilters(prev => prev.includes(email) ? prev.filter(x => x !== email) : [...prev, email]);
    const clearAllFilters = () => {
        setStatusFilters([]);
        setRmFilters([]);
        setDeveloperFilters([]);
        setFilterType('none');
        setDateRanges({ created: { start: '', end: '' }, closed: { start: '', end: '' } });
        setDateDropdownOpen(false);
        setSortOrder('desc');
    };

    useEffect(() => {
        const delay = setTimeout(() => {
            const p = parseInt(gotoInput, 10);
            if (gotoInput && (p < 1 || p > totalPages)) setGotoError(true);
            else { setGotoError(false); if (p >= 1 && p <= totalPages) setPage(p); }
        }, 400);
        return () => clearTimeout(delay);
    }, [gotoInput, totalPages]);

    useEffect(() => {
        if (user && (user.role === 'SuperAdmin' || user.role === 'SBM')) {
            fetchClosingStats();
        }
    }, [statsPeriod, user]);

    useEffect(() => {
        if (user && (user.role === 'SuperAdmin' || user.role === 'SBM')) {
            fetchAdminUsers();
        }
        fetchDevelopers();
    }, [user]);

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

    const fetchAdminUsers = async () => {
        try {
            const res = await api.get('/auth/admin-users', { params: { scope: 'all' } });
            const data = res.data?.data || res.data || {};
            const rms = data.rmUsers || [];
            setAdminUsers(rms);
        } catch (error) {
            console.error("Failed to load admin users", error);
        }
    };

    const fetchClosingStats = async () => {
        try {
            setStatsLoading(true);
            const params = { period: statsPeriod };
            const res = await api.get('/support/stats', { params });
            const data = res.data || [];
            setClosingStats(data);
        } catch (error) {
            console.error("Failed to load closing stats", error);
        } finally {
            setStatsLoading(false);
        }
    };

    const fetchTickets = async () => {
        // Don't fetch if filter type is selected but no date range is set
        if (filterType !== 'none' && (!dateRanges[filterType]?.start || !dateRanges[filterType]?.end)) return;
        try {
            setLoading(true);
            const params = { page, limit: 20 };
            if (statusFilters.length > 0) params.status = statusFilters.join(',');
            if (rmFilters.length > 0) params.assignedRM = rmFilters.join(',');
            if (developerFilters.length > 0) params.assignedDeveloper = developerFilters.join(',');
            if (filterType === 'created') {
                if (dateRanges.created.start) params.createdAtStart = dateRanges.created.start;
                if (dateRanges.created.end) params.createdAtEnd = dateRanges.created.end;
            }
            if (filterType === 'closed') {
                if (dateRanges.closed.start) params.closedAtStart = dateRanges.closed.start;
                if (dateRanges.closed.end) params.closedAtEnd = dateRanges.closed.end;
            }
            if (debouncedSearchTerm) params.search = debouncedSearchTerm;
            params.sortOrder = sortOrder;
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

    const handleStatusUpdate = async (newStatus) => {
        try {
            setStatusUpdating(true);
            await api.patch(`/support/${selectedTicket._id}`, { status: newStatus });
            toast.success("Status updated");
            fetchTicketDetails(selectedTicket._id);
            fetchTickets(); // refresh list
        } catch (error) {
            toast.error("Failed to update status");
        } finally {
            setStatusUpdating(false);
        }
    };

    const handleAssigneeUpdate = async (newAssigneeId) => {
        try {
            setStatusUpdating(true);
            await api.patch(`/support/${selectedTicket._id}`, { assignedRM: newAssigneeId || null });
            toast.success("Assignee updated");
            fetchTicketDetails(selectedTicket._id);
            fetchTickets();
        } catch (error) {
            toast.error("Failed to update assignee");
        } finally {
            setStatusUpdating(false);
        }
    };

    const fetchDevelopers = async () => {
        try {
            const res = await api.get('/support/developers');
            setDevelopers(res.data?.data || res.data || []);
        } catch (error) {
            console.error("Failed to load developers", error);
        }
    };

    const handleDeveloperUpdate = async (newDevEmail) => {
        try {
            setStatusUpdating(true);
            await api.patch(`/support/${selectedTicket._id}`, { assignedDeveloper: newDevEmail || null });
            toast.success("Developer assignment updated");
            fetchTicketDetails(selectedTicket._id);
            fetchTickets();
        } catch (error) {
            toast.error("Failed to update developer assignment");
        } finally {
            setStatusUpdating(false);
        }
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

    // Status badge style for the bold status pill in the drawer header.
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

    // Group day-label for date dividers in the conversation.
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

    // Synthesize a clean attachment label from the GCS storage path.
    // Stored paths are `support-screenshots/<scope>/<timestamp>-<uuid>.<ext>`, so the
    // raw filename isn't user-friendly — show "Screenshot N.<ext>" instead.
    const attachmentLabel = (url, index) => {
        const base = String(url || '').split('?')[0].split('/').pop() || '';
        const ext = (base.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
        return `screenshot_${String(index + 1).padStart(2, '0')}${ext ? '.' + ext : ''}`;
    };

    // Build a chronological item list combining the original description (as the opening
    // tenant-side bubble) with all messages, then group consecutive items by day.
    const buildConversationGroups = (ticket) => {
        if (!ticket) return [];
        const items = [];
        if (ticket.description) {
            items.push({
                _key: 'description',
                kind: 'description',
                isAdmin: false,
                senderName: ticket.createdBy?.fullName || 'Tenant',
                message: ticket.description,
                attachments: ticket.screenshots || [],
                createdAt: ticket.createdAt,
            });
        }
        if (Array.isArray(ticket.messages)) {
            for (let i = 0; i < ticket.messages.length; i++) {
                const m = ticket.messages[i];
                const isAdmin = !(m.senderId?.role === 'User' || m.senderId?.role === 'Admin');
                items.push({
                    _key: `msg-${i}`,
                    kind: 'message',
                    isAdmin,
                    senderName: m.senderId?.fullName || (isAdmin ? 'Support Team' : 'Tenant'),
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

    const isAssignedToMe = selectedTicket?.assignedRM?._id === user?._id;
    const canBeAssignee = user && ['SuperAdmin', 'SBM', 'RM'].includes(user.role);
    const canManageAssignment = user && ['SuperAdmin', 'SBM'].includes(user.role);

    return (
        <><DashboardLayout>
            <div className="p-6 lg:p-8 overflow-y-auto h-full custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* ═══════════════ HERO HEADER ═══════════════ */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-blue-800 rounded-2xl p-7 text-white shadow-lg mb-6">
                        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl"></div>
                        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm border border-white/10">
                                    <Headphones size={20} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold tracking-tight">Support Tickets (Admin)</h1>
                                    <p className="mt-1 text-sm text-blue-100">Manage and respond to tenant support requests.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                {/* Stats — SuperAdmin/SBM only */}
                {(user?.role === 'SuperAdmin' || user?.role === 'SBM') && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden mb-4">
                        <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-600">Avg Closing Time</span>
                            {['today', '3d', '7d', '30d'].map(p => (
                                <button
                                    key={p}
                                    onClick={() => { setStatsPeriod(p); }}
                                    className={`text-xs font-semibold px-3 py-1 rounded-full transition-all ${
                                        statsPeriod === p
                                            ? 'bg-brand-600 text-white shadow-sm'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {p === 'today' ? 'Today' : `${p}`}
                                </button>
                            ))}
                        </div>
                        {statsLoading ? (
                            <div className="px-6 py-4 text-sm text-slate-400">Loading...</div>
                        ) : closingStats.length === 0 ? (
                            <div className="px-6 py-4 text-sm text-slate-400">No closed tickets in this period.</div>
                        ) : (
                            <div className="px-6 py-4 flex gap-4 overflow-x-auto">
                                {(() => {
                                    const filtered = rmFilters.length === 0
                                        ? closingStats
                                        : closingStats.filter(s => rmFilters.includes(s.rmId));

                                    if (filtered.length === 0) {
                                        return <div className="text-sm text-slate-400">No stats for selected RM(s) in this period.</div>;
                                    }

                                    const cards = filtered.map(stat => (
                                        <div key={stat.rmId} className="min-w-[160px] bg-slate-50 rounded-xl border border-slate-200 p-4">
                                            <p className="text-sm font-semibold text-slate-800 truncate">{stat.rmName}</p>
                                            <p className="text-lg font-bold text-brand-600 mt-1">{stat.avgDuration}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">{stat.count} ticket{stat.count !== 1 ? 's' : ''} closed</p>
                                        </div>
                                    ));

                                    if (filtered.length > 1) {
                                        const totalCount = filtered.reduce((s, x) => s + x.count, 0);
                                        const totalAvgMs = filtered.reduce((s, x) => {
                                            const parts = x.avgDuration.match(/(\d+)([dhm])/g) || [];
                                            let ms = 0;
                                            for (const p of parts) {
                                                const n = parseInt(p);
                                                if (p.includes('d')) ms += n * 86400000;
                                                else if (p.includes('h')) ms += n * 3600000;
                                                else if (p.includes('m')) ms += n * 60000;
                                            }
                                            return s + ms * x.count;
                                        }, 0) / totalCount;
                                        const totalMin = Math.floor(totalAvgMs / 60000);
                                        const d = Math.floor(totalMin / 1440);
                                        const h = Math.floor((totalMin % 1440) / 60);
                                        const m = totalMin % 60;
                                        const parts = [];
                                        if (d > 0) parts.push(`${d}d`);
                                        if (h > 0) parts.push(`${h}h`);
                                        if (m > 0 && d === 0) parts.push(`${m}m`);
                                        if (parts.length === 0) parts.push('<1m');

                                        cards.unshift(
                                            <div key="overall" className="min-w-[160px] bg-brand-50 rounded-xl border border-brand-200 p-4">
                                                <p className="text-sm font-semibold text-brand-700">Overall</p>
                                                <p className="text-lg font-bold text-brand-600 mt-1">{parts.join(' ')}</p>
                                                <p className="text-xs text-brand-500 mt-0.5">{totalCount} ticket{totalCount !== 1 ? 's' : ''} closed</p>
                                            </div>
                                        );
                                    }

                                    return cards;
                                })()}
                            </div>
                )}
                </div>
                )}

                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden transition-all duration-300">
                    <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center gap-4">
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
                        {(user?.role === 'SuperAdmin' || user?.role === 'SBM') && (
                            <div className="relative" ref={rmDropdownRef}>
                                <button
                                    onClick={() => setRmDropdownOpen(o => !o)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors ${rmFilters.length > 0 ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50 shadow-sm'}`}
                                >
                                    <span className="text-xs">{rmFilters.length === 0 ? 'Assigned RM' : `${rmFilters.length} RM${rmFilters.length > 1 ? 's' : ''} selected`}</span>
                                    <ChevronDown size={13} className={rmFilters.length > 0 ? 'text-cyan-500' : 'text-slate-400'} />
                                </button>
                                {rmDropdownOpen && (
                                    <div className="absolute left-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg min-w-[210px] max-h-64 overflow-y-auto">
                                        <label className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 cursor-pointer text-sm text-slate-700 border-b border-slate-100">
                                            <input type="checkbox" checked={rmFilters.includes('unassigned')} onChange={() => toggleRM('unassigned')} className="rounded accent-brand-600" />
                                            <span className="font-medium">Unassigned</span>
                                        </label>
                                        {Array.isArray(adminUsers) && adminUsers.map(rm => (
                                            <label key={rm._id} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 cursor-pointer text-sm text-slate-700">
                                                <input type="checkbox" checked={rmFilters.includes(rm._id)} onChange={() => toggleRM(rm._id)} className="rounded accent-brand-600" />
                                                <span>{rm.fullName}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {(user?.role === 'SuperAdmin' || user?.role === 'SBM') && (
                            <div className="relative" ref={developerDropdownRef}>
                                <button
                                    onClick={() => setDeveloperDropdownOpen(o => !o)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors ${developerFilters.length > 0 ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50 shadow-sm'}`}
                                >
                                    <span className="text-xs">{developerFilters.length === 0 ? 'Developer' : `${developerFilters.length} dev${developerFilters.length > 1 ? 's' : ''} selected`}</span>
                                    <ChevronDown size={13} className={developerFilters.length > 0 ? 'text-violet-500' : 'text-slate-400'} />
                                </button>
                                {developerDropdownOpen && (
                                    <div className="absolute left-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg min-w-[185px] max-h-64 overflow-y-auto">
                                        <label className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 cursor-pointer text-sm text-slate-700 border-b border-slate-100">
                                            <input type="checkbox" checked={developerFilters.includes('unassigned')} onChange={() => toggleDeveloper('unassigned')} className="rounded accent-brand-600" />
                                            <span className="font-medium">Unassigned</span>
                                        </label>
                                        {Array.isArray(developers) && developers.map(dev => (
                                            <label key={dev.email} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 cursor-pointer text-sm text-slate-700">
                                                <input type="checkbox" checked={developerFilters.includes(dev.email)} onChange={() => toggleDeveloper(dev.email)} className="rounded accent-brand-600" />
                                                <span>{dev.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {(user?.role === 'SuperAdmin' || user?.role === 'SBM') && (
                            <div className="relative">
                                <select
                                    value={sortOrder}
                                    onChange={(e) => setSortOrder(e.target.value)}
                                    className={`appearance-none pl-3 pr-7 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-colors focus:outline-none cursor-pointer ${sortOrder !== 'desc' ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50 shadow-sm'}`}
                                >
                                    <option value="desc">Newest first</option>
                                    <option value="asc">Oldest first</option>
                                </select>
                                <ChevronDown size={13} className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${sortOrder !== 'desc' ? 'text-teal-500' : 'text-slate-400'}`} />
                            </div>
                        )}
                        <div className="relative" ref={dateFilterRef}>
                            <button
                                onClick={() => {
                                    if (!dateDropdownOpen) {
                                        if (filterType === 'none') setFilterType('created');
                                        const btn = dateFilterRef.current?.querySelector('button');
                                        if (btn) {
                                            const rect = btn.getBoundingClientRect();
                                            const spaceBelow = window.innerHeight - rect.bottom;
                                            const up = spaceBelow < 350;
                                            dropPosRef.current = {
                                                top: up ? rect.top - 8 : rect.bottom + 4,
                                                left: rect.left
                                            };
                                        }
                                    }
                                    setDateDropdownOpen(!dateDropdownOpen);
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors ${filterType !== 'none' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50 shadow-sm'}`}
                            >
                                <span className="text-xs flex-1 text-left truncate">
                                    {filterType !== 'none' && dateRanges[filterType]?.start && dateRanges[filterType]?.end
                                        ? `${filterType === 'created' ? 'Created' : 'Closed'}: ${dateRanges[filterType].start} – ${dateRanges[filterType].end}`
                                        : filterType === 'created' ? 'Created At' : filterType === 'closed' ? 'Closed At' : 'Date'}
                                </span>
                                {filterType !== 'none' ? (
                                    <span
                                        onClick={(e) => { e.stopPropagation(); setFilterType('none'); setDateRanges({ created: { start: '', end: '' }, closed: { start: '', end: '' } }); setDateDropdownOpen(false); }}
                                        className="p-0.5 rounded hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600 shrink-0"
                                    >✕</span>
                                ) : (
                                    <ChevronDown size={13} className="text-slate-400 shrink-0" />
                                )}
                            </button>
                            {dateDropdownOpen && (
                                <div
                                    className="bg-white border border-slate-200 rounded-lg shadow-sm min-w-[280px]"
                                    style={{ position: 'fixed', top: dropPosRef.current.top, left: dropPosRef.current.left, zIndex: 9999 }}
                                >
                                    <div className="flex border-b border-slate-100">
                                        {(['created', 'closed']).map((type) => (
                                            <div
                                                key={type}
                                                onClick={() => { setFilterType(type); }}
                                                className={`flex-1 px-3 py-2 text-sm cursor-pointer text-center transition-colors ${filterType === type ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                                            >
                                                {type === 'created' ? 'Created At' : 'Closed At'}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="p-2">
                                        <DateRangePicker
                                            startDate={dateRanges[filterType]?.start || ''}
                                            endDate={dateRanges[filterType]?.end || ''}
                                            onChange={(v) => {
                                                setDateRanges(prev => ({
                                                    ...prev,
                                                    [filterType]: { start: v.min, end: v.max }
                                                }));
                                                if (v.max) setDateDropdownOpen(false);
                                            }}
                                            hideDisplayChip
                                            maxDays={365}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search tickets..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition-all placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    {/* Active filter chips */}
                    {(statusFilters.length > 0 || rmFilters.length > 0 || developerFilters.length > 0 || sortOrder !== 'desc' || (filterType !== 'none' && dateRanges[filterType]?.start && dateRanges[filterType]?.end)) && (
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
                            {rmFilters.map(id => {
                                const label = id === 'unassigned' ? 'Unassigned' : adminUsers.find(u => u._id === id)?.fullName || 'RM';
                                return (
                                    <div key={id} className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-50 border border-cyan-200 rounded-lg text-xs font-medium text-cyan-700 shadow-sm">
                                        RM: {label}
                                        <button onClick={() => toggleRM(id)} className="p-0.5 hover:bg-cyan-100 rounded transition-colors"><X size={11} /></button>
                                    </div>
                                );
                            })}
                            {developerFilters.map(email => {
                                const label = email === 'unassigned' ? 'Unassigned' : developers.find(d => d.email === email)?.name || email;
                                return (
                                    <div key={email} className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-50 border border-violet-200 rounded-lg text-xs font-medium text-violet-700 shadow-sm">
                                        Dev: {label}
                                        <button onClick={() => toggleDeveloper(email)} className="p-0.5 hover:bg-violet-100 rounded transition-colors"><X size={11} /></button>
                                    </div>
                                );
                            })}
                            {filterType !== 'none' && dateRanges[filterType]?.start && dateRanges[filterType]?.end && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-medium text-indigo-700 shadow-sm">
                                    {filterType === 'created' ? 'Created' : 'Closed'}: {dateRanges[filterType].start} – {dateRanges[filterType].end}
                                    <button onClick={() => { setFilterType('none'); setDateRanges({ created: { start: '', end: '' }, closed: { start: '', end: '' } }); }} className="p-0.5 hover:bg-indigo-100 rounded transition-colors"><X size={11} /></button>
                                </div>
                            )}
                            {sortOrder !== 'desc' && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 border border-teal-200 rounded-lg text-xs font-medium text-teal-700 shadow-sm">
                                    Sort: Oldest first
                                    <button onClick={() => setSortOrder('desc')} className="p-0.5 hover:bg-teal-100 rounded transition-colors"><X size={11} /></button>
                                </div>
                            )}
                            {(statusFilters.length + rmFilters.length + developerFilters.length + (filterType !== 'none' && dateRanges[filterType]?.start ? 1 : 0) + (sortOrder !== 'desc' ? 1 : 0)) >= 2 && (
                                <button onClick={clearAllFilters} className="text-xs font-semibold text-brand-600 hover:text-brand-800 underline decoration-brand-300 underline-offset-2 ml-1 transition-colors">Clear all</button>
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
                                <MessageSquare className="w-10 h-10 text-slate-400" />
                            </div>
                            <div className="text-center">
                                <h3 className="font-semibold text-slate-700">{statusFilters.length === 0 && rmFilters.length === 0 && developerFilters.length === 0 ? 'No tickets found' : 'No tickets match these filters'}</h3>
                                <p className="mt-1 text-sm text-slate-500">{statusFilters.length === 0 && rmFilters.length === 0 && developerFilters.length === 0 ? 'There are no active support tickets at the moment.' : 'Try adjusting the filters.'}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-100/60">
                                        <th className="py-3.5 px-6 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ticket ID</th>
                                        <th className="py-3.5 px-6 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider w-[200px] max-w-[200px]">Tenant</th>
                                        <th className="py-3.5 px-6 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider w-[240px] max-w-[240px]">Title</th>
                                        <th className="py-3.5 px-6 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Assigned RM</th>
                                        <th className="py-3.5 px-6 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="py-3.5 px-6 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rating</th>
                                        <th className="py-3.5 px-6 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Closing Time</th>
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
                                            <td className="px-6 py-4 text-sm text-slate-700 w-[200px] max-w-[200px]">
                                                <div className="font-medium line-clamp-1">
                                                    {ticket.tenantId ? `${ticket.tenantId.tenantId} - ${ticket.tenantId.name}` : 'Unknown Tenant'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-700 w-[240px] max-w-[240px]">
                                                <div className="font-medium line-clamp-1">{ticket.title}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {ticket.assignedRM?.fullName ? (
                                                    <span className="text-slate-700 font-medium">{ticket.assignedRM.fullName}</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-red-50 text-red-700 border border-red-200">Unassigned</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-md border ${getStatusColor(ticket.status)}`}>
                                                    {ticket.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {ticket.rating?.stars ? (
                                                    <StarRating value={ticket.rating.stars} readOnly size={14} />
                                                ) : ['Resolved', 'Closed'].includes(ticket.status) ? (
                                                    <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Awaiting</span>
                                                ) : (
                                                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Pending</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {['Resolved', 'Closed'].includes(ticket.status) ? (
                                                    <span className="text-slate-700 font-medium">
                                                        {getClosingTime(ticket)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">Active</span>
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
                                                    Respond
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

                </div>

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
                                                    <span>Created by <span className="font-semibold text-slate-700">{selectedTicket.createdBy?.fullName}</span> on <span className="font-semibold text-slate-700">{new Date(selectedTicket.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span></span>
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-slate-700 p-2 rounded-full hover:bg-slate-100 transition-colors shrink-0">
                                            <X size={20} />
                                        </button>
                                    </div>
                                </div>

                                {/* Info strip */}
                                <div className="px-6 py-2 bg-slate-50/80 border-b border-slate-200 flex items-center gap-3 flex-wrap text-xs">
                                    <div className="inline-flex items-center gap-1.5">
                                        <span className="text-slate-500 font-semibold">Priority</span>
                                        <span className={`inline-flex items-center gap-1 font-bold ${getPriorityTextColor(selectedTicket.priority)}`}>
                                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                            {selectedTicket.priority}
                                        </span>
                                    </div>
                                    {selectedTicket.tenantId?.name && (
                                        <>
                                            <span className="h-3 w-px bg-slate-300"></span>
                                            <div className="inline-flex items-center gap-1.5">
                                                <span className="text-slate-500 font-semibold">Tag</span>
                                                <span className="font-bold text-slate-800">{selectedTicket.tenantId.tenantId} - {selectedTicket.tenantId.name}</span>
                                            </div>
                                        </>
                                    )}
                                    <span className="h-3 w-px bg-slate-300"></span>
                                    <div className="inline-flex items-center gap-1.5">
                                        <span className="text-slate-500 font-semibold">Category</span>
                                        <span className="font-bold text-slate-800">Tenant Support</span>
                                    </div>
                                    <span className="h-3 w-px bg-slate-300"></span>
                                    <button
                                            onClick={(e) => { e.stopPropagation(); setShowTimelineModal(true); }}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-brand-50 hover:border-brand-200 border border-slate-200 rounded-lg transition-all hover:-translate-y-px hover:shadow-sm active:scale-95 cursor-pointer"
                                        >
                                            <History size={14} className="text-slate-500" />
                                            <span className="text-xs font-semibold text-slate-700">Timeline</span>
                                        </button>
                                        {selectedTicket.rating?.note && (
                                            <>
                                                <span className="h-3 w-px bg-slate-300"></span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setShowRatingModal(true); }}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-brand-50 hover:border-brand-200 border border-slate-200 rounded-lg transition-all hover:-translate-y-px hover:shadow-sm active:scale-95 cursor-pointer"
                                                >
                                                    <span className="text-xs font-semibold text-slate-700">See Review</span>
                                                </button>
                                            </>
                                        )}
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
                                                const isFirstOfRun = !prev || prev.isAdmin !== item.isAdmin;
                                                const next = mIdx < group.items.length - 1 ? group.items[mIdx + 1] : null;
                                                const isLastOfRun = !next || next.isAdmin !== item.isAdmin;
                                                return (
                                                    <div key={item._key} className={`flex items-end gap-2.5 ${item.isAdmin ? 'flex-row-reverse' : ''} ${isFirstOfRun ? 'mt-4' : 'mt-1'}`}>
                                                        {/* Avatar (only on last bubble of a run) */}
                                                        {isLastOfRun ? (
                                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shadow-md ring-2 ring-white shrink-0 ${
                                                                item.isAdmin
                                                                    ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white'
                                                                    : 'bg-gradient-to-br from-slate-500 to-slate-700 text-white'
                                                            }`}>
                                                                {item.isAdmin ? 'ST' : getInitials(item.senderName)}
                                                            </div>
                                                        ) : (
                                                            <div className="w-9 shrink-0" />
                                                        )}

                                                        <div className={`flex flex-col max-w-[78%] ${item.isAdmin ? 'items-end' : 'items-start'}`}>
                                                            {isFirstOfRun && (
                                                                <span className={`text-[11px] font-bold uppercase tracking-wider mb-1 px-1 inline-flex items-center gap-1 ${item.isAdmin ? 'text-brand-700' : 'text-slate-500'}`}>
                                                                    {item.isAdmin && <CheckCircle2 size={11} className="text-brand-500" />}
                                                                    {item.senderName}
                                                                </span>
                                                            )}

                                                            <div className={`px-4 py-2.5 text-[14.5px] leading-relaxed transition-shadow ${
                                                                item.isAdmin
                                                                    ? `bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-md shadow-brand-500/20 rounded-2xl ${isLastOfRun ? 'rounded-br-md' : ''} ${!isFirstOfRun ? 'rounded-tr-md' : ''}`
                                                                    : `bg-white text-slate-800 border border-slate-200/80 shadow-sm rounded-2xl ${isLastOfRun ? 'rounded-bl-md' : ''} ${!isFirstOfRun ? 'rounded-tl-md' : ''}`
                                                            }`}>
                                                                <p className="whitespace-pre-wrap break-words">{item.message}</p>
                                                            </div>

                                                            {Array.isArray(item.attachments) && item.attachments.length > 0 && item.kind !== 'description' && (
                                                                <div className={`mt-2 flex flex-wrap gap-1.5 ${item.isAdmin ? 'justify-end' : 'justify-start'}`}>
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

                                {/* Reply + Actions footer */}
                                <div className="border-t border-slate-200 bg-white">
                                    <div className="px-4 pt-4 pb-3">
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
                                                    placeholder="Type your response to the tenant..."
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
                                    </div>
                                    <div className="px-4 pb-4 pt-1 flex items-center justify-end gap-2 flex-wrap border-t border-slate-100">
                                        {canManageAssignment && (
                                            <select
                                                value={selectedTicket.assignedRM?._id || ''}
                                                onChange={(e) => handleAssigneeUpdate(e.target.value)}
                                                disabled={statusUpdating}
                                                title="Reassign ticket"
                                                className={`text-xs font-semibold rounded-lg border-slate-300 bg-white focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 shadow-sm transition-all ${statusUpdating ? 'opacity-50' : ''}`}
                                            >
                                                <option value="">Unassigned</option>
                                                {Array.isArray(adminUsers) && adminUsers.map(admin => (
                                                    <option key={admin._id} value={admin._id}>{admin.fullName} ({admin.role})</option>
                                                ))}
                                            </select>
                                        )}
                                        <select
                                            value={selectedTicket.assignedDeveloper || ''}
                                            onChange={(e) => handleDeveloperUpdate(e.target.value)}
                                            disabled={statusUpdating}
                                            title="Assign Dev"
                                            className={`text-xs font-semibold rounded-lg border-slate-300 bg-white focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 shadow-sm transition-all ${statusUpdating ? 'opacity-50' : ''}`}
                                        >
                                            <option value="">Unassigned</option>
                                            {Array.isArray(developers) && developers.map(dev => (
                                                <option key={dev.email} value={dev.email}>{dev.name}</option>
                                            ))}
                                            {selectedTicket.assignedDeveloper && !developers.find(d => d.email === selectedTicket.assignedDeveloper) && (
                                                <option value={selectedTicket.assignedDeveloper}>
                                                    {selectedTicket.assignedDeveloper}
                                                </option>
                                            )}
                                        </select>
                                        <select
                                            value={selectedTicket.status}
                                            onChange={(e) => handleStatusUpdate(e.target.value)}
                                            disabled={statusUpdating}
                                            title="Change status"
                                            className={`text-xs font-semibold rounded-lg border-slate-300 bg-white focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 shadow-sm transition-all ${statusUpdating ? 'opacity-50' : ''}`}
                                        >
                                            <option value="Open">Open</option>
                                            <option value="In Progress">In Progress</option>
                                            <option value="Resolved">Resolved</option>
                                            <option value="Closed">Closed</option>
                                        </select>
                                        {canBeAssignee && !isAssignedToMe && (
                                            <button
                                                type="button"
                                                onClick={() => handleAssigneeUpdate(user._id)}
                                                disabled={statusUpdating}
                                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 rounded-lg transition-all shadow-sm hover:shadow"
                                            >
                                                <UserCheck size={14} />
                                                Assign to Me
                                            </button>
                                        )}
                                        {user?.role !== 'RM' && selectedTicket.status !== 'Resolved' && (
                                            <button
                                                type="button"
                                                onClick={() => handleStatusUpdate('Resolved')}
                                                disabled={statusUpdating}
                                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 rounded-lg transition-all shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 active:scale-95"
                                            >
                                                <CheckCircle2 size={14} />
                                                Resolve Ticket
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
                </div>
            </div>
        </DashboardLayout>

                {showTimelineModal && selectedTicket && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowTimelineModal(false)}>
                        <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Clock size={16} className="text-brand-500" />
                                    Ticket Timeline
                                </h3>
                                <button onClick={() => setShowTimelineModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all">
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>
                            {(() => {
                                const h = selectedTicket.statusHistory;
                                const c = selectedTicket.createdAt;
                                const s = [...(h || [])].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                                if (c && (s.length === 0 || s[0].status !== 'Open')) {
                                    s.unshift({ status: 'Open', timestamp: c });
                                }
                                return (
                                    <TicketTimeline history={h} createdAt={c} />
                                );
                            })()}
                        </div>
                    </div>
                )}
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
        </>
    );
};

export default AdminSupport;
