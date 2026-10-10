// ─────────────────────────────────────────────────────────
//  Speedy Agent — Language Context
//  Provides `lang` + `setLang` + a `t()` helper used to read
//  translated fields from the FAQ data layer.
//
//  Field shape:  string  → returned as-is (untranslated entries
//                          keep working without breakage)
//                { en, hi } → returned for current `lang` with
//                          fallback to `en` on missing key.
// ─────────────────────────────────────────────────────────

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

const STORAGE_KEY = 'speedy.lang';
const SUPPORTED   = ['en', 'hi'];

const LanguageContext = createContext({
    lang: 'en',
    setLang: () => {},
    t: (field) => (typeof field === 'string' ? field : field?.en || ''),
});

export const LanguageProvider = ({ children }) => {
    const [lang, setLangState] = useState(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return SUPPORTED.includes(stored) ? stored : 'en';
        } catch {
            return 'en';
        }
    });

    const setLang = (next) => {
        if (!SUPPORTED.includes(next)) return;
        setLangState(next);
    };

    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore quota errors */ }
    }, [lang]);

    const value = useMemo(() => {
        const t = (field, overrideLang) => {
            if (field == null) return '';
            if (typeof field === 'string') return field;
            const target = overrideLang || lang;
            return field[target] ?? field.en ?? '';
        };
        return { lang, setLang, t };
    }, [lang]);

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
