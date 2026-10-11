import { useCallback, useEffect, useRef, useState } from 'react';
import { Chip, Tabs, toast } from '@heroui/react';
import type { ConversationStorageEntry, HistoryCleanupPolicyResponse, NativeHistoryProvider } from '@todex/protocol/v2';
import {
  CleanupPolicyCard,
  formatDateTime,
  pathName,
  reportCleanupResult,
  SelectableHistoryList,
  StorageSummaryCard,
  type HistoryListItem,
} from '../components/cleanup/CleanupParts';
import { NativeHistoryTab } from '../components/cleanup/NativeHistoryTab';
import { ProviderIcon } from '../components/ProviderIcon';
import { useT } from '../i18n';
import { backendApi } from '../session/helpers';
import type { TodeXSession } from '../session/useTodeXSession';

const ACTIVE_STATUSES = new Set(['running', 'waiting_permission']);
const NATIVE_TABS: Array<{ id: NativeHistoryProvider; label: string }> = [
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'pi', label: 'Pi' },
];

type TabKey = 'todex' | NativeHistoryProvider;

/** TodeX's own conversations on the active backend: usage, the backend's
 * automatic cleanup policy, and manual (multi-)selection cleanup. */
function TodexHistoryTab({ session }: { session: TodeXSession }) {
  const t = useT();
  const [entries, setEntries] = useState<ConversationStorageEntry[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [measuredAt, setMeasuredAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState<HistoryCleanupPolicyResponse>();
  const generation = useRef(0);
  const { getHistoryStorage, purgeConversations, forgetDeletedConversations } = session;
  const api = useCallback(() => backendApi(session.settings), [session.settings.deviceSecret, session.settings.encryptionProtocol, session.settings.encryptionPublicKey, session.settings.transportVerified, session.settings.serverUrl]);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    try {
      const [storage, nextPolicy] = await Promise.all([getHistoryStorage(), api().getHistoryCleanupPolicy()]);
      if (current !== generation.current) return;
      setEntries(storage.conversations);
      setTotalBytes(storage.totalBytes);
      setMeasuredAt(storage.measuredAt);
      setPolicy(nextPolicy);
    } catch (error) {
      if (current === generation.current) toast.danger(error instanceof Error ? error.message : t('cleanup.readFailed'));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [api, getHistoryStorage]);

  useEffect(() => {
    setEntries([]);
    void refresh();
    return () => { generation.current += 1; };
  }, [refresh]);

  const items: HistoryListItem[] = entries.map((entry) => {
    const title = entry.title?.trim() || t('cleanup.untitled');
    const active = ACTIVE_STATUSES.has(entry.status);
    return {
      id: entry.id,
      provider: entry.provider,
      title,
      subtitle: `${pathName(entry.workspace)} · ${formatDateTime(entry.updatedAt)}`,
      subtitleTitle: entry.workspace,
      searchText: `${entry.title ?? ''} ${entry.workspace}`,
      updatedAt: entry.updatedAt,
      bytes: entry.bytes,
      locked: active,
      badge: active
        ? <Chip size="sm" variant="soft" color="warning">{t('cleanup.active')}</Chip>
        : entry.archivedAt ? <Chip size="sm" variant="soft">{t('cleanup.archived')}</Chip> : undefined,
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <StorageSummaryCard
        title={t('cleanup.todexTitle')}
        description={t('cleanup.todexHint')}
        count={entries.length}
        countLabel={t('cleanup.count')}
        totalBytes={totalBytes}
        measuredAt={measuredAt}
        capacity={policy?.policy.maxTotalBytes}
        loading={loading}
        onRefresh={() => void refresh()}
      />
      <CleanupPolicyCard
        hint={t('cleanup.autoHint')}
        state={policy}
        onSave={async (next) => setPolicy(await api().updateHistoryCleanupPolicy(next))}
        onRun={async () => {
          const result = await api().runHistoryCleanupPolicy();
          forgetDeletedConversations(result.deleted);
          reportCleanupResult(result, { cleaned: 'cleanup.cleaned', skipped: 'cleanup.skipped' });
          await refresh();
        }}
      />
      <SelectableHistoryList
        items={items}
        loading={loading}
        emptyLabel={t('cleanup.empty')}
        confirmTitle={(count) => t('cleanup.confirmSelectedTitle', { count })}
        confirmBody={(size) => t('cleanup.confirmSelectedBody', { size })}
        onClean={async (ids) => {
          reportCleanupResult(await purgeConversations(ids), { cleaned: 'cleanup.cleaned', skipped: 'cleanup.skipped' });
          await refresh();
        }}
      />
    </div>
  );
}

/** Cleanup: TodeX's own conversation history, and the session history the
 * supported agents keep themselves. */
export function CleanupPanel({ session }: { session: TodeXSession }) {
  const t = useT();
  const [tab, setTab] = useState<TabKey>('todex');
  return (
    <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(key === 'claude-code' || key === 'pi' ? key : 'todex')} className="flex flex-col gap-4 py-1">
      <Tabs.ListContainer>
        <Tabs.List aria-label={t('app.cleanup')}>
          <Tabs.Tab id="todex">{t('cleanup.tabTodex')}<Tabs.Indicator /></Tabs.Tab>
          {NATIVE_TABS.map((item) => (
            <Tabs.Tab key={item.id} id={item.id} className="gap-1.5">
              <ProviderIcon provider={item.id} className="size-4" />{item.label}<Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
      <Tabs.Panel id="todex"><TodexHistoryTab session={session} /></Tabs.Panel>
      {NATIVE_TABS.map((item) => (
        <Tabs.Panel key={item.id} id={item.id}><NativeHistoryTab session={session} provider={item.id} /></Tabs.Panel>
      ))}
    </Tabs>
  );
}
