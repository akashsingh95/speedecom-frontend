/**
 * Resolve numeric tenant ID from admin list row or flat tenant document.
 * Admin rows use tenant.tenantId (populated tenant object).tenantId (number).
 */
export function getTenantNumericId(tenantOrRow) {
    if (!tenantOrRow) return null;
    const nested = tenantOrRow.tenantId;
    if (nested && typeof nested === 'object' && nested.tenantId != null) {
        return nested.tenantId;
    }
    if (typeof tenantOrRow.tenantId === 'number') {
        return tenantOrRow.tenantId;
    }
    return null;
}

export function getTenantCompanyName(tenantOrRow) {
    if (!tenantOrRow) return 'Unknown';
    const nested = tenantOrRow.tenantId;
    if (nested && typeof nested === 'object' && nested.name) {
        return nested.name;
    }
    return tenantOrRow.name || 'Unknown';
}

export function toTitleCase(str) {
    if (!str) return str;
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

/** Display label: "{numericId} - {company name}" */
export function formatTenantLabel(tenantOrRow) {
    const name = toTitleCase(getTenantCompanyName(tenantOrRow));
    const num = getTenantNumericId(tenantOrRow);
    return num != null ? `${num} - ${name}` : name;
}