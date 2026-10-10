import React, { useState, useRef, useEffect } from 'react';
import { Send, Store, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import { useAuth } from '../../../AuthContext';
import api from '../../../api';
import ResponseRenderer from '../ResponseRenderer';
import TypewriterText from '../TypewriterText';

// Custom scrollbar styles - overlay style
const scrollbarStyles = `
    .custom-scrollbar {
        scrollbar-width: thin;
        scrollbar-color: #D1D5DB transparent;
        scrollbar-gutter: stable;
    }
    
    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(156, 163, 175, 0.5);
        border-radius: 3px;
    }
    
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(107, 114, 128, 0.7);
    }
`;

const ChatView = () => {
    const { user } = useAuth();
    const [messages, setMessages] = useState([
        {
            type: 'agent',
            text: "Hi! Ask me anything about your business — sales, orders, returns, ads, and more. I'll query your data and answer.",
            data: null,
            format: null,
            chartType: null,
        },
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const textareaRef = useRef(null);
    
    // Marketplace filter state
    const [marketplaces, setMarketplaces] = useState([]);
    const [selectedAccounts, setSelectedAccounts] = useState([]); // Array of account IDs
    const [isSectionExpanded, setIsSectionExpanded] = useState(false); // Section collapsed/expanded
    const [selectedMarketplaceKey, setSelectedMarketplaceKey] = useState(null); // Drill-down view
    const [loadingMarketplaces, setLoadingMarketplaces] = useState(true);
    
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Auto-resize textarea based on content
    const autoResizeTextarea = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto'; // Reset height
            const newHeight = Math.min(textarea.scrollHeight, 240); // Max 240px (~10 lines)
            textarea.style.height = `${newHeight}px`;
        }
    };

    // Handle input change and auto-resize
    const handleInputChange = (e) => {
        setInput(e.target.value);
        autoResizeTextarea();
    };

    // Handle keyboard shortcuts
    const handleKeyDown = (e) => {
        // Enter (without Shift) = Submit
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent new line
            handleSend(e);
        }
        // Shift+Enter = New line (default textarea behavior, no action needed)
    };

    // Fetch available marketplaces on mount
    useEffect(() => {
        const fetchMarketplaces = async () => {
            try {
                const tenantId = user?.tenantId || user?._id;
                if (!tenantId) {
                    setLoadingMarketplaces(false);
                    return;
                }

                const res = await api.get('/marketplaces/filter-options?includeInactive=true');
                console.log('[ChatView] Marketplace API Response:', res.data);
                
                // Handle both response formats: direct array or wrapped in success/data
                let marketplaceData = null;
                if (Array.isArray(res.data)) {
                    // Direct array response
                    marketplaceData = res.data;
                } else if (res.data?.success && res.data.data) {
                    // Wrapped response
                    marketplaceData = res.data.data;
                }

                if (marketplaceData && marketplaceData.length > 0) {
                    console.log('[ChatView] Setting marketplaces:', marketplaceData);
                    setMarketplaces(marketplaceData);
                } else {
                    console.warn('[ChatView] No marketplace data in response');
                }
            } catch (error) {
                console.error('[ChatView] Failed to fetch marketplaces:', error);
            } finally {
                setLoadingMarketplaces(false);
            }
        };

        fetchMarketplaces();
    }, [user]);

    // Toggle section expansion
    const toggleSection = () => {
        setIsSectionExpanded(prev => !prev);
        if (isSectionExpanded) {
            // Close drill-down when collapsing
            setSelectedMarketplaceKey(null);
        }
    };

    // Toggle drill-down for marketplace accounts
    const openMarketplaceDrilldown = (key) => {
        // If clicking the same marketplace, close it; otherwise switch to new one
        setSelectedMarketplaceKey(prev => prev === key ? null : key);
    };

    // Close drill-down
    const closeDrilldown = () => {
        setSelectedMarketplaceKey(null);
    };

    // Toggle account selection
    const toggleAccount = (accountId) => {
        setSelectedAccounts(prev => {
            if (prev.includes(accountId)) {
                return prev.filter(id => id !== accountId);
            } else {
                return [...prev, accountId];
            }
        });
    };

    // Toggle all accounts in a marketplace (checkbox)
    const toggleMarketplaceSelection = (marketplace) => {
        const accountIds = marketplace.accounts.map(acc => acc._id);
        const allSelected = accountIds.every(id => selectedAccounts.includes(id));
        
        if (allSelected) {
            // Deselect all
            setSelectedAccounts(prev => prev.filter(id => !accountIds.includes(id)));
        } else {
            // Select all
            setSelectedAccounts(prev => {
                const newSelection = [...prev];
                accountIds.forEach(id => {
                    if (!newSelection.includes(id)) {
                        newSelection.push(id);
                    }
                });
                return newSelection;
            });
        }
    };

    // Clear all selections
    const clearAllSelections = () => {
        setSelectedAccounts([]);
        closeDrilldown();
    };

    // Check if marketplace has all accounts selected
    const isMarketplaceFullySelected = (marketplace) => {
        const accountIds = marketplace.accounts.map(acc => acc._id);
        return accountIds.length > 0 && accountIds.every(id => selectedAccounts.includes(id));
    };

    // Check if marketplace has some accounts selected
    const isMarketplacePartiallySelected = (marketplace) => {
        const accountIds = marketplace.accounts.map(acc => acc._id);
        const selectedCount = accountIds.filter(id => selectedAccounts.includes(id)).length;
        return selectedCount > 0 && selectedCount < accountIds.length;
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    // Get current filter description
    const getCurrentFilter = () => {
        if (selectedAccounts.length === 0) return null;
        
        if (selectedAccounts.length === 1) {
            // Find the account name
            for (const mp of marketplaces) {
                const account = mp.accounts.find(acc => acc._id === selectedAccounts[0]);
                if (account) return account.name;
            }
            return '1 Account';
        }
        
        return `${selectedAccounts.length} Accounts Selected`;
    };

    const handleSend = async (e) => {
        e.preventDefault();
        const query = input.trim();
        if (!query || isLoading) return;

        const tenantId = user?.tenantId || user?._id;
        if (!tenantId) return;

        setInput('');
        
        // Reset textarea height after submission
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
        
        setMessages((prev) => [...prev, { type: 'user', text: query }]);
        setIsLoading(true);

        try {
            // Build conversation history (last 3 exchanges = 6 messages max)
            const conversationHistory = messages
                .slice(-6) // Last 6 messages (3 user + 3 agent)
                .map(msg => ({
                    role: msg.type === 'user' ? 'user' : 'assistant',
                    content: msg.text
                }));

            // Build request with selected accounts and conversation context
            const requestData = {
                query,
                tenantId,
                conversationHistory, // NEW: Send conversation context
            };

            // Add marketplace filter if specific accounts are selected
            if (selectedAccounts.length > 0) {
                requestData.marketplaceIds = selectedAccounts;
            }
            // Otherwise query all data (no filter)

            const res = await api.post('/agent/query', requestData);
            const { summary, data, format, chartType } = res.data;

            setMessages((prev) => [
                ...prev,
                {
                    type: 'agent',
                    text: summary,
                    data: data || [],
                    format: format || (data?.length ? 'table' : 'text'),
                    chartType: chartType || null,
                },
            ]);
        } catch (_) {
            setMessages((prev) => [
                ...prev,
                {
                    type: 'agent',
                    text: "⚠️ Something went wrong. Please try again.",
                    data: null,
                    format: 'text',
                    chartType: null,
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Custom Scrollbar Styles */}
            <style>{scrollbarStyles}</style>
            
            <div className="flex flex-col h-full" style={{ maxHeight: 'calc(100vh - 60px)' }}>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {/* Active Filter Badge */}
                {getCurrentFilter() && (
                    <div className="flex justify-center mb-2">
                        <div className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5">
                            <Store className="w-3 h-3" />
                            <span>Filtering: {getCurrentFilter()}</span>
                        </div>
                    </div>
                )}
                
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.type === 'user' ? (
                            <div className="max-w-[85%] bg-purple-600 text-white px-4 py-2.5 rounded-2xl rounded-br-none text-sm leading-relaxed">
                                {msg.text}
                            </div>
                        ) : (
                            <div className="w-full max-w-full">
                                {/* Summary text bubble with Typewriter Animation */}
                                {msg.text && (
                                    <div className="bg-white border border-gray-200 shadow-sm px-4 py-2.5 rounded-2xl rounded-bl-none mb-2 max-w-[90%]">
                                        <TypewriterText 
                                            text={msg.text}
                                            speed={15}
                                            className="text-sm text-gray-700 leading-relaxed"
                                        />
                                    </div>
                                )}
                                {/* Rich data */}
                                {msg.data?.length > 0 && (
                                    <div className="mt-2">
                                        <ResponseRenderer
                                            data={msg.data}
                                            format={msg.format}
                                            chartType={msg.chartType}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
                
                {/* Loading indicator */}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-gray-200 shadow-sm px-4 py-2.5 rounded-2xl rounded-bl-none">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Section */}
            <div className="border-t bg-white shrink-0">
                {/* Marketplace & Account Multi-Select - Collapsible */}
                <div className="border-b border-gray-100">


                    {/* Expandable Content with smooth animation - FIXED HEIGHT */}
                    <div 
                        className="overflow-hidden transition-all duration-300 ease-in-out"
                        style={{ 
                            maxHeight: isSectionExpanded ? '280px' : '0px',
                            opacity: isSectionExpanded ? 1 : 0
                        }}
                    >
                        <div className="flex h-[200px] relative">
                            {/* Marketplace List - Compresses when drill-down opens */}
                            <div 
                                className="overflow-y-auto custom-scrollbar px-3 py-3 h-full"
                                style={{
                                    width: selectedMarketplaceKey ? '50%' : '100%',
                                    transition: 'width 400ms cubic-bezier(0.4, 0, 0.2, 1)',
                                    willChange: 'width'
                                }}
                            >
                                <div>
                                    {loadingMarketplaces ? (
                                        <div className="text-center py-8 text-xs text-gray-400">
                                            Loading...
                                        </div>
                                    ) : marketplaces.length === 0 ? (
                                        <div className="text-center py-8 text-xs text-orange-500">
                                            No marketplaces
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {marketplaces.map((mp) => {
                                                const isFullySelected = isMarketplaceFullySelected(mp);
                                                const isPartiallySelected = isMarketplacePartiallySelected(mp);
                                                const isActive = selectedMarketplaceKey === mp.key;
                                                
                                                return (
                                                    <div 
                                                        key={mp.key}
                                                        onClick={() => openMarketplaceDrilldown(mp.key)}
                                                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${
                                                            isActive 
                                                                ? 'bg-purple-100 border border-purple-300' 
                                                                : 'bg-gray-50 hover:bg-gray-100'
                                                        }`}
                                                        style={{
                                                            transition: 'all 200ms ease-in-out'
                                                        }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isFullySelected}
                                                            ref={el => {
                                                                if (el) el.indeterminate = isPartiallySelected;
                                                            }}
                                                            onChange={() => toggleMarketplaceSelection(mp)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="w-4 h-4 rounded cursor-pointer flex-shrink-0"
                                                        />
                                                        <span 
                                                            className="flex-1 font-medium truncate"
                                                            style={{
                                                                fontSize: selectedMarketplaceKey ? '0.75rem' : '0.875rem',
                                                                transition: 'font-size 400ms cubic-bezier(0.4, 0, 0.2, 1)',
                                                                color: isActive ? '#7C3AED' : '#374151'
                                                            }}
                                                            title={mp.key}
                                                        >
                                                            {mp.key} ({mp.accounts.length})
                                                        </span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openMarketplaceDrilldown(mp.key);
                                                            }}
                                                            className="p-1 hover:bg-white rounded flex-shrink-0"
                                                            style={{
                                                                transition: 'all 200ms ease-in-out'
                                                            }}
                                                            title={isActive ? "Close" : "View accounts"}
                                                        >
                                                            <ChevronRight 
                                                                className="text-purple-600"
                                                                style={{
                                                                    width: '16px',
                                                                    height: '16px',
                                                                    transform: isActive ? 'rotate(180deg)' : 'rotate(0deg)',
                                                                    transition: 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)'
                                                                }}
                                                            />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Account Drill-down View - Slides in from right with border separator */}
                            <div 
                                className="overflow-y-auto border-l border-gray-200 h-full absolute top-0 right-0 custom-scrollbar px-3 py-3"
                                style={{
                                    width: selectedMarketplaceKey ? '50%' : '0%',
                                    opacity: selectedMarketplaceKey ? 1 : 0,
                                    transform: selectedMarketplaceKey ? 'translateX(0)' : 'translateX(20px)',
                                    transition: 'all 400ms cubic-bezier(0.4, 0, 0.2, 1)',
                                    pointerEvents: selectedMarketplaceKey ? 'auto' : 'none',
                                    willChange: 'width, opacity, transform'
                                }}
                            >
                                {selectedMarketplaceKey && (
                                    <div>
                                        {/* Account List with scrollbar */}
                                        <div className="space-y-1">
                                            {marketplaces
                                                .find(mp => mp.key === selectedMarketplaceKey)
                                                ?.accounts.map((acc, index) => (
                                                    <label
                                                        key={acc._id}
                                                        className="flex items-center gap-2 p-1.5 hover:bg-purple-50 rounded cursor-pointer"
                                                        style={{
                                                            opacity: selectedMarketplaceKey ? 1 : 0,
                                                            transform: selectedMarketplaceKey ? 'translateX(0)' : 'translateX(10px)',
                                                            transition: `all 400ms cubic-bezier(0.4, 0, 0.2, 1) ${100 + index * 30}ms`
                                                        }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedAccounts.includes(acc._id)}
                                                            onChange={() => toggleAccount(acc._id)}
                                                            className="w-3.5 h-3.5 text-purple-600 rounded flex-shrink-0"
                                                        />
                                                        <span className="text-xs text-gray-700 flex-1 truncate" title={acc.name}>
                                                            {acc.name}
                                                            {acc.status === 'inactive' && (
                                                                <span className="ml-1 text-[10px] text-red-500 font-medium">(Inactive)</span>
                                                            )}
                                                        </span>
                                                    </label>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Section Header - Clickable to expand/collapse */}
                    <button
                        onClick={toggleSection}
                        className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Store className="w-3.5 h-3.5 text-purple-600" />
                            <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                                Select Accounts
                            </span>
                            {selectedMarketplaceKey && (
                                <span className="text-[10px] text-purple-700 bg-purple-100 px-2 rounded font-medium truncate max-w-[120px] border border-purple-200" title={selectedMarketplaceKey}>
                                    📂 {selectedMarketplaceKey}
                                </span>
                            )}
                            {!loadingMarketplaces && marketplaces.length > 0 && !selectedMarketplaceKey && (
                                <span className="text-xs text-gray-500">
                                    ({selectedAccounts.length} of {marketplaces.reduce((sum, mp) => sum + mp.accounts.length, 0)})
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">

                            {selectedAccounts.length > 0 && (
                                <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                                    {selectedAccounts.length}
                                </span>
                            )}
                            {selectedAccounts.length > 0 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        clearAllSelections();
                                    }}
                                    className="text-[10px] text-red-500 hover:text-red-700 font-medium px-2 py-1 hover:bg-red-50 rounded transition-colors"
                                >
                                    Clear All
                                </button>
                            )}
                            {isSectionExpanded ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                        </div>
                    </button>
                </div>

                {/* Text Input */}
                <div className="p-3">
                    <form onSubmit={handleSend} className="flex gap-2 items-end">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder={getCurrentFilter() ? `Ask about ${getCurrentFilter()}...` : "Ask anything about your data..."}
                            className="flex-1 bg-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none overflow-y-auto custom-scrollbar"
                            rows={1}
                            style={{
                                minHeight: '40px',
                                maxHeight: '240px',
                                lineHeight: '1.5'
                            }}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white w-10 h-10 rounded-xl flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-all shrink-0"
                        >
                            <Send size={16} />
                        </button>
                    </form>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ChatView;
