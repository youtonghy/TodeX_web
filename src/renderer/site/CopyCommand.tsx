import { useEffect, useState } from 'react';
import { Button } from '@heroui/react';
import { RiCheckLine, RiFileCopyLine } from '@remixicon/react';
import { useT } from '../i18n';

/** A shell command with a copy button; `label` names what gets copied. */
export function CopyCommand({ command, label, className = '' }: { command: string; label: string; className?: string }) {
  const t = useT();
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => { if (status === 'idle') return; const timer = window.setTimeout(() => setStatus('idle'), 2400); return () => clearTimeout(timer); }, [status]);
  return <div className={`setup-command${className ? ` ${className}` : ''}`}><code><span>$</span> {command}</code><Button isIconOnly variant="ghost" aria-label={status === 'copied' ? t('site.how.copy.copied') : label} onPress={async () => { try { await navigator.clipboard.writeText(command); setStatus('copied'); } catch { setStatus('failed'); } }}>{status === 'copied' ? <RiCheckLine size={16} /> : <RiFileCopyLine size={16} />}</Button><span className="copy-status" role="status">{status === 'copied' ? t('site.how.copy.done') : status === 'failed' ? t('site.how.copy.failed') : ''}</span></div>;
}
