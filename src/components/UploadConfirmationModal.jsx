import React, { useState, useEffect, useRef } from 'react';
import hindiAudio   from '../assets/sounds/Upload_Confirmation_Hindi.mp3';
import englishAudio from '../assets/sounds/Upload_Confirmation_English.mp3';
import {
    X, FileSpreadsheet, Upload, Clock, CheckCircle,
    DollarSign, Package, TrendingUp, RefreshCw, FileBarChart,
    FileText, AlertCircle, RotateCcw, Volume2, VolumeX
} from 'lucide-react';
import { getMarketplaceLogo } from '../utils/marketplaceLogos';

const COUNTDOWN = 8;

const TYPE_CONFIG = {
    orders:          { label: 'Orders',           sub: 'Order sheet data',          Icon: FileSpreadsheet },
    payments:        { label: 'Payments',          sub: 'Payment settlement',         Icon: DollarSign      },
    ads:             { label: 'Ads',               sub: 'Ads campaign reports',       Icon: TrendingUp      },
    costsheet:       { label: 'Cost Sheet',        sub: 'Cost sheet data',            Icon: FileText        },
    meesho_payments: { label: 'Meesho Payments',   sub: 'Payment settlement',         Icon: DollarSign      },
    meesho_sales:    { label: 'Meesho Sales',      sub: 'Sales data',                 Icon: Package         },
    meesho_claims:   { label: 'Meesho Claims',     sub: 'Claims data',                Icon: AlertCircle     },
    meesho_returns:  { label: 'Meesho Returns',    sub: 'Returns data',               Icon: RotateCcw       },
    amazon_payments: { label: 'Amazon Payments',   sub: 'Settlements',                Icon: DollarSign      },
    amazon_orders:   { label: 'Amazon Orders',     sub: 'Order data',                 Icon: Package         },
    amazon_ads:      { label: 'Amazon Ads',        sub: 'Brand / Display / Product',  Icon: TrendingUp      },
    amazon_returns:  { label: 'Amazon Returns',    sub: 'FBA / Flex / SmartHub',      Icon: RefreshCw       },
    amazon_b2b_b2c:  { label: 'Amazon B2B / B2C', sub: 'Tax invoices',               Icon: FileBarChart    },
    myntra_payments: { label: 'Myntra Payments',   sub: 'Payment settlement',         Icon: DollarSign      },
    myntra_orders:   { label: 'Myntra Orders',     sub: 'Order data',                 Icon: Package         },
    myntra_returns_seller: { label: 'Myntra Returns', sub: 'Seller returns',          Icon: RotateCcw       },
    myntra_returns_delivery: { label: 'Myntra Returns', sub: 'Delivery returns',      Icon: RefreshCw       },
};

const fmtBytes = (b) => {
    if (b < 1024)    return `${b} B`;
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1048576).toFixed(1)} MB`;
};

/* Animated underline sweep: background-size animates 0%→100% left-to-right along the bottom edge. */
const hl = (active) => ({
    backgroundImage: 'linear-gradient(rgba(255, 234, 0, 0.9), rgba(255, 234, 0, 0.9))',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'left bottom',
    backgroundSize: active ? '100% 3px' : '0% 3px',
    transition: 'background-size 0.75s cubic-bezier(0.4, 0, 0.2, 1)',
    paddingBottom: '2px',
});

const Ring = ({ s, total }) => {
    const r = 8;
    const circ = 2 * Math.PI * r;
    return (
        <span className="relative inline-flex items-center justify-center w-[22px] h-[22px] flex-shrink-0">
            <svg className="absolute -rotate-90" width="22" height="22" viewBox="0 0 22 22">
                <circle cx="11" cy="11" r={r} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="2.5" />
                <circle
                    cx="11" cy="11" r={r} fill="none"
                    stroke="rgba(255,255,255,.7)"
                    strokeWidth="2.5"
                    strokeDasharray={circ}
                    strokeDashoffset={circ - ((total - s) / total) * circ}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
            </svg>
            <span className="text-[10px] font-bold text-white/80 z-10 leading-none">{s}</span>
        </span>
    );
};

const UploadConfirmationModal = ({
    isOpen,
    files = [],
    uploadType,
    marketplaceName,
    accountName,
    onConfirm,
    onCancel,
}) => {
    const [countdown, setCountdown]   = useState(COUNTDOWN);
    const [hlAccount, setHlAccount]   = useState(false);
    const [hlType,    setHlType]      = useState(false);
    const [isMuted,   setIsMuted]     = useState(() => localStorage.getItem('upload_speech_muted') === 'true');
    const [speechLang, setSpeechLang] = useState(() => localStorage.getItem('upload_speech_lang') || 'hi-IN');
    const isMutedRef    = useRef(isMuted);
    const speechLangRef = useRef(speechLang);
    const audioRef      = useRef(null);
    useEffect(() => { isMutedRef.current = isMuted; },    [isMuted]);
    useEffect(() => { speechLangRef.current = speechLang; }, [speechLang]);

    const logoUrl = getMarketplaceLogo(marketplaceName);
    const { label, sub, Icon: TypeIcon } = TYPE_CONFIG[uploadType] || { label: uploadType, sub: '', Icon: FileSpreadsheet };
    const ready = countdown === 0;

    /* Countdown */
    useEffect(() => {
        if (!isOpen) return;
        setCountdown(COUNTDOWN);
        const id = setInterval(() => {
            setCountdown(p => { if (p <= 1) { clearInterval(id); return 0; } return p - 1; });
        }, 1000);
        return () => clearInterval(id);
    }, [isOpen]);

    /* Audio playback using pre-recorded files */
    const speakDetails = (langOpt = speechLang) => {
        try {
            if (!audioRef.current) {
                audioRef.current = new Audio();
            }
            const audio = audioRef.current;
            audio.pause();
            audio.src = langOpt === 'hi-IN' ? hindiAudio : englishAudio;
            audio.volume = 0.85;
            audio.play().catch(() => {});
        } catch (_) {}
    };

    const toggleMute = () => {
        const newState = !isMuted;
        setIsMuted(newState);
        localStorage.setItem('upload_speech_muted', String(newState));
        if (!newState) {
            speakDetails(speechLang);
        } else {
            if (audioRef.current) {
                audioRef.current.pause();
            }
        }
    };

    const selectLang = (newLang) => {
        if (speechLang === newLang) return;
        setSpeechLang(newLang);
        localStorage.setItem('upload_speech_lang', newLang);
        if (!isMuted) {
            speakDetails(newLang); // Automatically read in new language if not muted
        }
    };

    /* Highlighter sweep + Auto-speak */
    useEffect(() => {
        if (!isOpen) {
            setHlAccount(false);
            setHlType(false);
            return;
        }

        /* Reset so animation replays every time modal opens */
        setHlAccount(false);
        setHlType(false);

        /* Account name sweeps first */
        const t1 = setTimeout(() => setHlAccount(true), 400);
        /* Upload type sweeps 700ms later */
        const t2 = setTimeout(() => setHlType(true),    1100);
        
        /* Auto-speak when modal opens */
        const t3 = setTimeout(() => {
            if (!isMutedRef.current) speakDetails(speechLangRef.current);
        }, 350);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            if (audioRef.current) { audioRef.current.pause(); }
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-[3px] flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden ring-1 ring-black/5">

                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-200 flex-shrink-0">
                            <Upload size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-900 leading-tight">Confirm Upload</h2>
                            <p className="text-[11px] text-gray-400 leading-tight mt-0.5">Review carefully before proceeding</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="flex bg-gray-100 rounded-lg p-0.5 mr-1 items-center">
                            <button
                                onClick={() => selectLang('en-US')}
                                title="English"
                                className={`px-2 py-1 text-[10px] font-bold rounded-md uppercase transition-all ${
                                    speechLang === 'en-US' 
                                        ? 'bg-white text-blue-600 shadow-sm' 
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                ENG
                            </button>
                            <button
                                onClick={() => selectLang('hi-IN')}
                                title="हिंदी"
                                className={`px-2 py-1 text-[10px] font-bold rounded-md uppercase transition-all ${
                                    speechLang === 'hi-IN' 
                                        ? 'bg-white text-blue-600 shadow-sm' 
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                हिंदी
                            </button>
                        </div>
                        <button
                            onClick={toggleMute}
                            title={isMuted ? "ऑटो-स्पीक चालू करें (Enable Auto-Speak)" : "ऑटो-स्पीक बंद करें (Disable Auto-Speak)"}
                            className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                                isMuted 
                                    ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100' 
                                    : 'text-blue-500 hover:text-blue-700 hover:bg-blue-50'
                            }`}
                        >
                            {isMuted ? <VolumeX size={23} /> : <Volume2 size={23} />}
                        </button>
                        <button
                            onClick={onCancel}
                            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
                        >
                            <X size={23} />
                        </button>
                    </div>
                </div>

                <div className="px-6 space-y-3 pb-5">

                    {/* ① Account — dark hero card */}
                    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 border border-slate-700/60 p-4 flex items-center gap-4 shadow-lg">
                        {/* subtle top-right glow */}
                        <div className="pointer-events-none absolute -top-6 -right-6 w-28 h-28 rounded-full bg-blue-500/10 blur-2xl" />
                        {/* Logo — slightly inset dark background so logo pops */}
                        <div className="flex-shrink-0 relative z-10 w-[60px] h-[60px] bg-slate-700/70 rounded-2xl ring-1 ring-white/10 flex items-center justify-center overflow-hidden shadow-inner">
                            {logoUrl
                                ? <img src={logoUrl} alt={marketplaceName} className="w-[42px] h-[42px] object-contain" />
                                : <Upload size={22} className="text-slate-400" />
                            }
                        </div>
                        <div className="min-w-0 flex-1 overflow-hidden relative z-10">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em] mb-1.5">
                                Uploading to account
                            </p>
                            {/* Yellow sweep on dark = neon marker effect */}
                            <p className="text-[22px] font-semibold text-white leading-tight truncate tracking-tight drop-shadow-sm">
                                <span style={hl(hlAccount)} >{accountName || '—'}</span>
                            </p>
                        </div>
                    </div>

                    {/* ② Upload Type — dark secondary card */}
                    <div className="relative flex items-center gap-3 px-4 py-3.5 rounded-2xl overflow-hidden bg-gradient-to-r from-blue-950 to-indigo-950 border border-blue-800/50 shadow-md">
                        {/* subtle left glow */}
                        <div className="pointer-events-none absolute -left-4 top-0 bottom-0 w-16 bg-blue-500/10 blur-xl" />
                        <div className="relative z-10 w-9 h-9 bg-blue-800/60 rounded-xl ring-1 ring-blue-500/30 flex items-center justify-center flex-shrink-0">
                            <TypeIcon size={16} className="text-blue-300" />
                        </div>
                        <div className="flex-1 min-w-0 relative z-10">
                            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.14em] leading-none mb-1">Upload Type</p>
                            {/* Yellow sweep on dark blue = vivid contrast */}
                            <p className="text-sm font-bold text-white leading-tight">
                                <span style={hl(hlType)}>{label}</span>
                            </p>
                        </div>
                        {sub && (
                            <span className="text-[11px] text-blue-400 font-medium flex-shrink-0 hidden sm:block relative z-10">{sub}</span>
                        )}
                    </div>

                    {/* ③ Files */}
                    <div>
                        <div className="flex items-center justify-between mb-2 px-0.5">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em]">Files</span>
                            <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
                                {files.length} {files.length === 1 ? 'file' : 'files'}
                            </span>
                        </div>

                        <div className="rounded-2xl border border-gray-100 overflow-hidden max-h-[200px] overflow-y-auto custom-scrollbar bg-gray-50/70">
                            {files.map((file, i) => {
                                const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
                                return (
                                    <div
                                        key={fileKey}
                                        className={`flex items-start gap-3 px-3.5 py-2.5 ${i > 0 ? 'border-t border-gray-100' : ''}`}
                                    >
                                        <FileSpreadsheet size={13} className="flex-shrink-0 mt-0.5 text-gray-400" />
                                        <span className="text-xs font-medium flex-1 break-all leading-relaxed text-gray-700">
                                            {file.name}
                                        </span>
                                        <span className="text-[11px] text-gray-400 tabular-nums flex-shrink-0 mt-0.5 pl-2">
                                            {fmtBytes(file.size)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 pt-1 space-y-3 border-t border-gray-100">
                    <div className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-medium mt-3 transition-all ${
                        ready
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                            : 'bg-amber-50 border border-amber-200 text-amber-700'
                    }`}>
                        {ready
                            ? <CheckCircle size={13} className="flex-shrink-0" />
                            : <Clock size={13} className="flex-shrink-0" />
                        }
                        {ready
                            ? <span>All clear — you can now confirm the upload.</span>
                            : <span>Please review the details above. Confirm enables in <strong>{countdown}s</strong>.</span>
                        }
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 h-11 text-sm font-semibold text-gray-600 bg-white border-2 border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={ready ? onConfirm : undefined}
                            disabled={!ready}
                            className={`flex-1 h-11 flex items-center justify-center gap-2 text-sm font-bold rounded-2xl transition-all ${
                                ready
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 hover:-translate-y-px active:translate-y-0'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            {!ready
                                ? <><Ring s={countdown} total={COUNTDOWN} /> Confirm Upload</>
                                : <><Upload size={14} /> Confirm Upload</>
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UploadConfirmationModal;
