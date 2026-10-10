import React from 'react';
import { formatDuration } from '../utils/formatDuration';
import { Clock } from 'lucide-react';

const STATUS_COLORS = {
    'Open': 'bg-amber-100 text-amber-800 border-amber-200',
    'In Progress': 'bg-blue-100 text-blue-800 border-blue-200',
    'Resolved': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Closed': 'bg-slate-200 text-slate-700 border-slate-300',
};

const TicketTimeline = ({ history, createdAt }) => {
    const sorted = [...(history || [])].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    // If the first recorded status isn't 'Open' and we have a createdAt, inject it as the implicit start
    if (createdAt && (sorted.length === 0 || sorted[0].status !== 'Open')) {
        sorted.unshift({ status: 'Open', timestamp: createdAt });
    }
    if (sorted.length < 2) {
        return (
            <div className="flex items-center gap-2">
                <Clock size={13} className="text-slate-400 shrink-0" />
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STATUS_COLORS['Open']}`}>
                    Open
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">
                    since {formatDuration(createdAt, new Date().toISOString())}
                </span>
            </div>
        );
    }

    const phases = [];
    for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i];
        phases.push({ type: 'status', status: current.status, timestamp: current.timestamp });
        if (i < sorted.length - 1) {
            phases.push({
                type: 'duration',
                from: current.timestamp,
                to: sorted[i + 1].timestamp,
            });
        }
    }

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <Clock size={13} className="text-slate-400 shrink-0" />
            {phases.map((phase, idx) => (
                phase.type === 'status' ? (
                    <span
                        key={idx}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STATUS_COLORS[phase.status] || 'bg-slate-100 text-slate-600'}`}
                    >
                        {phase.status}
                    </span>
                ) : (
                    <span key={idx} className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                        <span className="text-slate-300">→</span>
                        {formatDuration(phase.from, phase.to)}
                    </span>
                )
            ))}
        </div>
    );
};

export default TicketTimeline;
