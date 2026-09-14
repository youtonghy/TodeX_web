import { Accordion, Button, ScrollShadow } from '@heroui/react';
import { Widget } from '@heroui-pro/react/widget';
import type { ConversationRuntime } from '@todex/protocol/conversationRuntime';
import { useT, type MessageKey } from '../i18n';
import { piExtensionPlainText, piRuntimeStopReason } from './piExtensionPresentation';

type ExtensionUi = ConversationRuntime['extensionUi'];
type EditorRequest = NonNullable<ExtensionUi['editorRequest']>;

export type PiExtensionPanelProps = {
  extensionUi: ExtensionUi;
  placement: 'aboveEditor' | 'belowEditor';
  providerRuntime?: ConversationRuntime['providerRuntime'];
  /** Only pass a live editor request that the user has not already handled. */
  pendingEditorRequest?: EditorRequest;
  onReplaceEditor?: (request: EditorRequest) => void;
  onDismissEditor?: (request: EditorRequest) => void;
  onStopRuntime?: () => void;
  isStopping?: boolean;
  isConnected?: boolean;
};

const noticeLabelKeys = { info: 'pi.noticeInfo', warning: 'pi.noticeWarning', error: 'pi.noticeError' } as const satisfies Record<string, MessageKey>;
const noticeColors = { info: 'text-muted', warning: 'text-warning', error: 'text-danger' } as const;

/** A presentation of the shared projection. Toasts, draft writes, and RPCs belong to the caller. */
export function PiExtensionPanel({ extensionUi, placement, providerRuntime, pendingEditorRequest,
  onReplaceEditor, onDismissEditor, onStopRuntime, isStopping = false, isConnected = true }: PiExtensionPanelProps) {
  const t = useT();
  const above = placement === 'aboveEditor';
  const widgets = Object.values(extensionUi.widgets).filter(widget => widget.placement === placement);
  const statuses = above ? Object.values(extensionUi.statuses) : [];
  const notices = above ? extensionUi.notices : [];
  const editorRequest = above ? pendingEditorRequest : undefined;
  const running = above && providerRuntime?.status === 'ready';
  const stopped = above && providerRuntime?.status === 'stopped';
  const title = above ? piExtensionPlainText(extensionUi.title || t('pi.defaultTitle')) : t('pi.subtitle');
  const contentCount = widgets.length + statuses.length + notices.length;
  if (!contentCount && !editorRequest && !running && !stopped && !(above && extensionUi.title)) return null;

  return <Widget className="my-2 min-w-0 gap-2 rounded-2xl p-2" data-testid={`pi-extension-${placement}`}>
    <Accordion hideSeparator defaultExpandedKeys={['content']}>
      <Accordion.Item id="content">
        <Widget.Header className="min-w-0 gap-2 px-1 py-0">
          <Accordion.Heading className="min-w-0 flex-1">
            <Accordion.Trigger className="min-w-0 gap-2 py-1.5 text-xs">
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-left">
                <Widget.Title className="min-w-0 break-words text-xs font-medium">{title}</Widget.Title>
                {running ? <span className="text-muted">{isConnected ? t('pi.running') : t('pi.disconnected')}</span> : null}
                {stopped ? <span className="text-muted">{t('pi.stopped')}</span> : null}
                {notices.length ? <span className="text-muted">{t('pi.noticeCount', { count: notices.length })}</span> : null}
              </span>
              <Accordion.Indicator className="size-3.5 shrink-0" />
            </Accordion.Trigger>
          </Accordion.Heading>
          {running ? <Button size="sm" variant="ghost" className="shrink-0 text-xs"
            isPending={isStopping} isDisabled={!isConnected || !onStopRuntime || isStopping}
            aria-label={t('pi.stopAria')}
            onPress={onStopRuntime}>{t('pi.stop')}</Button> : null}
        </Widget.Header>
        <Accordion.Panel>
          <Accordion.Body className="p-0 pt-1">
            <Widget.Content className="min-w-0 space-y-3 p-3 text-xs shadow-none">
              {statuses.length ? <dl className="space-y-2" aria-label={t('pi.statusLabel')}>
                {statuses.map(status => <div key={status.key} className="grid min-w-0 grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-2">
                  <dt className="break-words text-muted">{piExtensionPlainText(status.key)}</dt>
                  <dd className="min-w-0 whitespace-pre-wrap break-words">{piExtensionPlainText(status.text)}</dd>
                </div>)}
              </dl> : null}
              {widgets.length ? <ScrollShadow className="max-h-52 overflow-y-auto" size={16}>
                <div className="space-y-3" aria-label={t('pi.widgetsLabel')}>
                  {widgets.map(widget => <section key={widget.key} aria-label={piExtensionPlainText(widget.key)}>
                    <p className="mb-1 break-words text-muted">{piExtensionPlainText(widget.key)}</p>
                    <p className="whitespace-pre-wrap break-words font-mono leading-relaxed">{piExtensionPlainText(widget.lines.join('\n'))}</p>
                  </section>)}
                </div>
              </ScrollShadow> : null}
              {notices.length ? <Accordion hideSeparator>
                <Accordion.Item id="notices">
                  <Accordion.Heading>
                    <Accordion.Trigger className="gap-2 py-0 text-xs">
                      <span className="flex-1 text-left">{t('pi.viewNotices', { count: notices.length })}</span>
                      <Accordion.Indicator className="size-3.5" />
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body className="p-0 pt-2">
                      <ScrollShadow className="max-h-52 overflow-y-auto" size={16}>
                        <ol className="space-y-3" aria-label={t('pi.noticesLabel')}>
                          {notices.map(notice => <li key={notice.eventId} className="space-y-0.5">
                            <p className={`text-[11px] ${noticeColors[notice.level]}`}>{t(noticeLabelKeys[notice.level])}</p>
                            <p className="whitespace-pre-wrap break-words leading-relaxed">{piExtensionPlainText(notice.message)}</p>
                          </li>)}
                        </ol>
                      </ScrollShadow>
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion> : null}
              {!contentCount ? <p className="text-muted">{running ? t('pi.waitingMessages') : t('pi.historyKept')}</p> : null}
              {stopped && providerRuntime?.reason ? <p className="whitespace-pre-wrap break-words text-muted">{piRuntimeStopReason(providerRuntime.reason)}</p> : null}
            </Widget.Content>
          </Accordion.Body>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
    {editorRequest ? <Widget.Content className="space-y-2 p-3 text-xs shadow-none" aria-label={t('pi.draftSuggestion')}>
      <p className="font-medium">{t('pi.replaceDraftTitle')}</p>
      <p className="text-muted">{t('pi.replaceDraftHint')}</p>
      <ScrollShadow className="max-h-32 overflow-y-auto" size={12}>
        <p className="whitespace-pre-wrap break-words">{piExtensionPlainText(editorRequest.text) || t('pi.clearDraft')}</p>
      </ScrollShadow>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" isDisabled={!onReplaceEditor}
          onPress={() => onReplaceEditor?.(editorRequest)}>{t('pi.replaceDraft')}</Button>
        <Button size="sm" variant="ghost" isDisabled={!onDismissEditor}
          onPress={() => onDismissEditor?.(editorRequest)}>{t('common.cancel')}</Button>
      </div>
    </Widget.Content> : null}
  </Widget>;
}
