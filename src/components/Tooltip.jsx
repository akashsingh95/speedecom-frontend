import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const Tooltip = ({ text, children }) => {
    const [show, setShow] = useState(false);
    const [style, setStyle] = useState({});
    const wrapperRef = useRef(null);

    const handleMouseEnter = () => {
        if (wrapperRef.current) {
            const rect = wrapperRef.current.getBoundingClientRect();
            setStyle({
                position: 'fixed',
                top: rect.top - 8,
                left: rect.left + rect.width / 2,
                transform: 'translate(-50%, -100%)',
                zIndex: 99999,
            });
        }
        setShow(true);
    };

    // Close if the wrapper scrolls out of view
    useEffect(() => {
        if (!show) return;
        const hide = () => setShow(false);
        window.addEventListener('scroll', hide, true);
        return () => window.removeEventListener('scroll', hide, true);
    }, [show]);

    const tooltip = show && (
        <div
            style={style}
            className="px-2 py-1 text-xs font-semibold text-white bg-slate-800 rounded-md shadow-md whitespace-nowrap pointer-events-none"
        >
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800" />
        </div>
    );

    return (
        <div
            ref={wrapperRef}
            className="relative flex items-center"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setShow(false)}
        >
            {children}
            {show && createPortal(tooltip, document.body)}
        </div>
    );
};

export default Tooltip;
