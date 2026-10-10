import React from 'react';
import {
    Package, ShoppingCart, Megaphone, RotateCcw,
    CreditCard, FileText, TrendingUp, ChevronRight,
} from 'lucide-react';
import { FAQ_CATEGORIES, getCategoryQuestionCount } from '../../../Speedydata/faqQuestions';

const ICON_MAP = {
    Package, ShoppingCart, Megaphone, RotateCcw,
    CreditCard, FileText, TrendingUp,
};

const COLOR_MAP = {
    purple: {
        bg: 'bg-purple-50', border: 'border-purple-100',
        hover: 'hover:border-purple-400 hover:bg-purple-100',
        icon: 'bg-purple-100 text-purple-600',
        badge: 'bg-purple-100 text-purple-600',
    },
    blue: {
        bg: 'bg-blue-50', border: 'border-blue-100',
        hover: 'hover:border-blue-400 hover:bg-blue-100',
        icon: 'bg-blue-100 text-blue-600',
        badge: 'bg-blue-100 text-blue-600',
    },
    orange: {
        bg: 'bg-orange-50', border: 'border-orange-100',
        hover: 'hover:border-orange-400 hover:bg-orange-100',
        icon: 'bg-orange-100 text-orange-600',
        badge: 'bg-orange-100 text-orange-600',
    },
    red: {
        bg: 'bg-red-50', border: 'border-red-100',
        hover: 'hover:border-red-400 hover:bg-red-100',
        icon: 'bg-red-100 text-red-600',
        badge: 'bg-red-100 text-red-600',
    },
    green: {
        bg: 'bg-green-50', border: 'border-green-100',
        hover: 'hover:border-green-400 hover:bg-green-100',
        icon: 'bg-green-100 text-green-600',
        badge: 'bg-green-100 text-green-600',
    },
    yellow: {
        bg: 'bg-yellow-50', border: 'border-yellow-100',
        hover: 'hover:border-yellow-400 hover:bg-yellow-100',
        icon: 'bg-yellow-100 text-yellow-600',
        badge: 'bg-yellow-100 text-yellow-600',
    },
    indigo: {
        bg: 'bg-indigo-50', border: 'border-indigo-100',
        hover: 'hover:border-indigo-400 hover:bg-indigo-100',
        icon: 'bg-indigo-100 text-indigo-600',
        badge: 'bg-indigo-100 text-indigo-600',
    },
};

const CategoryView = ({ onSelectCategory }) => {
    return (
        <div className="p-4">
            <p className="text-xs text-gray-500 mb-4">
                Select a category to browse pre-built questions
            </p>
            <div className="grid grid-cols-1 gap-3">
                {FAQ_CATEGORIES.map((cat) => {
                    const Icon = ICON_MAP[cat.icon] || Package;
                    const colors = COLOR_MAP[cat.color] || COLOR_MAP.purple;
                    const count = getCategoryQuestionCount(cat.id);

                    return (
                        <button
                            key={cat.id}
                            onClick={() => onSelectCategory(cat)}
                            className={`
                                w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left
                                transition-all duration-150 group
                                ${colors.border} ${colors.hover}
                            `}
                        >
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colors.icon}`}>
                                <Icon size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-800 text-sm">{cat.label}</p>
                                <p className="text-xs text-gray-500 truncate">{cat.description}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.badge}`}>
                                    {count}
                                </span>
                                <ChevronRight size={16} className="text-gray-400 group-hover:text-gray-600" />
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default CategoryView;
