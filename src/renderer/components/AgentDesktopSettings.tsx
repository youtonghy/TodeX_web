import { useCallback, useEffect, useMemo, useState } from 'react';
import { Chip, Surface, Switch, toast } from '@heroui/react';
import type { AgentDesktopSettings as Settings } from '@todex/protocol/agentDesktop';
import { ConnectionError } from '@todex/protocol/connectionError';
import { deviceIdentityFromSecret } from '@todex/protocol/deviceAuth';
import { V2ApiClient } from '@todex/protocol/v2';
import type { TodeXSession } from '../session/useTodeXSession';
import { useT } from '../i18n';

/**
 * Agent desktop tools for the active backend: the switch and the desktops
 * online to run them. The browser itself runs on a TodeX desktop, so the
 * executor and browser-profile settings live there.
 */
export function AgentDesktopSettings({ session }: { session: TodeXSession }) {
  const t = useT();
  const api = useMemo(
    () => new V2ApiClient({ serverUrl: session.settings.serverUrl, device: deviceIdentityFromSecret(session.settings.deviceSecret) }),
    [session.settings.deviceSecret, session.settings.serverUrl],
  );
  // `null`: the backend predates desktop tools.
  const [settings, setSettings] = useState<Settings | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setSettings(await api.getAgentDesktop());
    } catch (error) {
      setSettings(error instanceof ConnectionError && error.httpStatus === 404 ? null : undefined);
    }
  }, [api]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  const setEnabled = async (enabled: boolean) => {
    setSaving(true);
    try {
      setSettings(await api.setAgentDesktopEnabled(enabled));
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : t('agentDesktop.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (settings === null) {
    return (
      <Surface className="flex flex-col gap-2 rounded-2xl p-5">
        <h3 className="font-semibold">{t('agentDesktop.title')}</h3>
        <p className="text-muted text-sm">{t('agentDesktop.unsupported')}</p>
      </Surface>
    );
  }
  return (
    <Surface className="flex flex-col gap-4 rounded-2xl p-5">
      <h3 className="font-semibold">{t('agentDesktop.title')}</h3>
      <Switch isSelected={settings?.enabled ?? false} isDisabled={settings === undefined || saving} onChange={selected => { void setEnabled(selected); }}>
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <div>
            <p className="text-sm font-medium">{t('agentDesktop.enable')}</p>
            <p className="text-muted text-xs">{t('agentDesktop.enableHint')}</p>
          </div>
        </Switch.Content>
      </Switch>
      {settings?.enabled ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{t('agentDesktop.executors')}</p>
          {settings.executors.length ? (
            <div className="flex flex-wrap gap-2">
              {settings.executors.map(executor => (
                <Chip key={executor.executorId} size="sm" variant="soft" color="success">{executor.deviceName}</Chip>
              ))}
            </div>
          ) : <p className="text-muted text-xs">{t('agentDesktop.noExecutors')}</p>}
        </div>
      ) : null}
    </Surface>
  );
}
