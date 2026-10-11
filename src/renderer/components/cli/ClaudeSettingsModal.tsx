import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Description, FieldError, Input, Label, ListBox, Modal, Select, Spinner, Surface, Tabs, TextArea, TextField, toast } from '@heroui/react';
import { RiAddLine, RiDeleteBin6Line, RiEyeLine, RiEyeOffLine } from '@remixicon/react';
import type { CliSettingsDocument, V2ApiClient } from '@todex/protocol/v2';
import { isConflictError } from '@todex/protocol/connectionError';
import { SelectOption } from '../cleanup/CleanupParts';
import { useT, type MessageKey } from '../../i18n';
import {
  CLAUDE_SETTINGS_GROUPS,
  ENV_NAME,
  UNSET,
  applyMergePatch,
  envFromRows,
  envRows,
  fieldId,
  getAt,
  mergePatch,
  setAt,
  type FieldSpec,
  type SettingsObject,
} from '../../lib/claudeSettings';

type TabId = 'form' | 'env' | 'raw';
type EnvRow = { key: number; name: string; value: string; revealed: boolean };

const key = (value: string) => value as MessageKey;

/** Settings for the Claude Code CLI on the backend host (`~/.claude/settings.json`). */
export function ClaudeSettingsModal({ isOpen, onOpenChange, api }: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  api: () => V2ApiClient;
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} isDismissable={false}>
      <Modal.Container>
        <Modal.Dialog className="flex h-[min(760px,90vh)] flex-col sm:max-w-2xl">
          {isOpen ? <ClaudeSettingsEditor api={api} onClose={() => onOpenChange(false)} /> : null}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function ClaudeSettingsEditor({ api, onClose }: { api: () => V2ApiClient; onClose: () => void }) {
  const t = useT();
  const [doc, setDoc] = useState<CliSettingsDocument>();
  const [loadError, setLoadError] = useState<string>();
  const [draft, setDraft] = useState<SettingsObject>({});
  const [env, setEnv] = useState<EnvRow[]>([]);
  const [rawText, setRawText] = useState('');
  const [rawRevealed, setRawRevealed] = useState(false);
  const [tab, setTab] = useState<TabId>('form');
  const [saving, setSaving] = useState(false);
  const nextEnvKey = useRef(0);

  const toEnvRows = (settings: SettingsObject) => envRows(settings).map((row) => ({ ...row, key: nextEnvKey.current++, revealed: false }));

  /** Takes in a document; `draft` replaces the form state (default: the saved settings). */
  const adopt = useCallback((next: CliSettingsDocument, draftSettings?: SettingsObject) => {
    setDoc(next);
    const settings = draftSettings ?? next.settings ?? {};
    setDraft(settings);
    setEnv(toEnvRows(settings));
    setRawText(next.text);
    if (!next.settings) setTab('raw');
  }, []);

  const load = useCallback(async () => {
    setLoadError(undefined);
    try {
      adopt(await api().getClaudeSettings());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : t('cliSettings.readFailed'));
    }
  }, [adopt, api]);

  useEffect(() => { void load(); }, [load]);

  const saved = doc?.settings ?? null;
  // The form and the env tab edit one draft; env rows are folded in on save.
  const formNext = useMemo(() => setAt(draft, ['env'], envFromRows(env)), [draft, env]);
  const patch = useMemo(() => (saved ? mergePatch(saved, formNext) : {}), [saved, formNext]);
  const formDirty = Object.keys(patch).length > 0;
  const rawDirty = Boolean(doc) && rawText !== doc?.text;
  const rawError = useMemo(() => rawObjectError(rawText), [rawText]);
  const envInvalid = env.some((row) => row.name.trim() !== '' && !ENV_NAME.test(row.name.trim()));
  const editingRaw = tab === 'raw';
  const canSave = Boolean(doc) && !saving && (editingRaw ? rawDirty && !rawError : formDirty && !envInvalid);

  const save = async () => {
    if (!doc) return;
    setSaving(true);
    try {
      const next = editingRaw
        ? await api().replaceClaudeSettings(doc.revision, rawText)
        : await api().patchClaudeSettings(doc.revision, patch);
      adopt(next);
      toast.success(t('cliSettings.saved'));
    } catch (error) {
      if (!isConflictError(error)) {
        toast.danger(error instanceof Error ? error.message : t('cliSettings.saveFailed'));
        return;
      }
      // Someone else wrote the file: reload it and replay the form edits on
      // top (the raw text is kept as typed), so nothing is lost or silently
      // overwritten; the user reviews and saves again.
      try {
        const latest = await api().getClaudeSettings();
        if (editingRaw) {
          setDoc(latest);
        } else {
          adopt(latest, latest.settings ? applyMergePatch(latest.settings, patch) : undefined);
        }
        toast.warning(t('cliSettings.conflict'));
      } catch (reloadError) {
        toast.danger(reloadError instanceof Error ? reloadError.message : t('cliSettings.readFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <Modal.Header className="flex flex-col items-start gap-1">
      <Modal.Heading>{t('cliSettings.title', { name: 'Claude Code' })}</Modal.Heading>
      {doc ? <p className="text-muted w-full truncate text-xs" dir="ltr" title={doc.path}>{doc.path}</p> : null}
    </Modal.Header>
  );

  if (loadError || !doc) {
    return (
      <>
        {header}
        <Modal.Body className="flex flex-col gap-3">
          {loadError ? (
            <Surface variant="secondary" className="flex flex-col items-start gap-2 rounded-2xl p-4">
              <p className="text-danger text-sm font-medium">{t('cliSettings.readFailed')}</p>
              <p className="text-muted text-sm">{loadError}</p>
              <Button size="sm" variant="secondary" onPress={() => void load()}>{t('cliSettings.retry')}</Button>
            </Surface>
          ) : (
            <div className="flex min-h-48 items-center justify-center"><Spinner aria-label={t('cliSettings.reading')} /></div>
          )}
        </Modal.Body>
        <Modal.Footer><Button variant="tertiary" onPress={onClose}>{t('controls.close')}</Button></Modal.Footer>
      </>
    );
  }

  return (
    <>
      {header}
      <Modal.Body className="flex min-h-0 flex-1 flex-col">
        <Tabs selectedKey={tab} onSelectionChange={(next) => setTab(next === 'env' || next === 'raw' ? next : 'form')} className="flex min-h-0 flex-1 flex-col gap-4">
          <Tabs.ListContainer>
            <Tabs.List aria-label={t('cliSettings.tabsLabel')}>
              <Tabs.Tab id="form" isDisabled={!saved}>{t('cliSettings.tabForm')}<Tabs.Indicator /></Tabs.Tab>
              <Tabs.Tab id="env" isDisabled={!saved} className="gap-1.5">
                {t('cliSettings.tabEnv')}{env.length ? <span className="text-muted text-xs tabular-nums">{env.length}</span> : null}<Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="raw">{t('cliSettings.tabRaw')}<Tabs.Indicator /></Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Tabs.Panel id="form" className="flex flex-col gap-5">
              <p className="text-muted text-sm">{doc.exists ? t('cliSettings.scopeHint') : t('cliSettings.missingHint')}</p>
              {CLAUDE_SETTINGS_GROUPS.map((group) => (
                <section key={group.id} className="flex flex-col gap-2">
                  <h3 className="text-muted px-1 text-xs font-medium">{t(key(`cliSettings.group.${group.id}`))}</h3>
                  <Surface variant="secondary" className="divide-separator flex flex-col divide-y rounded-2xl px-4">
                    {group.fields.map((field) => (
                      <SettingsField
                        key={fieldId(field.path)}
                        field={field}
                        value={getAt(draft, field.path)}
                        onChange={(value) => setDraft((current) => setAt(current, field.path, value))}
                      />
                    ))}
                  </Surface>
                </section>
              ))}
              <p className="text-muted text-sm">{t('cliSettings.moreInRaw')}</p>
            </Tabs.Panel>
            <Tabs.Panel id="env" className="flex flex-col gap-3">
              <p className="text-muted text-sm">{t('cliSettings.envHint')}</p>
              <EnvEditor rows={env} onChange={setEnv} nextKey={() => nextEnvKey.current++} />
            </Tabs.Panel>
            <Tabs.Panel id="raw" className="flex flex-col gap-3">
              {doc.parseError ? (
                <Surface variant="secondary" className="flex flex-col gap-1 rounded-2xl p-4">
                  <p className="text-warning text-sm font-medium">{t('cliSettings.parseError')}</p>
                  <p className="text-muted font-mono text-xs">{doc.parseError}</p>
                </Surface>
              ) : null}
              {rawRevealed || !doc.exists ? (
                <TextField className="w-full" value={rawText} onChange={setRawText} isInvalid={Boolean(rawError)} aria-label="settings.json">
                  <TextArea className="w-full font-mono text-xs" rows={22} spellCheck="false" />
                  {rawError ? <FieldError>{rawError}</FieldError> : <Description>{t('cliSettings.rawHint')}</Description>}
                </TextField>
              ) : (
                <Surface variant="secondary" className="flex items-center gap-3 rounded-2xl p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{t('cliSettings.rawHiddenTitle')}</p>
                    <p className="text-muted text-sm">{t('cliSettings.rawHiddenHint')}</p>
                  </div>
                  <Button size="sm" variant="secondary" onPress={() => setRawRevealed(true)}>
                    <RiEyeLine className="size-4" />{t('cliSettings.reveal')}
                  </Button>
                </Surface>
              )}
            </Tabs.Panel>
          </div>
        </Tabs>
      </Modal.Body>
      <Modal.Footer className="flex-wrap">
        {(editingRaw ? formDirty : rawDirty) ? (
          <span className="text-muted me-auto text-sm">{t(editingRaw ? 'cliSettings.formUnsaved' : 'cliSettings.rawUnsaved')}</span>
        ) : null}
        <Button variant="tertiary" isDisabled={saving} onPress={onClose}>{t('controls.close')}</Button>
        <Button isDisabled={!canSave} onPress={() => void save()}>{saving ? <Spinner size="sm" /> : null}{t('common.save')}</Button>
      </Modal.Footer>
    </>
  );
}

function rawObjectError(text: string): string | null {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? null : 'settings.json must contain a JSON object';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** Label + description on the left, the control on the right. */
function FieldRow({ label, description, children }: { label: string; description: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm">{label}</p>
        <p className="text-muted text-xs">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

function CompactSelect({ label, selectedKey, onChange, options }: {
  label: string; selectedKey: string; onChange: (key: string) => void; options: { id: string; label: string }[];
}) {
  return (
    <Select aria-label={label} className="w-44" selectedKey={selectedKey} onSelectionChange={(next) => { if (next != null) onChange(String(next)); }}>
      <Select.Trigger className="w-full"><Select.Value /><Select.Indicator /></Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((option) => <SelectOption key={option.id} id={option.id} label={option.label} />)}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function SettingsField({ field, value, onChange }: { field: FieldSpec; value: unknown; onChange: (value: unknown) => void }) {
  const t = useT();
  const id = fieldId(field.path);
  const label = t(key(`cliSettings.field.${id}`));
  const description = (
    <>
      {t(key(`cliSettings.hint.${id}`))}
      <span className="ms-1.5 font-mono opacity-70" dir="ltr">{id}</span>
    </>
  );
  const unset = { id: UNSET, label: t('cliSettings.unset') };

  switch (field.kind) {
    case 'lines':
      return <LinesField label={label} description={description} placeholder={field.placeholder} value={value} onChange={onChange} />;
    case 'integer':
      return <IntegerField label={label} description={description} placeholder={unset.label} min={field.min} max={field.max} value={value} onChange={onChange} />;
    case 'attribution':
      return <AttributionField label={label} description={description} value={value} onChange={onChange} />;
    case 'bool':
      return (
        <FieldRow label={label} description={description}>
          <CompactSelect
            label={label}
            selectedKey={value === true ? 'true' : value === false ? 'false' : UNSET}
            onChange={(next) => onChange(next === 'true' ? true : next === 'false' ? false : undefined)}
            options={[unset, { id: 'true', label: t('cliSettings.on') }, { id: 'false', label: t('cliSettings.off') }]}
          />
        </FieldRow>
      );
    case 'enum': {
      // A value Claude Code accepts but the list lacks (a custom theme, a
      // strftime pattern) stays selectable so it is shown and kept as is.
      const options = typeof value === 'string' && value && !field.options.includes(value) ? [...field.options, value] : field.options;
      return (
        <FieldRow label={label} description={description}>
          <CompactSelect
            label={label}
            selectedKey={typeof value === 'string' ? value : UNSET}
            onChange={(next) => onChange(next === UNSET ? undefined : next)}
            options={[unset, ...options.map((option) => ({ id: option, label: field.options.includes(option) ? t(key(`cliSettings.option.${id}.${option}`)) : option }))]}
          />
        </FieldRow>
      );
    }
    case 'disable':
      return (
        <FieldRow label={label} description={description}>
          <CompactSelect
            label={label}
            selectedKey={value === 'disable' ? 'disable' : UNSET}
            onChange={(next) => onChange(next === 'disable' ? 'disable' : undefined)}
            options={[{ id: UNSET, label: t('cliSettings.allowed') }, { id: 'disable', label: t('cliSettings.disabled') }]}
          />
        </FieldRow>
      );
    case 'text':
      return (
        <FieldRow label={label} description={description}>
          <TextField aria-label={label} className="w-44" value={typeof value === 'string' ? value : ''} onChange={(next) => onChange(next.trim() ? next : undefined)}>
            <Input className="w-full" dir="ltr" placeholder={field.placeholder} />
          </TextField>
        </FieldRow>
      );
  }
}

function IntegerField({ label, description, placeholder, min, max, value, onChange }: {
  label: string; description: ReactNode; placeholder: string; min: number; max: number; value: unknown; onChange: (value: unknown) => void;
}) {
  const t = useT();
  const [text, setText] = useState(typeof value === 'number' ? String(value) : '');
  const parsed = Number(text);
  const invalid = text.trim() !== '' && !(Number.isInteger(parsed) && parsed >= min && parsed <= max);
  useEffect(() => {
    // Follow outside changes (a reload) without fighting the user's typing.
    if (value !== (text.trim() === '' ? undefined : parsed)) setText(typeof value === 'number' ? String(value) : '');
  }, [value]);
  return (
    <FieldRow label={label} description={description}>
      <TextField
        aria-label={label}
        className="w-44"
        value={text}
        isInvalid={invalid}
        onChange={(next) => {
          setText(next);
          const number = Number(next);
          if (next.trim() === '') onChange(undefined);
          else if (Number.isInteger(number) && number >= min && number <= max) onChange(number);
        }}
      >
        <Input className="w-full" dir="ltr" inputMode="numeric" placeholder={placeholder} />
        <FieldError>{t('cliSettings.integerRange', { min, max })}</FieldError>
      </TextField>
    </FieldRow>
  );
}

type AttributionMode = 'default' | 'hidden' | 'custom';

function AttributionField({ label, description, value, onChange }: {
  label: string; description: ReactNode; value: unknown; onChange: (value: unknown) => void;
}) {
  const t = useT();
  // An empty string is both "hidden" and a custom text being typed, so the
  // mode is kept here rather than derived from the value alone.
  const [mode, setMode] = useState<AttributionMode>(typeof value !== 'string' ? 'default' : value === '' ? 'hidden' : 'custom');
  useEffect(() => {
    if (typeof value !== 'string') setMode('default');
    else if (value !== '') setMode('custom');
    else setMode((current) => (current === 'default' ? 'hidden' : current));
  }, [value]);
  const text = typeof value === 'string' ? value : '';
  const choose = (next: AttributionMode) => {
    setMode(next);
    onChange(next === 'default' ? undefined : next === 'hidden' ? '' : text);
  };
  return (
    <div className="flex flex-col pb-2.5">
      <FieldRow label={label} description={description}>
        <CompactSelect
          label={label}
          selectedKey={mode}
          onChange={(next) => choose(next === 'hidden' || next === 'custom' ? next : 'default')}
          options={[
            { id: 'default', label: t('cliSettings.attributionDefault') },
            { id: 'hidden', label: t('cliSettings.attributionHidden') },
            { id: 'custom', label: t('cliSettings.attributionCustom') },
          ]}
        />
      </FieldRow>
      {mode === 'custom' ? (
        <TextField aria-label={label} className="w-full" value={text} onChange={onChange}>
          <TextArea className="w-full font-mono text-xs" rows={3} spellCheck="false" />
        </TextField>
      ) : null}
    </div>
  );
}

function LinesField({ label, description, placeholder, value, onChange }: {
  label: string; description: ReactNode; placeholder?: string; value: unknown; onChange: (value: unknown) => void;
}) {
  const toText = (current: unknown) => (Array.isArray(current) ? current.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join('\n') : '');
  const [text, setText] = useState(() => toText(value));
  const lines = (source: string) => source.split('\n').map((line) => line.trim()).filter(Boolean);
  useEffect(() => {
    if (JSON.stringify(lines(text)) !== JSON.stringify(Array.isArray(value) ? value : [])) setText(toText(value));
  }, [value]);
  return (
    <div className="flex flex-col gap-2 py-2.5">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        <p className="text-muted text-xs">{description}</p>
      </div>
      <TextField
        aria-label={label}
        className="w-full"
        value={text}
        onChange={(next) => {
          setText(next);
          const items = lines(next);
          onChange(items.length > 0 ? items : undefined);
        }}
      >
        <TextArea className="w-full font-mono text-xs" rows={3} spellCheck="false" placeholder={placeholder} />
      </TextField>
    </div>
  );
}

function EnvEditor({ rows, onChange, nextKey }: { rows: EnvRow[]; onChange: (rows: EnvRow[]) => void; nextKey: () => number }) {
  const t = useT();
  const update = (rowKey: number, changes: Partial<EnvRow>) => onChange(rows.map((row) => (row.key === rowKey ? { ...row, ...changes } : row)));
  return (
    <Surface variant="secondary" className="divide-separator flex flex-col divide-y rounded-2xl px-4">
      {rows.map((row) => {
        const invalid = row.name.trim() !== '' && !ENV_NAME.test(row.name.trim());
        return (
          <div key={row.key} className="flex items-start gap-2 py-2.5">
            <TextField aria-label={t('cliSettings.envName')} className="w-56 shrink-0" value={row.name} isInvalid={invalid} onChange={(name) => update(row.key, { name })}>
              <Input className="w-full font-mono" dir="ltr" placeholder="NAME" />
              <FieldError>{t('cliSettings.envNameInvalid')}</FieldError>
            </TextField>
            <TextField aria-label={t('cliSettings.envValue', { name: row.name })} className="min-w-0 flex-1" value={row.value} onChange={(value) => update(row.key, { value })}>
              <Input className="w-full font-mono" dir="ltr" type={row.revealed ? 'text' : 'password'} autoComplete="off" />
            </TextField>
            <Button isIconOnly size="sm" variant="ghost" aria-label={t(row.revealed ? 'cliSettings.hideValue' : 'cliSettings.showValue')} onPress={() => update(row.key, { revealed: !row.revealed })}>
              {row.revealed ? <RiEyeOffLine className="size-4" /> : <RiEyeLine className="size-4" />}
            </Button>
            <Button isIconOnly size="sm" variant="ghost" aria-label={t('cliSettings.removeEnv', { name: row.name })} onPress={() => onChange(rows.filter((item) => item.key !== row.key))}>
              <RiDeleteBin6Line className="size-4" />
            </Button>
          </div>
        );
      })}
      <div className="py-2.5">
        <Button size="sm" variant="ghost" onPress={() => onChange([...rows, { key: nextKey(), name: '', value: '', revealed: true }])}>
          <RiAddLine className="size-4" />{t('cliSettings.addEnv')}
        </Button>
      </div>
    </Surface>
  );
}
