import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, languages, getTranslation, translateText } from './translations.js';

function getInitialLanguage() {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return languages.some((language) => language.code === stored) ? stored : DEFAULT_LANGUAGE;
}

export function useLanguage() {
  const [language, setLanguageState] = useState(getInitialLanguage);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }
  }, [language]);

  const setLanguage = useCallback((nextLanguage) => {
    setLanguageState(languages.some((languageOption) => languageOption.code === nextLanguage) ? nextLanguage : DEFAULT_LANGUAGE);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((current) => (current === 'en' ? 'zh' : 'en'));
  }, []);

  const t = useCallback((key, fallback) => getTranslation(language, key, fallback), [language]);
  const tx = useCallback((value) => translateText(language, value), [language]);

  return useMemo(() => ({ language, languages, setLanguage, toggleLanguage, t, tx }), [language, setLanguage, toggleLanguage, t, tx]);
}
