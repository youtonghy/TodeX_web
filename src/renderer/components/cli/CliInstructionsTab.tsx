import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Button, Input, ListBox, Select, Spinner, TextArea, TextField, toast } from '@heroui/react';
import { RiAddLine } from '@remixicon/react';
import type { CliInstructionsDocument, CliSettingsProvider, InstructionPreset, InstructionPresetSync, V2ApiClient } from '@todex/protocol/v2';
import { isConflictError } from '@todex/protocol/connectionError';
import { SelectOption } from '../cleanup/CleanupParts';
import { useT } from '../../i18n';
import { CLI_SETTINGS } from '../../lib/cliSettings';

/** Select key for "the file keeps its own text". */
const OWN = '__own';

type Translate = ReturnType<typeof useT>;

const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

export const cliDisplayName = (provider: string) => CLI_SETTINGS[provider as CliSettingsProvider]?.name ?? provider;

/** Toasts what a preset edit did to the files that follow it. */
export function reportPresetSync(t: Translate, name: string, sync: InstructionPresetSync[]) {
  const names = (status: InstructionPresetSync['status']) => sync.filter((item) => item.status === status).map((item) => cliDisplayName(item.provider)).join(', ');
  toast.success(t('cliInstructions.presetSaved', { name }));
  const drifted = names('drifted');
  if (drifted) toast.warning(t('cliInstructions.syncDrifted', { names: drifted }));
  for (const item of sync.filter((entry) => entry.status === 'failed')) {
    toast.danger(t('cliInstructions.syncFailed', { name: cliDisplayName(item.provider), message: item.message ?? '' }));
  }
}

/** An inline status notice with optional actions under its text. */
export function InlineNotice({ status, title, description, actions }: {
  status: 'warning' | 'danger';
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Alert status={status}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
        {description ? <Alert.Description>{description}</Alert.Description> : null}
        {actions ? <div className="mt-2 flex flex-wrap gap-2">{actions}</div> : null}
      </Alert.Content>
    </Alert>
  );
}

/**
 * A CLI's global instruction file and the preset it may follow. Its own text
 * is edited in place; a followed preset is edited for every CLI following it.
 */
export function useCliInstructions(provider: CliSettingsProvider, api: () => V2ApiClient) {
  const t = useT();
  const [doc, setDoc] = useState<CliInstructionsDocument>();
  const [presets, setPresets] = useState<InstructionPreset[]>([]);
  const [loadError, setLoadError] = useState<string>();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  /** A preset waiting for the user to confirm it may overwrite the file. */
  const [pendingPreset, setPendingPreset] = useState<string>();

  const preset = doc?.presetId ? presets.find((item) => item.id === doc.presetId) : undefined;
  // A drifted file shows its current text; preset edits leave it alone.
  const editingPreset = Boolean(preset) && !doc?.drifted;
  const base = editingPreset && preset ? preset.text : doc?.text ?? '';
  const dirty = Boolean(doc) && draft !== base;

  /** Takes in the file and presets; `keepDraft` keeps unsaved edits (after a conflict). */
  const adopt = useCallback((next: CliInstructionsDocument, nextPresets: InstructionPreset[], keepDraft = false) => {
    setDoc(next);
    setPresets(nextPresets);
    setPendingPreset(undefined);
    if (keepDraft) return;
    const followed = next.presetId && !next.drifted ? nextPresets.find((item) => item.id === next.presetId) : undefined;
    setDraft(followed ? followed.text : next.text);
  }, []);

  const reload = useCallback(async (keepDraft = false) => {
    const [next, list] = await Promise.all([api().getCliInstructions(provider), api().listInstructionPresets()]);
    adopt(next, list.presets, keepDraft);
  }, [adopt, api, provider]);

  const load = useCallback(async () => {
    setLoadError(undefined);
    try {
      await reload();
    } catch (error) {
      setLoadError(errorText(error, t('cliInstructions.readFailed')));
    }
  }, [reload]);

  useEffect(() => { void load(); }, [load]);

  /** Runs a write and tells whether it succeeded; a conflict reloads with the draft kept so nothing typed is lost. */
  const run = async (work: () => Promise<void>, failure: string) => {
    setBusy(true);
    try {
      await work();
      return true;
    } catch (error) {
      if (!isConflictError(error)) {
        toast.danger(errorText(error, failure));
        return false;
      }
      try {
        await reload(true);
        toast.warning(t('cliInstructions.conflict'));
      } catch (reloadError) {
        toast.danger(errorText(reloadError, t('cliInstructions.readFailed')));
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = () => run(async () => {
    if (!doc) return;
    if (editingPreset && preset) {
      const { sync } = await api().updateInstructionPreset(preset.id, preset.revision, preset.name, draft);
      await reload();
      reportPresetSync(t, preset.name, sync);
    } else {
      const next = await api().writeCliInstructions(provider, doc.revision, draft);
      adopt(next, presets);
      toast.success(t('cliInstructions.saved', { file: fileName(next.path) }));
    }
  }, t('cliInstructions.saveFailed'));

  const applySource = (presetId: string | null) => run(async () => {
    if (!doc) return;
    const next = await api().setCliInstructionsSource(provider, doc.revision, presetId);
    const list = await api().listInstructionPresets();
    // Unsaved preset edits stay in the editor as the file's own unsaved text.
    adopt(next, list.presets, presetId === null && dirty);
  }, t('cliInstructions.saveFailed'));

  /** Follows a preset, after a confirmation when that would replace text of the file's own or unsaved edits. */
  const chooseSource = (key: string) => {
    if (!doc) return;
    if (key === OWN) {
      if (doc.presetId) void applySource(null);
      return;
    }
    if (key === doc.presetId && !doc.drifted) return;
    const target = presets.find((item) => item.id === key);
    const replacesOwnText = !doc.presetId && doc.text.trim() !== '' && doc.text !== target?.text;
    if (replacesOwnText || dirty || doc.drifted) setPendingPreset(key);
    else void applySource(key);
  };

  const saveAsPreset = (name: string) => run(async () => {
    if (!doc) return;
    const created = await api().createInstructionPreset(name, draft);
    const next = await api().setCliInstructionsSource(provider, doc.revision, created.id);
    const list = await api().listInstructionPresets();
    adopt(next, list.presets);
    toast.success(t('cliInstructions.presetCreated', { name: created.name }));
  }, t('cliInstructions.saveFailed'));

  return {
    doc, presets, preset, loadError, draft, setDraft, busy, dirty, editingPreset, pendingPreset,
    canSave: Boolean(doc) && !busy && dirty && !doc?.drifted,
    load, save, chooseSource, applySource, saveAsPreset,
    cancelPending: () => setPendingPreset(undefined),
  };
}

export type CliInstructionsState = ReturnType<typeof useCliInstructions>;

const fileName = (path: string) => path.split(/[\\/]/).pop() || path;

export function CliInstructionsPanel({ state }: { state: CliInstructionsState }) {
  const t = useT();
  const { doc, presets, preset, loadError, draft, setDraft, busy, editingPreset, pendingPreset } = state;
  const [newName, setNewName] = useState<string | null>(null);

  if (loadError) {
    return (
      <InlineNotice
        status="danger"
        title={t('cliInstructions.readFailed')}
        description={loadError}
        actions={<Button size="sm" variant="secondary" onPress={() => void state.load()}>{t('cliSettings.retry')}</Button>}
      />
    );
  }
  if (!doc) {
    return <div className="flex min-h-48 items-center justify-center"><Spinner aria-label={t('cliInstructions.reading')} /></div>;
  }

  const file = fileName(doc.path);
  const pending = pendingPreset ? presets.find((item) => item.id === pendingPreset) : undefined;
  const others = preset ? preset.usedBy.map(cliDisplayName).join(', ') : '';
  const trimmedName = newName?.trim() ?? '';

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted truncate text-xs" dir="ltr" title={doc.path}>{doc.path}</p>
      {doc.overridePath ? (
        <InlineNotice status="warning" title={t('cliInstructions.overrideTitle')} description={t('cliInstructions.overrideHint', { path: doc.overridePath, file })} />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">{t('cliInstructions.source')}</span>
        <Select
          aria-label={t('cliInstructions.source')}
          className="w-56"
          isDisabled={busy}
          selectedKey={pendingPreset ?? doc.presetId ?? OWN}
          onSelectionChange={(key) => { if (key != null) state.chooseSource(String(key)); }}
        >
          <Select.Trigger className="w-full"><Select.Value /><Select.Indicator /></Select.Trigger>
          <Select.Popover>
            <ListBox>
              <SelectOption id={OWN} label={t('cliInstructions.sourceOwn')} />
              {presets.map((item) => <SelectOption key={item.id} id={item.id} label={item.name} />)}
            </ListBox>
          </Select.Popover>
        </Select>
        {!doc.presetId && newName === null ? (
          <Button size="sm" variant="ghost" isDisabled={busy} onPress={() => setNewName('')}>
            <RiAddLine className="size-4" />{t('cliInstructions.saveAsPreset')}
          </Button>
        ) : null}
      </div>
      {newName !== null ? (
        <div className="flex flex-wrap items-start gap-2">
          <TextField aria-label={t('cliInstructions.presetName')} className="w-56" value={newName} onChange={setNewName} autoFocus>
            <Input className="w-full" placeholder={t('cliInstructions.presetName')} />
          </TextField>
          <Button
            size="sm"
            isDisabled={busy || trimmedName === ''}
            onPress={() => { void state.saveAsPreset(trimmedName).then((created) => { if (created) setNewName(null); }); }}
          >
            {t('cliInstructions.createAndFollow')}
          </Button>
          <Button size="sm" variant="secondary" onPress={() => setNewName(null)}>{t('common.cancel')}</Button>
        </div>
      ) : null}
      {pending ? (
        <InlineNotice
          status="warning"
          title={t('cliInstructions.confirmTitle', { name: pending.name, file })}
          description={t('cliInstructions.confirmHint')}
          actions={(
            <>
              <Button size="sm" variant="danger" isDisabled={busy} onPress={() => void state.applySource(pending.id)}>{t('cliInstructions.confirmReplace')}</Button>
              <Button size="sm" variant="secondary" onPress={state.cancelPending}>{t('common.cancel')}</Button>
            </>
          )}
        />
      ) : null}
      {doc.drifted && preset ? (
        <InlineNotice
          status="warning"
          title={t('cliInstructions.driftedTitle', { name: preset.name })}
          description={t('cliInstructions.driftedHint', { file })}
          actions={(
            <>
              <Button size="sm" variant="secondary" isDisabled={busy} onPress={() => void state.applySource(preset.id)}>{t('cliInstructions.overwrite')}</Button>
              <Button size="sm" variant="secondary" isDisabled={busy} onPress={() => void state.applySource(null)}>{t('cliInstructions.keepOwn')}</Button>
            </>
          )}
        />
      ) : null}
      <p className="text-muted text-sm">
        {editingPreset && preset
          ? t('cliInstructions.editingPreset', { name: preset.name, names: others })
          : doc.exists ? t('cliInstructions.ownHint', { file }) : t('cliInstructions.missingHint', { file })}
      </p>
      <TextField
        className="w-full"
        aria-label={editingPreset && preset ? preset.name : file}
        value={draft}
        onChange={setDraft}
        isReadOnly={doc.drifted}
      >
        <TextArea className="w-full font-mono text-xs" rows={20} spellCheck="false" />
      </TextField>
    </div>
  );
}
