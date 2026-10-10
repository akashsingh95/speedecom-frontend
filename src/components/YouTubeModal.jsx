import React, { useEffect } from 'react';
import { X, ExternalLink, PlayCircle } from 'lucide-react';

const extractVideoId = (url) => {
    if (!url) return null;
    try {
        const u = new URL(url);
        const host = u.hostname.replace(/^www\./, '');
        if (host === 'youtu.be') {
            const id = u.pathname.replace(/^\//, '').split('/')[0];
            return id || null;
        }
        if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
            const v = u.searchParams.get('v');
            if (v) return v;
            const parts = u.pathname.split('/').filter(Boolean);
            if (parts[0] === 'embed' || parts[0] === 'shorts') return parts[1] || null;
        }
        return null;
    } catch {
        return null;
    }
};

const YouTubeModal = ({ isOpen, videoUrl, title, onClose }) => {
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const videoId = extractVideoId(videoUrl);
    const embedSrc = videoId
        ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`
        : null;
    const heading = title || 'Upload Tutorial';

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-[3px] flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden ring-1 ring-black/5"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-2xl bg-red-50 flex items-center justify-center flex-shrink-0">
                            <PlayCircle size={18} className="text-red-500" strokeWidth={2} />
                        </div>
                        <h2 className="text-sm sm:text-base font-bold text-gray-900 truncate">{heading}</h2>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {videoUrl && (
                            <a
                                href={videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-all"
                                title="Open in YouTube"
                            >
                                <ExternalLink size={14} />
                                <span className="hidden sm:inline">Open in YouTube</span>
                            </a>
                        )}
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
                            title="Close"
                        >
                            <X size={22} />
                        </button>
                    </div>
                </div>

                <div className="bg-black">
                    {embedSrc ? (
                        <div className="aspect-video w-full">
                            <iframe
                                src={embedSrc}
                                title={heading}
                                className="w-full h-full"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </div>
                    ) : (
                        <div className="aspect-video w-full flex flex-col items-center justify-center text-gray-300 gap-3 p-6 text-center">
                            <PlayCircle size={36} className="text-gray-500" />
                            <p className="text-sm">This tutorial can't be embedded here.</p>
                            {videoUrl && (
                                <a
                                    href={videoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-all"
                                >
                                    <ExternalLink size={14} />
                                    Watch on YouTube
                                </a>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default YouTubeModal;
