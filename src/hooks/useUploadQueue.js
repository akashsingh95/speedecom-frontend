import { useReducer, useEffect, useRef, useCallback } from 'react';
import api from '../api';
import { toast } from 'sonner';

// Queue configuration
export const MAX_ACTIVE_FILES = 8;
export const ACTIVE_STAGES = new Set(['queued', 'uploading', 'validating', 'processing', 'pending_processing']);

const DEFAULT_CONFIG = {
    maxConcurrentUploads: 3,        // Max parallel uploads to GCS
    pollInterval: 3000,             // Poll server status every 3 seconds
    pollTimeout: 300000,            // 5 min timeout for any stage
};

// Server status → frontend stage mapping
// Used both for live polling and for restoring queue on page refresh
const SERVER_STATUS_TO_STAGE = {
    pending_upload:          'uploading',           // GCS upload in progress (being restored)
    validating:              'validating',
    validation_failed:       'failed',
    validation_warning:      'validated',           // Warnings — show modal
    validated:               'validated',           // Legacy clean pass
    queued_for_processing:   'pending_processing',  // In Redis queue, no worker yet
    processing:              'processing',           // Worker actively inserting rows
    completed:               'completed',
    failed:                  'failed',
    cancelled:               'cancelled',           // Worker confirmed cancellation
};

// Initial state
const initialState = {
    files: [],
    isPaused: false,
};

// Action types
const ACTIONS = {
    ADD_FILES: 'ADD_FILES',
    RESTORE_FILES: 'RESTORE_FILES',
    REMOVE_FILE: 'REMOVE_FILE',
    UPDATE_FILE: 'UPDATE_FILE',
    SET_ERROR: 'SET_ERROR',
    RETRY_FILE: 'RETRY_FILE',
    PAUSE_QUEUE: 'PAUSE_QUEUE',
    RESUME_QUEUE: 'RESUME_QUEUE',
    CANCEL_ALL: 'CANCEL_ALL',
    CLEAR_COMPLETED: 'CLEAR_COMPLETED',
    CLEAR_ALL: 'CLEAR_ALL',
};

// Reducer
const queueReducer = (state, action) => {
    switch (action.type) {
        case ACTIONS.ADD_FILES:
            return { ...state, files: [...state.files, ...action.payload] };

        case ACTIONS.RESTORE_FILES: {
            // Avoid duplicates — only add uploads not already in queue
            const existingIds = new Set(state.files.map(f => f.uploadId).filter(Boolean));
            const newFiles = action.payload.filter(f => !existingIds.has(f.uploadId));
            return { ...state, files: [...state.files, ...newFiles] };
        }

        case ACTIONS.REMOVE_FILE:
            return { ...state, files: state.files.filter(f => f.id !== action.payload) };

        case ACTIONS.UPDATE_FILE: {
            const files = state.files.map(f =>
                f.id === action.payload.id ? { ...f, ...action.payload.updates } : f
            );
            return { ...state, files };
        }

        case ACTIONS.SET_ERROR: {
            const files = state.files.map(f =>
                f.id === action.payload.id
                    ? { ...f, stage: action.payload.stage || 'failed', error: action.payload.error, retryable: action.payload.retryable ?? true }
                    : f
            );
            return { ...state, files };
        }

        case ACTIONS.RETRY_FILE: {
            const files = state.files.map(f =>
                f.id === action.payload
                    ? { ...f, stage: 'queued', error: null, retryCount: 0, uploadProgress: 0, uploadId: null, validationResult: null, hasValidationWarnings: false, hasValidationErrors: false }
                    : f
            );
            return { ...state, files };
        }

        case ACTIONS.PAUSE_QUEUE:
            return { ...state, isPaused: true };

        case ACTIONS.RESUME_QUEUE:
            return { ...state, isPaused: false };

        case ACTIONS.CANCEL_ALL: {
            const files = state.files.filter(f => !['queued', 'uploading'].includes(f.stage));
            return { ...state, files };
        }

        case ACTIONS.CLEAR_COMPLETED: {
            const files = state.files.filter(f => f.stage !== 'completed');
            return { ...state, files };
        }

        case ACTIONS.CLEAR_ALL: {
            const files = state.files.filter(f => !['completed', 'failed', 'cancelled'].includes(f.stage));
            return { ...state, files };
        }

        default:
            return state;
    }
};

// ─── Utilities ────────────────────────────────────────────────────────────────

const generateId = () => `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const sanitizeFileName = (file, uploadType) => {
    const timestamp = Date.now();
    const originalName = file.name || '';
    const lastDot = originalName.lastIndexOf('.');
    const extension = lastDot > -1 && lastDot < originalName.length - 1 ? originalName.substring(lastDot) : '';
    let baseName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (extension) baseName = baseName.slice(0, baseName.toLowerCase().lastIndexOf(extension.toLowerCase()));
    if (!baseName || !/[a-zA-Z0-9_-]/.test(baseName)) baseName = `file_${timestamp}`;
    return `uploads/${uploadType}_${timestamp}_${baseName}${extension}`;
};

const getContentType = (file) => {
    const ext = file.name.toLowerCase().split('.').pop();
    const mimeTypes = {
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        csv: 'text/csv',
        txt: 'text/plain',
        tsv: 'text/tab-separated-values',
        xls: 'application/vnd.ms-excel',
    };
    return mimeTypes[ext] || file.type || 'application/octet-stream';
};

const uploadToGCS = (file, signedUrl, onProgress) => {
    const xhr = new XMLHttpRequest();
    const promise = new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.addEventListener('load', () => {
            xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`));
        });
        xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
        xhr.open('PUT', signedUrl);
        xhr.setRequestHeader('Content-Type', getContentType(file));
        xhr.send(file);
    });
    return { promise, xhr };
};

// ─── Main hook ────────────────────────────────────────────────────────────────

export const useUploadQueue = (config = {}) => {
    const [state, dispatch] = useReducer(queueReducer, initialState);

    const cfg = { ...DEFAULT_CONFIG, ...config };

    // Refs for stable interval/async access
    const stateRef = useRef(state);
    const uploadingRef = useRef(new Set());   // fileIds currently uploading to GCS
    const pollingRef = useRef(new Map());     // fileId → intervalId (polling timer)
    const xhrMapRef = useRef(new Map());      // fileId → XHR (for abort)

    useEffect(() => { stateRef.current = state; });

    // ── Restore active uploads from server on mount ──────────────────────────
    useEffect(() => {
        const restore = async () => {
            try {
                const { data } = await api.get('/upload/active');
                if (!data || !data.length) return;

                const restoredFiles = data.map(upload => {
                    const stage = SERVER_STATUS_TO_STAGE[upload.status] || 'failed';
                    const hasValidationWarnings =
                        upload.status === 'validation_warning' ||
                        (upload.validationResult?.hasWarnings && upload.validationResult?.overallValid);

                    return {
                        id: generateId(),
                        file: null,             // No File object — restored from server
                        fileName: upload.fileName,
                        uploadType: upload.uploadType,
                        marketplaceId: upload.marketplaceId,
                        stage,
                        uploadProgress: 100,
                        uploadId: upload.uploadId,
                        validationResult: upload.validationResult || null,
                        hasValidationWarnings,
                        hasValidationErrors: upload.status === 'validation_failed',
                        userDecision: 'pending',
                        error: upload.errorMessage || null,
                        retryable: false,
                        retryCount: 0,
                        isRestored: true,       // Flag: came from server restore
                        queuedAt: new Date(upload.createdAt).getTime(),
                        startedAt: null,
                        completedAt: null,
                    };
                });

                dispatch({ type: ACTIONS.RESTORE_FILES, payload: restoredFiles });
            } catch (err) {
                console.warn('[useUploadQueue] Could not restore active uploads:', err.message);
            }
        };
        restore();
    }, []); // Run once on mount

    // ── Polling: start/stop per file ──────────────────────────────────────────
    const startPolling = useCallback((fileId, uploadId) => {
        if (pollingRef.current.has(fileId)) return; // Already polling

        const pollStart = Date.now();

        const intervalId = setInterval(async () => {
            // Timeout guard
            if (Date.now() - pollStart > cfg.pollTimeout) {
                clearInterval(intervalId);
                pollingRef.current.delete(fileId);
                dispatch({ type: ACTIONS.SET_ERROR, payload: { id: fileId, stage: 'timed_out', error: 'Still processing in the background. Check Upload History OR Refresh page.', retryable: false } });
                return;
            }

            try {
                const { data: statuses } = await api.post('/upload/status', { uploadIds: [uploadId] });
                if (!statuses || statuses.length === 0) return;

                const s = statuses[0];
                const stage = SERVER_STATUS_TO_STAGE[s.status];

                // Terminal states — stop polling
                if (['completed', 'failed', 'cancelled', 'validation_failed'].includes(s.status)) {
                    clearInterval(intervalId);
                    pollingRef.current.delete(fileId);

                    if (s.status === 'completed') {
                        dispatch({ type: ACTIONS.UPDATE_FILE, payload: { id: fileId, updates: { stage: 'completed', completedAt: Date.now() } } });
                        toast.success('Processing completed!');
                    } else if (s.status === 'cancelled') {
                        // Worker confirmed cancellation — remove the card
                        dispatch({ type: ACTIONS.REMOVE_FILE, payload: fileId });
                        toast.info('Processing cancelled');
                    } else if (s.status === 'validation_failed') {
                        const errMsg = s.validationResult?.error || 'Validation failed: missing required columns';
                        dispatch({ type: ACTIONS.SET_ERROR, payload: { id: fileId, error: errMsg, retryable: false } });
                        toast.error(`Validation failed`);
                    } else {
                        dispatch({ type: ACTIONS.SET_ERROR, payload: { id: fileId, error: s.errorMessage || 'Processing failed', retryable: false } });
                        toast.error('Processing failed');
                    }
                    return;
                }

                // Validation warning — pause and wait for user
                if (s.status === 'validation_warning') {
                    clearInterval(intervalId);
                    pollingRef.current.delete(fileId);

                    const hasWarnings = s.validationResult?.hasWarnings && s.validationResult?.overallValid;
                    dispatch({
                        type: ACTIONS.UPDATE_FILE,
                        payload: {
                            id: fileId,
                            updates: {
                                stage: 'validated',
                                validationResult: s.validationResult,
                                hasValidationWarnings: hasWarnings,
                                hasValidationErrors: false,
                                userDecision: 'pending',
                            }
                        }
                    });
                    toast.warning('Review warnings before proceeding');
                    return;
                }

                // In-progress states — just update stage
                if (stage) {
                    dispatch({ type: ACTIONS.UPDATE_FILE, payload: { id: fileId, updates: { stage } } });
                }
            } catch (err) {
                // Transient poll error — keep polling
                console.warn(`[useUploadQueue] Poll error for ${uploadId}:`, err.message);
            }
        }, cfg.pollInterval);

        pollingRef.current.set(fileId, intervalId);
    }, [cfg.pollInterval, cfg.pollTimeout]);

    const stopPolling = useCallback((fileId) => {
        const id = pollingRef.current.get(fileId);
        if (id) {
            clearInterval(id);
            pollingRef.current.delete(fileId);
        }
    }, []);

    // ── Upload a single file (new flow) ───────────────────────────────────────
    const uploadFile = useCallback(async (fileItem) => {
        if (uploadingRef.current.has(fileItem.id)) return;
        uploadingRef.current.add(fileItem.id);

        try {
            dispatch({ type: ACTIONS.UPDATE_FILE, payload: { id: fileItem.id, updates: { stage: 'uploading', startedAt: Date.now() } } });

            // Step 1: Get signed URL + create DB record (returns uploadId)
            const { data: urlData } = await api.post('/upload/signed-url', {
                fileName: fileItem.fileName,
                contentType: getContentType(fileItem.file),
                uploadType: fileItem.uploadType,
                marketplaceId: fileItem.marketplaceId,
            });

            const uploadId = urlData.uploadId;
            if (!uploadId) throw new Error('Server did not return an uploadId');

            dispatch({ type: ACTIONS.UPDATE_FILE, payload: { id: fileItem.id, updates: { uploadId } } });

            // Step 2: Upload file to GCS
            const { promise, xhr } = uploadToGCS(fileItem.file, urlData.url, (progress) => {
                dispatch({ type: ACTIONS.UPDATE_FILE, payload: { id: fileItem.id, updates: { uploadProgress: progress } } });
            });
            xhrMapRef.current.set(fileItem.id, xhr);
            await promise;

            // Step 3: Submit to validation queue
            await api.post('/upload/submit', { uploadId });

            dispatch({ type: ACTIONS.UPDATE_FILE, payload: { id: fileItem.id, updates: { stage: 'validating', uploadProgress: 100 } } });
            toast.info('File uploaded — validating...');

            // Step 4: Start polling for all status transitions
            startPolling(fileItem.id, uploadId);

        } catch (error) {
            if (error.message === 'Upload cancelled') return;
            dispatch({ type: ACTIONS.SET_ERROR, payload: { id: fileItem.id, error: error.message, retryable: true } });
            toast.error(`Upload failed: ${error.message}`);
        } finally {
            uploadingRef.current.delete(fileItem.id);
            xhrMapRef.current.delete(fileItem.id);
        }
    }, [startPolling]);

    // ── Queue processor — drives queued → uploading ───────────────────────────
    useEffect(() => {
        const tick = () => {
            const current = stateRef.current;
            if (current.isPaused) return;

            const queuedFiles = current.files.filter(f => f.stage === 'queued' && f.file); // only files with actual File object
            const uploadingCount = uploadingRef.current.size; // only count XHRs this browser owns — not restored files from other tabs/sessions
            const slots = cfg.maxConcurrentUploads - uploadingCount;

            if (slots > 0 && queuedFiles.length > 0) {
                queuedFiles.slice(0, slots).forEach(f => uploadFile(f));
            }

            // Start polling for restored files that haven't got a timer yet.
            // Includes 'uploading' — those are being uploaded by another browser session;
            // poll so they transition to validating/completed without needing a refresh.
            current.files.forEach(f => {
                if (f.uploadId && f.isRestored && ['uploading', 'validating', 'pending_processing', 'processing'].includes(f.stage) && !pollingRef.current.has(f.id)) {
                    startPolling(f.id, f.uploadId);
                }
            });
        };

        const interval = setInterval(tick, 500);
        return () => clearInterval(interval);
    }, [uploadFile, startPolling, cfg.maxConcurrentUploads]);

    // ── Cleanup on unmount ────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            pollingRef.current.forEach(id => clearInterval(id));
        };
    }, []);

    // ─── Public API ───────────────────────────────────────────────────────────

    const addFiles = useCallback((files, uploadType, marketplaceId) => {
        const items = files.map(file => ({
            id: generateId(),
            file,
            fileName: sanitizeFileName(file, uploadType),
            uploadType,
            marketplaceId,
            stage: 'queued',
            uploadProgress: 0,
            uploadId: null,
            validationResult: null,
            hasValidationWarnings: false,
            hasValidationErrors: false,
            userDecision: 'pending',
            error: null,
            retryable: false,
            retryCount: 0,
            isRestored: false,
            queuedAt: Date.now(),
            startedAt: null,
            completedAt: null,
        }));

        dispatch({ type: ACTIONS.ADD_FILES, payload: items });
        toast.success(`Added ${files.length} file${files.length > 1 ? 's' : ''} to queue`);
    }, []);

    const removeFile = useCallback((fileId) => {
        const file = stateRef.current.files.find(f => f.id === fileId);
        const uploadId = file?.uploadId;
        const stage = file?.stage;

        // Processing cancel: don't remove immediately — show cancelling state, keep polling for worker confirmation
        if (stage === 'processing') {
            dispatch({ type: ACTIONS.UPDATE_FILE, payload: { id: fileId, updates: { stage: 'cancelling' } } });
            if (uploadId) {
                api.post('/upload/cancel', { uploadId }).catch(err =>
                    console.warn(`[removeFile] Backend cancel failed for ${uploadId}:`, err.message)
                );
            }
            return;
        }

        // All other stages: immediate removal
        stopPolling(fileId);
        const xhr = xhrMapRef.current.get(fileId);
        if (xhr) { xhr.abort(); xhrMapRef.current.delete(fileId); }
        uploadingRef.current.delete(fileId);

        dispatch({ type: ACTIONS.REMOVE_FILE, payload: fileId });

        if (uploadId) {
            api.post('/upload/cancel', { uploadId }).catch(err =>
                console.warn(`[removeFile] Backend cancel failed for ${uploadId}:`, err.message)
            );
        }
    }, [stopPolling]);

    const retryFile = useCallback((fileId) => {
        stopPolling(fileId);
        uploadingRef.current.delete(fileId);

        // Capture old uploadId BEFORE RETRY_FILE wipes it to null
        const file = stateRef.current.files.find(f => f.id === fileId);
        const oldUploadId = file?.uploadId;

        dispatch({ type: ACTIONS.RETRY_FILE, payload: fileId });
        toast.info('Retrying...');

        // Cancel old DB record so it won't reappear on refresh alongside the new one
        if (oldUploadId) {
            api.post('/upload/cancel', { uploadId: oldUploadId }).catch(err =>
                console.warn(`[retryFile] Backend cancel failed for ${oldUploadId}:`, err.message)
            );
        }
    }, [stopPolling]);

    // User approves a file with validation warnings → call /upload/proceed
    const approveFile = useCallback(async (fileId) => {
        const file = stateRef.current.files.find(f => f.id === fileId);
        if (!file || !file.uploadId) return;

        try {
            dispatch({ type: ACTIONS.UPDATE_FILE, payload: { id: fileId, updates: { userDecision: 'proceed', stage: 'processing' } } });
            await api.post('/upload/proceed', { uploadId: file.uploadId, decision: 'approve' });
            toast.info('Processing queued');
            startPolling(fileId, file.uploadId);
        } catch (err) {
            dispatch({ type: ACTIONS.SET_ERROR, payload: { id: fileId, error: err.message, retryable: false } });
            toast.error('Failed to queue for processing');
        }
    }, [startPolling]);

    // User cancels a file with validation warnings
    const cancelFile = useCallback(async (fileId) => {
        const file = stateRef.current.files.find(f => f.id === fileId);
        if (!file || !file.uploadId) {
            dispatch({ type: ACTIONS.REMOVE_FILE, payload: fileId });
            return;
        }

        try {
            await api.post('/upload/proceed', { uploadId: file.uploadId, decision: 'cancel' });
        } catch (err) {
            console.warn(`[cancelFile] Failed to notify backend of cancellation for uploadId ${file.uploadId}:`, err.message);
            // Continue even if cancel API fails
        }
        dispatch({ type: ACTIONS.REMOVE_FILE, payload: fileId });
    }, []);

    // Approve all files waiting for warning confirmation
    const approveAllValid = useCallback(() => {
        const warningFiles = stateRef.current.files.filter(
            f => f.stage === 'validated' && f.hasValidationWarnings && f.userDecision === 'pending'
        );
        warningFiles.forEach(f => approveFile(f.id));
        if (warningFiles.length > 0) {
            toast.success(`Approved ${warningFiles.length} file${warningFiles.length > 1 ? 's' : ''}`);
        }
    }, [approveFile]);

    const pauseQueue = useCallback(() => { dispatch({ type: ACTIONS.PAUSE_QUEUE }); toast.info('Queue paused'); }, []);
    const resumeQueue = useCallback(() => { dispatch({ type: ACTIONS.RESUME_QUEUE }); toast.success('Queue resumed'); }, []);

    const cancelAll = useCallback(() => {
        stateRef.current.files.forEach(f => {
            if (['queued', 'uploading'].includes(f.stage)) {
                const xhr = xhrMapRef.current.get(f.id);
                if (xhr) { xhr.abort(); xhrMapRef.current.delete(f.id); }
                uploadingRef.current.delete(f.id);
                stopPolling(f.id);
            }
        });
        dispatch({ type: ACTIONS.CANCEL_ALL });
        toast.info('Cancelled pending uploads');
    }, [stopPolling]);

    const clearCompleted = useCallback(() => {
        stateRef.current.files.filter(f => f.stage === 'completed').forEach(f => stopPolling(f.id));
        dispatch({ type: ACTIONS.CLEAR_COMPLETED });
    }, [stopPolling]);

    const clearAll = useCallback(() => {
        stateRef.current.files.filter(f => ['completed', 'failed', 'cancelled'].includes(f.stage)).forEach(f => stopPolling(f.id));
        dispatch({ type: ACTIONS.CLEAR_ALL });
    }, [stopPolling]);

    return {
        state,
        addFiles,
        removeFile,
        retryFile,
        approveFile,
        cancelFile,
        approveAllValid,
        pauseQueue,
        resumeQueue,
        cancelAll,
        clearCompleted,
        clearAll,
    };
};
