import { useCallback, useEffect, useRef, useState } from 'react';
import { Chip, Description, Label, ListBox, Modal, Select, Spinner, toast } from '@heroui/react';
import type {
  HistoryCleanupPolicyResponse,
  NativeHistoryProvider,
  NativeHistoryProviderInfo,
  NativeHistorySession,
  NativeHistoryTranscript,
} from '@todex/protocol/v2';
import { useT } from '../../i18n';
import { backendApi } from '../../session/helpers';
import type { TodeXSession } from '../../session/useTodeXSession';
import {
  CleanupPolicyCard,
  formatDateTime,
  pathName,
  reportCleanupResult,
  SelectableHistoryList,
  SelectOption,
  StorageSummaryCard,
  withCurrent,
  type HistoryListItem,
} from './CleanupParts';

const NATIVE_DEFAULT = 'default';
const NATIVE_RETENTION_OPTIONS = [1, 3, 7, 14, 30, 90, 180, 365];

/** Read-only view of the last messages of one native session. */
function TranscriptModal({ transcript, loading, onClose }: {
  transcript: NativeHistoryTranscript | null;
  loading: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const roleLabel: Record<string, string> = { user: t('cleanup.roleUser'), assistant: t('cleanup.roleAssistant'), tool: t('cleanup.roleTool'), system: t('cleanup.roleSystem') };
  return (
    <Modal.Backdrop isOpen={loading || transcript !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Container>
        <Modal.Dialog className="max-h-[88vh] sm:max-w-3xl">
          <Modal.CloseTrigger />
          <Modal.Header className="min-w-0">
            <Modal.Heading className="truncate">{transcript?.title || t('cleanup.untitledSession')}</Modal.Heading>
            {transcript?.cwd ? <p className="text-muted truncate text-xs" title={transcript.cwd}>{transcript.cwd}</p> : null}
          </Modal.Header>
          <Modal.Body className="overflow-y-auto">
            {loading && !transcript ? (
              <div className="flex justify-center py-10"><Spinner size="sm" aria-label={t('app.loading')} /></div>
            ) : transcript ? (
              <div className="flex flex-col gap-3 pb-2">
                {transcript.truncated ? (
                  <p className="text-muted text-xs">{t('cleanup.transcriptTruncated', { shown: transcript.messages.length, total: transcript.totalMessages })}</p>
                ) : null}
                {transcript.messages.length === 0 ? <p className="text-muted text-sm">{t('cleanup.transcriptEmpty')}</p> : null}
                {transcript.messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex flex-col gap-1 rounded-2xl px-3 py-2${message.role === 'user' ? ' bg-surface-secondary' : message.role === 'tool' ? ' border-separator border' : ''}`}
                  >
                    <span className="text-muted text-xs font-semibold">
                      {roleLabel[message.role] ?? message.role}{message.at ? ` · ${formatDateTime(message.at)}` : ''}
                    </span>
                    <p className={`break-words whitespace-pre-wrap${message.role === 'tool' ? ' font-mono text-xs' : ' text-sm'}`}>{message.text}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** One agent's own session history: usage, the daemon's automatic cleanup
 * (plus Claude Code's own retention setting), and the session list with a
 * transcript view. Sessions TodeX conversations resume, and running ones,
 * cannot be removed. */
export function NativeHistoryTab({ session, provider }: { session: TodeXSession; provider: NativeHistoryProvider }) {
  const t = useT();
  const [info, setInfo] = useState<NativeHistoryProviderInfo>();
  const [sessions, setSessions] = useState<NativeHistorySession[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [measuredAt, setMeasuredAt] = useState('');
  const [policy, setPolicy] = useState<HistoryCleanupPolicyResponse>();
  const [loading, setLoading] = useState(true);
  const [savingNative, setSavingNative] = useState(false);
  const [transcript, setTranscript] = useState<NativeHistoryTranscript | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const generation = useRef(0);
  const api = useCallback(() => backendApi(session.settings), [session.settings.deviceSecret, session.settings.encryptionProtocol, session.settings.encryptionPublicKey, session.settings.transportVerified, session.settings.serverUrl]);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    try {
      const [providers, list, nextPolicy] = await Promise.all([
        api().listNativeHistoryProviders(),
        api().listNativeHistorySessions(provider),
        api().getNativeHistoryPolicy(provider),
      ]);
      if (current !== generation.current) return;
      setInfo(providers.providers.find((item) => item.provider === provider));
      setSessions(list.sessions);
      setTotalBytes(list.totalBytes);
      setMeasuredAt(list.measuredAt);
      setPolicy(nextPolicy);
    } catch (error) {
      if (current === generation.current) toast.danger(error instanceof Error ? error.message : t('cleanup.readFailed'));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [api, provider]);

  useEffect(() => {
    setSessions([]);
    setInfo(undefined);
    void refresh();
    return () => { generation.current += 1; };
  }, [refresh]);

  const openTranscript = async (id: string) => {
    setTranscriptLoading(true);
    try {
      setTranscript(await api().getNativeHistoryTranscript(provider, id));
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : t('cleanup.transcriptFailed'));
    } finally {
      setTranscriptLoading(false);
    }
  };

  const saveNativeRetention = async (days: number | null) => {
    setSavingNative(true);
    try {
      const next = await api().updateClaudeNativeRetention(days);
      setInfo((current) => current ? { ...current, native: { cleanupPeriodDays: next.cleanupPeriodDays, settingsPath: next.settingsPath } } : current);
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : t('cleanup.policySaveFailed'));
    } finally {
      setSavingNative(false);
    }
  };

  const displayName = session.v2Providers.find((item) => item.id === provider)?.displayName ?? (provider === 'pi' ? 'Pi' : 'Claude Code');
  const items: HistoryListItem[] = sessions.map((entry) => {
    const title = entry.title?.trim() || t('cleanup.untitledSession');
    const where = entry.cwd ? pathName(entry.cwd) : t('cleanup.unknownWorkspace');
    return {
      id: entry.id,
      provider,
      title,
      subtitle: `${where} · ${formatDateTime(entry.updatedAt)}`,
      subtitleTitle: entry.cwd ?? undefined,
      searchText: `${title} ${entry.cwd ?? ''} ${entry.id}`,
      updatedAt: entry.updatedAt,
      bytes: entry.bytes,
      locked: entry.running || entry.referencedBy.length > 0,
      badge: entry.running
        ? <Chip size="sm" variant="soft" color="warning">{t('cleanup.active')}</Chip>
        : entry.referencedBy.length > 0
          ? <Chip size="sm" variant="soft" color="accent">{t('cleanup.inUseByTodex')}</Chip>
          : undefined,
      onView: () => void openTranscript(entry.id),
    };
  });

  const nativeDays = info?.native?.cleanupPeriodDays ?? null;

  if (!loading && info && !info.available) {
    return (
      <StorageSummaryCard
        title={t('cleanup.agentTitle', { agent: displayName })}
        description={t('cleanup.agentMissing', { agent: displayName })}
        count={0}
        countLabel={t('cleanup.sessionCount')}
        totalBytes={0}
        measuredAt=""
        loading={loading}
        onRefresh={() => void refresh()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <StorageSummaryCard
        title={t('cleanup.agentTitle', { agent: displayName })}
        description={t('cleanup.agentHint', { agent: displayName })}
        count={sessions.length}
        countLabel={t('cleanup.sessionCount')}
        totalBytes={totalBytes}
        measuredAt={measuredAt}
        capacity={policy?.policy.maxTotalBytes}
        loading={loading}
        onRefresh={() => void refresh()}
      >
        {info?.root ? <p className="text-muted truncate font-mono text-xs" title={info.root}>{info.root}</p> : null}
      </StorageSummaryCard>
      <CleanupPolicyCard
        hint={t('cleanup.agentAutoHint')}
        state={policy}
        onSave={async (next) => setPolicy(await api().updateNativeHistoryPolicy(provider, next))}
        onRun={async () => {
          reportCleanupResult(await api().runNativeHistoryPolicy(provider), { cleaned: 'cleanup.sessionsCleaned', skipped: 'cleanup.sessionsSkipped' });
          await refresh();
        }}
      >
        {info?.native ? (
          <div className="border-separator flex flex-col gap-1 border-t pt-3">
            <Select
              className="w-full sm:w-1/2"
              isDisabled={savingNative}
              selectedKey={nativeDays != null ? String(nativeDays) : NATIVE_DEFAULT}
              onSelectionChange={(key) => void saveNativeRetention(key === NATIVE_DEFAULT || key == null ? null : Number(key))}
            >
              <Label>{t('cleanup.claudeRetention')}</Label>
              <Select.Trigger className="w-full"><Select.Value /><Select.Indicator /></Select.Trigger>
              <Description>{t('cleanup.claudeRetentionHint')}</Description>
              <Select.Popover>
                <ListBox>
                  <SelectOption id={NATIVE_DEFAULT} label={t('cleanup.claudeRetentionDefault')} />
                  {withCurrent(NATIVE_RETENTION_OPTIONS, nativeDays).map((days) => (
                    <SelectOption key={days} id={String(days)} label={t('cleanup.days', { count: days })} />
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        ) : null}
      </CleanupPolicyCard>
      <SelectableHistoryList
        items={items}
        loading={loading}
        emptyLabel={t('cleanup.noSessions')}
        confirmTitle={(count) => t('cleanup.confirmSessionsTitle', { count })}
        confirmBody={(size) => t('cleanup.confirmSessionsBody', { size })}
        onClean={async (ids) => {
          reportCleanupResult(await api().cleanupNativeHistory(provider, ids), { cleaned: 'cleanup.sessionsCleaned', skipped: 'cleanup.sessionsSkipped' });
          await refresh();
        }}
      />
      <TranscriptModal transcript={transcript} loading={transcriptLoading} onClose={() => { setTranscript(null); setTranscriptLoading(false); }} />
    </div>
  );
}
