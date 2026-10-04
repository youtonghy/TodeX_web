import { useEffect, useMemo, useState } from 'react';
import { RiArrowDownSLine, RiArrowUpSLine, RiComputerLine, RiStopCircleLine } from '@remixicon/react';
import { Button, toast } from '@heroui/react';
import type { DesktopComputerState } from '@todex/protocol/conversationRuntime';
import { deviceIdentityFromSecret } from '@todex/protocol/deviceAuth';
import { V2ApiClient } from '@todex/protocol/v2';
import type { TodeXSession } from '../session/useTodeXSession';
import { useT } from '../i18n';

/**
 * Pinned above the composer while the conversation's agent controls a Mac.
 * The web shows the latest screenshot the agent took (the live view needs
 * the desktop app on that Mac).
 */
export function ComputerLiveView({ session, conversationId, state }: {
  session: TodeXSession;
  conversationId: string;
  state: DesktopComputerState | undefined;
}) {
  const t = useT();
  const [collapsed, setCollapsed] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [shot, setShot] = useState<{ shotId: string; dataUrl: string } | null>(null);
  const api = useMemo(
    () => new V2ApiClient({ serverUrl: session.settings.serverUrl, device: deviceIdentityFromSecret(session.settings.deviceSecret) }),
    [session.settings.deviceSecret, session.settings.serverUrl],
  );
  const active = Boolean(state?.active);
  const latest = state?.actions.at(-1);
  const latestShotId = state ? [...state.actions].reverse().find(action => action.shotId)?.shotId : undefined;
  useEffect(() => {
    if (!active || collapsed || !latestShotId || shot?.shotId === latestShotId) return;
    let alive = true;
    void api.getAgentShot(conversationId, latestShotId)
      .then(next => { if (alive) setShot({ shotId: latestShotId, dataUrl: next.dataUrl }); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [active, api, collapsed, conversationId, latestShotId, shot?.shotId]);

  if (!active) return null;

  const stop = async () => {
    setStopping(true);
    try {
      await api.revokeAgentDesktop(conversationId, 'screen');
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : t('computerLive.stopFailed'));
    } finally {
      setStopping(false);
    }
  };

  const device = state?.deviceName || t('computerLive.thisMac');
  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-warning">
      <div className="flex items-center gap-2 px-3 py-2">
        <RiComputerLine className="text-warning size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{t('computerLive.title', { device })}</p>
          {latest ? <p className="text-muted truncate text-xs">{latest.summary}{latest.app ? ` · ${latest.app}` : ''}</p> : null}
        </div>
        <Button isIconOnly size="sm" variant="ghost" aria-label={collapsed ? t('computerLive.expand') : t('computerLive.collapse')} onPress={() => setCollapsed(value => !value)}>
          {collapsed ? <RiArrowUpSLine className="size-4" /> : <RiArrowDownSLine className="size-4" />}
        </Button>
        <Button size="sm" variant="danger-soft" isDisabled={stopping} onPress={() => { void stop(); }}>
          <RiStopCircleLine className="size-4" />
          {t('computerLive.stop')}
        </Button>
      </div>
      {collapsed ? null : (
        <div className="bg-black/80 flex h-60 items-center justify-center">
          {shot ? (
            <img src={shot.dataUrl} alt={t('computerLive.screenshot')} className="h-full w-full object-contain" />
          ) : (
            <p className="text-xs text-white/70">{t('computerLive.waiting')}</p>
          )}
        </div>
      )}
    </div>
  );
}
