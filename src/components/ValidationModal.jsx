import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, X } from 'lucide-react';

const ValidationModal = ({ isOpen, onClose, validationResult, onProceed, onCancel }) => {
    if (!isOpen || !validationResult) return null;

    const hasErrors = validationResult.hasErrors || !validationResult.overallValid;
    const hasWarnings = validationResult.hasWarnings && validationResult.overallValid;

    const allMissingRequired = validationResult.sheets
        ? validationResult.sheets.flatMap(s => s.missingRequired || [])
        : validationResult.missingRequired || [];

    const allExtraColumns = validationResult.sheets
        ? validationResult.sheets.flatMap(s => s.extraColumns || [])
        : validationResult.extraColumns || [];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">

                {/* Header */}
                <div className={`p-6 border-b ${hasErrors ? 'bg-red-50' : 'bg-yellow-50'}`}>
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${hasErrors ? 'bg-red-100' : 'bg-yellow-100'}`}>
                                {hasErrors
                                    ? <AlertCircle className="text-red-600" size={28} />
                                    : <AlertTriangle className="text-yellow-600" size={28} />
                                }
                            </div>
                            <div>
                                <h2 className={`text-xl font-bold ${hasErrors ? 'text-red-800' : 'text-yellow-800'}`}>
                                    {hasErrors ? 'Validation Failed' : 'Validation Warning'}
                                </h2>
                                <p className={`text-sm mt-1 ${hasErrors ? 'text-red-600' : 'text-yellow-600'}`}>
                                    {hasErrors
                                        ? 'Your file is missing required columns'
                                        : 'Your file has extra columns that will be ignored during processing'
                                    }
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">

                    {/* Missing Required Columns */}
                    {allMissingRequired.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <AlertCircle className="text-red-600" size={20} />
                                <h3 className="font-semibold text-red-800">
                                    Missing Required Columns ({[...new Set(allMissingRequired)].length})
                                </h3>
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <p className="text-sm text-red-700 mb-3">
                                    These columns are required but not found in your file:
                                </p>
                                <ul className="space-y-2">
                                    {[...new Set(allMissingRequired)].map((col, idx) => (
                                        <li key={idx} className="flex items-center gap-2 text-sm">
                                            <span className="w-1.5 h-1.5 bg-red-600 rounded-full flex-shrink-0" />
                                            <code className="bg-red-100 px-2 py-1 rounded text-red-800 font-mono">{col}</code>
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-sm text-red-700 mt-3 font-semibold">
                                    Add these columns to your file and upload again.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Extra Columns */}
                    {hasWarnings && allExtraColumns.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle className="text-yellow-600" size={20} />
                                <h3 className="font-semibold text-yellow-800">
                                    Extra Columns Detected ({[...new Set(allExtraColumns)].length})
                                </h3>
                            </div>
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <p className="text-sm text-yellow-700 mb-3">
                                    These columns don't match our schema and will be ignored:
                                </p>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {[...new Set(allExtraColumns)].slice(0, 15).map((col, idx) => (
                                        <code key={idx} className="bg-yellow-100 px-2 py-1 rounded text-yellow-800 text-xs font-mono">
                                            {col}
                                        </code>
                                    ))}
                                    {allExtraColumns.length > 15 && (
                                        <span className="text-xs text-yellow-700 px-2 py-1 self-center">
                                            +{allExtraColumns.length - 15} more
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-yellow-700">
                                    You can continue — these columns will simply be skipped.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Sheet-by-Sheet summary (multi-sheet files) */}
                    {validationResult.sheets && validationResult.sheets.length > 1 && (
                        <div>
                            <h3 className="font-semibold text-slate-800 mb-3">Sheet Details</h3>
                            <div className="space-y-2">
                                {validationResult.sheets.map((sheet, idx) => (
                                    <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-semibold text-slate-800 text-sm">{sheet.sheetName}</span>
                                            {sheet.canProceed
                                                ? <CheckCircle className="text-green-600" size={16} />
                                                : <AlertCircle className="text-red-600" size={16} />
                                            }
                                        </div>
                                        <div className="text-xs text-slate-500 space-y-0.5">
                                            {sheet.missingRequired?.length > 0 && (
                                                <p className="text-red-600">Missing: {sheet.missingRequired.join(', ')}</p>
                                            )}
                                            {sheet.extraColumns?.length > 0 && (
                                                <p className="text-yellow-600">{sheet.extraColumns.length} extra column{sheet.extraColumns.length > 1 ? 's' : ''} will be ignored</p>
                                            )}
                                            {!sheet.missingRequired?.length && !sheet.extraColumns?.length && (
                                                <p className="text-green-600">All columns matched</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t bg-slate-50">
                    <div className="flex items-center justify-end gap-3">
                        {hasErrors ? (
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-700 transition-colors"
                            >
                                Close
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={onCancel}
                                    className="px-6 py-2.5 text-slate-600 font-medium hover:text-slate-800 transition-colors"
                                >
                                    Cancel Upload
                                </button>
                                <button
                                    onClick={onProceed}
                                    className="px-6 py-2.5 bg-yellow-600 text-white font-medium rounded-lg hover:bg-yellow-700 transition-colors"
                                >
                                    Continue Anyway
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ValidationModal;
