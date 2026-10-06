import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import GstAutoFill from '../components/GstAutoFill';

const MARKETPLACES_DATA = [
    { "name": "Amazon India (Seller)", "status": "active" },
    { "name": "Flipkart", "status": "active" },
    { "name": "Meesho", "status": "active" },
    { "name": "Myntra", "status": "active" },
    { "name": "Snapdeal", "status": "inactive" }
];

const platformOptions = [
    ...MARKETPLACES_DATA
        .filter(p => p.status === 'active')
        .map(p => p.name === 'Amazon India (Seller)' ? 'Amazon' : p.name),
    'Others'
];

const Signup = () => {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [tenantName, setTenantName] = useState('');
    const [mobileNumber, setMobileNumber] = useState('');
    const [gstin, setGstin] = useState('');
    const [gstDetails, setGstDetails] = useState(null);
    const [address, setAddress] = useState('');
    const [currentAddress, setCurrentAddress] = useState('');
    const [sameAsAbove, setSameAsAbove] = useState(false);
    const [perDayOrder, setPerDayOrder] = useState('');
    const [numberOfAccount, setNumberOfAccount] = useState('');
    const [salesPersonName, setSalesPersonName] = useState('');
    const [platform, setPlatform] = useState('');
    const [otherPlatform, setOtherPlatform] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const gstinCursorRef = useRef(null);
    const [fieldErrors, setFieldErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const { signupTenant } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const gstButtonRef = useRef(null);

    const refs = {
        fullName: useRef(null),
        gstin: useRef(null),
        tenantName: useRef(null),
        mobileNumber: useRef(null),
        email: useRef(null),
        password: useRef(null),
        address: useRef(null),
        currentAddress: useRef(null),
        perDayOrder: useRef(null),
        numberOfAccount: useRef(null),
        salesPersonName: useRef(null),
        platform: useRef(null),
        otherPlatform: useRef(null),
    };

useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useLayoutEffect(() => {
        if (gstinCursorRef.current !== null && refs.gstin.current) {
            refs.gstin.current.setSelectionRange(gstinCursorRef.current, gstinCursorRef.current);
        }
    }, [gstin]);

    const handleGstinChange = (e) => {
        gstinCursorRef.current = e.target.selectionStart;
        setGstin(e.target.value.toUpperCase());
        setGstDetails(null);
        clearError('gstin');
    };

    const handlePlatformToggle = (option) => {
        let currentSelected = platform ? platform.split(',').map(p => p.trim()).filter(Boolean) : [];
        if (currentSelected.includes(option)) {
            currentSelected = currentSelected.filter(p => p !== option);
            if (option === 'Others') {
                setOtherPlatform('');
            }
        } else {
            currentSelected = [...currentSelected, option];
        }
        setPlatform(currentSelected.join(', '));
        clearError('platform');
        clearError('otherPlatform');
    };

    const selectedList = platform ? platform.split(',').map(p => p.trim()).filter(Boolean) : [];

    const validate = () => {
        const errors = {};

        const fullNameValue = fullName.trim();
        if (!fullNameValue) {
            errors.fullName = 'Full name is required';
        }else if (!/^[A-Za-z\s]+$/.test(fullNameValue)) {
            errors.fullName = 'Full name can contain letters and spaces only';
        }

        const gstinValue = gstin.trim();
        if (!gstinValue) {
            errors.gstin = 'GSTIN is required';
        } else if (gstinValue.length !== 15) {
            errors.gstin = 'GSTIN must be exactly 15 characters';
        } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstinValue)) {
            errors.gstin = 'Please enter a valid GSTIN (e.g., 27AAACR4498R1ZV)';
        }

        const tenantNameValue = tenantName.trim();
        if (!tenantNameValue) {
            errors.tenantName = 'Company name is required';
        } else if (/^[0-9]+$/.test(tenantNameValue)) {
            errors.tenantName = 'Company name cannot contain numbers only';
        }

        const mobileValue = mobileNumber.trim().replace(/\s+/g, '');
        const mobileDigits = mobileValue.replace(/^\+91/, '');
        if (!mobileValue) {
            errors.mobileNumber = 'Mobile number is required';
        } else if (!/^(\+91)?\d{10}$/.test(mobileValue)) {
            errors.mobileNumber = 'Enter a valid 10-digit Indian mobile number (with or without +91)';
        } else if (!/^[6-9]/.test(mobileDigits)) {
            errors.mobileNumber = 'Mobile number must start with 6, 7, 8, or 9';
        }

        const emailValue = email.trim();
        if (!emailValue) {
            errors.email = 'Email is required';
        } else if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(emailValue)) {
            errors.email = 'Please enter a valid email address';
        }

        if (!password) {
            errors.password = 'Password is required';
        } else if (password.length < 8) {
            errors.password = 'Password must be at least 8 characters';
        }

        if (!address.trim()) {
            errors.address = 'GST address is required';
        }

        if (!currentAddress.trim()) {
            errors.currentAddress = 'Current address is required';
        }

        const perDayOrderValue = perDayOrder.trim();
        if (!perDayOrderValue) {
            errors.perDayOrder = 'Per day order is required';
        } else if (!/^[0-9]+$/.test(perDayOrderValue)) {
            errors.perDayOrder = 'Per day order must contain numbers only';
        } else if (parseInt(perDayOrderValue, 10) <= 0) {
            errors.perDayOrder = 'Per day order must be a positive number';
        }

        const numberOfAccountValue = numberOfAccount.trim();
        if (!numberOfAccountValue) {
            errors.numberOfAccount = 'Number of account is required';
        } else if (!/^[0-9]+$/.test(numberOfAccountValue)) {
            errors.numberOfAccount = 'Number of account must contain numbers only';
        }

        const salesPersonNameValue = salesPersonName.trim();
        if (!salesPersonNameValue) {
            errors.salesPersonName = 'Sales person name is required';
        } else if (!/^[A-Za-z\s]+$/.test(salesPersonNameValue)) {
            errors.salesPersonName = 'Sales person name can contain letters and spaces only';
        }

        if (!platform.trim()) {
           errors.platform = 'Please select at least one platform';
        } else if (selectedList.includes('Others') && !otherPlatform.trim()) {
            errors.otherPlatform = 'Please specify your other marketplace name';
        }

        return errors;
    };

    const handleGstFetched = (data) => {
        setGstDetails({
            businessName: data.businessName,
            gstin: data.gstin,
            pan: data.pan,
            address: data.address,
            state: data.state,
            stateCode: data.stateCode,
        });
        if (data.legalName) {
            setFullName(data.legalName);
        }
        if (data.tradeName || data.businessName) {
            setTenantName(data.tradeName || data.businessName);
        }
        if (data.address) {
            setAddress(data.address);
        }
        toast.success('GST details auto-filled');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const errors = validate();
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            // Focus the first invalid field
            const order = ['gstin', 'fullName', 'tenantName', 'mobileNumber', 'email', 'password', 'address', 'currentAddress', 'perDayOrder', 'numberOfAccount', 'salesPersonName', 'platform', 'otherPlatform'];
            const firstError = order.find(f => errors[f]);
            if (firstError && refs[firstError]?.current) {
                refs[firstError].current.focus();
            }
            return;
        }

        setFieldErrors({});
        setIsLoading(true);
        try {
           const cleanMobile = mobileNumber.trim().replace(/\s+/g, '');
            const formattedMobile = cleanMobile.startsWith('+91')
                ? cleanMobile
                : `+91${cleanMobile.replace(/^0+/, '')}`;

            const finalPlatformList = selectedList.map(p => p === 'Others' ? otherPlatform.trim() : p).filter(Boolean);
            const finalPlatformString = finalPlatformList.join(', ');

            const res = await signupTenant(
                fullName.trim(),
                email.trim(),
                password,
                tenantName.trim(),
                formattedMobile,
                gstDetails ? {
                    ...gstDetails,
                    address: address.trim(),
                    phone: formattedMobile,
                    currentAddress: currentAddress.trim(),
                } : {
                    businessName: tenantName.trim(),
                    gstin: gstin.trim(),
                    pan: '',
                    address: address.trim(),
                    state: '',
                    stateCode: '',
                    phone: formattedMobile,
                    currentAddress: currentAddress.trim(),
                }, {
                    perDayOrder: parseInt(perDayOrder, 10) || 0,
                    numberOfAccount: parseInt(numberOfAccount, 10) || 0,
                    salesPersonName: salesPersonName.trim(),
                    platform: finalPlatformString,
                }
            );
            if (res.success) {
                toast.success('Registration successful! Please wait for SuperAdmin approval.');
                navigate('/login');
            } else {
                setError(res.message);
            }
        } finally {
            setIsLoading(false);
        }
    };


    const handleSameAsAbove = (checked) => {
        setSameAsAbove(checked);
        if (checked) {
            setCurrentAddress(address);
        } else {
            setCurrentAddress('');
        }
    };

    // Keep secondary (current) address synchronized with primary (GST) address when "Same as above" is checked
    useEffect(() => {
        if (sameAsAbove) {
            setCurrentAddress(address);
            setFieldErrors(prev => prev.currentAddress ? { ...prev, currentAddress: '' } : prev);
        }
    }, [address, sameAsAbove]);

    const clearError = (field) => {
        if (fieldErrors[field]) {
            setFieldErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const inputClass = (field) =>
        `w-full px-3 py-2.5 bg-white/5 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all shadow-inner text-sm ${fieldErrors[field]
            ? 'border-red-500/70 focus:ring-red-500/40 focus:border-red-500/70'
            : 'border-white/10 focus:ring-purple-500/50 focus:border-purple-500/50'
        }`;

    const errorClass = 'mt-0.5 pl-1 text-[11px] text-red-400 flex items-center gap-1';

    return (
        <div className="relative min-h-screen flex items-center justify-center bg-gray-900 overflow-hidden font-sans py-12">
            {/* Background Dynamic Blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-[32rem] h-[32rem] rounded-full bg-purple-600/50 mix-blend-screen filter blur-[128px] animate-pulse transition-all duration-[3000ms]"></div>
            <div className="absolute top-[20%] right-[-10%] w-[32rem] h-[32rem] rounded-full bg-pink-600/50 mix-blend-screen filter blur-[128px] animate-pulse transition-all duration-[4000ms]" style={{ animationDelay: '1s' }}></div>
            <div className="absolute bottom-[-10%] left-[20%] w-[40rem] h-[40rem] rounded-full bg-indigo-600/50 mix-blend-screen filter blur-[128px] animate-pulse transition-all duration-[5000ms]" style={{ animationDelay: '2s' }}></div>

            {/* Glassmorphic Card Container */}
            <div className="relative z-10 w-full max-w-lg p-6 sm:p-8 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl">
                <div className="text-center mb-5">
                    <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-pink-400 via-purple-400 to-indigo-400 drop-shadow-lg mb-1 tracking-tight">
                        Join SpeedEcom
                    </h1>
                    <p className="text-gray-300 text-xs tracking-wide font-light">Register a new tenant account</p>
                </div>

                {error && (
                    <div className="mb-4 overflow-hidden rounded-lg bg-red-500/10 border border-red-500/50">
                        <div className="px-3 py-2 flex items-center gap-2">
                            <div className="flex-shrink-0 bg-red-500/20 p-1.5 rounded-full">
                                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="text-left w-full">
                                <h3 className="text-xs font-bold text-red-400">Registration Failed</h3>
                                <p className="text-[11px] text-red-300">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3" noValidate>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Row 1: GSTIN + Full Name */}
                        <div>
                            <label className="block text-gray-300 text-[11px] font-medium mb-0.5 pl-1">GSTIN <span className="text-red-400">*</span></label>
                            <div className="relative">
                                <input
                                    ref={refs.gstin}
                                    type="text"
                                    placeholder="27AAACR4498R1ZV"
                                    className={inputClass('gstin') + ' w-full pr-10'}
                                    value={gstin}
                                    onChange={handleGstinChange}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && gstin.trim().length === 15) gstButtonRef.current?.click(); }}
                                    autoComplete="off"
                                    maxLength={15}
                                />
                                <div className="absolute right-1 top-1/2 -translate-y-1/2">
                                    <GstAutoFill
                                        gstin={gstin}
                                        onGstFetched={handleGstFetched}
                                        disabled={!gstin || gstin.length < 15}
                                        buttonRef={gstButtonRef}
                                        buttonClassName="p-1.5 rounded-lg bg-transparent text-purple-400 hover:text-purple-300 hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                                    />
                                </div>
                            </div>
                            {gstDetails && (
                                <div className="mt-1.5 flex items-center gap-1.5 justify-end">
                                    <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                                    <span className="text-[10px] text-emerald-400/70">Validated</span>
                                </div>
                            )}
                            {fieldErrors.gstin && <p className={errorClass}>{fieldErrors.gstin}</p>}
                        </div>
                        <div>
                            <label className="block text-gray-300 text-[11px] font-medium mb-0.5 pl-1">Full Name <span className="text-red-400">*</span></label>
                            <input
                                ref={refs.fullName}
                                type="text"
                                placeholder="Rahul Sharma"
                                className={inputClass('fullName')}
                                value={fullName}
                                onChange={(e) => { setFullName(e.target.value); clearError('fullName'); }}
                            />
                            {fieldErrors.fullName && <p className={errorClass}>{fieldErrors.fullName}</p>}
                        </div>

                        {/* Row 2: Company Name + Mobile */}
                        <div>
                            <label className="block text-gray-300 text-[11px] font-medium mb-0.5 pl-1">Company Name <span className="text-red-400">*</span></label>
                            <div className="relative">
                                <input
                                    ref={refs.tenantName}
                                    type="text"
                                    placeholder="Acme Corp"
                                    className={`${inputClass('tenantName')} ${gstDetails ? 'pr-8' : ''}`}
                                    value={tenantName}
                                    onChange={(e) => { setTenantName(e.target.value); clearError('tenantName'); }}
                                    disabled={!!gstDetails}
                                />
                                {gstDetails && (
                                    <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                )}
                            </div>
                            {fieldErrors.tenantName && <p className={errorClass}>{fieldErrors.tenantName}</p>}
                        </div>
                        <div>
                            <label className="block text-gray-300 text-[11px] font-medium mb-0.5 pl-1">Mobile <span className="text-red-400">*</span></label>
                            <input
                                ref={refs.mobileNumber}
                                type="tel"
                                placeholder="+919876543210"
                                className={inputClass('mobileNumber')}
                                value={mobileNumber}
                                onChange={(e) => { setMobileNumber(e.target.value); clearError('mobileNumber'); }}
                            />
                            {fieldErrors.mobileNumber && <p className={errorClass}>{fieldErrors.mobileNumber}</p>}
                        </div>

                        {/* Row 3: Email + Password */}
                        <div>
                            <label className="block text-gray-300 text-[11px] font-medium mb-0.5 pl-1">Email <span className="text-red-400">*</span></label>
                            <input
                                ref={refs.email}
                                type="email"
                                placeholder="name@company.com"
                                className={inputClass('email')}
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); clearError('email'); }}
                            />
                            {fieldErrors.email && <p className={errorClass}>{fieldErrors.email}</p>}
                        </div>
                        <div>
                            <label className="block text-gray-300 text-[11px] font-medium mb-0.5 pl-1">Password <span className="text-red-400">*</span></label>
                            <div className="relative">
                                <input
                                    ref={refs.password}
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    className={`${inputClass('password')} pr-10`}
                                    value={password}
                                    onChange={(e) => { setPassword(e.target.value); clearError('password'); }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(v => !v)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-purple-400 transition-colors"
                                >
                                    {showPassword ? (
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                            {fieldErrors.password && <p className={errorClass}>{fieldErrors.password}</p>}
                            {!fieldErrors.password && <p className="mt-0.5 pl-1 text-[11px] text-gray-500">Min 8 characters</p>}
                        </div>

                        {/* Row 4: GST Address */}
                        <div className="sm:col-span-2">
                            <label className="block text-gray-300 text-[11px] font-medium mb-0.5 pl-1">GST Address <span className="text-red-400">*</span></label>
                            <div className="relative">
                                <textarea
                                    ref={refs.address}
                                    rows={2}
                                    placeholder="Auto-filled from GST details"
                                    className={`w-full px-3 py-2 bg-white/5 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all shadow-inner text-sm resize-none ${fieldErrors.address
                                            ? 'border-red-500/70 focus:ring-red-500/40'
                                            : 'border-white/10 focus:ring-purple-500/50'
                                        } ${gstDetails ? 'pr-8' : ''}`}
                                    value={address}
                                    onChange={(e) => { setAddress(e.target.value); clearError('address'); }}
                                    disabled={!!gstDetails}
                                />
                                {gstDetails && (
                                    <svg className="absolute right-2.5 top-3 w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                )}
                            </div>
                            {fieldErrors.address && <p className={errorClass}>{fieldErrors.address}</p>}
                        </div>

                        {/* Row 5: Current Address with Same as Above */}
                        <div className="sm:col-span-2">
                            <div className="flex items-center gap-2 mb-1.5">
                                <label className="text-gray-300 text-[11px] font-medium pl-1">Current Address <span className="text-red-400">*</span></label>
                                <label className="flex items-center gap-1.5 text-gray-400 text-[11px] cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={sameAsAbove}
                                        onChange={(e) => handleSameAsAbove(e.target.checked)}
                                        className="w-3 h-3 rounded border-gray-500 bg-white/10 text-purple-500 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
                                    />
                                    Same as above
                                </label>
                            </div>
                            <textarea
                                ref={refs.currentAddress}
                                rows={2}
                                placeholder="Enter current address or check 'Same as above'"
                                className={`w-full px-3 py-2 bg-white/5 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all shadow-inner text-sm resize-none ${fieldErrors.currentAddress
                                        ? 'border-red-500/70 focus:ring-red-500/40'
                                        : 'border-white/10 focus:ring-purple-500/50'
                                    }`}
                                value={currentAddress}
                                onChange={(e) => { setCurrentAddress(e.target.value); setSameAsAbove(false); clearError('currentAddress'); }}
                            />
                            {fieldErrors.currentAddress && <p className={errorClass}>{fieldErrors.currentAddress}</p>}
                        </div>

                        {/* Row 6: Per Day Order + Number of Account */}
                        <div>
                            <label className="block text-gray-300 text-[11px] font-medium mb-0.5 pl-1">Per Day Order <span className="text-red-400">*</span></label>
                            <input
                                ref={refs.perDayOrder}
                                type="number"
                                placeholder="e.g., 50"
                                className={inputClass('perDayOrder')}
                                value={perDayOrder}
                                onChange={(e) => { setPerDayOrder(e.target.value); clearError('perDayOrder'); }}
                                min="0"
                            />
                            {fieldErrors.perDayOrder && <p className={errorClass}>{fieldErrors.perDayOrder}</p>}
                        </div>
                        <div>
                            <label className="block text-gray-300 text-[11px] font-medium mb-0.5 pl-1">Number of Account <span className="text-red-400">*</span></label>
                            <input
                                ref={refs.numberOfAccount}
                                type="number"
                                placeholder="e.g., 10"
                                className={inputClass('numberOfAccount')}
                                value={numberOfAccount}
                                onChange={(e) => { setNumberOfAccount(e.target.value); clearError('numberOfAccount'); }}
                                min="0"
                            />
                            {fieldErrors.numberOfAccount && <p className={errorClass}>{fieldErrors.numberOfAccount}</p>}
                        </div>

                        {/* Row 7: Sales Person Name + Platform */}
                        <div>
                            <label className="block text-gray-300 text-[11px] font-medium mb-0.5 pl-1">Sales Person Name <span className="text-red-400">*</span></label>
                            <input
                                ref={refs.salesPersonName}
                                type="text"
                                placeholder="Amit Patel"
                                className={inputClass('salesPersonName')}
                                value={salesPersonName}
                                onChange={(e) => { setSalesPersonName(e.target.value); clearError('salesPersonName'); }}
                            />
                            {fieldErrors.salesPersonName && <p className={errorClass}>{fieldErrors.salesPersonName}</p>}
                        </div>
                        <div>
                            <label className="block text-gray-300 text-[11px] font-medium mb-0.5 pl-1">Platform <span className="text-red-400">*</span></label>
                                             <div className="relative font-sans text-sm" ref={dropdownRef}>
                                <button
                                    ref={refs.platform}
                                    type="button"
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className={`${inputClass('platform')} flex items-center justify-between text-left min-h-[42px] cursor-pointer`}
                                >
                                    <div className="flex flex-wrap gap-1 max-w-[90%]">
                                        {selectedList.length > 0 ? (
                                            selectedList.map((p) => (
                                                <span
                                                    key={p}
                                                    className="inline-flex items-center gap-1 bg-purple-500/20 text-purple-300 text-[10px] px-2 py-0.5 rounded-md border border-purple-500/30"
                                                >
                                                    {p}
                                                    <span
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handlePlatformToggle(p);
                                                        }}
                                                        className="hover:bg-purple-500/30 rounded px-1 py-0.5 text-[9px] leading-none transition-colors cursor-pointer"
                                                    >
                                                        &times;
                                                    </span>
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-gray-500">Select platforms...</span>
                                        )}
                                    </div>
                                    <svg
                                        className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {isDropdownOpen && (
                                    <div className="absolute z-50 w-full bottom-full mb-1.5 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl overflow-hidden py-1">
                                        {platformOptions.map((option) => {
                                            const isSelected = selectedList.includes(option);
                                            return (
                                                <div
                                                    key={option}
                                                    onClick={() => handlePlatformToggle(option)}
                                                    className={`flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 cursor-pointer transition-colors ${isSelected ? 'bg-purple-500/10' : ''
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        readOnly
                                                        className="w-3.5 h-3.5 rounded border-gray-500 bg-white/5 text-purple-500 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
                                                    />
                                                    <span className="font-medium">{option}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            {fieldErrors.platform && <p className={errorClass}>{fieldErrors.platform}</p>}
                            {selectedList.includes('Others') && (
                                <div className="mt-2.5">
                                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                                        Specify Other Marketplace Name <span className="text-purple-400">*</span>
                                    </label>
                                    <input
                                        ref={refs.otherPlatform}
                                        type="text"
                                        value={otherPlatform}
                                        onChange={(e) => {
                                            setOtherPlatform(e.target.value);
                                            clearError('otherPlatform');
                                        }}
                                        placeholder="e.g. JioMart, Ajio, Nykaa"
                                        className="w-full px-3.5 py-2.5 text-sm text-gray-200 bg-gray-900/60 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-500 transition-all"
                                    />
                                    {fieldErrors.otherPlatform && <p className={errorClass}>{fieldErrors.otherPlatform}</p>}
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full py-2.5 text-sm font-bold text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 rounded-lg hover:from-purple-500 hover:via-fuchsia-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all shadow-lg shadow-purple-500/30 ${isLoading ? 'opacity-75 cursor-not-allowed' : ''}`}
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Creating Account...
                            </span>
                        ) : (
                            'Create Account'
                        )}
                    </button>

                    <div className="text-center pt-1">
                        <p className="text-gray-400 text-xs">
                            Already have an account?{' '}
                            <Link to="/login" className="text-purple-400 hover:text-purple-300 font-semibold transition-colors hover:underline">
                                Log In
                            </Link>
                        </p>
                    </div>
                </form>
            </div>

            {/* Subtle Overlay Pattern */}
            <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNykiLz48L3N2Zz4=')] opacity-60"></div>
        </div>
    );
};

export default Signup;
