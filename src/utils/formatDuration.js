export function formatDuration(startDate, endDate) {
    const end = endDate || new Date();
    const diffMs = new Date(end) - new Date(startDate);
    if (diffMs < 0) return '';
    const totalMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 && days === 0) parts.push(`${minutes}m`);
    if (parts.length === 0) return '<1m';
    return parts.join(' ');
}

export function getClosingTime(ticket) {
    if (!['Resolved', 'Closed'].includes(ticket.status)) return null;

    const history = ticket.statusHistory || [];
    let totalMs = 0;
    let cycleStart = 0;
    let i = 0;
    while (i < history.length) {
        if (['Resolved', 'Closed'].includes(history[i].status)) {
            let j = i;
            while (j + 1 < history.length && ['Resolved', 'Closed'].includes(history[j + 1].status)) {
                j++;
            }
            totalMs += new Date(history[j].timestamp) - new Date(history[cycleStart].timestamp);
            i = j + 1;
            if (i < history.length && !['Resolved', 'Closed'].includes(history[i].status)) {
                cycleStart = i;
                i++;
            }
        } else {
            i++;
        }
    }
    if (totalMs > 0) return formatDuration(new Date(0), new Date(totalMs));
    // Fallback: createdAt → last terminal entry
    for (let i = history.length - 1; i >= 0; i--) {
        if (['Resolved', 'Closed'].includes(history[i].status)) {
            return formatDuration(ticket.createdAt, history[i].timestamp);
        }
    }
    return formatDuration(ticket.createdAt, ticket.updatedAt || ticket.createdAt);
}
