import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, X, Bot } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import api from '../../api';

import HomeView from './views/HomeView';
import CategoryView from './views/CategoryView';
import QuestionListView from './views/QuestionListView';
import ParamCollectionView from './views/ParamCollectionView';
import ResponseView from './views/ResponseView';
import ChatView from './views/ChatView';
import ViewTransition from './ViewTransition';

// ─── View title map ────────────────────────────────────────
const VIEW_TITLES = {
    home: 'Speedy ⚡',
    categories: 'Browse Questions',
    questions: '',          // set dynamically from selectedCategory
    params: '',             // set dynamically from selectedQuestion
    response: 'Result',
    chat: 'Ask Speedy',
};

const SpeedySidebar = ({ isOpen, onClose }) => {
    const { user } = useAuth();

    // ── Navigation stack ─────────────────────────────────
    const [viewStack, setViewStack] = useState(['home']);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedQuestion, setSelectedQuestion] = useState(null);
    const [response, setResponse] = useState(null); // { data, format, chartType, summary }
    
    // ── Transition state ─────────────────────────────────
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [previousView, setPreviousView] = useState(null);
    const [isBackTransition, setIsBackTransition] = useState(false);

    // ── Marketplace cache (fetched once per sidebar open) ─
    const [marketplaces, setMarketplaces] = useState([]);
    const [marketplacesLoaded, setMarketplacesLoaded] = useState(false);

    const currentView = viewStack[viewStack.length - 1];
    const canGoBack = viewStack.length > 1;

    const push = useCallback((view) => {
        setPreviousView(currentView);
        setIsTransitioning(true);
        setIsBackTransition(false);
        setViewStack((p) => [...p, view]);
        setTimeout(() => {
            setIsTransitioning(false);
            setPreviousView(null);
        }, 350); // Match animation duration
    }, [currentView]);
    
    const pop = useCallback(() => {
        setPreviousView(currentView);
        setIsTransitioning(true);
        setIsBackTransition(true);
        setViewStack((p) => (p.length > 1 ? p.slice(0, -1) : p));
        setTimeout(() => {
            setIsTransitioning(false);
            setPreviousView(null);
        }, 350);
    }, [currentView]);
    
    const reset = useCallback(() => {
        setViewStack(['home']);
        setSelectedCategory(null);
        setSelectedQuestion(null);
        setResponse(null);
        setPreviousView(null);
        setIsTransitioning(false);
    }, []);

    // Fetch marketplaces once when sidebar opens
    useEffect(() => {
        if (!isOpen || marketplacesLoaded) return;
        (async () => {
            try {
                const res = await api.get('/marketplaces/filter-options?includeInactive=true');
                setMarketplaces(res.data || []);
            } catch (_) {
                setMarketplaces([]);
            } finally {
                setMarketplacesLoaded(true);
            }
        })();
    }, [isOpen, marketplacesLoaded]);

    // Reset view when sidebar closes
    useEffect(() => {
        if (!isOpen) {
            setViewStack(['home']);
            setSelectedCategory(null);
            setSelectedQuestion(null);
            setResponse(null);
        }
    }, [isOpen]);

    // ── View title ────────────────────────────────────────
    const getTitle = () => {
        if (currentView === 'questions' && selectedCategory) return selectedCategory.label;
        if (currentView === 'params' && selectedQuestion) return 'Set Parameters';
        return VIEW_TITLES[currentView] || 'Speedy';
    };

    // ── Handlers passed to child views ────────────────────
    const handleSelectCategory = (cat) => {
        setSelectedCategory(cat);
        push('questions');
    };

    const handleSelectQuestion = (q) => {
        setSelectedQuestion(q);
        if (q.type === 'static') {
            setResponse({ data: [], format: 'text', chartType: null, summary: q.answer });
            push('response');
        } else {
            push('params');
        }
    };

    const handleQueryResult = (result) => {
        setResponse(result);
        push('response');
    };

    // ── Render view helper ────────────────────────────────
    const renderView = (view, isExiting = false) => {
        // Animation classes based on direction:
        // Forward (push): exit slides left, enter from right
        // Backward (pop): exit slides right, enter from left
        const exitClass = isBackTransition ? 'page-transition-exit-back' : 'page-transition-exit';
        const enterClass = isBackTransition ? 'page-transition-enter-back' : 'page-transition-enter';
        
        const baseClasses = isExiting 
            ? `absolute inset-0 z-20 bg-white ${exitClass}` 
            : isTransitioning 
            ? `absolute inset-0 z-10 bg-white ${enterClass}` 
            : 'h-full bg-white';
        
        // Chat view needs overflow-hidden, others need overflow-y-auto
        const overflowClass = view === 'chat' ? 'overflow-hidden' : 'overflow-y-auto';
        const wrapperClass = `${baseClasses} ${overflowClass}`;
        
        switch (view) {
            case 'home':
                return (
                    <div key="home" className={wrapperClass}>
                        <HomeView
                            onBrowseFAQ={() => push('categories')}
                            onAskCustom={() => push('chat')}
                            userName={user?.fullName}
                        />
                    </div>
                );
            case 'categories':
                return (
                    <div key="categories" className={wrapperClass}>
                        <CategoryView onSelectCategory={handleSelectCategory} />
                    </div>
                );
            case 'questions':
                return selectedCategory ? (
                    <div key={`questions-${selectedCategory.id}`} className={wrapperClass}>
                        <QuestionListView
                            category={selectedCategory}
                            onSelectQuestion={handleSelectQuestion}
                        />
                    </div>
                ) : null;
            case 'params':
                return selectedQuestion ? (
                    <div key={`params-${selectedQuestion.id}`} className={wrapperClass}>
                        <ParamCollectionView
                            question={selectedQuestion}
                            marketplaces={marketplaces}
                            onResult={handleQueryResult}
                        />
                    </div>
                ) : null;
            case 'response':
                return response ? (
                    <div key="response" className={wrapperClass}>
                        <ResponseView
                            response={response}
                            question={selectedQuestion}
                            onAskAnother={reset}
                        />
                    </div>
                ) : null;
            case 'chat':
                return (
                    <div key="chat" className={`${wrapperClass} ${!isExiting ? 'h-full' : ''}`}>
                        <ChatView onBack={pop} />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div
            className={`
                fixed top-0 right-0 h-full z-50
                w-full sm:w-[460px]
                bg-white shadow-2xl flex flex-col
                transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : 'translate-x-full'}
            `}
        >
            {/* ── Header ─────────────────────────────────── */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 flex items-center gap-3 shrink-0">
                {canGoBack ? (
                    <button
                        onClick={pop}
                        className="text-white/80 hover:text-white transition-smooth-fast p-1 rounded-lg hover:bg-white/10"
                        title="Go back"
                    >
                        <ArrowLeft size={20} />
                    </button>
                ) : (
                    <div className="p-1 animate-scaleIn">
                        <Bot size={20} className="text-white" />
                    </div>
                )}

                <span className="flex-1 text-white font-bold text-sm">{getTitle()}</span>

                <button
                    onClick={onClose}
                    className="text-white/80 hover:text-white transition-smooth-fast p-1 rounded-lg hover:bg-white/10"
                    title="Close"
                >
                    <X size={20} />
                </button>
            </div>

            {/* ── View body ──────────────────────────────── */}
            <div className="flex-1 relative overflow-hidden">
                {/* Render previous view (exiting) */}
                {isTransitioning && previousView && renderView(previousView, true)}
                
                {/* Render current view (entering) */}
                {currentView && renderView(currentView, false)}
            </div>
        </div>
    );
};

export default SpeedySidebar;
