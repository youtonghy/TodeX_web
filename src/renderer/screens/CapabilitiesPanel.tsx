import { useMemo, useState } from 'react';
import { AlertDialog, Button, Card, ScrollShadow, Spinner, Tabs, toast } from '@heroui/react';
import { RiArrowDownSLine, RiDeleteBinLine, RiFlashlightLine, RiGitlabLine, RiRefreshLine } from '@remixicon/react';
import type { McpCatalog, McpServerCatalogDescriptor, McpServerConfig, ProviderDescriptor, ProviderKind, SkillCatalog, SkillCatalogDescriptor } from '@todex/protocol/v2';
import { providerDisplayName } from '@todex/protocol/v2';
import { ProviderIcon } from '../components/ProviderIcon';
import { useNoticeToast } from '../components/NoticeToast';
import { useT } from '../i18n';
import type { SelectedSkillAttachment } from '../session/helpers';

export type CatalogState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  skills?: SkillCatalog;
  mcp?: McpCatalog;
  error?: string;
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
  onDeleteMcp?: (server: McpServerCatalogDescriptor) => Promise<void>;
  /** Hosted in a dialog whose heading already names the panel. */
  inDialog?: boolean;
};

type ViewMode = 'skills' | 'mcp';
type ProviderChoice = ProviderKind | 'common';

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
  onDeleteMcp,
  inDialog = false,
}: Props) {
  const t = useT();
  const [viewMode, setViewMode] = useState<ViewMode>('skills');
  const [providerChoice, setProviderChoice] = useState<ProviderChoice>('common');
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [mcpConfigs, setMcpConfigs] = useState<Record<string, McpServerConfig>>({});
  const [pendingDelete, setPendingDelete] = useState<McpServerCatalogDescriptor | null>(null);
  const [deleting, setDeleting] = useState(false);
  const provider = providerChoice === 'common' ? undefined : providers.find((item) => item.id === providerChoice);
  const providerKeys = useMemo(() => providers.map((item) => item.id), [providers]);
  const selectedCatalogs = providerChoice === 'common'
    ? providerKeys.map((key) => catalogs[key]).filter(Boolean) as CatalogState[]
    : catalogs[providerChoice] ? [catalogs[providerChoice] as CatalogState] : [];
  const state = selectedCatalogs.find((item) => item.status === 'loading') ?? selectedCatalogs[0];
  const catalogError = [...new Set(selectedCatalogs.map(item => item.error).filter(Boolean))].join('\n');
  useNoticeToast(catalogError, { variant: 'danger', scope: `${workspacePath}:${providerChoice}` });
  const skills = useMemo(() => {
    const items = selectedCatalogs.flatMap((item) => (item.skills?.skills ?? []).map((skill) => ({
      skill,
      provider: (item.skills?.provider ?? providerChoice) as ProviderKind,
    })));
    // Resource ids are provider-scoped, so the common view folds one shared
    // skill across providers by name and source, like the MCP list below.
    const keyOf = (item: (typeof items)[number]) => providerChoice === 'common'
      ? `${item.skill.name}:${item.skill.source}`
      : `${item.skill.resourceId}:${item.skill.name}`;
    return items.filter((item, index, list) => list.findIndex((candidate) => keyOf(candidate) === keyOf(item)) === index)
      .filter((item) => providerChoice !== 'common' || isCommonSource(item.skill.source));
  }, [providerChoice, selectedCatalogs]);
  const mcpServers = useMemo(() => {
    const items = selectedCatalogs.flatMap((item) => item.mcp?.servers ?? []);
    return items.filter((item, index, list) => {
      if (providerChoice !== 'common') return true;
      if (!isCommonSource(item.source)) return false;
      return list.findIndex((candidate) => candidate.name === item.name && candidate.source === item.source) === index;
    });
  }, [providerChoice, selectedCatalogs]);

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
        {providerChoice !== 'common' ? (
          <Button isIconOnly size="sm" variant="ghost" aria-label={t('workbench.refresh')} onPress={() => onRefresh(providerChoice)}>
            <RiRefreshLine className="size-4" />
          </Button>
        ) : null}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Button size="sm" variant={providerChoice === 'common' ? 'primary' : 'tertiary'} onPress={() => setProviderChoice('common')}>{t('cap.common')}</Button>
        {providers.map((item) => (
          <Button key={item.id} size="sm" variant={providerChoice === item.id ? 'primary' : 'tertiary'} onPress={() => setProviderChoice(item.id)}>
            <ProviderIcon provider={item.id} />
            {providerDisplayName(item.id)} {item.available ? '●' : '○'}
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
              preview={previews[item.skill.resourceId] ?? null}
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
          mcpServers.length ? mcpServers.map((item) => (
            <McpRow
              key={`${item.resourceId}:${item.name}`}
              item={item}
              config={mcpConfigs[item.resourceId] ?? null}
              canDelete={Boolean(onDeleteMcp)}
              onLoad={async () => {
                if (!onLoadMcpConfig) return;
                try {
                  const config = await onLoadMcpConfig(item);
                  setMcpConfigs((current) => ({ ...current, [item.resourceId]: config }));
                } catch (error) {
                  toast.danger(error instanceof Error ? error.message : t('cap.mcpConfigFailed'));
                }
              }}
              onDelete={() => setPendingDelete(item)}
            />
          )) : <p className="text-muted py-10 text-center text-sm">{t('cap.noMcps')}</p>
        ) : null}
      </ScrollShadow>
      <AlertDialog isOpen={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open && !deleting) setPendingDelete(null); }}>
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-md">
              <AlertDialog.Header>
                <AlertDialog.Heading>{t('cap.deleteMcpTitle')}</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p className="text-muted text-sm">
                  {pendingDelete ? t('cap.deleteMcpBody', {
                    name: pendingDelete.name,
                    path: mcpConfigs[pendingDelete.resourceId]?.path ?? pendingDelete.source,
                  }) : null}
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary" isDisabled={deleting}>{t('common.cancel')}</Button>
                <Button
                  variant="danger"
                  isPending={deleting}
                  onPress={async () => {
                    if (!pendingDelete || !onDeleteMcp) return;
                    setDeleting(true);
                    try {
                      await onDeleteMcp(pendingDelete);
                      toast.success(t('cap.mcpDeleted', { name: pendingDelete.name }));
                      setPendingDelete(null);
                    } catch (error) {
                      toast.danger(error instanceof Error ? error.message : t('cap.deleteMcpFailed'));
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
    </div>
  );
}

function SkillRow({
  item,
  selected,
  canSelect,
  preview,
  onToggle,
  onPreview,
}: {
  item: SkillCatalogDescriptor;
  selected: boolean;
  canSelect: boolean;
  preview: string | null;
  onToggle: () => void;
  onPreview: () => Promise<void>;
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

              {canSelect ? (
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-muted text-xs">
                    {selected ? t('cap.attachedToChat') : t('cap.attachable')}
                  </span>
                  <Button
                    size="sm"
                    variant={selected ? 'secondary' : 'primary'}
                    onPress={onToggle}
                  >
                    {selected ? t('cap.detach') : t('cap.attach')}
                  </Button>
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
  canDelete,
  onLoad,
  onDelete,
}: {
  item: McpServerCatalogDescriptor;
  config: McpServerConfig | null;
  canDelete: boolean;
  onLoad: () => Promise<void>;
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
                  {canDelete ? (
                    config.format === 'native' ? (
                      <p className="text-muted mt-3 text-xs">{t('cap.mcpNativeManaged')}</p>
                    ) : (
                      <div className="mt-3 flex justify-end">
                        <Button size="sm" variant="danger" onPress={onDelete}>
                          <RiDeleteBinLine className="size-4" />
                          {t('cap.deleteMcp')}
                        </Button>
                      </div>
                    )
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
