import { useEffect, useState } from 'react';

const MS_PER_WORD = 60;
// Long answers still finish quickly; nobody should wait on an animation.
const MAX_DURATION_MS = 4000;
const MIN_TICK_MS = 20;

const prefersReducedMotion = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Reveals `text` one word at a time with a blinking caret, the way a typed reply appears.
 * The full answer has already arrived; this only paces how it is shown.
 * onProgress fires as text is revealed, so the thread can keep scrolling to the bottom.
 */
const TypewriterText = ({ text, onProgress, onDone }) => {
  const animate = !prefersReducedMotion();
  // Word plus the spaces/newlines after it, so line breaks appear with their word.
  const [words] = useState(() => text.match(/\S+\s*|\s+/g) || [text]);
  // Start with the first word so the bubble never renders empty.
  const [shown, setShown] = useState(animate ? 1 : words.length);

  useEffect(() => {
    if (!animate) return undefined;
    const tick = Math.max(MIN_TICK_MS, Math.min(MS_PER_WORD, MAX_DURATION_MS / words.length));
    const timer = setInterval(() => {
      setShown((current) => Math.min(current + 1, words.length));
    }, tick);
    return () => clearInterval(timer);
    // A message's text never changes; re-running would restart the animation.
  }, []);

  const done = shown >= words.length;

  useEffect(() => {
    onProgress?.();
    if (done) onDone?.();
  }, [shown]);

  return (
    <>
      {done ? text : words.slice(0, shown).join('')}
      {!done && <span className="inline-block w-[2px] h-[1em] ml-0.5 align-[-2px] bg-brand-600 animate-pulse" aria-hidden="true" />}
    </>
  );
};

export default TypewriterText;
