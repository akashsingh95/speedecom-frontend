import React from 'react';
import { RefreshCw } from 'lucide-react';
import ResponseRenderer from '../ResponseRenderer';
import TypewriterText from '../TypewriterText';
import { useLanguage } from '../../../Speedydata/LanguageContext';

const ResponseView = ({ response, question, onAskAnother }) => {
    const { t } = useLanguage();
    const { data = [], format, chartType, summary } = response;

    return (
        <div className="flex flex-col h-full">
            {/* Summary text with Typewriter Animation */}
            {summary && (
                <div className="px-5 pt-5 pb-3">
                    <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl">
                        <TypewriterText 
                            text={summary}
                            speed={15}
                            className="text-sm text-gray-800 leading-relaxed"
                        />
                    </div>
                </div>
            )}

            {/* Question that was asked */}
            {question && (
                <div className="px-5 pb-3">
                    <p className="text-xs text-gray-400 leading-snug">{t(question.question)}</p>
                </div>
            )}

            {/* Data */}
            {(data.length > 0 || format === 'text') && (
                <div className="flex-1 overflow-auto px-5 pb-3">
                    <ResponseRenderer
                        data={data}
                        format={format}
                        chartType={chartType}
                    />
                </div>
            )}

            {/* Ask another */}
            <div className="px-5 pb-5 pt-2 border-t border-gray-100 shrink-0">
                <button
                    onClick={onAskAnother}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-purple-200 text-purple-600 font-semibold text-sm hover:bg-purple-50 transition-colors"
                >
                    <RefreshCw size={15} />
                    Ask Another Question
                </button>
            </div>
        </div>
    );
};

export default ResponseView;
