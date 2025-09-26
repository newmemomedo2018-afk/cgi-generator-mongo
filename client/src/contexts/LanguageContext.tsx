/**
 * Language Context Provider
 * Provides language switching functionality across the application
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  Language, 
  LanguageContextType, 
  translations, 
  TranslationKeys, 
  DEFAULT_LANGUAGE 
} from '@/lib/i18n';

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Check localStorage first, then browser language, then default
    const savedLang = localStorage.getItem('language') as Language;
    if (savedLang && ['en', 'ar'].includes(savedLang)) {
      return savedLang;
    }
    
    // Check browser language for Arabic
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('ar')) {
      return 'ar';
    }
    
    return DEFAULT_LANGUAGE;
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
    
    // Update document direction and language
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    
    // Update CSS custom property for direction-aware styling
    document.documentElement.style.setProperty('--text-direction', lang === 'ar' ? 'rtl' : 'ltr');
  };

  const t = (key: keyof TranslationKeys): string => {
    return translations[language][key] || translations[DEFAULT_LANGUAGE][key] || key;
  };

  const isRTL = language === 'ar';

  // Set initial direction and language on mount
  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    document.documentElement.style.setProperty('--text-direction', isRTL ? 'rtl' : 'ltr');
  }, [language, isRTL]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}