import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import api, { encryptPassword } from '../api';
import { toast } from 'sonner';

const ResetPassword = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    
    const [verifying, setVerifying] = useState(true);
    const [tokenValid, setTokenValid] = useState(false);
    const [userEmail, setUserEmail] = useState('');
    
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState(0);

    useEffect(() => {
        verifyToken();
    }, [token]);

    useEffect(() => {
        calculatePasswordStrength(newPassword);
    }, [newPassword]);

    const verifyToken = async () => {
        try {
            const { data } = await api.get(`/auth/reset-password/${token}`);
            if (data.valid) {
                setTokenValid(true);
                setUserEmail(data.email);
            } else {
                setTokenValid(false);
                toast.error(data.message || 'Invalid or expired reset link');
            }
        } catch (error) {
            console.error('Token verification error:', error);
            setTokenValid(false);
            toast.error('Invalid or expired reset link');
        } finally {
            setVerifying(false);
        }
    };

    const calculatePasswordStrength = (password) => {
        let strength = 0;
        if (password.length >= 8) strength += 25;
        if (password.length >= 12) strength += 25;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
        if (/\d/.test(password)) strength += 25;
        setPasswordStrength(strength);
    };

    const getPasswordStrengthColor = () => {
        if (passwordStrength <= 25) return 'bg-red-500';
        if (passwordStrength <= 50) return 'bg-orange-500';
        if (passwordStrength <= 75) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const getPasswordStrengthText = () => {
        if (passwordStrength <= 25) return 'Weak';
        if (passwordStrength <= 50) return 'Fair';
        if (passwordStrength <= 75) return 'Good';
        return 'Strong';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!newPassword || !confirmPassword) {
            toast.error('All fields are required');
            return;
        }

        if (newPassword.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const encryptedPassword = await encryptPassword(newPassword);
            
            const { data } = await api.post(`/auth/reset-password/${token}`, {
                newPassword: encryptedPassword
            });

            toast.success(data.message || 'Password reset successful!');
            
            // Redirect to login after 2 seconds
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (error) {
            console.error('Password reset error:', error);
            // Error handled by interceptor
        } finally {
            setLoading(false);
        }
    };

    // Loading state
    if (verifying) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 font-medium">Verifying reset link...</p>
                </div>
            </div>
        );
    }

    // Invalid token state
    if (!tokenValid) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-4">
                <div className="w-full max-w-md">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
                        {/* Error Icon */}
                        <div className="flex justify-center mb-6">
                            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
                                <XCircle className="text-red-600" size={40} />
                            </div>
                        </div>

                        {/* Error Message */}
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">Invalid Reset Link</h2>
                            <p className="text-slate-600">
                                This password reset link is invalid or has expired.
                            </p>
                        </div>

                        {/* Info Box */}
                        <div className="bg-amber-50 rounded-xl p-4 mb-6 border border-amber-200">
                            <p className="text-sm text-amber-800">
                                <strong>Possible reasons:</strong>
                            </p>
                            <ul className="text-sm text-amber-700 mt-2 space-y-1 list-disc list-inside">
                                <li>Link has expired (valid for 30 minutes)</li>
                                <li>Link has already been used</li>
                                <li>Link was copied incorrectly</li>
                            </ul>
                        </div>

                        {/* Actions */}
                        <div className="space-y-3">
                            <Link
                                to="/forgot-password"
                                className="block w-full py-3 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors text-center shadow-lg shadow-brand-500/20"
                            >
                                Request New Link
                            </Link>
                            <Link
                                to="/login"
                                className="flex items-center justify-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
                            >
                                <ArrowLeft size={16} />
                                <span className="text-sm font-medium">Back to Login</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Valid token - show reset form
    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-50 mb-4">
                            <Lock className="text-brand-600" size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800">Set New Password</h2>
                        <p className="text-slate-600 mt-2">
                            for <strong>{userEmail}</strong>
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* New Password */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                New Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    type={showNewPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full pl-11 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                                    placeholder="Enter new password"
                                    required
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                            
                            {/* Password Strength */}
                            {newPassword && (
                                <div className="mt-2">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs text-slate-500">Password Strength:</span>
                                        <span className={`text-xs font-medium ${
                                            passwordStrength <= 25 ? 'text-red-600' :
                                            passwordStrength <= 50 ? 'text-orange-600' :
                                            passwordStrength <= 75 ? 'text-yellow-600' :
                                            'text-green-600'
                                        }`}>
                                            {getPasswordStrengthText()}
                                        </span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full ${getPasswordStrengthColor()} transition-all duration-300`}
                                            style={{ width: `${passwordStrength}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Confirm New Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full pl-11 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                                    placeholder="Confirm new password"
                                    required
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                            {confirmPassword && newPassword && (
                                <p className={`text-xs mt-1 ${
                                    confirmPassword === newPassword ? 'text-green-600' : 'text-red-600'
                                }`}>
                                    {confirmPassword === newPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                                </p>
                            )}
                        </div>

                        {/* Password Requirements */}
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                            <p className="text-xs font-medium text-slate-700 mb-2">Password must contain:</p>
                            <ul className="text-xs text-slate-600 space-y-1">
                                <li className="flex items-center gap-2">
                                    <span className={newPassword.length >= 8 ? 'text-green-600' : 'text-slate-400'}>
                                        {newPassword.length >= 8 ? '✓' : '○'}
                                    </span>
                                    At least 8 characters
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className={/[A-Z]/.test(newPassword) ? 'text-green-600' : 'text-slate-400'}>
                                        {/[A-Z]/.test(newPassword) ? '✓' : '○'}
                                    </span>
                                    One uppercase letter
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className={/[a-z]/.test(newPassword) ? 'text-green-600' : 'text-slate-400'}>
                                        {/[a-z]/.test(newPassword) ? '✓' : '○'}
                                    </span>
                                    One lowercase letter
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className={/\d/.test(newPassword) ? 'text-green-600' : 'text-slate-400'}>
                                        {/\d/.test(newPassword) ? '✓' : '○'}
                                    </span>
                                    One number
                                </li>
                            </ul>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                            className="w-full py-3 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-brand-500/20"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Resetting Password...
                                </span>
                            ) : (
                                'Reset Password'
                            )}
                        </button>
                    </form>

                    {/* Back to Login */}
                    <div className="mt-6 text-center">
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
                        >
                            <ArrowLeft size={16} />
                            <span className="text-sm font-medium">Back to Login</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
