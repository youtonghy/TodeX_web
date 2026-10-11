import { useMemo, useState } from 'react';
import { AlertDialog, Button, Card, ScrollShadow, Spinner, Tabs, toast } from '@heroui/react';
import { RiAddLine, RiArrowDownSLine, RiDeleteBinLine, RiEditLine, RiFlashlightLine, RiGitlabLine, RiRefreshLine } from '@remixicon/react';
import type { CatalogScope, McpCatalog, McpServerCatalogDescriptor, McpServerConfig, ProviderDescriptor, ProviderKind, SkillCatalog, SkillCatalogDescriptor } from '@todex/protocol/v2';
import { providerDisplayName } from '@todex/protocol/v2';
import { ProviderIcon } from '../components/ProviderIcon';
import { useNoticeToast } from '../components/NoticeToast';
import { useT } from '../i18n';
import type { SelectedSkillAttachment } from '../session/helpers';
import { McpEditorModal, SkillEditorModal, type McpEditorTarget, type SkillEditorTarget } from './CapabilityEditor';

export type CatalogState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  skills?: SkillCatalog;
  mcp?: McpCatalog;
  error?: string;
};

/** Writes to the provider's own skill folders and MCP config files. */
export type CapabilityManager = {
  createSkill: (provider: ProviderKind, input: { source: string; name: string; content: string }) => Promise<SkillCatalogDescriptor>;
  updateSkill: (provider: ProviderKind, resourceId: string, content: string) => Promise<SkillCatalogDescriptor>;
  deleteSkill: (provider: ProviderKind, resourceId: string) => Promise<void>;
  createMcpServer: (provider: ProviderKind, input: { scope: CatalogScope; name: string; config: unknown }) => Promise<McpServerConfig>;
  updateMcpServer: (provider: ProviderKind, resourceId: string, input: { name: string; config: unknown }) => Promise<McpServerConfig>;
  deleteMcpServer: (provider: ProviderKind, resourceId: string) => Promise<void>;
};

type Props = {
  workspacePath: string;
  providers: ProviderDescriptor[];
  catalogs: Partial<Record<ProviderKind, CatalogState>>;
  onRefresh: (provider: ProviderKind) => void;
  conversationId?: string;
  selectedSkills?: SelectedSkillAttachment[];
  canInvoke?: boolean;
  onToggleSkill?: (skill: SkillCatalogDescriptor, provider: ProviderKind) => void;
  onPreviewSkill?: (skill: SkillCatalogDescriptor, provider: ProviderKind) => Promise<string>;
  onLoadMcpConfig?: (server: McpServerCatalogDescriptor) => Promise<McpServerConfig>;
  manager?: CapabilityManager;
  /** Hosted in a dialog whose heading already names the panel. */
  inDialog?: boolean;
};

type ViewMode = 'skills' | 'mcp';
type ProviderChoice = ProviderKind | 'common';
type PendingDelete =
  | { kind: 'skill'; provider: ProviderKind; skill: SkillCatalogDescriptor }
  | { kind: 'mcp'; server: McpServerCatalogDescriptor };

function isCommonSource(source: string): boolean {
  return source.toLowerCase().includes('shared') || source.toLowerCase().includes('common');
}

export function CapabilitiesPanel({
  workspacePath,
  providers,
  catalogs,
  onRefresh,
  conversationId,
  selectedSkills = [],
  canInvoke = false,
  onToggleSkill,
  onPreviewSkill,
  onLoadMcpConfig,
  manager,
  inDialog = false,
}: Props) {
  const t = useT();
  const [viewMode, setViewMode] = useState<ViewMode>('skills');
  const [providerChoice, setProviderChoice] = useState<ProviderChoice>('common');
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [mcpConfigs, setMcpConfigs] = useState<Record<string, McpServerConfig>>({});
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [skillEditor, setSkillEditor] = useState<(SkillEditorTarget & { provider: ProviderKind; resourceId?: string }) | null>(null);
  const [mcpEditor, setMcpEditor] = useState<(McpEditorTarget & { provider: ProviderKind; resourceId?: string }) | null>(null);
  // Only agents that can run right now; a tab whose agent went away falls
  // back to the shared view.
  const availableProviders = useMemo(() => providers.filter((item) => item.available), [providers]);
  const provider = providerChoice === 'common' ? undefined : availableProviders.find((item) => item.id === providerChoice);
  const choice: ProviderChoice = provider ? provider.id : 'common';
  const providerKeys = useMemo(() => availableProviders.map((item) => item.id), [availableProviders]);
  const selectedCatalogs = choice === 'common'
    ? providerKeys.map((key) => catalogs[key]).filter(Boolean) as CatalogState[]
    : catalogs[choice] ? [catalogs[choice] as CatalogState] : [];
  const state = selectedCatalogs.find((item) => item.status === 'loading') ?? selectedCatalogs[0];
  const catalogError = [...new Set(selectedCatalogs.map(item => item.error).filter(Boolean))].join('\n');
  useNoticeToast(catalogError, { variant: 'danger', scope: `${workspacePath}:${choice}` });
  const skills = useMemo(() => {
    const items = selectedCatalogs.flatMap((item) => (item.skills?.skills ?? []).map((skill) => ({
      skill,
      provider: (item.skills?.provider ?? choice) as ProviderKind,
      editable: Boolean(manager && item.skills?.editable),
    })));
    // Resource ids are provider-scoped, so the common view folds one shared
    // skill across providers by name and source, like the MCP list below.
    const keyOf = (item: (typeof items)[number]) => choice === 'common'
      ? `${item.skill.name}:${item.skill.source}`
      : `${item.skill.resourceId}:${item.skill.name}`;
    return items.filter((item, index, list) => list.findIndex((candidate) => keyOf(candidate) === keyOf(item)) === index)
      .filter((item) => choice !== 'common' || isCommonSource(item.skill.source));
  }, [choice, manager, selectedCatalogs]);
  const mcpServers = useMemo(() => {
    const items = selectedCatalogs.flatMap((item) => (item.mcp?.servers ?? []).map((server) => ({
      server,
      editable: Boolean(manager && item.mcp?.editable),
    })));
    return items.filter((item, index, list) => {
      if (choice !== 'common') return true;
      if (!isCommonSource(item.server.source)) return false;
      return list.findIndex((candidate) => candidate.server.name === item.server.name && candidate.server.source === item.server.source) === index;
    });
  }, [choice, manager, selectedCatalogs]);
  // New skills go to the selected agent's folders; the shared view creates
  // in the shared folders through any agent that can write them.
  const skillCreateTarget = useMemo(() => {
    if (!manager) return null;
    for (const item of selectedCatalogs) {
      const sources = (item.skills?.creatableSources ?? []).filter((source) => choice !== 'common' || isCommonSource(source));
      if (item.skills && sources.length) return { provider: item.skills.provider, sources };
    }
    return null;
  }, [choice, manager, selectedCatalogs]);
  const mcpCreateTarget = useMemo(() => {
    if (!manager || choice === 'common') return null;
    const scopes = catalogs[choice]?.mcp?.creatableScopes ?? [];
    return scopes.length ? { provider: choice, scopes } : null;
  }, [catalogs, choice, manager]);
  const createTarget = viewMode === 'skills' ? skillCreateTarget : mcpCreateTarget;
  const refresh = () => {
    for (const key of choice === 'common' ? providerKeys : [choice]) onRefresh(key);
  };
  const openCreate = () => {
    if (viewMode === 'skills' && skillCreateTarget) {
      setSkillEditor({ mode: 'create', ...skillCreateTarget });
    } else if (viewMode === 'mcp' && mcpCreateTarget) {
      setMcpEditor({ mode: 'create', ...mcpCreateTarget });
    }
  };

  return (
    <div className={`flex h-full min-h-0 flex-col ${inDialog ? 'py-1' : 'p-5'}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          {inDialog ? null : <h2 className="text-lg font-semibold">{t('cap.title')}</h2>}
          <p className={`text-muted text-xs ${inDialog ? '' : 'mt-1'}`}>{provider ? `${providerDisplayName(provider.id, provider.displayName)} · ${workspacePath}` : t('cap.commonPath', { path: workspacePath })}</p>
          {conversationId && canInvoke ? (
            <p className="text-muted mt-1 text-xs">{t('cap.attachHint')}</p>
          ) : (
            <p className="text-muted mt-1 text-xs">{t('cap.needV2')}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {createTarget ? (
            <Button size="sm" variant="secondary" onPress={openCreate}>
              <RiAddLine className="size-4" />
              {viewMode === 'skills' ? t('cap.newSkill') : t('cap.newMcp')}
            </Button>
          ) : null}
          <Button isIconOnly size="sm" variant="ghost" aria-label={t('workbench.refresh')} onPress={refresh}>
            <RiRefreshLine className="size-4" />
          </Button>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Button size="sm" variant={choice === 'common' ? 'primary' : 'tertiary'} onPress={() => setProviderChoice('common')}>{t('cap.common')}</Button>
        {availableProviders.map((item) => (
          <Button key={item.id} size="sm" variant={choice === item.id ? 'primary' : 'tertiary'} onPress={() => setProviderChoice(item.id)}>
            <ProviderIcon provider={item.id} />
            {providerDisplayName(item.id)}
          </Button>
        ))}
      </div>
      <Tabs
        selectedKey={viewMode}
        onSelectionChange={(key) => setViewMode(key === 'mcp' ? 'mcp' : 'skills')}
        className="w-full"
      >
        <Tabs.ListContainer className="w-full">
          <Tabs.List aria-label={t('cap.tabsLabel')} className="grid w-full grid-cols-2">
            <Tabs.Tab id="skills">
              Skills
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="mcp">
              MCPs
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      {state?.status === 'loading' ? (
        <div className="flex flex-col items-center py-10">
          <Spinner />
          <p className="text-muted mt-2 text-xs">{t('cap.loading')}</p>
        </div>
      ) : null}
      <ScrollShadow className="mt-3 min-h-0 flex-1">
        {viewMode === 'skills' && state?.status !== 'loading' ? (
          skills.length ? skills.map((item) => (
            <SkillRow
              key={`${item.skill.resourceId}:${item.skill.name}`}
              item={item.skill}
              selected={selectedSkills.some((skill) => skill.resourceId === item.skill.resourceId || skill.name === item.skill.name)}
              canSelect={Boolean(canInvoke && onToggleSkill)}
              editable={item.editable}
              preview={previews[item.skill.resourceId] ?? null}
              onEdit={() => setSkillEditor({
                mode: 'edit',
                name: item.skill.name,
                content: previews[item.skill.resourceId] ?? '',
                provider: item.provider,
                resourceId: item.skill.resourceId,
              })}
              onDelete={() => setPendingDelete({ kind: 'skill', provider: item.provider, skill: item.skill })}
              onToggle={() => onToggleSkill?.(item.skill, item.provider)}
              onPreview={async () => {
                if (!onPreviewSkill) return;
                try {
                  const content = await onPreviewSkill(item.skill, item.provider);
                  setPreviews((current) => ({ ...current, [item.skill.resourceId]: content }));
                } catch (error) {
                  toast.danger(error instanceof Error ? error.message : t('cap.previewFailed'));
                }
              }}
            />
          )) : <p className="text-muted py-10 text-center text-sm">{t('cap.noSkills')}</p>
        ) : null}
        {viewMode === 'mcp' && state?.status !== 'loading' ? (
          mcpServers.length ? mcpServers.map(({ server, editable }) => (
            <McpRow
              key={`${server.resourceId}:${server.name}`}
              item={server}
              config={mcpConfigs[server.resourceId] ?? null}
              editable={editable}
              onLoad={async () => {
                if (!onLoadMcpConfig) return;
                try {
                  const config = await onLoadMcpConfig(server);
                  setMcpConfigs((current) => ({ ...current, [server.resourceId]: config }));
                } catch (error) {
                  toast.danger(error instanceof Error ? error.message : t('cap.mcpConfigFailed'));
                }
              }}
              onEdit={(config) => setMcpEditor({
                mode: 'edit',
                name: server.name,
                path: config.path,
                config: config.config,
                provider: server.provider,
                resourceId: server.resourceId,
              })}
              onDelete={() => setPendingDelete({ kind: 'mcp', server })}
            />
          )) : <p className="text-muted py-10 text-center text-sm">{t('cap.noMcps')}</p>
        ) : null}
      </ScrollShadow>
      <AlertDialog isOpen={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open && !deleting) setPendingDelete(null); }}>
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-md">
              <AlertDialog.Header>
                <AlertDialog.Heading>{pendingDelete?.kind === 'skill' ? t('cap.deleteSkillTitle') : t('cap.deleteMcpTitle')}</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p className="text-muted text-sm">
                  {pendingDelete?.kind === 'skill'
                    ? t('cap.deleteSkillBody', { name: pendingDelete.skill.name })
                    : pendingDelete ? t('cap.deleteMcpBody', {
                      name: pendingDelete.server.name,
                      path: mcpConfigs[pendingDelete.server.resourceId]?.path ?? pendingDelete.server.source,
                    }) : null}
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary" isDisabled={deleting}>{t('common.cancel')}</Button>
                <Button
                  variant="danger"
                  isPending={deleting}
                  onPress={async () => {
                    if (!pendingDelete || !manager) return;
                    setDeleting(true);
                    const name = pendingDelete.kind === 'skill' ? pendingDelete.skill.name : pendingDelete.server.name;
                    try {
                      if (pendingDelete.kind === 'skill') {
                        await manager.deleteSkill(pendingDelete.provider, pendingDelete.skill.resourceId);
                      } else {
                        await manager.deleteMcpServer(pendingDelete.server.provider, pendingDelete.server.resourceId);
                      }
                      toast.success(t('cap.deleted', { name }));
                      setPendingDelete(null);
                    } catch (error) {
                      toast.danger(error instanceof Error ? error.message : t('cap.deleteFailed'));
                    } finally {
                      setDeleting(false);
                    }
                  }}
                >
                  {t('common.delete')}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
      <SkillEditorModal
        target={skillEditor}
        onClose={() => setSkillEditor(null)}
        onSubmit={async ({ source, name, content }) => {
          if (!manager || !skillEditor) return;
          if (skillEditor.mode === 'create') {
            await manager.createSkill(skillEditor.provider, { source, name, content });
          } else if (skillEditor.resourceId) {
            const resourceId = skillEditor.resourceId;
            await manager.updateSkill(skillEditor.provider, resourceId, content);
            setPreviews((current) => ({ ...current, [resourceId]: content }));
          }
        }}
      />
      <McpEditorModal
        target={mcpEditor}
        onClose={() => setMcpEditor(null)}
        onSubmit={async ({ scope, name, config }) => {
          if (!manager || !mcpEditor) return;
          const saved = mcpEditor.mode === 'create'
            ? await manager.createMcpServer(mcpEditor.provider, { scope, name, config })
            : mcpEditor.resourceId ? await manager.updateMcpServer(mcpEditor.provider, mcpEditor.resourceId, { name, config }) : null;
          if (saved) setMcpConfigs((current) => ({ ...current, [saved.descriptor.resourceId]: saved }));
        }}
      />
    </div>
  );
}

function SkillRow({
  item,
  selected,
  canSelect,
  editable,
  preview,
  onToggle,
  onPreview,
  onEdit,
  onDelete,
}: {
  item: SkillCatalogDescriptor;
  selected: boolean;
  canSelect: boolean;
  editable: boolean;
  preview: string | null;
  onToggle: () => void;
  onPreview: () => Promise<void>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const status = item.active && item.valid ? t('cap.statusActive') : item.shadowedBy ? t('cap.statusShadowed') : item.valid ? t('cap.statusInactive') : t('cap.statusInvalid');

  const handleToggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !preview && onPreview) {
      setLoading(true);
      try {
        await onPreview();
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      className={`mb-2 p-3.5 transition-all cursor-pointer select-none hover:bg-surface-secondary/40 active:bg-surface-secondary/60 ${
        expanded ? 'bg-surface-secondary/20 ring-1 ring-separator' : ''
      }`}
      onClick={handleToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          void handleToggle();
        }
      }}
    >
      <div className="flex gap-3">
        <div className="bg-accent-soft flex size-9 shrink-0 items-center justify-center rounded-lg">
          <RiFlashlightLine className="text-accent size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-semibold text-sm">{item.name}</p>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs ${selected ? 'text-accent font-medium' : 'text-muted'}`}>
                {selected ? t('cap.attached') : status}
              </span>
              <RiArrowDownSLine
                className={`text-muted size-4 transition-transform duration-200 ${
                  expanded ? 'rotate-180' : ''
                }`}
              />
            </div>
          </div>
          {item.description ? (
            <p className={`text-muted mt-1 text-xs leading-relaxed ${expanded ? 'whitespace-pre-line' : 'line-clamp-2'}`}>
              {item.description}
            </p>
          ) : null}
          <p className="text-muted mt-1.5 text-[11px]">{item.scope} · {item.source}</p>

          {expanded ? (
            <div className="mt-3 border-t border-separator/40 pt-3" onClick={(e) => e.stopPropagation()}>
              {loading ? (
                <div className="flex items-center gap-2 py-3 text-muted text-xs">
                  <Spinner size="sm" />
                  <span>{t('cap.loadingSkill')}</span>
                </div>
              ) : preview ? (
                <div className="rounded-lg bg-surface-secondary/60 border border-separator/50 p-2.5">
                  <p className="text-muted mb-1 text-[11px] font-medium">{t('cap.previewLabel')}</p>
                  <pre className="text-foreground/80 max-h-52 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed select-text">
                    {preview.slice(0, 4000)}
                  </pre>
                </div>
              ) : (
                <p className="text-muted text-xs">{t('cap.noPreview')}</p>
              )}

              {canSelect || editable ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted text-xs">
                    {canSelect ? (selected ? t('cap.attachedToChat') : t('cap.attachable')) : null}
                  </span>
                  <div className="flex items-center gap-2">
                    {editable ? (
                      <>
                        <Button size="sm" variant="secondary" onPress={onDelete}>
                          <RiDeleteBinLine className="size-4" />
                          {t('common.delete')}
                        </Button>
                        <Button size="sm" variant="secondary" onPress={onEdit} isDisabled={!preview && item.valid}>
                          <RiEditLine className="size-4" />
                          {t('cap.edit')}
                        </Button>
                      </>
                    ) : null}
                    {canSelect ? (
                      <Button
                        size="sm"
                        variant={selected ? 'secondary' : 'primary'}
                        onPress={onToggle}
                      >
                        {selected ? t('cap.detach') : t('cap.attach')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function McpRow({
  item,
  config,
  editable,
  onLoad,
  onEdit,
  onDelete,
}: {
  item: McpServerCatalogDescriptor;
  config: McpServerConfig | null;
  editable: boolean;
  onLoad: () => Promise<void>;
  onEdit: (config: McpServerConfig) => void;
  onDelete: () => void;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const status = item.enabled && item.active ? t('cap.statusActive') : item.shadowedBy ? t('cap.statusShadowed') : item.enabled ? t('cap.statusAvailable') : t('cap.statusDisabled');

  const handleToggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !config) {
      setLoading(true);
      try {
        await onLoad();
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      className={`mb-2 p-3.5 transition-all cursor-pointer select-none hover:bg-surface-secondary/40 active:bg-surface-secondary/60 ${
        expanded ? 'bg-surface-secondary/20 ring-1 ring-separator' : ''
      }`}
      onClick={handleToggle}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          void handleToggle();
        }
      }}
    >
      <div className="flex gap-3">
        <div className="bg-success-soft flex size-9 shrink-0 items-center justify-center rounded-lg">
          <RiGitlabLine className="text-success size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-semibold text-sm">{item.name}</p>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-muted text-xs">{status}</span>
              <RiArrowDownSLine
                className={`text-muted size-4 transition-transform duration-200 ${
                  expanded ? 'rotate-180' : ''
                }`}
              />
            </div>
          </div>
          <p className="text-muted mt-1.5 text-[11px]">{item.transport} · {item.scope} · {item.source}</p>
          {item.error ? <p className="text-danger mt-1 text-xs">{item.error}</p> : null}

          {expanded ? (
            <div className="mt-3 cursor-default border-t border-separator/40 pt-3 select-text" onClick={(e) => e.stopPropagation()}>
              {loading ? (
                <div className="flex items-center gap-2 py-3 text-muted text-xs">
                  <Spinner size="sm" />
                  <span>{t('cap.loadingMcp')}</span>
                </div>
              ) : config ? (
                <>
                  <div className="rounded-lg bg-surface-secondary/60 border border-separator/50 p-2.5">
                    <p className="text-muted mb-1 truncate text-[11px] font-medium" title={config.path}>{config.path || 'JSON'}</p>
                    <pre className="text-foreground/80 max-h-72 overflow-auto whitespace-pre font-mono text-[11px] leading-relaxed select-text">
                      {JSON.stringify({ [item.name]: config.config }, null, 2)}
                    </pre>
                  </div>
                  {config.format === 'native' ? (
                    <p className="text-muted mt-3 text-xs">{t('cap.mcpNativeManaged')}</p>
                  ) : editable ? (
                    <div className="mt-3 flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onPress={onDelete}>
                        <RiDeleteBinLine className="size-4" />
                        {t('common.delete')}
                      </Button>
                      <Button size="sm" variant="secondary" onPress={() => onEdit(config)}>
                        <RiEditLine className="size-4" />
                        {t('cap.edit')}
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-muted text-xs">{t('cap.mcpConfigFailed')}</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
