import { useMemo, useState, type ReactNode } from 'react';
import { AlertDialog, Button, Card, Checkbox, Description, Label, ListBox, Meter, SearchField, Select, Spinner, Switch, Tooltip, toast } from '@heroui/react';
import { EmptyState } from '@heroui-pro/react';
import { RiChat3Line, RiDeleteBin6Line, RiEyeLine, RiRefreshLine } from '@remixicon/react';
import type { HistoryCleanupPolicy, HistoryCleanupPolicyResponse, HistoryCleanupResult } from '@todex/protocol/v2';
import { ProviderIcon } from '../ProviderIcon';
import { getLocale, t, useT } from '../../i18n';

const GIB = 1024 ** 3;
const MIB = 1024 ** 2;
const AGE_OPTIONS = [7, 14, 30, 90, 180, 365];
const CAPACITY_OPTIONS = [100 * MIB, 500 * MIB, GIB, 2 * GIB, 5 * GIB, 10 * GIB];
const OFF = 'off';

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

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(getLocale(), { dateStyle: 'medium', timeStyle: 'short' });
}

export function pathName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

/** Saved values from another client may sit between the presets. */
export function withCurrent(options: number[], current: number | null): number[] {
  return current == null || options.includes(current) ? options : [...options, current].sort((a, b) => a - b);
}

/** Toasts for a cleanup: what was removed, and how much was skipped. */
export function reportCleanupResult(result: HistoryCleanupResult, labels: { cleaned: 'cleanup.cleaned' | 'cleanup.sessionsCleaned'; skipped: 'cleanup.skipped' | 'cleanup.sessionsSkipped' }) {
  if (result.deleted.length > 0) {
    toast.success(t(labels.cleaned, { count: result.deleted.length, size: formatStorageBytes(result.freedBytes) }));
  } else if (result.skipped.length === 0) {
    toast.success(t('cleanup.nothingToClean'));
  }
  if (result.skipped.length > 0) {
    toast.warning(t(labels.skipped, { count: result.skipped.length }));
  }
}

export function SelectOption({ id, label }: { id: string; label: string }) {
  return (
    <ListBox.Item id={id} textValue={label}>
      {label}
      <ListBox.ItemIndicator />
    </ListBox.Item>
  );
}

function ConfirmCleanup({ isOpen, onClose, title, body, confirmLabel, isPending, onConfirm }: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  isPending: boolean;
  onConfirm: () => void;
}) {
  const t = useT();
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
              <Button slot="close" variant="tertiary" isDisabled={isPending}>{t('common.cancel')}</Button>
              <Button variant="danger" isPending={isPending} onPress={onConfirm}>{confirmLabel}</Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}

/** Count, disk usage and (with a size limit) how full it is. */
export function StorageSummaryCard({ title, description, count, countLabel, totalBytes, measuredAt, capacity, loading, onRefresh, children }: {
  title: ReactNode;
  description: ReactNode;
  count: number;
  countLabel: string;
  totalBytes: number;
  measuredAt: string;
  capacity?: number | null;
  loading: boolean;
  onRefresh: () => void;
  children?: ReactNode;
}) {
  const t = useT();
  return (
    <Card className="min-w-0 gap-3 p-4">
      <div className="flex items-start gap-3">
        <Card.Header className="min-w-0 flex-1">
          <Card.Title>{title}</Card.Title>
          <Card.Description>{description}</Card.Description>
        </Card.Header>
        <Button isIconOnly size="sm" variant="ghost" aria-label={t('cleanup.refreshAria')} isDisabled={loading} onPress={onRefresh}>
          <RiRefreshLine className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-secondary flex flex-col gap-1 rounded-lg p-3">
          <span className="text-muted text-xs">{countLabel}</span>
          <span className="text-xl font-semibold tabular-nums">{count}</span>
        </div>
        <div className="bg-surface-secondary flex flex-col gap-1 rounded-lg p-3">
          <span className="text-muted text-xs">{t('cleanup.storage')}</span>
          <span className="text-xl font-semibold tabular-nums">{formatStorageBytes(totalBytes)}</span>
        </div>
      </div>
      {capacity ? (
        <Meter
          size="sm"
          color={totalBytes >= capacity * 0.9 ? 'warning' : 'accent'}
          value={Math.min(totalBytes, capacity)}
          maxValue={capacity}
          valueLabel={`${formatStorageBytes(totalBytes)} / ${formatStorageBytes(capacity)}`}
        >
          <Label>{t('cleanup.capacityLabel')}</Label>
          <Meter.Output />
          <Meter.Track>
            <Meter.Fill />
          </Meter.Track>
        </Meter>
      ) : null}
      {children}
      {measuredAt ? <p className="text-muted text-xs">{t('cleanup.measuredAt', { time: formatDateTime(measuredAt) })}</p> : null}
    </Card>
  );
}

/** The daemon's automatic cleanup: enable switch, age and size rules, last
 * and next run, and a confirmed run-now action. */
export function CleanupPolicyCard({ hint, state, onSave, onRun, children }: {
  hint: ReactNode;
  state: HistoryCleanupPolicyResponse | undefined;
  onSave: (policy: HistoryCleanupPolicy) => Promise<void>;
  onRun: () => Promise<void>;
  children?: ReactNode;
}) {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);

  const policy = state?.policy;
  const hasThreshold = policy ? policy.maxAgeDays != null || policy.maxTotalBytes != null : false;
  const lastRun = state?.lastRun;

  const save = async (patch: Partial<HistoryCleanupPolicy>) => {
    if (!policy) return;
    const next = { ...policy, ...patch };
    // A policy without thresholds cannot stay enabled.
    if (next.maxAgeDays == null && next.maxTotalBytes == null) next.enabled = false;
    setSaving(true);
    try {
      await onSave(next);
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : t('cleanup.policySaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const run = async () => {
    setRunning(true);
    try {
      await onRun();
      setConfirming(false);
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : t('cleanup.cleanFailed'));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="min-w-0 gap-3 p-4">
      <div className="flex items-start gap-3">
        <Card.Header className="min-w-0 flex-1">
          <Card.Title>{t('cleanup.autoTitle')}</Card.Title>
          <Card.Description>{hint}</Card.Description>
        </Card.Header>
        <Switch
          aria-label={t('cleanup.autoTitle')}
          isSelected={policy?.enabled ?? false}
          isDisabled={!policy || saving || !hasThreshold}
          onChange={(enabled) => void save({ enabled })}
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          className="w-full"
          isDisabled={!policy || saving}
          selectedKey={policy?.maxAgeDays != null ? String(policy.maxAgeDays) : OFF}
          onSelectionChange={(key) => void save({ maxAgeDays: key === OFF || key == null ? null : Number(key) })}
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
          isDisabled={!policy || saving}
          selectedKey={policy?.maxTotalBytes != null ? String(policy.maxTotalBytes) : OFF}
          onSelectionChange={(key) => void save({ maxTotalBytes: key === OFF || key == null ? null : Number(key) })}
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
          {policy?.enabled && state?.nextRunAt ? <span>{t('cleanup.nextRun', { time: formatDateTime(state.nextRunAt) })}</span> : null}
        </div>
        <Button variant="secondary" size="sm" isDisabled={!hasThreshold || running} onPress={() => setConfirming(true)}>
          {t('cleanup.runNow')}
        </Button>
      </div>
      {children}
      <ConfirmCleanup
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        title={t('cleanup.confirmPolicyTitle')}
        body={t('cleanup.confirmPolicyBody')}
        confirmLabel={t('cleanup.runNow')}
        isPending={running}
        onConfirm={() => void run()}
      />
    </Card>
  );
}

export type HistoryListItem = {
  id: string;
  provider: string;
  title: string;
  subtitle: string;
  subtitleTitle?: string;
  searchText: string;
  updatedAt: string;
  bytes: number;
  /** Cannot be selected (running, or in use by a TodeX conversation). */
  locked: boolean;
  badge?: ReactNode;
  onView?: () => void;
};

type SortKey = 'oldest' | 'newest' | 'largest';

/** Searchable, sortable list with (select-all) selection and a confirmed
 * "clean selected" action. Locked rows cannot be selected. */
export function SelectableHistoryList({ items, loading, emptyLabel, confirmTitle, confirmBody, onClean }: {
  items: HistoryListItem[];
  loading: boolean;
  emptyLabel: string;
  confirmTitle: (count: number) => string;
  confirmBody: (size: string) => string;
  onClean: (ids: string[]) => Promise<void>;
}) {
  const t = useT();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('oldest');
  const [confirming, setConfirming] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle ? items.filter((item) => item.searchText.toLowerCase().includes(needle)) : items;
    const time = (item: HistoryListItem) => Date.parse(item.updatedAt) || 0;
    return [...filtered].sort((a, b) => (
      sort === 'largest' ? b.bytes - a.bytes : sort === 'newest' ? time(b) - time(a) : time(a) - time(b)
    ));
  }, [items, query, sort]);

  // Rows that went away or became locked drop out of the selection.
  const chosen = items.filter((item) => selected.has(item.id) && !item.locked);
  const chosenBytes = chosen.reduce((sum, item) => sum + item.bytes, 0);
  const selectable = visible.filter((item) => !item.locked);
  const selectedVisible = selectable.filter((item) => selected.has(item.id));
  const allSelected = selectable.length > 0 && selectedVisible.length === selectable.length;

  const toggle = (ids: string[], on: boolean) => {
    setSelected((previous) => {
      const next = new Set(previous);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const clean = async () => {
    setCleaning(true);
    try {
      await onClean(chosen.map((item) => item.id));
      setConfirming(false);
      setSelected(new Set());
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : t('cleanup.cleanFailed'));
    } finally {
      setCleaning(false);
    }
  };

  return (
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
          onChange={(on) => toggle(selectable.map((item) => item.id), on)}
        >
          <Checkbox.Content>
            <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
            {t('cleanup.selectAll')}
          </Checkbox.Content>
        </Checkbox>
        <span className="text-muted flex-1 text-xs tabular-nums">
          {chosen.length > 0 ? t('cleanup.selectedSummary', { count: chosen.length, size: formatStorageBytes(chosenBytes) }) : null}
        </span>
        <Button variant="danger" size="sm" isDisabled={chosen.length === 0 || cleaning} onPress={() => setConfirming(true)}>
          <RiDeleteBin6Line className="size-4" />
          {t('cleanup.cleanSelected')}
        </Button>
      </div>
      {loading && items.length === 0 ? (
        <div className="flex justify-center py-8"><Spinner size="sm" aria-label={t('cleanup.refreshAria')} /></div>
      ) : visible.length === 0 ? (
        <EmptyState size="sm">
          <EmptyState.Header>
            <EmptyState.Media variant="icon"><RiChat3Line /></EmptyState.Media>
            <EmptyState.Title>{query ? t('cleanup.noMatches') : emptyLabel}</EmptyState.Title>
          </EmptyState.Header>
        </EmptyState>
      ) : (
        <ul className="flex flex-col">
          {visible.map((item) => (
            <li key={item.id} className={`flex items-center gap-1 rounded-lg pe-1${item.locked ? '' : ' hover:bg-default'}`}>
              <Checkbox
                className="min-w-0 flex-1"
                isSelected={selected.has(item.id) && !item.locked}
                isDisabled={item.locked}
                onChange={(on) => toggle([item.id], on)}
                aria-label={item.title}
              >
                <Checkbox.Content className="flex w-full min-w-0 items-center gap-3 px-2 py-2">
                  <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
                  <ProviderIcon provider={item.provider} className="size-4 shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{item.title}</span>
                    <span className="text-muted truncate text-xs" title={item.subtitleTitle}>{item.subtitle}</span>
                  </span>
                  {item.badge}
                  <span className="text-muted shrink-0 text-xs tabular-nums">{formatStorageBytes(item.bytes)}</span>
                </Checkbox.Content>
              </Checkbox>
              {item.onView ? (
                <Tooltip delay={200}>
                  <Button isIconOnly size="sm" variant="ghost" aria-label={t('cleanup.view')} onPress={item.onView}>
                    <RiEyeLine className="size-4" />
                  </Button>
                  <Tooltip.Content className="text-xs">{t('cleanup.view')}</Tooltip.Content>
                </Tooltip>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <ConfirmCleanup
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        title={confirmTitle(chosen.length)}
        body={confirmBody(formatStorageBytes(chosenBytes))}
        confirmLabel={t('cleanup.cleanSelected')}
        isPending={cleaning}
        onConfirm={() => void clean()}
      />
    </Card>
  );
}
