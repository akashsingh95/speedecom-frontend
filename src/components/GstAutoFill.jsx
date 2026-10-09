/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import { useState, useEffect, useRef, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Search, Loader2, X, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useGstAutoFill } from '../hooks/useGstAutoFill';
import { parseGstin } from '../utils/gstinUtils';

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export default function GstAutoFill({ gstin, onGstFetched, disabled, buttonLabel, buttonClassName, buttonRef }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [captchaText, setCaptchaText] = useState('');
    const [gstinValid, setGstinValid] = useState(false);
    const [fetchedData, setFetchedData] = useState(null);
    const prefetchedRef = useRef(false);
    const imgErrorRef = useRef(0);
    const captchaInputRef = useRef(null);

    const {
        captchaImg,
        loadingCaptcha,
        fetchingDetails,
        gstError,
        fetchCaptcha,
        lookupGst,
        resetCaptcha,
    } = useGstAutoFill();

    useEffect(() => {
        setGstinValid(GSTIN_RE.test((gstin || '').trim().toUpperCase()));
    }, [gstin]);

    // Pre-fetch captcha as soon as GSTIN is valid (background)
    useEffect(() => {
        if (gstinValid && !disabled && !modalOpen && !prefetchedRef.current) {
            prefetchedRef.current = true;
            fetchCaptcha();
        }
        if (!gstinValid) {
            prefetchedRef.current = false;
        }
    }, [gstinValid, disabled, modalOpen, fetchCaptcha]);

    // When modal opens, ensure a captcha is loaded and focus input
    useEffect(() => {
        if (modalOpen) {
            setCaptchaText('');
            setFetchedData(null);
            if (!loadingCaptcha) {
                fetchCaptcha();
            }
            const timer = setTimeout(() => {
                captchaInputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
         
    }, [modalOpen]);

    // Focus captcha input when captcha image loads
    useEffect(() => {
        if (modalOpen && !fetchedData) {
            captchaInputRef.current?.focus();
        }
    }, [captchaImg, modalOpen, fetchedData]);

    // Reset error retry count when a new captcha loads
    useEffect(() => {
        if (captchaImg) imgErrorRef.current = 0;
    }, [captchaImg]);

    const handleLookup = async () => {
        const result = await lookupGst(gstin, captchaText);
        if (result) {
            setFetchedData(result);
        } else {
            setCaptchaText('');
            captchaInputRef.current?.focus();
        }
    };

    const handleApply = () => {
        if (fetchedData && onGstFetched) {
            onGstFetched(fetchedData);
        }
        setModalOpen(false);
    };

    const handleClose = () => {
        resetCaptcha();
        setModalOpen(false);
        setFetchedData(null);
        setCaptchaText('');
    };

    const parsed = parseGstin((gstin || '').trim().toUpperCase());

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setModalOpen(true)}
                disabled={disabled || !gstinValid}
                title="Auto-fill GST Details"
                className={buttonClassName || 'p-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center'}
            >
                <Search size={16} />
                {buttonLabel && <span>{buttonLabel}</span>}
            </button>

            <Transition appear show={modalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-50" onClose={handleClose} initialFocus={captchaInputRef}>
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
                    </Transition.Child>

                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <Dialog.Panel className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl">
                                    <div className="flex items-center justify-between mb-5">
                                        <Dialog.Title as="h3" className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                            <Search size={18} className="text-purple-600" />
                                            Auto-fill GST Details
                                        </Dialog.Title>
                                        <button onClick={handleClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                                            <X size={18} />
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        {/* GSTIN Preview */}
                                        <div className="bg-slate-50 rounded-xl p-3">
                                            <p className="text-xs font-semibold text-slate-500 mb-1">GSTIN</p>
                                            <p className="text-sm font-bold font-mono text-slate-800">{gstin?.toUpperCase() || '-'}</p>
                                            {parsed.valid && (
                                                <div className="flex gap-3 mt-1.5 text-xs text-slate-500">
                                                    <span>PAN: <strong className="text-slate-700">{parsed.pan}</strong></span>
                                                    <span>State: <strong className="text-slate-700">{parsed.stateName || parsed.stateCode}</strong></span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Captcha - hidden after successful fetch */}
                                        {!fetchedData && (
                                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold text-slate-500">Verify Captcha</span>
                                                <button
                                                    type="button"
                                                    onClick={fetchCaptcha}
                                                    disabled={loadingCaptcha}
                                                    className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 disabled:opacity-50"
                                                    title="Refresh Captcha"
                                                >
                                                    <RefreshCw size={12} className={loadingCaptcha ? 'animate-spin' : ''} />
                                                    Refresh
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="w-48 h-16 bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                                                    {loadingCaptcha ? (
                                                        <div className="flex items-center gap-1.5 text-slate-400">
                                                            <Loader2 size={13} className="animate-spin" />
                                                            <span className="text-[11px]">Loading...</span>
                                                        </div>
                                                    ) : captchaImg ? (
                                                        <img src={`data:image/png;base64,${captchaImg}`} alt="Captcha" className="h-full w-full object-contain" onError={() => { if (imgErrorRef.current < 2) { imgErrorRef.current += 1; fetchCaptcha(); } }} />
                                                    ) : (
                                                        <span className="text-[11px] text-slate-400">No captcha</span>
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <input
                                                        ref={captchaInputRef}
                                                        type="text"
                                                        value={captchaText}
                                                        onChange={e => setCaptchaText(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                        onKeyDown={e => { if (e.key === 'Enter' && captchaText.length === 6 && !fetchingDetails) handleLookup(); }}
                                                        placeholder="6-digit code"
                                                        maxLength={6}
                                                        className="w-full px-3 py-2.5 text-sm text-center tracking-[0.4em] font-mono font-bold rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 placeholder:tracking-normal placeholder:font-normal"
                                                        autoComplete="off"
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        )}

                                        {/* Error */}
                                        {gstError && (
                                            <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl">
                                                <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                                                <span className="text-xs font-medium text-red-700 leading-relaxed">{gstError}</span>
                                            </div>
                                        )}

                                        {/* Fetched Result */}
                                        {fetchedData && (
                                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
                                                <div className="flex items-center gap-2 text-emerald-700">
                                                    <CheckCircle size={16} />
                                                    <span className="text-sm font-bold">Details Fetched</span>
                                                </div>
                                                <div className="text-sm space-y-1">
                                                    {fetchedData.legalName && (
                                                        <p><span className="text-slate-500 text-xs">Legal Name:</span><br /><span className="font-semibold text-slate-800">{fetchedData.legalName}</span></p>
                                                    )}
                                                    {fetchedData.businessName && (
                                                        <p><span className="text-slate-500 text-xs">Trade Name / Business Name:</span><br /><span className="font-semibold text-slate-800">{fetchedData.businessName}</span></p>
                                                    )}
                                                    {fetchedData.address && (
                                                        <p><span className="text-slate-500 text-xs">Address:</span><br /><span className="text-slate-700">{fetchedData.address}</span></p>
                                                    )}
                                                    {fetchedData.state && (
                                                        <p><span className="text-slate-500 text-xs">State:</span> <span className="text-slate-700">{fetchedData.state}</span></p>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="flex gap-3 pt-2">
                                            <button
                                                type="button"
                                                onClick={handleClose}
                                                className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            {fetchedData ? (
                                                <button
                                                    type="button"
                                                    onClick={handleApply}
                                                    className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <CheckCircle size={16} />
                                                    Auto-fill
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={handleLookup}
                                                    disabled={fetchingDetails || !captchaText || captchaText.length < 6}
                                                    className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                >
                                                    {fetchingDetails ? (
                                                        <><Loader2 size={16} className="animate-spin" /> Fetching...</>
                                                    ) : (
                                                        <><Search size={16} /> Fetch Details</>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </>
    );
}
