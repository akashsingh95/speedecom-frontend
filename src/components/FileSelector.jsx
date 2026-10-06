import React, { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';

const FileSelector = ({ onFilesSelected, disabled = false, multiple = true }) => {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (disabled) return;
        const files = Array.from(e.dataTransfer.files);
        validateAndAdd(files);
    };

    const handleFileInput = (e) => {
        const files = Array.from(e.target.files);
        validateAndAdd(files);
        e.target.value = '';
    };

    const validateAndAdd = (files) => {
        const validFiles = [];
        const errors = [];

        files.forEach(file => {
            const ext = file.name.toLowerCase().split('.').pop();
            const allowed = ['xlsx', 'xls', 'csv', 'txt', 'tsv'];

            if (!allowed.includes(ext)) {
                errors.push(`${file.name}: Unsupported format .${ext}`);
                return;
            }

            const maxSize = 300 * 1024 * 1024;
            if (file.size > maxSize) {
                errors.push(`${file.name}: File too large (max 300MB)`);
                return;
            }

            if (file.size < 256) {
                errors.push(`${file.name}: File too small (minimum 256 bytes)`);
                return;
            }

            validFiles.push(file);
        });

        if (errors.length > 0) {
            toast.error(`Some files were skipped:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? `\n... and ${errors.length - 3} more` : ''}`);
        }

        if (validFiles.length > 0) {
            onFilesSelected(validFiles);
        } else if (errors.length === 0) {
            toast.error('No files selected');
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleClick = () => {
        if (!disabled) fileInputRef.current?.click();
    };

    const handleKeyDown = (e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            fileInputRef.current?.click();
        }
    };

    return (
        <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            onKeyDown={handleKeyDown}
            className={`relative border-2 border-dashed rounded-xl text-center outline-none transition-all duration-200 ${
                isDragging
                    ? 'border-blue-500 bg-blue-50 scale-[1.01] shadow-md'
                    : disabled
                        ? 'border-gray-200 bg-gray-50/80 cursor-not-allowed'
                        : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleClick}
        >
            <input
                ref={fileInputRef}
                type="file"
                multiple={multiple}
                accept=".xlsx,.xls,.csv,.txt,.tsv"
                onChange={handleFileInput}
                className="hidden"
                disabled={disabled}
            />

            <div className={`flex flex-col items-center gap-3 py-8 sm:py-10 px-6 transition-opacity duration-200 ${disabled ? 'opacity-40' : ''}`}>
                <div className={`p-3.5 rounded-2xl transition-all duration-200 ${
                    isDragging ? 'bg-blue-100 scale-110' : 'bg-gray-100'
                }`}>
                    <Upload className={`w-6 h-6 transition-colors duration-200 ${isDragging ? 'text-blue-600' : 'text-gray-500'}`} />
                </div>

                <div>
                    <p className={`text-sm font-medium mb-1 transition-colors ${
                        isDragging ? 'text-blue-600' : 'text-gray-700'
                    }`}>
                        {isDragging ? 'Drop files here' : 'Drag & drop or click to browse'}
                    </p>
                    <p className="text-xs text-gray-400">
                        {multiple ? 'Multiple files • ' : ''}.xlsx, .xls, .csv, .txt, .tsv
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Max 100MB per file</p>
                </div>
            </div>

            {disabled && (
                <div className="absolute inset-x-0 bottom-3 flex justify-center pointer-events-none">
                    <p className="text-xs text-amber-600 font-medium bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                        Select account &amp; type first
                    </p>
                </div>
            )}
        </div>
    );
};

export default FileSelector;
