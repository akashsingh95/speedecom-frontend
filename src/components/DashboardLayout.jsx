import React from 'react';
import Sidebar from './Sidebar';
import { useAuth } from '../AuthContext';
import { AlertTriangle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DashboardLayout = ({ children }) => {
    const { user, isImpersonating, impersonatedTenant, stopImpersonating } = useAuth();
    const navigate = useNavigate();

    const handleExitImpersonation = () => {
        stopImpersonating();
        setTimeout(() => {
            if (user?.role === 'RM') {
                navigate('/rm/tenants');
            } else {
                navigate('/admin/tenants');
            }
        }, 0);
    };

    const modeLabel = user?.role === 'RM' ? 'ADMIN MODE' : 'SUPERADMIN MODE';

    return (
        <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">
            {isImpersonating && impersonatedTenant && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between shadow-sm z-50 shrink-0 w-full">
                    <div className="flex items-center gap-3 text-amber-900">
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
                            <AlertTriangle size={18} strokeWidth={2.5} />
                        </div>
                        <p className="font-medium text-sm">
                            <strong className="font-bold tracking-wide">{modeLabel}</strong> &nbsp;•&nbsp; Viewing dashboard as <span className="font-bold bg-white px-2.5 py-1 rounded-md shadow-sm border border-amber-100 ml-1">{impersonatedTenant.name}</span>
                        </p>
                    </div>
                    <button 
                        onClick={handleExitImpersonation}
                        className="flex items-center gap-2 bg-white hover:bg-amber-100 text-amber-800 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 border border-amber-200 shadow-sm hover:shadow group"
                    >
                        <XCircle size={16} className="text-amber-500 group-hover:text-amber-700 transition-colors" />
                        Exit View
                    </button>
                </div>
            )}
            <div className="flex flex-1 overflow-hidden h-full">
                <Sidebar />
                <div className="flex-1 flex flex-col overflow-hidden h-full relative">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default DashboardLayout;
