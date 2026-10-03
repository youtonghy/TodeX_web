import { useLayoutEffect, useRef } from 'react';
import { RiCloseLine, RiFileCopyLine, RiTerminalWindowLine } from '@remixicon/react';
import { Button, Chip, Tooltip, toast } from '@heroui/react';
import { isSshFailureKind, type SshExecOutputChunk, type SshExecRun } from '@todex/protocol/ssh';
import { SSH_FAILURE_HINT_KEYS, SSH_FAILURE_LABEL_KEYS } from './sshShared';
import { formatSshExecDuration } from '../../session/sshExecTabs';
import { useT } from '../../i18n';

type ChipColor = 'default' | 'accent' | 'success' | 'warning' | 'danger';

function useStatus(run: SshExecRun): { label: string; color: ChipColor; hint: string } {
  const t = useT();
  if (run.status === 'running') return { label: t('sshExec.running'), color: 'accent', hint: '' };
  if (run.status === 'cancelled') return { label: t('sshExec.cancelled'), color: 'warning', hint: '' };
  if (run.status === 'failed') {
    const kind = isSshFailureKind(run.failure) ? run.failure : null;
    return {
      label: t('sshExec.failed', { reason: t(SSH_FAILURE_LABEL_KEYS[kind ?? 'other']) }),
      color: 'danger',
      hint: kind ? t(SSH_FAILURE_HINT_KEYS[kind]) : '',
    };
  }
  if (run.exitCode === undefined) return { label: t('sshExec.completed'), color: 'success', hint: '' };
  return { label: t('sshExec.exitCode', { code: run.exitCode }), color: run.exitCode === 0 ? 'success' : 'danger', hint: '' };
}

/** Scrolling read-only output; follows new output while the reader stays at
 * the bottom and stops following once they scroll up. */
function SshExecOutput({ output, isActive, label }: { output: SshExecOutputChunk[]; isActive: boolean; label: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element && isActive && followRef.current) element.scrollTop = element.scrollHeight;
  }, [isActive, output]);
  return (
    <div
      ref={scrollRef}
      role="log"
      aria-label={label}
      className="bg-surface-secondary min-h-0 flex-1 overflow-auto rounded-xl border border-separator p-3"
      onScroll={(event) => {
        const element = event.currentTarget;
        followRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 16;
      }}
    >
      <pre className="font-mono text-xs whitespace-pre-wrap break-all">
        {output.map((chunk, index) => (
          <span key={index} data-stream={chunk.stream} className={chunk.stream === 'stderr' ? 'text-danger opacity-80' : undefined}>{chunk.data}</span>
        ))}
      </pre>
    </div>
  );
}

export function SshExecPane({ run, isActive, onClose }: { run: SshExecRun | undefined; isActive: boolean; onClose: () => void }) {
  const t = useT();
  if (!run) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex justify-end px-4 pt-3">
          <Button isIconOnly size="sm" variant="ghost" aria-label={t('sshExec.close')} onPress={onClose}>
            <RiCloseLine className="size-4" />
          </Button>
        </div>
        <div className="text-muted flex flex-1 items-center justify-center px-6 text-center text-sm">{t('sshExec.missing')}</div>
      </div>
    );
  }
  return <SshExecRunView run={run} isActive={isActive} onClose={onClose} />;
}

function SshExecRunView({ run, isActive, onClose }: { run: SshExecRun; isActive: boolean; onClose: () => void }) {
  const t = useT();
  const status = useStatus(run);
  const duration = run.status !== 'running' && run.durationMs !== undefined ? formatSshExecDuration(run.durationMs) : '';
  const copyCommand = () => {
    void navigator.clipboard.writeText(run.command)
      .then(() => toast.success(t('sshExec.commandCopied')))
      .catch(() => toast.danger(t('sshExec.copyFailed')));
  };
  return (
    <div className="flex h-full min-h-0 flex-col px-4 pb-4 pt-3">
      <div className="mb-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <RiTerminalWindowLine className="text-muted size-4 shrink-0" />
          <span className="min-w-0 truncate text-sm font-medium">{run.host}</span>
          <Chip size="sm" variant="soft" color={status.color}>{status.label}</Chip>
          {duration ? <span className="text-muted shrink-0 text-xs">{duration}</span> : null}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Tooltip delay={200}>
              <Button isIconOnly size="sm" variant="ghost" aria-label={t('sshExec.copyCommand')} isDisabled={!run.command} onPress={copyCommand}>
                <RiFileCopyLine className="size-4" />
              </Button>
              <Tooltip.Content className="text-xs">{t('sshExec.copyCommand')}</Tooltip.Content>
            </Tooltip>
            <Button isIconOnly size="sm" variant="ghost" aria-label={t('sshExec.close')} onPress={onClose}>
              <RiCloseLine className="size-4" />
            </Button>
          </div>
        </div>
        <code className="bg-surface-secondary block truncate rounded-md px-2 py-1 font-mono text-xs" title={run.command}>
          {run.command || '…'}
        </code>
        {run.cwd ? <span className="text-muted truncate text-xs" title={run.cwd}>{t('sshExec.cwd', { cwd: run.cwd })}</span> : null}
        {status.hint ? <p className="text-danger text-xs">{status.hint}</p> : null}
        {run.outputTruncated ? <p className="text-warning text-xs">{t('sshExec.outputTruncated')}</p> : null}
      </div>
      <SshExecOutput output={run.output} isActive={isActive} label={t('sshExec.output')} />
    </div>
  );
}
