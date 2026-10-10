import React, { useEffect, useState } from 'react';
import { Calendar, CreditCard, Filter, History, Image, Layers, List, Loader2, Sparkles, Video } from 'lucide-react';
import api from '../../api';

const TYPE_DETAILS = {
    CAMPAIGN_CHARGE: { label: 'Campaign created', icon: Sparkles, color: 'bg-violet-50 text-violet-600' },
    IMAGE_CHARGE: { label: 'Image generated', icon: Image, color: 'bg-sky-50 text-sky-600' },
    VIDEO_CHARGE: { label: 'Video generated', icon: Video, color: 'bg-rose-50 text-rose-600' },
    FREE_ALLOWANCE_USE: { label: 'Free allowance used', icon: Sparkles, color: 'bg-emerald-50 text-emerald-600' },
    ADMIN_GIFT: { label: 'Admin gift', icon: CreditCard, color: 'bg-amber-50 text-amber-600' },
    FREE_TRIAL_CREDIT: { label: 'Free trial credit', icon: CreditCard, color: 'bg-amber-50 text-amber-600' },
};

const formatDate = (value) => new Date(value).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const campaignLabel = (campaign) => {
    if (!campaign) return '';
    return campaign.campaignNumber != null ? `#${campaign.campaignNumber}` : campaign.campaignId;
};

const ListingStudioCreditsTab = ({ tenantId }) => {
    const [loading, setLoading] = useState(true);
    const [wallet, setWallet] = useState({ balance: 0, freeImagesRemaining: 0, freeVideosRemaining: 0 });
    const [transactions, setTransactions] = useState([]);
    const [campaignSummary, setCampaignSummary] = useState([]);
    const [campaignFilter, setCampaignFilter] = useState('');
    const [view, setView] = useState('activity');

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

    const usedCredits = transactions.reduce((sum, transaction) => sum + Math.abs(Math.min(transaction.amount || 0, 0)), 0);
    const freeUses = transactions.filter((transaction) => transaction.type === 'FREE_ALLOWANCE_USE').length;

    if (loading) {
        return <div className="flex flex-col items-center justify-center min-h-[400px]"><Loader2 className="animate-spin text-brand-600 mb-4" size={40} /><p className="text-slate-500">Loading Speedy Listing usage...</p></div>;
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SummaryCard icon={CreditCard} iconClass="bg-violet-50 text-violet-600" label="Credits Left" value={wallet.balance || 0} />
                <SummaryCard icon={History} iconClass="bg-blue-50 text-blue-600" label="Credits Used" value={usedCredits} />
                <SummaryCard icon={Image} iconClass="bg-emerald-50 text-emerald-600" label="Free Uses Remaining" value={(wallet.freeImagesRemaining || 0) + (wallet.freeVideosRemaining || 0)} />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
                    <div>
                        <h3 className="font-bold text-slate-800">Speedy Listing Credit Usage</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Your recent credit usage across Speedy Listing tools.</p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap justify-end">
                        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs font-semibold">
                            <button onClick={() => setView('activity')} className={`px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 ${view === 'activity' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}><List size={13} />Activity</button>
                            <button onClick={() => setView('campaigns')} className={`px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 ${view === 'campaigns' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}><Layers size={13} />By campaign</button>
                        </div>
                        {view === 'activity' && (
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
                                    <tr key={c.campaignId} className="hover:bg-slate-50/70 cursor-pointer" onClick={() => { setCampaignFilter(c.campaignId); setView('activity'); }}>
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
                ) : transactions.length === 0 ? (
                    <div className="py-16 text-center"><History className="text-slate-200 mx-auto mb-3" size={40} /><p className="text-slate-400 font-medium">No Speedy Listing credit usage yet</p></div>
                ) : (
                    <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wide border-b border-slate-100"><tr><th className="px-6 py-3">Activity</th><th className="px-6 py-3">Campaign</th><th className="px-6 py-3">Credits</th><th className="px-6 py-3">Date</th></tr></thead>
                        <tbody className="divide-y divide-slate-50">{transactions.map((transaction) => {
                            const detail = TYPE_DETAILS[transaction.type] || TYPE_DETAILS.CAMPAIGN_CHARGE;
                            const Icon = detail.icon;
                            const isFree = transaction.type === 'FREE_ALLOWANCE_USE';
                            const isGift = transaction.type === 'ADMIN_GIFT' || transaction.type === 'FREE_TRIAL_CREDIT';
                            const giftLabel = isGift && transaction.metadata?.kind === 'freeImages'
                                ? `${detail.label} · ${transaction.metadata.count || 0} free images`
                                : isGift && transaction.metadata?.kind === 'freeVideos'
                                    ? `${detail.label} · ${transaction.metadata.count || 0} free videos`
                                    : detail.label;
                            return <tr key={transaction._id} className="hover:bg-slate-50/70"><td className="px-6 py-4"><div className="flex items-center gap-3"><div className={`p-2 rounded-lg ${detail.color}`}><Icon size={16} /></div><div><span className="font-semibold text-slate-800">{giftLabel}</span>{isGift && transaction.metadata?.adminName && <p className="text-xs text-slate-500 mt-0.5">by {transaction.metadata.adminName}</p>}</div></div></td><td className="px-6 py-4 text-slate-600 text-xs">{transaction.campaign ? <button type="button" onClick={() => setCampaignFilter(transaction.campaign.campaignId)} className="font-semibold text-violet-700 hover:underline text-left">{campaignLabel(transaction.campaign)}</button> : <span className="text-slate-300">—</span>}</td><td className="px-6 py-4 font-bold">{isFree ? <span className="text-emerald-600">Free</span> : isGift ? <span className="text-emerald-600">+{Math.abs(transaction.amount || 0)}</span> : <span className="text-slate-800">-{Math.abs(transaction.amount || 0)}</span>}</td><td className="px-6 py-4 text-slate-500 whitespace-nowrap text-xs"><span className="inline-flex items-center gap-1.5"><Calendar size={13} />{formatDate(transaction.createdAt)}</span></td></tr>;
                        })}</tbody>
                    </table></div>
                )}
            </div>
        </div>
    );
};

const SummaryCard = ({ icon: Icon, iconClass, label, value }) => <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition-shadow"><div className="flex items-center gap-3 mb-4"><div className={`p-2 rounded-lg ${iconClass}`}><Icon size={24} /></div><h3 className="font-semibold text-slate-700">{label}</h3></div><p className="text-4xl font-heading font-bold text-slate-900">{Number(value).toLocaleString()}</p></div>;

export default ListingStudioCreditsTab;
