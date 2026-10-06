import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import api from '../api';
import { toast } from 'sonner';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!email || !email.trim()) {
            toast.error('Please enter your email address');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            toast.error('Please enter a valid email address');
            return;
        }

        setLoading(true);
        try {
            const { data } = await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
            setEmailSent(true);
            toast.success(data.message || 'Password reset email sent!');
        } catch (error) {
            console.error('Forgot password error:', error);
            setEmailSent(true);
        } finally {
            setLoading(false);
        }
    };

    const GlobalBackground = () => (
        <>
            <div className="absolute top-[-10%] left-[-10%] w-[32rem] h-[32rem] rounded-full bg-purple-600/50 mix-blend-screen filter blur-[128px] animate-pulse transition-all duration-[3000ms]"></div>
            <div className="absolute top-[20%] right-[-10%] w-[32rem] h-[32rem] rounded-full bg-pink-600/50 mix-blend-screen filter blur-[128px] animate-pulse transition-all duration-[4000ms]" style={{ animationDelay: '1s' }}></div>
            <div className="absolute bottom-[-10%] left-[20%] w-[40rem] h-[40rem] rounded-full bg-indigo-600/50 mix-blend-screen filter blur-[128px] animate-pulse transition-all duration-[5000ms]" style={{ animationDelay: '2s' }}></div>
            <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNykiLz48L3N2Zz4=')] opacity-60"></div>
        </>
    );

    if (emailSent) {
        return (
            <div className="relative min-h-screen flex items-center justify-center bg-gray-900 overflow-hidden font-sans py-12 px-4">
                <GlobalBackground />
                <div className="relative z-10 w-full max-w-md p-10 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl">
                    <div className="flex justify-center mb-6 relative">
                        <div className="absolute inset-0 bg-green-500/20 blur-xl rounded-full"></div>
                        <div className="relative w-24 h-24 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shadow-lg shadow-green-500/20 animate-[pulse_2s_ease-in-out_infinite]">
                            <CheckCircle className="text-green-400" size={48} strokeWidth={1.5} />
                        </div>
                    </div>

                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-extrabold text-white tracking-tight mb-3">Check Your Inbox</h2>
                        <p className="text-gray-300 font-light text-sm">
                            We've sent a password reset link to <br/><strong className="text-purple-300 font-medium">{email}</strong>
                        </p>
                    </div>

                    <div className="bg-white/5 rounded-2xl p-5 mb-8 border border-white/10 shadow-inner">
                        <p className="text-sm text-purple-200 font-semibold mb-3 tracking-wide uppercase text-center">
                            Next steps
                        </p>
                        <ul className="text-sm text-gray-300 space-y-3 font-light">
                            <li className="flex items-start gap-2">
                                <span className="text-purple-400 mt-0.5">•</span> Check your email inbox (and spam folder)
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-purple-400 mt-0.5">•</span> Click the secure reset link (expires in 30 mins)
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-purple-400 mt-0.5">•</span> Set your new password to regain access
                            </li>
                        </ul>
                    </div>

                    <div className="text-center mb-6">
                        <p className="text-xs text-gray-400 mb-2">Didn't receive the email?</p>
                        <button
                            onClick={() => setEmailSent(false)}
                            className="text-pink-400 hover:text-pink-300 font-medium text-sm transition-colors hover:underline"
                        >
                            Click here to try again
                        </button>
                    </div>

                    <Link
                        to="/login"
                        className="flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-colors bg-white/5 py-3 rounded-xl border border-white/5 hover:bg-white/10"
                    >
                        <ArrowLeft size={16} />
                        <span className="text-sm font-semibold tracking-wide">Return to Login</span>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen flex items-center justify-center bg-gray-900 overflow-hidden font-sans py-12 px-4">
            <GlobalBackground />
            <div className="relative z-10 w-full max-w-md p-10 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 mb-6 shadow-lg shadow-purple-500/20 backdrop-blur-sm">
                        <Mail className="text-purple-300" size={36} strokeWidth={1.5} />
                    </div>
                    <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-pink-400 via-purple-400 to-indigo-400 tracking-tight mb-3">
                        Reset Password
                    </h2>
                    <p className="text-gray-300 text-sm font-light">
                        No worries! Enter your email and we'll securely send you a reset link.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-gray-300 text-sm font-medium mb-2 pl-1">
                            Account Email Address
                        </label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Mail className="text-gray-400 group-focus-within:text-purple-400 transition-colors" size={20} />
                            </div>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-12 pr-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all shadow-inner"
                                placeholder="name@company.com"
                                required
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 text-white font-bold rounded-2xl hover:from-purple-500 hover:via-fuchsia-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/30 transform hover:-translate-y-1 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-3">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span className="tracking-wide">Sending Link...</span>
                                </span>
                            ) : (
                                <span className="tracking-wide">Send Reset Link</span>
                            )}
                        </button>
                    </div>
                </form>

                <div className="mt-8 text-center">
                    <Link
                        to="/login"
                        className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors font-medium hover:underline"
                    >
                        <ArrowLeft size={16} />
                        <span className="text-sm">Back to Secure Login</span>
                    </Link>
                </div>

                <div className="mt-8 pt-6 border-t border-white/10">
                    <p className="text-xs text-gray-500 font-light text-center leading-relaxed">
                        <span className="text-purple-400/80 mr-1">🔒</span> 
                        For security, we'll send instructions only if the email is registered in our system.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
