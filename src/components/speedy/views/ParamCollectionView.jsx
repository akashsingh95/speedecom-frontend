import React, { useState, useEffect, useMemo } from 'react';
import { Play, RotateCcw, X, Search } from 'lucide-react';
import { useAuth } from '../../../AuthContext';
import api from '../../../api';
import { useLanguage } from '../../../Speedydata/LanguageContext';
import { isQuestionSupportedForMarketplace } from '../../../Speedydata/faqQuestions';

// Returns the auto-default value for a param (placeholder or defaultValue)
const getDefaultValue = (p) => {
    if (p.defaultValue !== undefined) return String(p.defaultValue);
    if (p.placeholder !== undefined) return String(p.placeholder);
    return '';
};

const ParamCollectionView = ({ question, marketplaces, onResult }) => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [params, setParams]           = useState({});
    const [defaultFields, setDefaultFields] = useState(new Set()); // keys currently showing auto-default
    const [selectedMarketplace, setSelectedMarketplace] = useState('');
    const [selectedAccountIds, setSelectedAccountIds]   = useState([]); // multi-select
    const [accountSearch, setAccountSearch]             = useState('');
    const [isLoading, setIsLoading]     = useState(false);
    const [errors, setErrors]           = useState({});

    const tenantId = user?.tenantId || user?._id;

    // ── On question change: auto-populate optional params with their defaults ──
    useEffect(() => {
        const initial  = {};
        const autoKeys = new Set();

        question.params?.forEach((p) => {
            const def = getDefaultValue(p);
            if (!p.required && def) {
                initial[p.key] = def;
                autoKeys.add(p.key);
            }
        });

        setParams(initial);
        setDefaultFields(autoKeys);
        setErrors({});
    }, [question]);

    // ── Auto-pick / Reset marketplace ─────────────────────────────────────────
    useEffect(() => {
        const supportedMps = marketplaces.filter(m => isQuestionSupportedForMarketplace(question, m.key));
        const isCurrentSupported = selectedMarketplace && isQuestionSupportedForMarketplace(question, selectedMarketplace);

        if (selectedMarketplace && !isCurrentSupported) {
            setSelectedMarketplace('');
        }

        if (supportedMps.length === 1 && (!selectedMarketplace || !isCurrentSupported)) {
            setSelectedMarketplace(supportedMps[0].key);
        }
    }, [marketplaces, question, selectedMarketplace]);

    const isMarketplaceSupported = (mpKey) => isQuestionSupportedForMarketplace(question, mpKey);

    // ── Auto-select all/only account on marketplace change ────────────────────
    useEffect(() => {
        setAccountSearch('');
        if (!selectedMarketplace) { setSelectedAccountIds([]); return; }
        const mp = marketplaces.find((m) => m.key === selectedMarketplace);
        if (mp?.accounts?.length === 1) {
            setSelectedAccountIds([mp.accounts[0]._id]);
        } else {
            setSelectedAccountIds([]);
        }
    }, [selectedMarketplace, marketplaces]);

    // ── Param change helpers ──────────────────────────────────────────────────
    const set = (key, value, p) => {
        setParams((prev) => ({ ...prev, [key]: value }));
        setErrors((prev) => ({ ...prev, [key]: '' }));

        // Track whether the field is still showing the auto default
        const def = getDefaultValue(p);
        setDefaultFields((prev) => {
            const next = new Set(prev);
            value === def ? next.add(key) : next.delete(key);
            return next;
        });
    };

    const clearField = (key) => {
        setParams((prev) => ({ ...prev, [key]: '' }));
        setDefaultFields((prev) => { const n = new Set(prev); n.delete(key); return n; });
    };

    const resetToDefault = (key, p) => {
        const def = getDefaultValue(p);
        setParams((prev) => ({ ...prev, [key]: def }));
        setDefaultFields((prev) => new Set([...prev, key]));
    };

    // ── Validation ────────────────────────────────────────────────────────────
    const validate = () => {
        const newErrors = {};
        question.params?.forEach((p) => {
            if (p.required && !params[p.key]?.toString().trim()) {
                newErrors[p.key] = `${p.label} is required`;
            }
        });
        if (question.requiresMarketplace) {
            if (!selectedMarketplace) {
                newErrors._marketplace = 'Please select a marketplace';
            } else if (selectedAccountIds.length === 0) {
                newErrors._accounts = 'Please select at least one account';
            }
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // ── Run ───────────────────────────────────────────────────────────────────
    const handleRun = async () => {
        if (!validate()) return;
        setIsLoading(true);

        const finalParams = { ...params };
        if (selectedAccountIds.length > 0) finalParams.accountId = selectedAccountIds;

        try {
            const res = await api.post('/agent/faq', {
                questionId: question.id,
                params: finalParams,
                tenantId,
            });
            onResult(res.data);
        } catch (_) {
            onResult({
                data: [],
                format: 'text',
                chartType: null,
                summary: '⚠️ Failed to fetch data. Please try again.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const mp       = marketplaces.find((m) => m.key === selectedMarketplace);
    const accounts = mp?.accounts || [];
    const showMarketplace = marketplaces.length > 0;

    // Filtered accounts by search input (case-insensitive)
    const filteredAccounts = useMemo(() => {
        const q = accountSearch.trim().toLowerCase();
        if (!q) return accounts;
        return accounts.filter((a) => a.name.toLowerCase().includes(q));
    }, [accounts, accountSearch]);

    const visibleIds        = filteredAccounts.map((a) => a._id);
    const allVisibleChecked = visibleIds.length > 0 && visibleIds.every((id) => selectedAccountIds.includes(id));
    const someVisibleChecked = visibleIds.some((id) => selectedAccountIds.includes(id));

    const toggleSelectAllVisible = () => {
        if (allVisibleChecked) {
            setSelectedAccountIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
        } else {
            setSelectedAccountIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
        }
    };

    const toggleAccount = (id) => {
        setSelectedAccountIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
        setErrors((prev) => ({ ...prev, _accounts: '' }));
    };

    return (
        <div className="p-5 flex flex-col gap-5">

            {/* Question recap */}
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-1">Question</p>
                <p className="text-sm text-gray-800 leading-snug">{t(question.question)}</p>
            </div>

            {/* Marketplace selector — required, single-select */}
            {showMarketplace && (
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Marketplace
                        <span className="text-red-500 ml-1">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {marketplaces.map((m) => {
                            const isActive = selectedMarketplace === m.key;
                            const isSupported = isMarketplaceSupported(m.key);
                            return (
                                <button
                                    key={m.key}
                                    type="button"
                                    disabled={!isSupported}
                                    onClick={() => {
                                        if (!isSupported) return;
                                        setSelectedMarketplace(m.key);
                                        setErrors((prev) => ({ ...prev, _marketplace: '' }));
                                    }}
                                    className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                                        !isSupported
                                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                                            : isActive
                                                ? 'bg-purple-600 text-white border-purple-600'
                                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-purple-300'
                                    }`}
                                    title={!isSupported ? 'Not supported for this question' : ''}
                                >
                                    {m.key.charAt(0).toUpperCase() + m.key.slice(1)}
                                </button>
                            );
                        })}
                    </div>
                    {errors._marketplace && <p className="text-xs text-red-500">{errors._marketplace}</p>}
                </div>
            )}

            {/* Account selector — required, multi-select with search + select-all */}
            {selectedMarketplace && (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Accounts
                            <span className="text-red-500 ml-1">*</span>
                        </label>
                        <span className="text-[11px] text-gray-500">
                            {selectedAccountIds.length} of {accounts.length} selected
                        </span>
                    </div>

                    {/* Search */}
                    {accounts.length > 5 && (
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" />
                            <input
                                type="text"
                                value={accountSearch}
                                onChange={(e) => setAccountSearch(e.target.value)}
                                placeholder="Search account…"
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder-gray-400"
                            />
                        </div>
                    )}

                    {/* List */}
                    <div className="border border-gray-200 rounded-xl bg-gray-50 max-h-56 overflow-y-auto">
                        {/* Select all visible */}
                        {filteredAccounts.length > 1 && (
                            <label className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white hover:bg-purple-50 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={allVisibleChecked}
                                    ref={(el) => { if (el) el.indeterminate = !allVisibleChecked && someVisibleChecked; }}
                                    onChange={toggleSelectAllVisible}
                                    className="w-4 h-4 rounded cursor-pointer accent-purple-600"
                                />
                                <span className="text-sm font-medium text-gray-700">
                                    Select all {accountSearch ? `(${filteredAccounts.length} matching)` : `(${accounts.length})`}
                                </span>
                            </label>
                        )}

                        {/* Account rows */}
                        {filteredAccounts.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-4">No accounts match "{accountSearch}"</p>
                        ) : (
                            filteredAccounts.map((a) => {
                                const checked = selectedAccountIds.includes(a._id);
                                return (
                                    <label
                                        key={a._id}
                                        className="flex items-center gap-2 px-3 py-2 hover:bg-purple-50 cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleAccount(a._id)}
                                            className="w-4 h-4 rounded cursor-pointer accent-purple-600"
                                        />
                                        <span className="text-sm text-gray-800 flex-1 truncate">
                                            {a.name}
                                            {a.status === 'inactive' && (
                                                <span className="ml-1 text-[10px] text-gray-400">(Inactive)</span>
                                            )}
                                        </span>
                                    </label>
                                );
                            })
                        )}
                    </div>
                    {errors._accounts && <p className="text-xs text-red-500">{errors._accounts}</p>}
                </div>
            )}

            {/* ── Dynamic params ─────────────────────────────────────────────── */}
            {question.params?.map((p) => {
                const isAuto    = !p.required && defaultFields.has(p.key);
                const hasValue  = params[p.key] !== '' && params[p.key] !== undefined;
                const def       = getDefaultValue(p);

                // ── Toggle type ───────────────────────────────────────────────
                if (p.type === 'toggle' && p.options) {
                    return (
                        <div key={p.key} className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                    {p.label}
                                    {p.required && <span className="text-red-500 ml-1">*</span>}
                                </label>
                                {isAuto && (
                                    <span className="inline-flex items-center gap-1 text-[10px] bg-purple-50 text-purple-500 border border-purple-200 px-1.5 py-0.5 rounded-full font-semibold">
                                        Auto
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {p.options.map((opt) => (
                                    <button
                                        key={opt}
                                        onClick={() => set(p.key, opt, p)}
                                        className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                                            params[p.key] === opt
                                                ? 'bg-purple-600 text-white border-purple-600'
                                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-purple-300'
                                        }`}
                                    >
                                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                }

                // ── Number / text / date inputs ───────────────────────────────
                return (
                    <div key={p.key} className="flex flex-col gap-1.5">

                        {/* Label row */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                    {p.label}
                                    {p.required && <span className="text-red-500 ml-1">*</span>}
                                </label>

                                {/* Auto badge — shown when value equals the default */}
                                {isAuto && (
                                    <span className="inline-flex items-center gap-1 text-[10px] bg-purple-50 text-purple-500 border border-purple-200 px-1.5 py-0.5 rounded-full font-semibold select-none">
                                        Auto
                                    </span>
                                )}
                            </div>

                            {/* Reset link — shown when user has changed away from default */}
                            {!p.required && !isAuto && def && hasValue && (
                                <button
                                    onClick={() => resetToDefault(p.key, p)}
                                    className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-600 transition-colors"
                                    title={`Reset to default (${def})`}
                                >
                                    <RotateCcw size={10} />
                                    reset to {def}
                                </button>
                            )}
                        </div>

                        {/* Input with clear button */}
                        <div className="relative">
                            <input
                                type={p.type === 'toggle' ? 'text' : p.type}
                                value={params[p.key] ?? ''}
                                onChange={(e) => set(p.key, e.target.value, p)}
                                placeholder={p.placeholder}
                                min={p.type === 'number' ? 0 : undefined}
                                className={`
                                    w-full border rounded-xl px-3 py-2.5 text-sm
                                    focus:outline-none focus:ring-2 transition-colors
                                    ${isAuto
                                        ? 'bg-purple-50/60 border-purple-200 text-purple-800 focus:ring-purple-300 placeholder-purple-300'
                                        : errors[p.key]
                                            ? 'bg-gray-50 border-red-400 text-gray-800 focus:ring-red-300'
                                            : 'bg-gray-50 border-gray-200 text-gray-800 focus:ring-purple-400 placeholder-gray-400'
                                    }
                                    ${hasValue && !p.required ? 'pr-8' : ''}
                                `}
                            />

                            {/* Clear × button — for non-required fields that have a value */}
                            {!p.required && hasValue && (
                                <button
                                    onClick={() => clearField(p.key)}
                                    title="Clear this filter (will use backend default)"
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        {/* Hint for cleared optional fields */}
                        {!p.required && !hasValue && def && (
                            <p className="text-[11px] text-gray-400 flex items-center gap-1">
                                Default is <span className="font-medium text-gray-500">{def}</span>
                                <button
                                    onClick={() => resetToDefault(p.key, p)}
                                    className="text-purple-400 hover:text-purple-600 underline transition-colors"
                                >
                                    restore
                                </button>
                            </p>
                        )}

                        {errors[p.key] && <p className="text-xs text-red-500">{errors[p.key]}</p>}
                    </div>
                );
            })}

            {/* No params fallback */}
            {(!question.params || question.params.length === 0) && !showMarketplace && (
                <p className="text-sm text-gray-500 text-center py-2">
                    This query runs with your account data — no extra parameters needed.
                </p>
            )}

            {/* Run button */}
            <button
                onClick={handleRun}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 rounded-xl hover:opacity-90 disabled:opacity-60 transition-all"
            >
                {isLoading ? (
                    <>
                        <span className="animate-spin text-sm">⊙</span>
                        Running query...
                    </>
                ) : (
                    <>
                        <Play size={16} />
                        Run Query
                    </>
                )}
            </button>
        </div>
    );
};

export default ParamCollectionView;
