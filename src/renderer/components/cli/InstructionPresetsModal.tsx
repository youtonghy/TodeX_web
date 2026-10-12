import { useCallback, useEffect, useState } from 'react';
import { Button, Input, Label, Modal, Spinner, TextArea, TextField, toast } from '@heroui/react';
import { EmptyState } from '@heroui-pro/react';
import { RiAddLine, RiDeleteBin6Line, RiFileList3Line } from '@remixicon/react';
import type { InstructionPreset, V2ApiClient } from '@todex/protocol/v2';
import { isConflictError } from '@todex/protocol/connectionError';
import { useT } from '../../i18n';
import { InlineNotice, cliDisplayName, reportPresetSync } from './CliInstructionsTab';

/** Selection key of a preset not created yet. */
const NEW = '__new';

const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

/** The global AGENTS.md preset library that CLIs can follow. */
export function InstructionPresetsModal({ isOpen, onClose, api }: { isOpen: boolean; onClose: () => void; api: () => V2ApiClient }) {
  const t = useT();
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} isDismissable={false}>
      <Modal.Container>
        <Modal.Dialog className="flex h-[min(760px,90vh)] flex-col sm:max-w-2xl">
          <Modal.Header className="flex flex-col items-start gap-1">
            <Modal.Heading>{t('instructionPresets.title')}</Modal.Heading>
            <p className="text-muted text-sm">{t('instructionPresets.description')}</p>
          </Modal.Header>
          {isOpen ? <PresetsEditor api={api} onClose={onClose} /> : null}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function PresetsEditor({ api, onClose }: { api: () => V2ApiClient; onClose: () => void }) {
  const t = useT();
  const [presets, setPresets] = useState<InstructionPreset[]>();
  const [loadError, setLoadError] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const current = presets?.find((item) => item.id === selected);
  const isNew = selected === NEW;
  const dirty = isNew ? name.trim() !== '' || text !== '' : Boolean(current) && (name !== current?.name || text !== current?.text);

  const select = (id: string | undefined, list = presets ?? []) => {
    const preset = list.find((item) => item.id === id);
    setSelected(id);
    setName(preset?.name ?? '');
    setText(preset?.text ?? '');
    setConfirmDelete(false);
  };

  const load = useCallback(async () => {
    setLoadError(undefined);
    try {
      const { presets: list } = await api().listInstructionPresets();
      setPresets(list);
      return list;
    } catch (error) {
      setLoadError(errorText(error, t('instructionPresets.readFailed')));
      return undefined;
    }
  }, [api]);

  useEffect(() => {
    void load().then((list) => { if (list) select(list[0]?.id, list); });
  }, [load]);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } catch (error) {
      if (isConflictError(error)) {
        // Someone else edited the preset: take theirs in, keep the typed text.
        await load();
        toast.warning(t('cliInstructions.conflict'));
      } else {
        toast.danger(errorText(error, t('cliInstructions.saveFailed')));
      }
    } finally {
      setBusy(false);
    }
  };

  const save = () => run(async () => {
    const trimmed = name.trim();
    if (isNew) {
      const created = await api().createInstructionPreset(trimmed, text);
      const list = await load();
      select(created.id, list);
      toast.success(t('cliInstructions.presetCreated', { name: created.name }));
    } else if (current) {
      const { preset, sync } = await api().updateInstructionPreset(current.id, current.revision, trimmed, text);
      const list = await load();
      select(preset.id, list);
      reportPresetSync(t, preset.name, sync);
    }
  });

  const remove = () => run(async () => {
    if (!current) return;
    await api().deleteInstructionPreset(current.id);
    const list = await load();
    select(list?.[0]?.id, list);
    toast.success(t('instructionPresets.deleted', { name: current.name }));
  });

  if (loadError || !presets) {
    return (
      <>
        <Modal.Body className="flex flex-col gap-3">
          {loadError ? (
            <InlineNotice
              status="danger"
              title={t('instructionPresets.readFailed')}
              description={loadError}
              actions={<Button size="sm" variant="secondary" onPress={() => void load()}>{t('cliSettings.retry')}</Button>}
            />
          ) : (
            <div className="flex min-h-48 items-center justify-center"><Spinner aria-label={t('instructionPresets.reading')} /></div>
          )}
        </Modal.Body>
        <Modal.Footer><Button variant="tertiary" onPress={onClose}>{t('controls.close')}</Button></Modal.Footer>
      </>
    );
  }

  const editing = isNew || current;
  return (
    <>
      <Modal.Body className="flex min-h-0 flex-1 gap-4">
        <div className="flex w-52 shrink-0 flex-col gap-2">
          <Button size="sm" variant="secondary" isDisabled={busy} onPress={() => select(NEW)}>
            <RiAddLine className="size-4" />{t('instructionPresets.new')}
          </Button>
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {presets.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => select(item.id)}
                className={`flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 ${item.id === selected ? 'bg-surface-secondary' : 'hover:bg-surface-secondary'}`}
              >
                <span className="w-full truncate text-sm font-medium">{item.name}</span>
                <span className="text-muted w-full truncate text-xs">
                  {item.usedBy.length > 0 ? item.usedBy.map(cliDisplayName).join(', ') : t('instructionPresets.unused')}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto pb-1">
          {editing ? (
            <>
              <TextField className="w-full" value={name} onChange={setName} autoFocus={isNew}>
                <Label>{t('cliInstructions.presetName')}</Label>
                <Input className="w-full" />
              </TextField>
              {current ? (
                <p className="text-muted text-sm">
                  {current.usedBy.length > 0
                    ? t('instructionPresets.usedBy', { names: current.usedBy.map(cliDisplayName).join(', ') })
                    : t('instructionPresets.notUsed')}
                </p>
              ) : null}
              <TextField className="w-full" aria-label={t('instructionPresets.content')} value={text} onChange={setText}>
                <TextArea className="w-full font-mono text-xs" rows={18} spellCheck="false" />
              </TextField>
              {confirmDelete && current ? (
                <InlineNotice
                  status="warning"
                  title={t('instructionPresets.confirmDelete', { name: current.name })}
                  description={t('instructionPresets.confirmDeleteHint')}
                  actions={(
                    <>
                      <Button size="sm" variant="danger" isDisabled={busy} onPress={() => void remove()}>{t('common.delete')}</Button>
                      <Button size="sm" variant="secondary" onPress={() => setConfirmDelete(false)}>{t('common.cancel')}</Button>
                    </>
                  )}
                />
              ) : null}
            </>
          ) : (
            <EmptyState size="sm">
              <EmptyState.Header>
                <EmptyState.Media variant="icon"><RiFileList3Line /></EmptyState.Media>
                <EmptyState.Title>{t('instructionPresets.emptyTitle')}</EmptyState.Title>
                <EmptyState.Description>{t('instructionPresets.emptyHint')}</EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer className="flex-wrap">
        {current && !confirmDelete ? (
          <Button variant="ghost" className="me-auto" isDisabled={busy} onPress={() => setConfirmDelete(true)}>
            <RiDeleteBin6Line className="size-4" />{t('common.delete')}
          </Button>
        ) : null}
        <Button variant="tertiary" isDisabled={busy} onPress={onClose}>{t('controls.close')}</Button>
        <Button isDisabled={!editing || busy || !dirty || name.trim() === ''} onPress={() => void save()}>
          {busy ? <Spinner size="sm" /> : null}{isNew ? t('instructionPresets.create') : t('common.save')}
        </Button>
      </Modal.Footer>
    </>
  );
}
