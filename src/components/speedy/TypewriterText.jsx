import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SkipForward } from 'lucide-react';

/**
 * TypewriterText Component
 * Renders text with a smooth character-by-character animation.
 * Supports \n newlines (rendered as <br>) and resets when `text` changes.
 *
 * @param {string}   text       - The full text to animate
 * @param {number}   speed      - Base ms per character (default: 15)
 * @param {function} onComplete - Callback when animation completes
 * @param {string}   className  - CSS classes for the text container
 * @param {boolean}  showSkip   - Whether to show skip button (default: true)
 */
const TypewriterText = ({
    text,
    speed = 15,
    onComplete,
    className = '',
    showSkip = true,
}) => {
    const [displayedText, setDisplayedText] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [showSkipButton, setShowSkipButton] = useState(false);

    // Reset animation whenever the text prop itself changes
    const prevTextRef = useRef(text);
    useEffect(() => {
        if (prevTextRef.current !== text) {
            prevTextRef.current = text;
            setDisplayedText('');
            setCurrentIndex(0);
            setIsComplete(false);
            setShowSkipButton(false);
        }
    }, [text]);

    // Show skip button after 1 second
    useEffect(() => {
        if (!isComplete && showSkip) {
            const timer = setTimeout(() => setShowSkipButton(true), 1000);
            return () => clearTimeout(timer);
        }
    }, [isComplete, showSkip]);

    // Skip to end of animation
    const skipAnimation = useCallback(() => {
        setDisplayedText(text);
        setCurrentIndex(text.length);
        setIsComplete(true);
        if (onComplete) onComplete();
    }, [text, onComplete]);

    // Main animation effect
    useEffect(() => {
        if (currentIndex < text.length && !isComplete) {
            const char = text[currentIndex];
            let delay = speed;

            // Add natural pauses for punctuation
            if (char === '.') delay = 120;
            else if (char === ',' || char === '!' || char === '?') delay = 80;
            else if (char === '\n') delay = 60;
            else if (char === ' ') delay = 30;

            const timeout = setTimeout(() => {
                setDisplayedText(prev => prev + char);
                setCurrentIndex(prev => prev + 1);
            }, delay);

            return () => clearTimeout(timeout);
        } else if (currentIndex >= text.length && !isComplete) {
            setIsComplete(true);
            if (onComplete) onComplete();
        }
    }, [currentIndex, text, speed, isComplete, onComplete]);

    // Render inline bold segments: **text** → <strong>
    const renderInline = (str) => {
        const segments = str.split(/(\*\*[^*]+\*\*)/g);
        return segments.map((seg, i) => {
            if (seg.startsWith('**') && seg.endsWith('**')) {
                return <strong key={i} className="font-semibold">{seg.slice(2, -2)}</strong>;
            }
            return seg;
        });
    };

    // Render displayedText respecting \n as line breaks and • bullet points
    const renderText = (raw) => {
        const lines = raw.split('\n');
        return lines.map((line, i) => {
            const isBullet = line.trimStart().startsWith('•');
            const isLastLine = i === lines.length - 1;
            if (isBullet) {
                const content = line.trimStart().slice(1).trim();
                return (
                    <React.Fragment key={i}>
                        <span className="flex items-start gap-1.5 mt-1">
                            <span className="mt-[3px] w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 shrink-0 inline-block" />
                            <span>{renderInline(content)}</span>
                        </span>
                        {!isLastLine && <span />}
                    </React.Fragment>
                );
            }
            return (
                <React.Fragment key={i}>
                    {renderInline(line)}
                    {!isLastLine && <br />}
                </React.Fragment>
            );
        });
    };

    return (
        <div className="relative">
            <div className={className}>
                {renderText(displayedText)}
                {!isComplete && <span className="animate-pulse ml-0.5 opacity-70">▊</span>}
            </div>

            {showSkipButton && !isComplete && (
                <button
                    onClick={skipAnimation}
                    className="absolute -top-8 right-0 flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg border border-blue-200 dark:border-blue-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all shadow-sm"
                    title="Skip animation"
                >
                    <SkipForward size={12} />
                    Skip
                </button>
            )}
        </div>
    );
};

export default TypewriterText;
