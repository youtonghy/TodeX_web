import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertDialog, Button, Card, Checkbox, Chip, Description, Label, ListBox, Meter, SearchField, Select, Spinner, Switch, toast } from '@heroui/react';
import { EmptyState } from '@heroui-pro/react';
import { RiChat3Line, RiDeleteBin6Line, RiRefreshLine } from '@remixicon/react';
import type {
  ConversationStorageEntry,
  HistoryCleanupPolicy,
  HistoryCleanupPolicyResponse,
  HistoryCleanupResult,
} from '@todex/protocol/v2';
import { ProviderIcon } from '../components/ProviderIcon';
import { getLocale, useT } from '../i18n';
import { backendApi } from '../session/helpers';
import type { TodeXSession } from '../session/useTodeXSession';

const GIB = 1024 ** 3;
const MIB = 1024 ** 2;
const AGE_OPTIONS = [7, 14, 30, 90, 180, 365];
const CAPACITY_OPTIONS = [100 * MIB, 500 * MIB, GIB, 2 * GIB, 5 * GIB, 10 * GIB];
const OFF = 'off';
const ACTIVE_STATUSES = new Set(['running', 'waiting_permission']);

type SortKey = 'oldest' | 'newest' | 'largest';

export function formatStorageBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 ? Math.round(value) : Math.round(value * 10) / 10} ${units[unit]}`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(getLocale(), { dateStyle: 'medium', timeStyle: 'short' });
}

function workspaceName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

/** Saved values from another client may sit between the presets. */
function withCurrent(options: number[], current: number | null): number[] {
  return current == null || options.includes(current) ? options : [...options, current].sort((a, b) => a - b);
}

function SelectOption({ id, label }: { id: string; label: string }) {
  return (
    <ListBox.Item id={id} textValue={label}>
      {label}
      <ListBox.ItemIndicator />
    </ListBox.Item>
  );
}

function ConfirmCleanup({ isOpen, onClose, title, body, confirmLabel, cancelLabel, isPending, onConfirm }: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  isPending: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog isOpen={isOpen} onOpenChange={(open) => { if (!open && !isPending) onClose(); }}>
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-md">
            <AlertDialog.Header>
              <AlertDialog.Heading>{title}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p className="text-muted text-sm">{body}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary" isDisabled={isPending}>{cancelLabel}</Button>
              <Button variant="danger" isPending={isPending} onPress={onConfirm}>{confirmLabel}</Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}

/** Cleanup: TodeX's own conversation history on the active backend — what
 * it takes on disk, manual (multi-)selection cleanup, and the backend's
 * automatic cleanup policy (by age and/or total size). */
export function CleanupPanel({ session }: { session: TodeXSession }) {
  const t = useT();
  const [entries, setEntries] = useState<ConversationStorageEntry[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [measuredAt, setMeasuredAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [policyState, setPolicyState] = useState<HistoryCleanupPolicyResponse>();
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('oldest');
  const [confirm, setConfirm] = useState<'selected' | 'policy' | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const generation = useRef(0);
  const { getHistoryStorage, purgeConversations, forgetDeletedConversations } = session;
  const api = useCallback(() => backendApi(session.settings), [session.settings.deviceSecret, session.settings.encryptionProtocol, session.settings.encryptionPublicKey, session.settings.transportVerified, session.settings.serverUrl]);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    try {
      const [storage, policy] = await Promise.all([getHistoryStorage(), api().getHistoryCleanupPolicy()]);
      if (current !== generation.current) return;
      setEntries(storage.conversations);
      setTotalBytes(storage.totalBytes);
      setMeasuredAt(storage.measuredAt);
      setPolicyState(policy);
      const ids = new Set(storage.conversations.map((entry) => entry.id));
      setSelected((previous) => new Set([...previous].filter((id) => ids.has(id))));
    } catch (error) {
      if (current === generation.current) toast.danger(error instanceof Error ? error.message : t('cleanup.readFailed'));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [api, getHistoryStorage]);

  useEffect(() => {
    setEntries([]);
    setSelected(new Set());
    void refresh();
    return () => { generation.current += 1; };
  }, [refresh]);

  const isActive = (entry: ConversationStorageEntry) => ACTIVE_STATUSES.has(entry.status);
  const titleOf = (entry: ConversationStorageEntry) => entry.title?.trim() || t('cleanup.untitled');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? entries.filter((entry) => `${entry.title ?? ''} ${entry.workspace}`.toLowerCase().includes(needle))
      : entries;
    const time = (entry: ConversationStorageEntry) => Date.parse(entry.updatedAt) || 0;
    return [...filtered].sort((a, b) => (
      sort === 'largest' ? b.bytes - a.bytes : sort === 'newest' ? time(b) - time(a) : time(a) - time(b)
    ));
  }, [entries, query, sort]);

  const selectable = visible.filter((entry) => !isActive(entry));
  const selectedVisible = selectable.filter((entry) => selected.has(entry.id));
  const allSelected = selectable.length > 0 && selectedVisible.length === selectable.length;
  const selectedEntries = entries.filter((entry) => selected.has(entry.id));
  const selectedBytes = selectedEntries.reduce((sum, entry) => sum + entry.bytes, 0);

  const toggleAll = (on: boolean) => {
    setSelected((previous) => {
      const next = new Set(previous);
      for (const entry of selectable) {
        if (on) next.add(entry.id);
        else next.delete(entry.id);
      }
      return next;
    });
  };

  const toggleOne = (id: string, on: boolean) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const reportResult = (result: HistoryCleanupResult) => {
    if (result.deleted.length > 0) {
      toast.success(t('cleanup.cleaned', { count: result.deleted.length, size: formatStorageBytes(result.freedBytes) }));
    } else if (result.skipped.length === 0) {
      toast.success(t('cleanup.nothingToClean'));
    }
    if (result.skipped.length > 0) {
      toast.warning(t('cleanup.skipped', { count: result.skipped.length }));
    }
  };

  const cleanSelected = async () => {
    setCleaning(true);
    try {
      const result = await purgeConversations(selectedEntries.map((entry) => entry.id));
      reportResult(result);
      setConfirm(null);
      setSelected(new Set());
      await refresh();
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : t('cleanup.cleanFailed'));
    } finally {
      setCleaning(false);
    }
  };

  const runPolicy = async () => {
    setCleaning(true);
    try {
      const result = await api().runHistoryCleanupPolicy();
      forgetDeletedConversations(result.deleted);
      reportResult(result);
      setConfirm(null);
      await refresh();
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : t('cleanup.cleanFailed'));
    } finally {
      setCleaning(false);
    }
  };

  const savePolicy = async (patch: Partial<HistoryCleanupPolicy>) => {
    if (!policyState) return;
    const next = { ...policyState.policy, ...patch };
    // A policy without thresholds cannot stay enabled.
    if (next.maxAgeDays == null && next.maxTotalBytes == null) next.enabled = false;
    setSavingPolicy(true);
    try {
      setPolicyState(await api().updateHistoryCleanupPolicy(next));
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : t('cleanup.policySaveFailed'));
    } finally {
      setSavingPolicy(false);
    }
  };

  const policy = policyState?.policy;
  const hasThreshold = policy ? policy.maxAgeDays != null || policy.maxTotalBytes != null : false;
  const lastRun = policyState?.lastRun;

  return (
    <div className="flex flex-col gap-4 py-1">
      <Card className="min-w-0 gap-3 p-4">
        <div className="flex items-start gap-3">
          <Card.Header className="min-w-0 flex-1">
            <Card.Title>{t('cleanup.todexTitle')}</Card.Title>
            <Card.Description>{t('cleanup.todexHint')}</Card.Description>
          </Card.Header>
          <Button isIconOnly size="sm" variant="ghost" aria-label={t('cleanup.refreshAria')} isDisabled={loading} onPress={() => void refresh()}>
            <RiRefreshLine className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-secondary flex flex-col gap-1 rounded-lg p-3">
            <span className="text-muted text-xs">{t('cleanup.count')}</span>
            <span className="text-xl font-semibold tabular-nums">{entries.length}</span>
          </div>
          <div className="bg-surface-secondary flex flex-col gap-1 rounded-lg p-3">
            <span className="text-muted text-xs">{t('cleanup.storage')}</span>
            <span className="text-xl font-semibold tabular-nums">{formatStorageBytes(totalBytes)}</span>
          </div>
        </div>
        {policy?.maxTotalBytes ? (
          <Meter
            size="sm"
            color={totalBytes >= policy.maxTotalBytes * 0.9 ? 'warning' : 'accent'}
            value={Math.min(totalBytes, policy.maxTotalBytes)}
            maxValue={policy.maxTotalBytes}
            valueLabel={`${formatStorageBytes(totalBytes)} / ${formatStorageBytes(policy.maxTotalBytes)}`}
          >
            <Label>{t('cleanup.capacityLabel')}</Label>
            <Meter.Output />
            <Meter.Track>
              <Meter.Fill />
            </Meter.Track>
          </Meter>
        ) : null}
        {measuredAt ? <p className="text-muted text-xs">{t('cleanup.measuredAt', { time: formatDateTime(measuredAt) })}</p> : null}
      </Card>

      <Card className="min-w-0 gap-3 p-4">
        <div className="flex items-start gap-3">
          <Card.Header className="min-w-0 flex-1">
            <Card.Title>{t('cleanup.autoTitle')}</Card.Title>
            <Card.Description>{t('cleanup.autoHint')}</Card.Description>
          </Card.Header>
          <Switch
            aria-label={t('cleanup.autoTitle')}
            isSelected={policy?.enabled ?? false}
            isDisabled={!policy || savingPolicy || !hasThreshold}
            onChange={(enabled) => void savePolicy({ enabled })}
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            className="w-full"
            isDisabled={!policy || savingPolicy}
            selectedKey={policy?.maxAgeDays != null ? String(policy.maxAgeDays) : OFF}
            onSelectionChange={(key) => void savePolicy({ maxAgeDays: key === OFF || key == null ? null : Number(key) })}
          >
            <Label>{t('cleanup.ageRule')}</Label>
            <Select.Trigger className="w-full"><Select.Value /><Select.Indicator /></Select.Trigger>
            <Description>{t('cleanup.ageHint')}</Description>
            <Select.Popover>
              <ListBox>
                <SelectOption id={OFF} label={t('cleanup.off')} />
                {withCurrent(AGE_OPTIONS, policy?.maxAgeDays ?? null).map((days) => (
                  <SelectOption key={days} id={String(days)} label={t('cleanup.days', { count: days })} />
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <Select
            className="w-full"
            isDisabled={!policy || savingPolicy}
            selectedKey={policy?.maxTotalBytes != null ? String(policy.maxTotalBytes) : OFF}
            onSelectionChange={(key) => void savePolicy({ maxTotalBytes: key === OFF || key == null ? null : Number(key) })}
          >
            <Label>{t('cleanup.capacityRule')}</Label>
            <Select.Trigger className="w-full"><Select.Value /><Select.Indicator /></Select.Trigger>
            <Description>{t('cleanup.capacityHint')}</Description>
            <Select.Popover>
              <ListBox>
                <SelectOption id={OFF} label={t('cleanup.off')} />
                {withCurrent(CAPACITY_OPTIONS, policy?.maxTotalBytes ?? null).map((bytes) => (
                  <SelectOption key={bytes} id={String(bytes)} label={formatStorageBytes(bytes)} />
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="text-muted flex min-w-0 flex-1 flex-col gap-0.5 text-xs">
            <span>
              {lastRun
                ? lastRun.error
                  ? t('cleanup.lastRunFailed', { time: formatDateTime(lastRun.at), error: lastRun.error })
                  : t('cleanup.lastRun', { time: formatDateTime(lastRun.at), count: lastRun.deleted, size: formatStorageBytes(lastRun.freedBytes) })
                : t('cleanup.neverRun')}
            </span>
            {policy?.enabled && policyState?.nextRunAt ? <span>{t('cleanup.nextRun', { time: formatDateTime(policyState.nextRunAt) })}</span> : null}
          </div>
          <Button variant="secondary" size="sm" isDisabled={!hasThreshold || cleaning} onPress={() => setConfirm('policy')}>
            {t('cleanup.runNow')}
          </Button>
        </div>
      </Card>

      <Card className="min-w-0 gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SearchField aria-label={t('cleanup.search')} className="min-w-40 flex-1" value={query} onChange={setQuery}>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input className="w-full" placeholder={t('cleanup.search')} />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <Select
            aria-label={t('cleanup.sort')}
            className="w-40"
            selectedKey={sort}
            onSelectionChange={(key) => setSort(key === 'newest' || key === 'largest' ? key : 'oldest')}
          >
            <Select.Trigger className="w-full"><Select.Value /><Select.Indicator /></Select.Trigger>
            <Select.Popover>
              <ListBox>
                <SelectOption id="oldest" label={t('cleanup.sortOldest')} />
                <SelectOption id="newest" label={t('cleanup.sortNewest')} />
                <SelectOption id="largest" label={t('cleanup.sortLargest')} />
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
        <div className="border-separator flex flex-wrap items-center gap-3 border-b pb-3">
          <Checkbox
            isSelected={allSelected}
            isIndeterminate={selectedVisible.length > 0 && !allSelected}
            isDisabled={selectable.length === 0}
            onChange={toggleAll}
          >
            <Checkbox.Content>
              <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
              {t('cleanup.selectAll')}
            </Checkbox.Content>
          </Checkbox>
          <span className="text-muted flex-1 text-xs tabular-nums">
            {selected.size > 0 ? t('cleanup.selectedSummary', { count: selected.size, size: formatStorageBytes(selectedBytes) }) : null}
          </span>
          <Button variant="danger" size="sm" isDisabled={selected.size === 0 || cleaning} onPress={() => setConfirm('selected')}>
            <RiDeleteBin6Line className="size-4" />
            {t('cleanup.cleanSelected')}
          </Button>
        </div>
        {loading && entries.length === 0 ? (
          <div className="flex justify-center py-8"><Spinner size="sm" aria-label={t('cleanup.refreshAria')} /></div>
        ) : visible.length === 0 ? (
          <EmptyState size="sm">
            <EmptyState.Header>
              <EmptyState.Media variant="icon"><RiChat3Line /></EmptyState.Media>
              <EmptyState.Title>{query ? t('cleanup.noMatches') : t('cleanup.empty')}</EmptyState.Title>
            </EmptyState.Header>
          </EmptyState>
        ) : (
          <ul className="flex flex-col">
            {visible.map((entry) => {
              const active = isActive(entry);
              return (
                <li key={entry.id}>
                  <Checkbox
                    className="w-full"
                    isSelected={selected.has(entry.id)}
                    isDisabled={active}
                    onChange={(on) => toggleOne(entry.id, on)}
                    aria-label={titleOf(entry)}
                  >
                    <Checkbox.Content className={`flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-2${active ? '' : ' hover:bg-default'}`}>
                      <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
                      <ProviderIcon provider={entry.provider} className="size-4 shrink-0" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{titleOf(entry)}</span>
                        <span className="text-muted truncate text-xs" title={entry.workspace}>
                          {workspaceName(entry.workspace)} · {formatDateTime(entry.updatedAt)}
                        </span>
                      </span>
                      {active
                        ? <Chip size="sm" variant="soft" color="warning">{t('cleanup.active')}</Chip>
                        : entry.archivedAt ? <Chip size="sm" variant="soft">{t('cleanup.archived')}</Chip> : null}
                      <span className="text-muted shrink-0 text-xs tabular-nums">{formatStorageBytes(entry.bytes)}</span>
                    </Checkbox.Content>
                  </Checkbox>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ConfirmCleanup
        isOpen={confirm === 'selected'}
        onClose={() => setConfirm(null)}
        title={t('cleanup.confirmSelectedTitle', { count: selectedEntries.length })}
        body={t('cleanup.confirmSelectedBody', { size: formatStorageBytes(selectedBytes) })}
        confirmLabel={t('cleanup.cleanSelected')}
        cancelLabel={t('common.cancel')}
        isPending={cleaning}
        onConfirm={() => void cleanSelected()}
      />
      <ConfirmCleanup
        isOpen={confirm === 'policy'}
        onClose={() => setConfirm(null)}
        title={t('cleanup.confirmPolicyTitle')}
        body={t('cleanup.confirmPolicyBody')}
        confirmLabel={t('cleanup.runNow')}
        cancelLabel={t('common.cancel')}
        isPending={cleaning}
        onConfirm={() => void runPolicy()}
      />
    </div>
  );
}
