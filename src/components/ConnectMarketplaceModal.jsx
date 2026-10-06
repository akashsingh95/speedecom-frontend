import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, Eye, EyeOff, AlertCircle, RefreshCw, Pencil, Lock, ShieldCheck, Info } from 'lucide-react';
import api from '../api';
import forge from 'node-forge';
import MonthYearPicker from './MonthYearPicker';

const ConnectMarketplaceModal = ({ marketplaceName, onClose, onSuccess, accountData, mode, accountPassword, bypassPassword = false, supportedSignInTypes = ['email', 'phone', 'oauth'], onBack }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [publicKey, setPublicKey] = useState('');
    const [showAutoSyncFields, setShowAutoSyncFields] = useState(false);
    
    // Multi-account selection state
    const [accountSelectionOptions, setAccountSelectionOptions] = useState(null);
    const [selectedSubAccount, setSelectedSubAccount] = useState('');

    // Update mode — track which fields are in edit mode
    const [editingPassword, setEditingPassword] = useState(false);

    // Tracks whether the user explicitly typed a new password (vs browser autofill)
    const [passwordTouched, setPasswordTouched] = useState(false);

    const [formData, setFormData] = useState(() => {
        if (mode === 'update' && accountData) {
            return {
                signInType: accountData.signInType || 'email',
                email: accountData.email || '',
                phone: accountData.phone || '',
                password: accountData.retrievedPassword || '',
                accountName: accountData.nameWithoutPrefix || accountData.name || '',
                merchantId: accountData.merchantId || '',
                clientId: accountData.clientId || '',
                clientSecret: '',
                analysisStartDate: accountData.analysisStartDate ? new Date(accountData.analysisStartDate).toISOString().slice(0, 7) : '',
                supplierIdentifier: accountData.supplierIdentifier || '',
                enableSizeWiseCalculation: accountData.config?.enableSizeWiseCalculation ?? true,
            };
        }

        const defaultType = supportedSignInTypes.length > 0 ? supportedSignInTypes[0] : 'email';
        const today = new Date().toISOString().slice(0, 7);

        return {
            signInType: defaultType,
            email: '',
            phone: '',
            password: '',
            accountName: '',
            merchantId: '',
            clientId: '',
            clientSecret: '',
            analysisStartDate: today,
            supplierIdentifier: '',
            enableSizeWiseCalculation: false,
        };
    });

    useEffect(() => {
        const fetchPublicKey = async () => {
            try {
                const { data } = await api.get('/auth/public-key');
                setPublicKey(data.publicKey);
            } catch (err) {
                console.error('Failed to fetch encryption key', err);
                setError('Security Initialization Failed. Please reload.');
            }
        };
        fetchPublicKey();
    }, []);

    // Auto-expand auto-sync section if account already has credentials AND uses email sign-in
    useEffect(() => {
        if (mode === 'update' && accountData && marketplaceName === 'Meesho') {
            const hasEmail = !!(accountData.email?.trim()) && accountData.signInType !== 'phone';
            if (hasEmail && (accountData.iv || accountData.supplierIdentifier)) {
                setShowAutoSyncFields(true);
            }
        }
    }, [mode, accountData, marketplaceName]);

    // Auto-collapse auto-sync section whenever the gate becomes false:
    // - user switches sign-in type away from email
    // - user clears the email field
    // - user filled email then switched to phone (email value persists in state)
    useEffect(() => {
        const locked = formData.signInType !== 'email' || !formData.email?.trim();
        if (locked) setShowAutoSyncFields(false);
    }, [formData.signInType, formData.email]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const encryptPassword = (password, key) => {
        const pki = forge.pki;
        const publicKey = pki.publicKeyFromPem(key);
        const encrypted = publicKey.encrypt(password, 'RSA-OAEP');
        return forge.util.encode64(encrypted);
    };

    const handleSubmit = async (e, forceUpdate = false) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (formData.signInType === 'email' && !formData.email) {
                throw new Error('Please enter an Email Address');
            }

            // Account name required for add mode and common update (no accountPassword = common update)
            if ((mode === 'add' || (mode === 'update' && !accountPassword && !bypassPassword)) && !formData.accountName) {
                throw new Error('Please enter an Account Name');
            }

            if (mode === 'add' && !formData.analysisStartDate) {
                throw new Error('Please select an Analysis Start Date');
            }

            if (formData.signInType === 'email') {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(formData.email)) throw new Error('Invalid Email Address');
            }

            if (mode === 'add' && marketplaceName === 'Meesho' && showAutoSyncFields) {
                if (!formData.password) throw new Error('Please enter your Meesho Supplier Panel Password to enable auto-sync');

            }

            if (mode === 'update') {
                // Legacy accounts have no prefix stored (e.g. "Dharmik10" instead of "MEE_Dharmik10").
                // Submitting them will add the prefix — that IS a real change, so never treat as no-op.
                const alreadyPrefixed = accountData.name !== (accountData.nameWithoutPrefix || accountData.name);
                const nameUnchanged = alreadyPrefixed
                    ? formData.accountName.trim() === (accountData.nameWithoutPrefix || '').trim()
                    : false;
                const emailUnchanged = formData.email.trim() === (accountData.email || '').trim();

                if (!accountPassword && !bypassPassword) {
                    // Blue button: only name + email editable
                    if (nameUnchanged && emailUnchanged) {
                        throw new Error('No changes detected. Please update the name or email before saving.');
                    }
                } else {
                    // Green button (Meesho): name + email + password + supplier identifier
                    const passwordChanged = passwordTouched && !!formData.password && formData.password !== (accountData.retrievedPassword || '');
                    const supplierUnchanged = (formData.supplierIdentifier || '').trim() === (accountData.supplierIdentifier || '').trim();
                    
                    const needsReconnect = marketplaceName === 'Meesho' && !accountData.supplierIdentifier && !accountData.supplierId;
                    
                    if (needsReconnect && (!passwordTouched || !formData.password)) {
                        throw new Error('This account needs to be reconnected. Please re-enter your password to proceed.');
                    }
                    
                    if (!needsReconnect && nameUnchanged && emailUnchanged && !passwordChanged && supplierUnchanged) {
                        throw new Error('No changes detected. Please update at least one field before saving.');
                    }
                }
            }

            if (!publicKey) {
                throw new Error('Encryption key not loaded. Please try again.');
            }

            let encryptedPassword = '';
            // In update mode, only encrypt+send the password if the user explicitly typed it.
            // This prevents browser autofill from silently overwriting the stored Meesho password.
            const shouldSendPassword = mode === 'add'
                ? !!formData.password
                : passwordTouched && !!formData.password;
            if (shouldSendPassword) {
                encryptedPassword = encryptPassword(formData.password, publicKey);
            }

            const { data } = await api.post('/marketplaces/verify', {
                name: marketplaceName,
                credentials: {
                    signInType: formData.signInType,
                    email: formData.signInType === 'email' ? formData.email : undefined,
                    phone: formData.signInType === 'phone' ? formData.phone : undefined,
                    password: encryptedPassword || undefined,
                    // If the user selected a sub-account, use that, otherwise use what was in formData
                    supplierIdentifier: (marketplaceName === 'Meesho' && (selectedSubAccount || formData.supplierIdentifier)) ? (selectedSubAccount || formData.supplierIdentifier).trim() : undefined,
                    enableSizeWiseCalculation: marketplaceName === 'Meesho' ? formData.enableSizeWiseCalculation : undefined,
                },
                forceUpdate,
                mode,
                accountPassword: mode === 'update' && !bypassPassword ? accountPassword : undefined,
                marketplaceId: mode === 'update' ? accountData?._id : undefined,
                accountName: mode === 'update' ? formData.accountName : (formData.accountName || undefined),
                analysisStartDate: mode === 'add' ? formData.analysisStartDate : undefined
            });

            if (data.needsAccountSelection) {
                setAccountSelectionOptions(data.availableAccounts);
                // Pre-select the first option
                if (data.availableAccounts && data.availableAccounts.length > 0) {
                    setSelectedSubAccount(data.availableAccounts[0].supplierIdentifier);
                }
                setLoading(false);
                return;
            }

            if (data.redirectUrl) {
                window.location.href = data.redirectUrl;
                return;
            }

            if (data.requiresConfirmation) {
                setError({
                    type: 'confirmation',
                    message: data.message || 'Are you sure you want to change your password?'
                });
                setLoading(false);
                return;
            }

            await onSuccess(data.warning || null);
            if (!data.warning) {
                onClose();
            } else {
                setError({ type: 'warning', message: data.warning });
                setLoading(false);
            }
        } catch (err) {
            console.error('Connection failed', err);
            setError(err.response?.data?.message || err.message || 'Connection failed.');
            setLoading(false);
        }
    };



    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn" onClick={onClose}>
            <div className="bg-white rounded-3xl w-full max-w-[440px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden animate-zoomIn flex flex-col relative" onClick={(e) => e.stopPropagation()}>

                {/* Loading Overlay */}
                {loading && (
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center animate-fadeIn">
                        <div className="relative">
                            <Loader2 className="animate-spin text-brand-600" size={48} />
                            <div className="absolute inset-0 animate-ping">
                                <Loader2 className="text-brand-300" size={48} />
                            </div>
                        </div>
                        <p className="mt-4 text-sm font-bold tracking-wider uppercase text-slate-600 animate-pulse">Securing connection</p>
                    </div>
                )}

                {/* ── PREMIUM HEADER ── */}
                <div className="relative overflow-hidden pt-2">
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-600 via-brand-500 to-sky-500"></div>
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>

                    <div className="relative z-10 px-6 py-5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {onBack && (
                                <button type="button" onClick={onBack} className="p-1.5 -ml-1 hover:bg-white/15 rounded-lg text-white/70 hover:text-white transition-all duration-200">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M19 12H5M12 19l-7-7 7-7" />
                                    </svg>
                                </button>
                            )}
                            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-brand-700/20 border border-white/20">
                                {mode === 'update' ? <Pencil size={18} className="text-white" /> : <ShieldCheck size={18} className="text-white" />}
                            </div>
                            <div>
                                <h3 className="text-[17px] font-heading font-bold text-white leading-tight tracking-tight">{mode === 'update' ? 'Update Credentials' : 'Connect Account'}</h3>
                                <p className="text-[12px] text-white/70 font-medium">{marketplaceName} Integration</p>
                            </div>
                        </div>
                        <button type="button" onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg text-white/60 hover:text-white transition-all duration-200">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">

                    {/* ── ACCOUNT SELECTION MODE ── */}
                    {accountSelectionOptions ? (
                        <div className="space-y-4 animate-fadeIn">
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
                                <h4 className="text-sm font-bold text-blue-800 mb-1 flex items-center gap-2">
                                    <Info size={16} /> Multiple Sub-Accounts Found
                                </h4>
                                <p className="text-xs text-blue-600 leading-relaxed">
                                    Your email address is associated with multiple Meesho sub-accounts. Please select which account you want to connect.
                                </p>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-slate-700">Select Sub-Account</label>
                                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                    {accountSelectionOptions.map((acc) => (
                                        <label 
                                            key={acc.supplierIdentifier} 
                                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedSubAccount === acc.supplierIdentifier ? 'bg-brand-50 border-brand-300 ring-1 ring-brand-300' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                                        >
                                            <input 
                                                type="radio" 
                                                name="subAccount" 
                                                value={acc.supplierIdentifier} 
                                                checked={selectedSubAccount === acc.supplierIdentifier} 
                                                onChange={(e) => setSelectedSubAccount(e.target.value)}
                                                className="w-4 h-4 text-brand-600 focus:ring-brand-500" 
                                            />
                                            <div className="flex-1">
                                                <p className="text-sm font-semibold text-slate-800">
                                                    ID: {acc.supplierIdentifier}
                                                </p>
                                                {acc.supplierId && (
                                                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">Supplier ID: {acc.supplierId}</p>
                                                )}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                    {/* ── ADD MODE fields ── */}
                    {mode === 'add' && (
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Account Name <span className="text-xs text-slate-400 font-normal">(e.g. your name or store id)</span>
                            </label>
                            <input
                                type="text"
                                name="accountName"
                                value={formData.accountName || ''}
                                onChange={handleChange}
                                placeholder="Enter a unique name"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 placeholder:text-slate-400"
                            />
                        </div>
                    )}

                    {mode === 'add' && (
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Analysis Start Date <span className="text-xs text-slate-400 font-normal">(Orders before this date won't be charged)</span>
                            </label>
                            <MonthYearPicker
                                value={formData.analysisStartDate}
                                onChange={(val) => handleChange({ target: { name: 'analysisStartDate', value: val } })}
                                minYear={new Date().getFullYear() - 20}
                            />
                            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3 mt-3">
                                <AlertCircle className="text-blue-600 shrink-0" size={20} />
                                <div className="text-xs text-blue-800">
                                    <p><span className="font-bold">Important:</span> Only orders from this date onwards will be analyzed. You cannot change this later.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {mode === 'add' && marketplaceName === 'Meesho' && (
                        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                            <div className="pr-4">
                                <h3 className="text-sm font-semibold text-slate-800">Size-wise Calculations</h3>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                    Calculate P&amp;L separately for each SKU size. Turn it on if you want size-wise calculations.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleChange({ target: { name: 'enableSizeWiseCalculation', value: !formData.enableSizeWiseCalculation } })}
                                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${formData.enableSizeWiseCalculation ? 'bg-brand-500' : 'bg-slate-300'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${formData.enableSizeWiseCalculation ? 'left-6' : 'left-1'}`} />
                            </button>
                        </div>
                    )}

                    {/* ── UPDATE MODE: Premium Form UI ── */}
                    {mode === 'update' ? (
                        <div className="space-y-5">

                            {/* Account name — always editable in update mode */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                                    Account Name
                                </label>
                                <input
                                    type="text"
                                    name="accountName"
                                    value={formData.accountName || ''}
                                    onChange={handleChange}
                                    placeholder="Enter a unique name"
                                    className="w-full text-sm text-slate-800 bg-white border border-slate-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 px-4 py-3 rounded-xl outline-none placeholder:text-slate-300 transition-all shadow-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                                    {formData.signInType === 'phone' ? 'Phone Number' : 'Email Address'}
                                </label>
                                <input
                                    type={formData.signInType === 'phone' ? 'tel' : 'email'}
                                    name={formData.signInType === 'phone' ? 'phone' : 'email'}
                                    value={formData.signInType === 'phone' ? (formData.phone || '') : formData.email}
                                    onChange={handleChange}
                                    placeholder={formData.signInType === 'phone' ? '10-digit number' : 'name@example.com'}
                                    className="w-full text-sm text-slate-800 bg-white border border-slate-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 px-4 py-3 rounded-xl outline-none placeholder:text-slate-300 transition-all shadow-sm"
                                />
                            </div>

                            {/* Auto-sync credentials (Meesho sync update only — not shown in common update) */}
                            {marketplaceName === 'Meesho' && import.meta.env.VITE_ENABLE_MEESHO_AUTOSYNC === 'true' && (!!accountPassword || bypassPassword) && (
                                <div className="mt-6 pt-6 border-t border-slate-100 relative">
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                        <Lock size={12} className="text-brand-500" /> Auto-Sync Settings
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between ml-1">
                                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Meesho Supplier Panel Password</label>
                                                {accountData?.iv && !editingPassword && <span className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Secured</span>}
                                            </div>
                                            {/* Show display row until user explicitly clicks pencil — prevents browser autofill */}
                                            {editingPassword ? (
                                                <div className="relative">
                                                    <input
                                                        type={showPassword ? 'text' : 'password'}
                                                        name="password"
                                                        value={formData.password}
                                                        autoComplete="new-password"
                                                        onChange={(e) => { handleChange(e); setPasswordTouched(true); }}
                                                        placeholder="Enter new password"
                                                        autoFocus
                                                        className="w-full text-sm text-slate-800 bg-white border border-brand-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 px-4 py-3 rounded-xl outline-none pr-10 placeholder:text-slate-400 transition-all shadow-sm"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(v => !v)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-500 p-1 bg-white"
                                                    >
                                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                                                    <span className="text-sm text-slate-500 tracking-widest">
                                                        {accountData?.iv ? '••••••••••' : <span className="tracking-normal italic text-slate-400 text-xs">Not set — click pencil to add</span>}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setEditingPassword(true); }}
                                                        className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-all"
                                                        title="Edit password"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                     </div>
                                </div>
                            )}
                        </div>

                    ) : (
                        /* ── ADD MODE: credential input ── */
                        <div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                                <input
                                    type="email" name="email" value={formData.email} onChange={handleChange}
                                    placeholder="name@example.com"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none transition-all placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                                />
                            </div>

                            {/* Meesho auto-sync fields (add mode) */}
                            {marketplaceName === 'Meesho' && import.meta.env.VITE_ENABLE_MEESHO_AUTOSYNC === 'true' && (
                                <div className="space-y-4 mt-4">
                                    <button
                                        type="button"
                                        onClick={() => { setShowAutoSyncFields(v => !v); setError(null); }}
                                        className={`w-full rounded-xl border p-3.5 flex items-center gap-3 transition-all cursor-pointer ${
                                            showAutoSyncFields
                                                ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                                        }`}
                                    >
                                        <div className={`p-2 rounded-lg transition-colors shrink-0 ${showAutoSyncFields ? 'bg-emerald-100' : 'bg-slate-200'}`}>
                                            <RefreshCw className={`transition-colors ${showAutoSyncFields ? 'text-emerald-600' : 'text-slate-500'}`} size={14} />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="flex items-center gap-1">
                                                <p className={`text-xs font-semibold transition-colors ${showAutoSyncFields ? 'text-emerald-700' : 'text-slate-700'}`}>
                                                    Auto-Sync
                                                </p>
                                                {!showAutoSyncFields && (
                                                    <div className="relative group/autotip" onClick={e => e.stopPropagation()}>
                                                        <Info size={11} className="text-slate-400 cursor-default" />
                                                        <div className="absolute left-0 bottom-full mb-2 w-56 bg-slate-800 text-white text-[10px] rounded-lg px-3 py-2 leading-relaxed opacity-0 invisible group-hover/autotip:opacity-100 group-hover/autotip:visible transition-all duration-150 shadow-lg z-50 pointer-events-none">
                                                            You're all set for manual uploads. Use the toggle and add your Meesho seller page <strong className="text-white">password</strong> &amp; <strong className="text-white">supplier identifier</strong> to enable auto-sync.
                                                            <div className="absolute left-2 top-full border-4 border-transparent border-t-slate-800" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <p className={`text-[10px] mt-0.5 transition-colors ${showAutoSyncFields ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                {showAutoSyncFields ? 'Enabled — orders sync automatically' : 'Disabled — upload orders manually'}
                                            </p>
                                        </div>
                                        <div className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${showAutoSyncFields ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${showAutoSyncFields ? 'left-5' : 'left-0.5'}`} />
                                        </div>
                                    </button>

                                    {showAutoSyncFields && (
                                        <div className="space-y-4 animate-fadeIn">
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                    Meesho Supplier Panel Password
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type={showPassword ? 'text' : 'password'} name="password"
                                                        value={formData.password} onChange={handleChange}
                                                        placeholder="Enter your Meesho supplier panel password"
                                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 outline-none transition-all placeholder:text-slate-400 pr-10"
                                                    />
                                                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    </>
                    )}

                    {/* Error / confirmation / warning banner */}
                    {error && (
                        <div className={`p-4 rounded-lg flex items-start gap-3 ${error.type === 'confirmation' ? 'bg-amber-50 text-amber-800' : error.type === 'warning' ? 'bg-blue-50 text-blue-800' : 'bg-red-50 text-red-600'}`}>
                            {error.type === 'confirmation' || error.type === 'warning' ? null : <X size={18} className="mt-0.5 shrink-0" />}
                            <div className="flex-1">
                                <p className="text-sm font-medium">{typeof error === 'string' ? error : (error.message || 'An error occurred')}</p>

                                {error.type === 'warning' && (
                                    <button type="button" onClick={() => { setError(null); onClose(); }} className="mt-3 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all duration-200">
                                        Got it — Close
                                    </button>
                                )}

                                {error.type === 'confirmation' && (
                                    <div className="flex gap-3 mt-3">
                                        <button type="button" onClick={() => { setFormData({ ...formData, password: '' }); setError(null); }} className="px-3 py-1.5 bg-white border border-amber-200 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-50 hover:scale-105 active:scale-95 transition-all duration-200">No</button>
                                        <button type="button" onClick={() => { setError(null); handleSubmit(null, true); }} className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 hover:scale-105 active:scale-95 shadow-sm transition-all duration-200">Yes, Change it</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Footer buttons */}
                    <div className="pt-2 flex justify-end gap-3">
                        {accountSelectionOptions ? (
                            <>
                                <button type="button" onClick={() => { setAccountSelectionOptions(null); setError(null); }} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-50 hover:scale-105 active:scale-95 rounded-xl transition-all duration-200">
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || !selectedSubAccount}
                                    className="bg-brand-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-brand-700 hover:scale-105 active:scale-95 focus:ring-4 focus:ring-brand-600/20 transition-all duration-200 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-brand-600/20 hover:shadow-xl hover:shadow-brand-600/30"
                                >
                                    {loading ? (
                                        <><Loader2 className="animate-spin" size={18} />Connecting...</>
                                    ) : (
                                        <><Save size={18} />Connect Sub-Account</>
                                    )}
                                </button>
                            </>
                        ) : (
                            <>
                                <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-50 hover:scale-105 active:scale-95 rounded-xl transition-all duration-200">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || !publicKey}
                                    className="bg-brand-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-brand-700 hover:scale-105 active:scale-95 focus:ring-4 focus:ring-brand-600/20 transition-all duration-200 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-brand-600/20 hover:shadow-xl hover:shadow-brand-600/30"
                                >
                                    {loading ? (
                                        <><Loader2 className="animate-spin" size={18} />Encrypting...</>
                                    ) : (
                                        <><Save size={18} />{mode === 'update' ? 'Update Securely' : 'Connect Securely'}</>
                                    )}
                                </button>
                            </>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ConnectMarketplaceModal;
