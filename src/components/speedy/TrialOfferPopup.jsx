import React, { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const TrialOfferPopup = () => {
    const [isVisible, setIsVisible] = useState(true);

    const handleClose = () => {
        setIsVisible(false);
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: -60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -60, opacity: 0 }}
                    transition={{ type: "keyframes", duration: 0.5 }}
                    className="absolute top-0 left-0 w-full z-30"
                >
                    <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-[0_4px_20px_rgba(139,92,246,0.3)] border-b border-white/10">
                        {/* Animated Light Sweep Effect */}
                        <motion.div
                            animate={{ x: ["-100%", "400%"] }}
                            transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
                            className="absolute top-0 left-0 h-full w-1/4 bg-white/20 skew-x-12 blur-md z-10 pointer-events-none"
                        />

                        <div className="mx-auto px-4 py-2.5 flex items-center justify-center gap-3 relative z-20">
                            {/* Sparkle Icon */}
                            <motion.div
                                animate={{ rotate: [0, 15, -15, 0] }}
                                transition={{ repeat: Infinity, duration: 5 }}
                            >
                                <Sparkles size={16} className="text-pink-200" />
                            </motion.div>

                            {/* Text */}
                            <div className="text-[13px] md:text-sm font-medium tracking-wide flex items-center flex-wrap justify-center gap-1.5 px-6 sm:px-0 text-center">
                                <span className="font-bold">30-day Free Trial</span> 
                                <span className="hidden sm:inline">is active. Supercharge your analysis with</span>
                                <span className="sm:hidden">is active! Unlock</span>
                                <span className="bg-white/20 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[10px] border border-white/20 flex items-center mx-1">
                                    Speedy AI
                                </span>
                                <span className="hidden sm:inline">capabilities!</span>
                            </div>

                            {/* Close Button */}
                            <button
                                onClick={handleClose}
                                className="absolute right-4 md:right-6 w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default TrialOfferPopup;
