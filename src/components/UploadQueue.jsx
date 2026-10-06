import React, { useState } from 'react';
import QueueItem from './QueueItem';
import ValidationModal from './ValidationModal';

// Export stats calculator for use in parent component
export const calculateQueueStats = (files) => {
    return {
        total: files.length,
        queued: files.filter(f => f.stage === 'queued').length,
        uploading: files.filter(f => f.stage === 'uploading').length,
        validating: files.filter(f => f.stage === 'validating').length,
        validated: files.filter(f => f.stage === 'validated' && !f.hasValidationErrors).length,
        errors: files.filter(f => f.hasValidationErrors || f.stage === 'failed').length,
        warnings: files.filter(f => f.hasValidationWarnings && !f.hasValidationErrors).length,
        processing: files.filter(f => f.stage === 'processing').length,
        completed: files.filter(f => f.stage === 'completed').length,
        warningsNeedingApproval: files.filter(f =>
            f.stage === 'validated' &&
            !f.hasValidationErrors &&
            f.hasValidationWarnings &&
            f.userDecision === 'pending'
        ).length,
        failedCount: files.filter(f => f.error && f.retryable).length,
        completedCount: files.filter(f => f.stage === 'completed').length,
        cancelableCount: files.filter(f =>
            ['queued', 'uploading', 'validating'].includes(f.stage)
        ).length,
    };
};

const UploadQueue = ({ 
    files, 
    onRetry, 
    onCancel, 
    onApprove, 
    onReject
}) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [showValidationModal, setShowValidationModal] = useState(false);

    const handleViewDetails = (fileItem) => {
        setSelectedFile(fileItem);
        setShowValidationModal(true);
    };

    const handleModalClose = () => {
        setShowValidationModal(false);
        setSelectedFile(null);
    };

    const handleModalProceed = () => {
        if (selectedFile) {
            onApprove(selectedFile.id);
            handleModalClose();
        }
    };

    const handleModalCancel = () => {
        if (selectedFile) {
            onReject(selectedFile.id);
            handleModalClose();
        }
    };

    if (files.length === 0) {
        return null;
    }

    return (
        <div className="space-y-3">
            {/* Validation Modal */}
            {showValidationModal && selectedFile && (
                <ValidationModal
                    isOpen={showValidationModal}
                    onClose={handleModalClose}
                    validationResult={selectedFile.validationResult}
                    onProceed={handleModalProceed}
                    onCancel={handleModalCancel}
                />
            )}

            {/* Queue Items */}
            <div className="space-y-3">
                {files.map(fileItem => (
                    <QueueItem
                        key={fileItem.id}
                        fileItem={fileItem}
                        onRetry={onRetry}
                        onCancel={onCancel}
                        onViewDetails={handleViewDetails}
                        onApprove={onApprove}
                        onReject={onReject}
                    />
                ))}
            </div>
        </div>
    );
};

export default UploadQueue;
