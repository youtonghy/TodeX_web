import { useCallback, useEffect, useMemo, useState } from 'react';
import { Surface, Switch, toast } from '@heroui/react';
import type { AgentDesktopSettings as Settings } from '@todex/protocol/agentDesktop';
import { ConnectionError } from '@todex/protocol/connectionError';
import type { TodeXSession } from '../session/useTodeXSession';
import { useT } from '../i18n';
import { AgentBrowserSettings } from './AgentBrowserSettings';
import { ComputerUseSettings } from './ComputerUseSettings';
import { backendApi } from '../session/helpers';

/**
 * Agent desktop tools for the active backend. The agent browser and
 * Computer Use both run on the backend's computer; this app only watches
 * them, so everything here is backend state.
 */
export function AgentDesktopSettings({ session }: { session: TodeXSession }) {
  const t = useT();
  const api = useMemo(
    () => backendApi(session.settings),
    [session.settings.deviceSecret, session.settings.encryptionProtocol, session.settings.encryptionPublicKey, session.settings.serverUrl],
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

  const setComputerEnabled = async (computerEnabled: boolean) => {
    setSaving(true);
    try {
      setSettings(await api.setAgentComputerEnabled(computerEnabled));
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : t('agentDesktop.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const requestComputerPermissions = async () => {
    setSaving(true);
    try {
      setSettings(await api.requestComputerPermissions());
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
        <AgentBrowserSettings session={session} api={api} settings={settings} onSettings={setSettings} />
      ) : null}
      {settings?.enabled ? (
        <ComputerUseSettings
          settings={settings}
          saving={saving}
          onEnable={selected => { void setComputerEnabled(selected); }}
          onRequestPermissions={() => { void requestComputerPermissions(); }}
        />
      ) : null}
    </Surface>
  );
}
