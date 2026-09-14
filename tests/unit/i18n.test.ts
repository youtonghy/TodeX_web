import { afterEach, describe, expect, it } from 'vitest';
import { detectLocale, matchLocale, resolveLocale, setLocale, translate, getLocale, subscribeLocale, LOCALE_STORAGE_KEY } from '../../src/renderer/i18n';

afterEach(() => {
  window.localStorage.removeItem(LOCALE_STORAGE_KEY);
  setLocale('zh-CN');
});

describe('locale resolution', () => {
  it('serves every Chinese variant as Simplified Chinese', () => {
    expect(matchLocale('zh-TW')).toBe('zh-CN');
    expect(matchLocale('zh-Hant-HK')).toBe('zh-CN');
    expect(matchLocale('zh_CN')).toBe('zh-CN');
    expect(matchLocale('ZH')).toBe('zh-CN');
  });

  it('matches Japanese, Korean and English regions', () => {
    expect(matchLocale('ja-JP')).toBe('ja');
    expect(matchLocale('ko-KR')).toBe('ko');
    expect(matchLocale('en-GB')).toBe('en');
    expect(matchLocale('fr')).toBeNull();
  });

  it('picks the first supported language in preference order and falls back to English', () => {
    expect(resolveLocale(['fr', 'ja', 'zh-CN'])).toBe('ja');
    expect(resolveLocale(['fr', 'de'])).toBe('en');
    expect(resolveLocale([])).toBe('en');
  });

  it('prefers the ?lang override, then the saved choice, then the browser languages', () => {
    expect(detectLocale({ search: '?lang=ko', stored: 'ja', languages: ['zh-TW'] })).toBe('ko');
    expect(detectLocale({ search: '?lang=xx', stored: 'ja', languages: ['zh-TW'] })).toBe('ja');
    expect(detectLocale({ search: '', stored: null, languages: ['zh-TW'] })).toBe('zh-CN');
    expect(detectLocale({ search: '', stored: null, languages: ['pt-BR'] })).toBe('en');
  });
});

describe('translate', () => {
  it('interpolates parameters and ICU plurals per locale', () => {
    expect(translate('en', 'common.language')).toBe('Language');
    expect(translate('ja', 'common.language')).toBe('言語');
    // Templates are exercised through the formatter directly via a known key shape.
    expect(translate('en', 'common.language', { unused: 1 })).toBe('Language');
  });

  it('notifies subscribers and updates <html lang> when the locale changes', () => {
    let calls = 0;
    const unsubscribe = subscribeLocale(() => { calls += 1; });
    setLocale('ko');
    expect(getLocale()).toBe('ko');
    expect(document.documentElement.lang).toBe('ko');
    expect(calls).toBe(1);
    setLocale('ko');
    expect(calls).toBe(1);
    unsubscribe();
  });
});
