import { useCallback, useSyncExternalStore } from 'react';
import { DirectionProvider } from '@/components/foundations/direction/direction';
import { TemplateCopyProvider } from '@/components/foundations/template-copy/template-copy';
import { App } from './App';
import { getLocale, subscribeLocale, t } from './i18n';

/** Built-in English copy of BoardUI components (e.g. the date picker's
 * footer) mapped to the app's own strings; anything else passes through. */
const TEMPLATE_COPY = {
  'Select date': 'common.selectDate',
  Cancel: 'common.cancel',
  Apply: 'common.apply',
  Date: 'common.date',
} as const;

/** Keeps BoardUI's text direction, React Aria locale, portalled menus and
 * built-in copy in step with the in-app language. */
export function AppRoot() {
  const locale = useSyncExternalStore(subscribeLocale, getLocale);
  // Re-created per locale so translated copy re-renders on a language switch.
  const translate = useCallback((text: string) => {
    const key = TEMPLATE_COPY[text as keyof typeof TEMPLATE_COPY];
    return key ? t(key) : text;
  }, [locale]);
  return (
    <DirectionProvider locale={locale}>
      <TemplateCopyProvider translate={translate}>
        <App />
      </TemplateCopyProvider>
    </DirectionProvider>
  );
}
