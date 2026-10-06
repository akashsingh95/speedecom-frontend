import { useState } from 'react';
import api from '../api';
import StarRating from './StarRating';
import { X } from 'lucide-react';
import { toast } from 'sonner';

const RatingModal = ({ ticket, onClose, onRated }) => {
    const [stars, setStars] = useState(0);
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!stars) return;
        try {
            setSubmitting(true);
            await api.post(`/support/${ticket._id}/rating`, { stars, note });
            onRated(ticket._id, { stars, note, createdAt: new Date().toISOString() });
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to submit rating");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 relative">
                <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors">
                    <X size={18} />
                </button>

                <h3 className="text-lg font-bold text-slate-800 mb-1">Rate your support ticket</h3>
                <p className="text-sm text-slate-500 mb-4">
                    {ticket.ticketId} — {ticket.title}
                </p>

                <div className="flex justify-center mb-4">
                    <StarRating value={stars} onChange={setStars} size={28} />
                </div>

                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional note..."
                    rows={3}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-brand-400 mb-4 resize-none"
                />

                <button
                    onClick={handleSubmit}
                    disabled={!stars || submitting}
                    className="w-full text-sm font-semibold py-2.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                    {submitting ? 'Submitting...' : 'Submit'}
                </button>
            </div>
        </div>
    );
};

export default RatingModal;