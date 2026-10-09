/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports/components false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useEffect, useState } from 'react';
import { Calendar, CreditCard, Filter, History, Image, Layers, List, Loader2, Sparkles, Video } from 'lucide-react';
import api from '../../api';

const TYPE_DETAILS = {
    CAMPAIGN_CHARGE: { label: 'Campaign created', icon: Sparkles, color: 'bg-violet-50 text-violet-600' },
    IMAGE_CHARGE: { label: 'Image generated', icon: Image, color: 'bg-sky-50 text-sky-600' },
    VIDEO_CHARGE: { label: 'Video generated', icon: Video, color: 'bg-rose-50 text-rose-600' },
    FREE_ALLOWANCE_USE: { label: 'Free allowance used', icon: Sparkles, color: 'bg-emerald-50 text-emerald-600' },
    ADMIN_GIFT: { label: 'Admin gift', icon: CreditCard, color: 'bg-amber-50 text-amber-600' },
    ADMIN_DEDUCTION: { label: 'Admin deduction', icon: CreditCard, color: 'bg-red-50 text-red-600' },
    FREE_TRIAL_CREDIT: { label: 'Free trial credit', icon: CreditCard, color: 'bg-amber-50 text-amber-600' },
    INVOICE_CREDIT: { label: 'Invoice payment', icon: CreditCard, color: 'bg-emerald-50 text-emerald-600' },
    TRANSFER_OUT: { label: 'Credits transferred out', icon: CreditCard, color: 'bg-slate-100 text-slate-600' },
    TRANSFER_IN: { label: 'Credits transferred in', icon: CreditCard, color: 'bg-emerald-50 text-emerald-600' },
};

// Usage = actually consuming credits on a campaign/image/video. Everything else is an
// admin/financial adjustment to the wallet itself (gift, deduction, invoice credit, transfer) —
// the two are shown as separate history sections rather than one mixed "Activity" feed.
const USAGE_ROW_TYPES = ['CAMPAIGN_CHARGE', 'IMAGE_CHARGE', 'VIDEO_CHARGE', 'FREE_ALLOWANCE_USE'];
const isUsageRow = (transaction) => USAGE_ROW_TYPES.includes(transaction.type);

const formatDate = (value) => new Date(value).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const campaignLabel = (campaign) => {
    if (!campaign) return '';
    return campaign.campaignNumber != null ? `#${campaign.campaignNumber}` : campaign.campaignId;
};

// Shared row renderer for both the Usage and Adjustments tables.
const TransactionRow = ({ transaction, showCampaign, onCampaignClick }) => {
    const detail = TYPE_DETAILS[transaction.type] || TYPE_DETAILS.CAMPAIGN_CHARGE;
    const Icon = detail.icon;
    const isFree = transaction.type === 'FREE_ALLOWANCE_USE';
    const isAdminRow = transaction.type === 'ADMIN_GIFT' || transaction.type === 'ADMIN_DEDUCTION' || transaction.type === 'FREE_TRIAL_CREDIT';
    const isCountRow = isAdminRow && ['freeImages', 'freeVideos'].includes(transaction.metadata?.kind);
    const label = isAdminRow && transaction.metadata?.kind === 'freeImages'
        ? `${detail.label} · ${transaction.metadata.count || 0} free images`
        : isAdminRow && transaction.metadata?.kind === 'freeVideos'
            ? `${detail.label} · ${transaction.metadata.count || 0} free videos`
            : detail.label;

    let amountCell;
    if (isFree) {
        amountCell = <span className="text-emerald-600">Free</span>;
    } else if (isCountRow) {
        // The free-image/video count is already shown in the label above, so showing it again
        // as a signed number here (e.g. "-30") reads like a credit charge — it isn't one.
        const count = transaction.metadata?.count || 0;
        amountCell = transaction.type === 'ADMIN_DEDUCTION'
            ? null
            : <span className="text-emerald-600">+{count}</span>;
    } else if ((transaction.amount || 0) >= 0) {
        amountCell = <span className="text-emerald-600">+{Math.abs(transaction.amount || 0)}</span>;
    } else if (transaction.type === 'ADMIN_DEDUCTION') {
        amountCell = <span className="text-red-600">-{Math.abs(transaction.amount || 0)}</span>;
    } else {
        amountCell = <span className="text-slate-800">-{Math.abs(transaction.amount || 0)}</span>;
    }

    return (
        <tr className="hover:bg-slate-50/70">
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${detail.color}`}><Icon size={16} /></div>
                    <div>
                        <span className="font-semibold text-slate-800">{label}</span>
                        {isAdminRow && transaction.metadata?.adminName && <p className="text-xs text-slate-500 mt-0.5">by {transaction.metadata.adminName}</p>}
                        {/* Reconciliation's own history (CreditsTab.jsx) already shows this note — it
                            was stored here too but never rendered. */}
                        {transaction.metadata?.note && <p className="text-xs text-slate-400 mt-0.5 italic">{transaction.metadata.note}</p>}
                    </div>
                </div>
            </td>
            {showCampaign && (
                <td className="px-6 py-4 text-slate-600 text-xs">
                    {transaction.campaign
                        ? <button type="button" onClick={() => onCampaignClick(transaction.campaign.campaignId)} className="font-semibold text-violet-700 hover:underline text-left">{campaignLabel(transaction.campaign)}</button>
                        : <span className="text-slate-300">—</span>}
                </td>
            )}
            <td className="px-6 py-4 font-bold">{amountCell}</td>
            <td className="px-6 py-4 text-slate-500 whitespace-nowrap text-xs"><span className="inline-flex items-center gap-1.5"><Calendar size={13} />{formatDate(transaction.createdAt)}</span></td>
        </tr>
    );
};

const TransactionsTable = ({ transactions, showCampaign, onCampaignClick, emptyLabel }) => {
    if (transactions.length === 0) {
        return <div className="py-16 text-center"><History className="text-slate-200 mx-auto mb-3" size={40} /><p className="text-slate-400 font-medium">{emptyLabel}</p></div>;
    }
    return (
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wide border-b border-slate-100">
                <tr>
                    <th className="px-6 py-3">Activity</th>
                    {showCampaign && <th className="px-6 py-3">Campaign</th>}
                    <th className="px-6 py-3">Credits</th>
                    <th className="px-6 py-3">Date</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {transactions.map((transaction) => (
                    <TransactionRow key={transaction._id} transaction={transaction} showCampaign={showCampaign} onCampaignClick={onCampaignClick} />
                ))}
            </tbody>
        </table></div>
    );
};

const ListingStudioCreditsTab = ({ tenantId }) => {
    const [loading, setLoading] = useState(true);
    const [wallet, setWallet] = useState({ balance: 0, freeImagesRemaining: 0, freeVideosRemaining: 0 });
    const [transactions, setTransactions] = useState([]);
    const [campaignSummary, setCampaignSummary] = useState([]);
    const [campaignFilter, setCampaignFilter] = useState('');
    const [view, setView] = useState('usage'); // 'usage' | 'adjustments' | 'campaigns'

    const fetchUsage = async () => {
        setLoading(true);
        try {
            const params = { ...(tenantId ? { tenantId } : {}), ...(campaignFilter ? { campaignId: campaignFilter } : {}) };
            const { data } = await api.get('/listing-studio/wallet/usage', { params });
            setWallet(data?.wallet || { balance: 0, freeImagesRemaining: 0, freeVideosRemaining: 0 });
            setTransactions(data?.transactions || []);
            setCampaignSummary(data?.campaignSummary || []);
        } catch (error) {
            console.error('Error fetching Speedy Listing credit usage:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsage(); }, [tenantId, campaignFilter]);

    // Usage rows (campaign/image/video/free-allowance) vs. admin & financial adjustments
    // (gifts, deductions, invoice credits, transfers) — two separate history sections.
    const usageTransactions = transactions.filter(isUsageRow);
    const adjustmentTransactions = transactions.filter((t) => !isUsageRow(t));

    const usedCredits = usageTransactions.reduce((sum, transaction) => sum + Math.abs(Math.min(transaction.amount || 0, 0)), 0);
    const freeUses = usageTransactions.filter((transaction) => transaction.type === 'FREE_ALLOWANCE_USE').length;

    if (loading) {
        return <div className="flex flex-col items-center justify-center min-h-[400px]"><Loader2 className="animate-spin text-brand-600 mb-4" size={40} /><p className="text-slate-500">Loading Speedy Listing usage...</p></div>;
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                <SummaryCard icon={CreditCard} iconClass="bg-violet-50 text-violet-600" label="Credits Left" value={wallet.balance || 0} />
                <SummaryCard icon={History} iconClass="bg-blue-50 text-blue-600" label="Credits Used" value={usedCredits} />
                <SummaryCard icon={Image} iconClass="bg-emerald-50 text-emerald-600" label="Free Images Remaining" value={wallet.freeImagesRemaining || 0} />
                <SummaryCard icon={Video} iconClass="bg-rose-50 text-rose-600" label="Free Videos Remaining" value={wallet.freeVideosRemaining || 0} />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
                    <div>
                        <h3 className="font-bold text-slate-800">
                            {view === 'adjustments' ? 'Credit Adjustments' : 'Speedy Listing Credit Usage'}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {view === 'adjustments'
                                ? 'Admin gifts, deductions, invoice credits and transfers on this wallet.'
                                : 'Your recent credit usage across Speedy Listing tools.'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap justify-end">
                        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs font-semibold">
                            <button onClick={() => setView('usage')} className={`px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 ${view === 'usage' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}><List size={13} />Usage</button>
                            <button onClick={() => setView('adjustments')} className={`px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 ${view === 'adjustments' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}><CreditCard size={13} />Adjustments</button>
                            <button onClick={() => setView('campaigns')} className={`px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 ${view === 'campaigns' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}><Layers size={13} />By campaign</button>
                        </div>
                        {view === 'usage' && (
                            <div className="relative inline-flex items-center">
                                <Filter size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                                <select
                                    value={campaignFilter}
                                    onChange={(e) => setCampaignFilter(e.target.value)}
                                    className={`appearance-none pl-8 pr-3 py-1.5 rounded-lg border text-xs font-semibold focus:outline-none cursor-pointer max-w-[220px] ${campaignFilter ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-white text-slate-600 border-slate-200'}`}
                                >
                                    <option value="">All campaigns</option>
                                    {campaignSummary.map((c) => <option key={c.campaignId} value={c.campaignId}>{campaignLabel(c)}</option>)}
                                </select>
                            </div>
                        )}
                        <button onClick={fetchUsage} className="text-xs text-brand-600 hover:text-brand-700 font-semibold">Refresh</button>
                    </div>
                </div>
                {view === 'campaigns' ? (
                    campaignSummary.length === 0 ? (
                        <div className="py-16 text-center"><Layers className="text-slate-200 mx-auto mb-3" size={40} /><p className="text-slate-400 font-medium">No campaign spend yet</p></div>
                    ) : (
                        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wide border-b border-slate-100"><tr><th className="px-6 py-3">Campaign</th><th className="px-6 py-3">Images</th><th className="px-6 py-3">Free uses</th><th className="px-6 py-3">Credits spent</th><th className="px-6 py-3">Last activity</th></tr></thead>
                            <tbody className="divide-y divide-slate-50">
                                {campaignSummary.map((c) => (
                                    <tr key={c.campaignId} className="hover:bg-slate-50/70 cursor-pointer" onClick={() => { setCampaignFilter(c.campaignId); setView('usage'); }}>
                                        <td className="px-6 py-4 font-semibold text-slate-800">{campaignLabel(c)}</td>
                                        <td className="px-6 py-4 text-slate-600">{c.images}</td>
                                        <td className="px-6 py-4 text-slate-600">{c.freeUses}</td>
                                        <td className="px-6 py-4 font-bold text-slate-800">{c.credits.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-slate-500 whitespace-nowrap text-xs">{formatDate(c.lastActivity)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t border-slate-100"><tr><td className="px-6 py-3 font-bold text-slate-700" colSpan={3}>Total</td><td className="px-6 py-3 font-bold text-slate-900" colSpan={2}>{campaignSummary.reduce((sum, c) => sum + c.credits, 0).toLocaleString()}</td></tr></tfoot>
                        </table></div>
                    )
                ) : view === 'adjustments' ? (
                    <TransactionsTable
                        transactions={adjustmentTransactions}
                        showCampaign={false}
                        emptyLabel="No credit adjustments yet"
                    />
                ) : (
                    <TransactionsTable
                        transactions={usageTransactions}
                        showCampaign
                        onCampaignClick={setCampaignFilter}
                        emptyLabel="No Speedy Listing credit usage yet"
                    />
                )}
            </div>
        </div>
    );
};

const SummaryCard = ({ icon: Icon, iconClass, label, value }) => <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition-shadow"><div className="flex items-center gap-3 mb-4"><div className={`p-2 rounded-lg ${iconClass}`}><Icon size={24} /></div><h3 className="font-semibold text-slate-700">{label}</h3></div><p className="text-4xl font-heading font-bold text-slate-900">{Number(value).toLocaleString()}</p></div>;

export default ListingStudioCreditsTab;
