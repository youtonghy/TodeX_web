import { ListBox, Select } from '@heroui/react';
import { RiGlobalLine } from '@remixicon/react';
import { isLocale, LOCALE_LABELS, SUPPORTED_LOCALES, setLocalePreference, useLocale, useT } from '../i18n';

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const t = useT();
  const locale = useLocale();
  return (
    <Select aria-label={t('common.language')} value={locale} onChange={(value) => { if (isLocale(value)) setLocalePreference(value); }} className={`language-select${className ? ` ${className}` : ''}`}>
      <Select.Trigger><RiGlobalLine size={16} /><Select.Value /><Select.Indicator /></Select.Trigger>
      <Select.Popover className="website-select-popover"><ListBox>
        {SUPPORTED_LOCALES.map((item) => <ListBox.Item key={item} id={item} textValue={LOCALE_LABELS[item]}>{LOCALE_LABELS[item]}<ListBox.ItemIndicator /></ListBox.Item>)}
      </ListBox></Select.Popover>
    </Select>
  );
}
