import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useAuth } from '../AuthContext';
import SpeedySidebar from './speedy/SpeedySidebar';

const SpeedyAgent = () => {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);

    // Only show Speedy for Admin and SuperAdmin roles
    if (!user || user.role === 'User') return null;

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-50 animate-fadeIn"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar */}
            <SpeedySidebar isOpen={isOpen} onClose={() => setIsOpen(false)} />

            {/* Trigger button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    title="Open Speedy Agent"
                    className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-xl
                        flex items-center justify-center
                        transition-all duration-300 hover:scale-105
                        bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
                >
                    <MessageCircle size={28} />
                </button>
            )}
        </>
    );
};

export default SpeedyAgent;
