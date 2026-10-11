import { useState, type ReactNode } from 'react';
import { Button, Description, FieldError, Input, Label, ListBox, Modal, Select, Spinner, TextArea, TextField, toast } from '@heroui/react';
import type { CatalogScope } from '@todex/protocol/v2';
import { useT } from '../i18n';

const SKILL_NAME = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$/;
const MCP_TEMPLATE = '{\n  "command": "npx",\n  "args": []\n}';

function skillTemplate(name: string): string {
  return `---\nname: ${name}\ndescription: \n---\n\n`;
}

/** Labels for the skill sources the backend reports, falling back to the raw id. */
export function useSkillSourceLabel() {
  const t = useT();
  return (source: string) => {
    switch (source) {
      case 'shared-user': return t('cap.sourceSharedUser');
      case 'shared-project': return t('cap.sourceSharedProject');
      case 'provider-user': return t('cap.sourceProviderUser');
      case 'provider-project': return t('cap.sourceProviderProject');
      default: return source;
    }
  };
}

function EditorShell({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Container>
        <Modal.Dialog className="max-h-[90vh] sm:max-w-2xl">
          {children}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function EditorFooter({ saving, canSave, onClose, onSave }: { saving: boolean; canSave: boolean; onClose: () => void; onSave: () => void }) {
  const t = useT();
  return (
    <Modal.Footer>
      <Button variant="tertiary" isDisabled={saving} onPress={onClose}>{t('common.cancel')}</Button>
      <Button isDisabled={!canSave} onPress={onSave}>{saving ? <Spinner size="sm" /> : null}{t('common.save')}</Button>
    </Modal.Footer>
  );
}

export type SkillEditorTarget =
  | { mode: 'create'; sources: string[] }
  | { mode: 'edit'; name: string; content: string };

export function SkillEditorModal({
  target,
  onClose,
  onSubmit,
}: {
  target: SkillEditorTarget | null;
  onClose: () => void;
  onSubmit: (input: { source: string; name: string; content: string }) => Promise<void>;
}) {
  return (
    <EditorShell isOpen={Boolean(target)} onClose={onClose}>
      {target ? <SkillEditorForm key={target.mode === 'edit' ? target.name : 'create'} target={target} onClose={onClose} onSubmit={onSubmit} /> : null}
    </EditorShell>
  );
}

function SkillEditorForm({
  target,
  onClose,
  onSubmit,
}: {
  target: SkillEditorTarget;
  onClose: () => void;
  onSubmit: (input: { source: string; name: string; content: string }) => Promise<void>;
}) {
  const t = useT();
  const sourceLabel = useSkillSourceLabel();
  const creating = target.mode === 'create';
  const [source, setSource] = useState(creating ? target.sources[0] ?? '' : '');
  const [name, setName] = useState(creating ? '' : target.name);
  const [content, setContent] = useState(creating ? skillTemplate('') : target.content);
  const [saving, setSaving] = useState(false);
  const nameInvalid = creating && name.length > 0 && !SKILL_NAME.test(name);
  const contentInvalid = !content.trimStart().startsWith('---');
  const canSave = !saving && !contentInvalid && (!creating || (SKILL_NAME.test(name) && Boolean(source)));

  const save = async () => {
    setSaving(true);
    try {
      await onSubmit({ source, name, content });
      toast.success(t(creating ? 'cap.skillCreated' : 'cap.skillSaved', { name }));
      onClose();
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : t('cap.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal.Header>
        <Modal.Heading>{creating ? t('cap.newSkill') : t('cap.editSkill', { name })}</Modal.Heading>
      </Modal.Header>
      <Modal.Body className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
        {creating ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              className="w-full"
              selectedKey={source || null}
              onSelectionChange={(key) => { if (key !== null) setSource(String(key)); }}
            >
              <Label>{t('cap.location')}</Label>
              <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {target.sources.map((item) => (
                    <ListBox.Item key={item} id={item} textValue={sourceLabel(item)}>{sourceLabel(item)}</ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <TextField
              className="w-full"
              value={name}
              onChange={(next) => {
                // Keep the front matter name in step until the user edits the body.
                if (content === skillTemplate(name)) setContent(skillTemplate(next));
                setName(next);
              }}
              isInvalid={nameInvalid}
            >
              <Label>{t('cap.skillName')}</Label>
              <Input className="w-full" placeholder="my-skill" dir="ltr" />
              <FieldError>{t('cap.skillNameHint')}</FieldError>
            </TextField>
          </div>
        ) : null}
        <TextField className="w-full" value={content} onChange={setContent} isInvalid={contentInvalid}>
          <Label>SKILL.md</Label>
          <TextArea className="w-full font-mono text-xs" rows={16} />
          <FieldError>{t('cap.frontMatterHint')}</FieldError>
        </TextField>
      </Modal.Body>
      <EditorFooter saving={saving} canSave={canSave} onClose={onClose} onSave={() => void save()} />
    </>
  );
}

export type McpEditorTarget =
  | { mode: 'create'; scopes: CatalogScope[] }
  | { mode: 'edit'; name: string; path: string; config: unknown };

export function McpEditorModal({
  target,
  onClose,
  onSubmit,
}: {
  target: McpEditorTarget | null;
  onClose: () => void;
  onSubmit: (input: { scope: CatalogScope; name: string; config: Record<string, unknown> }) => Promise<void>;
}) {
  return (
    <EditorShell isOpen={Boolean(target)} onClose={onClose}>
      {target ? <McpEditorForm key={target.mode === 'edit' ? target.name : 'create'} target={target} onClose={onClose} onSubmit={onSubmit} /> : null}
    </EditorShell>
  );
}

function parseConfig(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function McpEditorForm({
  target,
  onClose,
  onSubmit,
}: {
  target: McpEditorTarget;
  onClose: () => void;
  onSubmit: (input: { scope: CatalogScope; name: string; config: Record<string, unknown> }) => Promise<void>;
}) {
  const t = useT();
  const creating = target.mode === 'create';
  const [scope, setScope] = useState<CatalogScope>(creating ? target.scopes[0] ?? 'user' : 'user');
  const [name, setName] = useState(creating ? '' : target.name);
  const [text, setText] = useState(creating ? MCP_TEMPLATE : JSON.stringify(target.config, null, 2));
  const [saving, setSaving] = useState(false);
  const config = parseConfig(text);
  const canSave = !saving && Boolean(config) && name.trim().length > 0;

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await onSubmit({ scope, name: name.trim(), config });
      toast.success(t(creating ? 'cap.mcpCreated' : 'cap.mcpSaved', { name: name.trim() }));
      onClose();
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : t('cap.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal.Header>
        <Modal.Heading>{creating ? t('cap.newMcp') : t('cap.editMcp', { name: target.name })}</Modal.Heading>
        {creating ? null : <p className="text-muted truncate text-sm" dir="ltr" title={target.path}>{target.path}</p>}
      </Modal.Header>
      <Modal.Body className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
        <div className={creating ? 'grid gap-3 sm:grid-cols-2' : 'flex flex-col'}>
          {creating ? (
            <Select
              className="w-full"
              selectedKey={scope}
              onSelectionChange={(key) => setScope(key === 'project' ? 'project' : 'user')}
            >
              <Label>{t('cap.location')}</Label>
              <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {target.scopes.map((item) => (
                    <ListBox.Item key={item} id={item} textValue={t(item === 'project' ? 'cap.scopeProject' : 'cap.scopeUser')}>
                      {t(item === 'project' ? 'cap.scopeProject' : 'cap.scopeUser')}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          ) : null}
          <TextField className="w-full" value={name} onChange={setName}>
            <Label>{t('cap.mcpName')}</Label>
            <Input className="w-full" placeholder="my-server" dir="ltr" />
          </TextField>
        </div>
        <TextField className="w-full" value={text} onChange={setText} isInvalid={!config}>
          <Label>{t('cap.mcpConfigJson')}</Label>
          <TextArea className="w-full font-mono text-xs" rows={14} dir="ltr" />
          {config ? <Description>{t('cap.mcpConfigHint')}</Description> : <FieldError>{t('cap.mcpConfigInvalid')}</FieldError>}
        </TextField>
      </Modal.Body>
      <EditorFooter saving={saving} canSave={canSave} onClose={onClose} onSave={() => void save()} />
    </>
  );
}
