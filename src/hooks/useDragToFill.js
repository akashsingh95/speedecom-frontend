import { useState, useEffect, useRef } from 'react';

// Generic drag-to-fill hook for data tables.
// The consumer provides an onComplete callback that runs when the user releases the drag
// over a row strictly below the source row. Drag is downward-only (Excel-style fill handle).
export const useDragToFill = ({ onComplete } = {}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState(null); // { rowIndex, ...payload }
    const [dragEnd, setDragEnd] = useState(null);     // { rowIndex }
    const [dragPreview, setDragPreview] = useState([]); // row indexes in the preview range

    // Keep latest refs so the window mouseup handler doesn't need to re-subscribe on every state tick.
    const startRef = useRef(null);
    const endRef = useRef(null);
    const completeRef = useRef(onComplete);
    useEffect(() => { completeRef.current = onComplete; }, [onComplete]);
    useEffect(() => { startRef.current = dragStart; }, [dragStart]);
    useEffect(() => { endRef.current = dragEnd; }, [dragEnd]);

    const startDrag = (e, rowIndex, payload = {}) => {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        setIsDragging(true);
        setDragStart({ rowIndex, ...payload });
        setDragEnd({ rowIndex });
        setDragPreview([rowIndex]);
    };

    const enterCell = (rowIndex) => {
        if (!isDragging || !dragStart) return;
        if (rowIndex < dragStart.rowIndex) return; // downward-only
        setDragEnd({ rowIndex });
        const preview = [];
        for (let i = dragStart.rowIndex; i <= rowIndex; i++) preview.push(i);
        setDragPreview(preview);
    };

    const reset = () => {
        setIsDragging(false);
        setDragStart(null);
        setDragEnd(null);
        setDragPreview([]);
    };

    useEffect(() => {
        if (!isDragging) return;
        const handleUp = async () => {
            const start = startRef.current;
            const end = endRef.current;
            if (start && end && end.rowIndex > start.rowIndex) {
                try {
                    await completeRef.current?.({ start, end });
                } catch {
                    // swallow — consumer is expected to surface errors via toast/rollback
                }
            }
            reset();
        };
        window.addEventListener('mouseup', handleUp);
        return () => window.removeEventListener('mouseup', handleUp);
    }, [isDragging]);

    return {
        isDragging,
        dragStart,
        dragEnd,
        dragPreview,
        startDrag,
        enterCell,
    };
};
