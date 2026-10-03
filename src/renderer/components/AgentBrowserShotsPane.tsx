import { useEffect, useMemo, useState } from 'react';
import { RiGlobalLine, RiStopCircleLine } from '@remixicon/react';
import { Button, Chip, ScrollShadow, Spinner, toast } from '@heroui/react';
import { V2ApiClient } from '@todex/protocol/v2';
import { deviceIdentityFromSecret } from '@todex/protocol/deviceAuth';
import type { DesktopBrowserState } from '@todex/protocol/conversationRuntime';
import type { TodeXSession } from '../session/useTodeXSession';
import { useT } from '../i18n';

/**
 * The agent's desktop browser seen from the web: the page runs on the
 * desktop, so this shows the screenshots the agent took and its recent
 * actions, newest first.
 */
export function AgentBrowserShotsPane({ state, session, conversationId }: {
  state: DesktopBrowserState | undefined;
  session: TodeXSession;
  conversationId: string;
}) {
  const t = useT();
  const actions = useMemo(() => [...(state?.actions ?? [])].reverse(), [state?.actions]);
  const latestShot = actions.find(action => action.shotId)?.shotId;
  const [selected, setSelected] = useState<string | undefined>();
  const shotId = selected ?? latestShot;
  const [image, setImage] = useState<{ shotId: string; dataUrl: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [stopping, setStopping] = useState(false);
  const api = useMemo(
    () => new V2ApiClient({ serverUrl: session.settings.serverUrl, device: deviceIdentityFromSecret(session.settings.deviceSecret) }),
    [session.settings.deviceSecret, session.settings.serverUrl],
  );

  useEffect(() => {
    if (!shotId || image?.shotId === shotId) return;
    let alive = true;
    setLoading(true);
    api.getAgentShot(conversationId, shotId)
      .then(shot => { if (alive) setImage({ shotId, dataUrl: shot.dataUrl }); })
      .catch(() => { if (alive) toast.danger(t('agentBrowser.shotFailed')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [api, conversationId, image?.shotId, shotId]);

  const stop = async () => {
    setStopping(true);
    try {
      await api.revokeAgentDesktop(conversationId);
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : t('agentBrowser.stopFailed'));
    } finally {
      setStopping(false);
    }
  };

  const device = state?.deviceName || t('agentBrowser.desktopDevice');
  const current = actions.find(action => action.url);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border flex items-center gap-2 border-b px-3 py-2">
        <RiGlobalLine className="text-muted size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{current?.title || current?.url || t('agentBrowser.title')}</p>
          {current?.url ? <p className="text-muted truncate text-xs">{current.url}</p> : null}
        </div>
        {state?.granted ? <Chip size="sm" variant="soft" color="warning">{t('agentBrowser.controlled')}</Chip> : null}
        <Button size="sm" variant="danger-soft" isDisabled={!state?.granted || stopping} onPress={() => { void stop(); }}>
          <RiStopCircleLine className="size-4" />
          {t('agentBrowser.stop')}
        </Button>
      </div>
      <div className="relative min-h-0 flex-1 bg-black/5">
        {image && image.shotId === shotId ? (
          <img src={image.dataUrl} alt={t('agentBrowser.title')} className="h-full w-full object-contain object-top" />
        ) : !shotId ? (
          <div className="text-muted flex h-full items-center justify-center px-6 text-center text-sm">{t('agentBrowser.noShots', { device })}</div>
        ) : null}
        {loading ? <div className="absolute inset-0 flex items-center justify-center"><Spinner size="sm" /></div> : null}
      </div>
      {actions.length ? (
        <div className="border-border max-h-48 border-t">
          <p className="text-muted px-3 pt-2 text-xs font-medium">{t('agentBrowser.recent')}</p>
          <ScrollShadow className="max-h-40 overflow-y-auto px-1 pb-2">
            {actions.map(action => (
              <Button
                key={action.actionId}
                size="sm"
                variant={action.shotId && action.shotId === shotId ? 'secondary' : 'ghost'}
                isDisabled={!action.shotId}
                onPress={() => setSelected(action.shotId)}
                className="h-auto w-full justify-start gap-2 px-2 py-1 text-left text-xs font-normal"
              >
                <span className={action.ok ? 'text-success' : 'text-danger'}>{action.ok ? '●' : '✕'}</span>
                <span className="min-w-0 flex-1 truncate">{action.summary}{action.error ? ` — ${action.error.message}` : ''}</span>
                <span className="text-muted shrink-0">{new Date(action.time).toLocaleTimeString()}</span>
              </Button>
            ))}
          </ScrollShadow>
        </div>
      ) : null}
    </div>
  );
}
