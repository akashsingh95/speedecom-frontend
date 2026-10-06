import api from '../api';

/**
 * Initiate an export
 * @param {Object} params - Export parameters
 * @param {string} params.exportType - 'cost_sheet' | 'payment_metrics' | 'payment_calculations' | 'pending_payments'
 * @param {string|Array} params.marketplaceId - Marketplace ID or array of IDs
 * @param {string} [params.startDate] - Start date (YYYY-MM-DD)
 * @param {string} [params.endDate] - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} Export response with export_id or duplicate info
 */
export const initiateExport = async ({ exportType, marketplaceId, marketplaceIds, startDate, endDate, nullOrderDate, dataTypeFilter, warehouses, brands, adsType, gstMode, returnStatuses, shopsyFilter, meeshoOrderSource, compensationReasons, recoveryReasons, sizes, exportSheets, marketplaceScope, search, status, returnType, paymentStatus, orderItemStatuses, orderMonth }) => {
    try {
        const payload = {
            exportType,
            marketplaceId: Array.isArray(marketplaceId) ? JSON.stringify(marketplaceId) : marketplaceId,
            marketplaceIds: marketplaceIds || undefined,
            startDate,
            endDate,
            nullOrderDate: nullOrderDate || undefined,
            dataTypeFilter,
            warehouses,
            brands,
            adsType,
            gstMode,
            shopsyFilter,
            meeshoOrderSource,
            compensationReasons,
            recoveryReasons,
            sizes,
            returnStatuses: returnStatuses && returnStatuses.length > 0 ? returnStatuses : undefined,
            exportSheets: exportSheets || undefined,
            marketplaceScope: marketplaceScope || undefined,
            search: search || undefined,
            status: status || undefined,
            returnType: returnType || undefined,
            paymentStatus: paymentStatus || undefined,
            orderItemStatuses: orderItemStatuses && orderItemStatuses.length > 0 ? orderItemStatuses : undefined,
            orderMonth: orderMonth || undefined,
        };
        const response = await api.post('/downloads/export', payload);
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Force create export (bypass duplicate check)
 */
export const forceCreateExport = async ({ exportType, marketplaceId, marketplaceIds, startDate, endDate, nullOrderDate, dataTypeFilter, warehouses, brands, adsType, gstMode, returnStatuses, shopsyFilter, meeshoOrderSource, compensationReasons, recoveryReasons, sizes, exportSheets, marketplaceScope, search, status, returnType, paymentStatus, orderItemStatuses, orderMonth }) => {
    try {
        const payload = {
            exportType,
            marketplaceId: Array.isArray(marketplaceId) ? JSON.stringify(marketplaceId) : marketplaceId,
            marketplaceIds: marketplaceIds || undefined,
            startDate,
            endDate,
            nullOrderDate: nullOrderDate || undefined,
            dataTypeFilter,
            warehouses,
            brands,
            adsType,
            gstMode,
            shopsyFilter,
            meeshoOrderSource,
            compensationReasons,
            recoveryReasons,
            sizes,
            returnStatuses: returnStatuses && returnStatuses.length > 0 ? returnStatuses : undefined,
            exportSheets: exportSheets || undefined,
            marketplaceScope: marketplaceScope || undefined,
            search: search || undefined,
            status: status || undefined,
            returnType: returnType || undefined,
            paymentStatus: paymentStatus || undefined,
            orderItemStatuses: orderItemStatuses && orderItemStatuses.length > 0 ? orderItemStatuses : undefined,
            orderMonth: orderMonth || undefined,
            force: true
        };
        const response = await api.post('/downloads/export/force', payload);
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Get export status
 * @param {string} exportId - Export ID
 * @returns {Promise<Object>} Export details
 */
export const getExportStatus = async (exportId) => {
    try {
        const response = await api.get(`/downloads/${exportId}`);
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Get export history
 * @param {Object} filters - Filter parameters
 * @returns {Promise<Object>} Exports list with pagination
 */
export const getExportHistory = async (filters = {}) => {
    try {
        const params = new URLSearchParams(filters);
        const response = await api.get(`/downloads/history?${params}`);
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Get download URL for completed export
 * @param {string} exportId - Export ID
 * @returns {Promise<string>} Download URL
 */
export const getDownloadUrl = async (exportId) => {
    try {
        const response = await api.post(`/downloads/${exportId}/download`);
        return response.data.download_url;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Delete export
 * @param {string} exportId - Export ID
 */
export const deleteExport = async (exportId) => {
    try {
        await api.delete(`/downloads/${exportId}`);
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Poll export status until completion
 * @param {string} exportId - Export ID
 * @param {Function} onUpdate - Callback for status updates
 * @param {number} maxAttempts - Maximum polling attempts (default: 180)
 * @param {number} interval - Polling interval in ms (default: 5000)
 * @returns {Promise<Object>} Final export status
 */
export const pollExportStatus = async (exportId, onUpdate, maxAttempts = 180, interval = 5000) => {
    let attempts = 0;

    return new Promise((resolve, reject) => {
        const poll = async () => {
            try {
                attempts++;
                const exportStatus = await getExportStatus(exportId);

                // Call update callback
                if (onUpdate) {
                    onUpdate(exportStatus);
                }

                // Check if completed or failed
                if (exportStatus.status === 'completed') {
                    resolve(exportStatus);
                    return;
                }

                if (exportStatus.status === 'failed') {
                    reject(new Error(exportStatus.error_message || 'Export failed'));
                    return;
                }

                // Check max attempts
                if (attempts >= maxAttempts) {
                    reject(new Error('Export timeout: maximum polling attempts reached'));
                    return;
                }

                // Continue polling
                setTimeout(poll, interval);
            } catch (error) {
                reject(error);
            }
        };

        poll();
    });
};
