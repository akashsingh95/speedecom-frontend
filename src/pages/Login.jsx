import { useState, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    const refs = {
        email: useRef(null),
        password: useRef(null),
    };

    const validate = () => {
        const errors = {};

        if (!email.trim()) {
            errors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            errors.email = 'Please enter a valid email address';
        }

        if (!password) {
            errors.password = 'Password is required';
        }

        return errors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const errors = validate();
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            const firstError = ['email', 'password'].find(f => errors[f]);
            if (firstError) refs[firstError].current?.focus();
            return;
        }

        setFieldErrors({});
        setIsLoading(true);
        try {
            const res = await login(email, password);
            if (res.success) {
                navigate('/dashboard');
            } else {
                setError(res.message);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const clearError = (field) => {
        if (fieldErrors[field]) {
            setFieldErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const inputBase = (field, extra = '') =>
        `w-full pl-11 py-3.5 bg-white/5 border rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all shadow-inner ${extra} ${
            fieldErrors[field]
                ? 'border-red-500/70 focus:ring-red-500/40 focus:border-red-500/70'
                : 'border-white/10 focus:ring-purple-500/50 focus:border-purple-500/50'
        }`;

    return (
        <div className="relative min-h-screen flex items-center justify-center bg-gray-900 overflow-hidden font-sans">
            {/* Background Dynamic Blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-[32rem] h-[32rem] rounded-full bg-purple-600/50 mix-blend-screen filter blur-[128px] animate-pulse transition-all duration-[3000ms]"></div>
            <div className="absolute top-[20%] right-[-10%] w-[32rem] h-[32rem] rounded-full bg-pink-600/50 mix-blend-screen filter blur-[128px] animate-pulse transition-all duration-[4000ms]" style={{ animationDelay: '1s' }}></div>
            <div className="absolute bottom-[-10%] left-[20%] w-[40rem] h-[40rem] rounded-full bg-indigo-600/50 mix-blend-screen filter blur-[128px] animate-pulse transition-all duration-[5000ms]" style={{ animationDelay: '2s' }}></div>

            {/* Glassmorphic Card Container */}
            <div className="relative z-10 w-full max-w-md p-10 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-pink-400 via-purple-400 to-indigo-400 drop-shadow-lg mb-3 tracking-tight">
                        SpeedEcomSolution
                    </h1>
                    <p className="text-gray-300 text-sm tracking-wide font-light">Welcome back! Let's get to work.</p>
                </div>

                {error && (
                    <div className="mb-6 overflow-hidden rounded-xl bg-red-500/10 border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-[pulse_1s_ease-in-out]">
                        <div className="px-4 py-3 flex items-center gap-3">
                            <div className="flex-shrink-0 bg-red-500/20 p-2 rounded-full">
                                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="text-left">
                                <h3 className="text-sm font-bold text-red-400 font-sans tracking-wide">Authentication Failed</h3>
                                <p className="text-xs text-red-300 mt-0.5">{error}</p>
                            </div>
                        </div>
                        <div className="h-0.5 w-full bg-red-500/20">
                            <div className="h-full bg-red-500/60 w-full animate-pulse"></div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                    {/* Email */}
                    <div>
                        <label className="block text-gray-300 text-sm font-medium mb-2 pl-1">Email Address</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400 group-focus-within:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <input
                                ref={refs.email}
                                type="email"
                                placeholder="name@company.com"
                                className={inputBase('email', 'pr-5')}
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); clearError('email'); }}
                            />
                        </div>
                        {fieldErrors.email && (
                            <p className="mt-1 pl-1 text-xs text-red-400 flex items-center gap-1">
                                <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                {fieldErrors.email}
                            </p>
                        )}
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-gray-300 text-sm font-medium mb-2 pl-1">Password</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400 group-focus-within:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <input
                                ref={refs.password}
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                className={inputBase('password', 'pr-12')}
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); clearError('password'); }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(v => !v)}
                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-purple-400 transition-colors"
                            >
                                {showPassword ? (
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                    </svg>
                                ) : (
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        {fieldErrors.password && (
                            <p className="mt-1 pl-1 text-xs text-red-400 flex items-center gap-1">
                                <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                {fieldErrors.password}
                            </p>
                        )}
                        <div className="text-right mt-3 pr-1">
                            <Link to="/forgot-password" className="text-sm text-purple-400 hover:text-purple-300 hover:underline transition-all">
                                Forgot Password?
                            </Link>
                        </div>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full px-6 py-4 text-white font-bold bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 rounded-2xl hover:from-purple-500 hover:via-fuchsia-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all shadow-lg shadow-purple-500/30 transform hover:-translate-y-1 ${isLoading ? 'opacity-75 cursor-not-allowed' : ''}`}
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Signing In...
                                </span>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </div>

                    <div className="text-center mt-8">
                        <p className="text-gray-400 text-sm">
                            New around here?{' '}
                            <Link to="/signup" className="text-purple-400 hover:text-purple-300 font-semibold transition-colors hover:underline">
                                Register Tenant
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

export default Login;
