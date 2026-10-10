import React from 'react';
import { ChevronRight, Database, MessageSquare } from 'lucide-react';
import { getQuestionsByCategory } from '../../../Speedydata/faqQuestions';
import { useLanguage } from '../../../Speedydata/LanguageContext';

const QuestionListView = ({ category, onSelectQuestion }) => {
    const { t } = useLanguage();
    const questions = getQuestionsByCategory(category.id);

    return (
        <div className="p-4">
            <p className="text-xs text-gray-500 mb-4">
                {questions.length} question{questions.length !== 1 ? 's' : ''} in this category
            </p>
            <div className="flex flex-col gap-2">
                {questions.map((q) => (
                    <button
                        key={q.id}
                        onClick={() => onSelectQuestion(q)}
                        className="w-full flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all text-left group"
                    >
                        {/* Dynamic vs Static indicator */}
                        <div className={`
                            w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5
                            ${q.type === 'dynamic'
                                ? 'bg-purple-100 text-purple-600'
                                : 'bg-gray-100 text-gray-500'}
                        `}>
                            {q.type === 'dynamic'
                                ? <Database size={14} />
                                : <MessageSquare size={14} />}
                        </div>

                        <p className="flex-1 text-sm text-gray-700 group-hover:text-gray-900 leading-snug">
                            {t(q.question)}
                        </p>

                        <ChevronRight
                            size={16}
                            className="text-gray-400 group-hover:text-purple-500 shrink-0 mt-0.5"
                        />
                    </button>
                ))}
            </div>

            {/* Legend */}
            <div className="mt-4 flex gap-4 text-xs text-gray-400">
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-purple-100 flex items-center justify-center">
                        <Database size={10} className="text-purple-600" />
                    </div>
                    Live data query
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-gray-100 flex items-center justify-center">
                        <MessageSquare size={10} className="text-gray-500" />
                    </div>
                    Instant answer
                </div>
            </div>
        </div>
    );
};

export default QuestionListView;
