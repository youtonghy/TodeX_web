import { setLocale } from '../src/renderer/i18n';

// Unit tests assert the Simplified Chinese source text regardless of the
// machine's language; jsdom reports en-US by default.
setLocale('zh-CN');
