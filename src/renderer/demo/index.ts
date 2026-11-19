// Demo preview (`/demo`, embedded by the landing page): the real app against
// an in-memory backend with fixture data, the same as the desktop's `?demo`.
// It shares the origin with /app, so its storage stays in memory (see
// ./isolate, which entry.tsx imports first).
import { installWebPlatformBridge } from '../lib/webPlatform';
import { saveSealedSecret } from '../lib/historyKeyStore';
import {
  ACTIVE_SELECTION_STORAGE_KEY,
  BACKEND_CONNECTIONS_STORAGE_KEY,
  CONVERSATIONS_STORAGE_KEY,
  DEVICE_SECRET_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  USAGE_RECORDS_STORAGE_KEY,
  WORKSPACES_STORAGE_KEY,
  conversationFromManifest,
  defaultSettings,
  overrideBackendTransport,
} from '../session/helpers';
import { MESH_GROUPS_STORAGE_KEY, meshDeviceSecretKey } from '../session/meshGroups';
import { setLocale } from '../i18n';
import {
  DEMO_OFFLINE_BACKEND_ID,
  DEMO_OFFLINE_SERVER_URL,
  DEMO_ROOT,
  DEMO_SECOND_SERVER_URL,
  DEMO_SERVER_URL,
  demoActiveConversationId,
  demoConversationRecord,
  demoJournals,
  demoOfflineWorkspaces,
  demoUsageRecords,
  demoWorkspaces,
} from './fixtures';
import { DEMO_MESH_DEVICE_SECRET, DEMO_MESH_NAS_ID, demoMesh } from './mesh';
import { demoOfflineTransport, demoSecondTransport, demoTransport, installDemoFetch } from './transport';

export function installDemoMode(): void {
  const params = new URLSearchParams(window.location.search);
  const { deviceSecret: _deviceSecret, ...settings } = { ...defaultSettings, serverUrl: DEMO_SERVER_URL, defaultWorkspacePath: DEMO_ROOT };
  const store = new Map<string, unknown>([
    [SETTINGS_STORAGE_KEY, settings],
    [WORKSPACES_STORAGE_KEY, demoWorkspaces],
    [CONVERSATIONS_STORAGE_KEY, demoJournals.map((journal) => demoConversationRecord(journal, conversationFromManifest(journal.manifest, journal.manifest.workspaceId ?? demoWorkspaces[0].id)))],
    [ACTIVE_SELECTION_STORAGE_KEY, { workspaceId: demoWorkspaces[0].id, conversationId: demoActiveConversationId }],
    [USAGE_RECORDS_STORAGE_KEY, demoUsageRecords],
  ]);

  installWebPlatformBridge();
  window.todexWeb.store = {
    get: async (key) => structuredClone(store.get(key) ?? null),
    set: async (key, value) => {
      store.set(key, structuredClone(value));
    },
  };

  // `backends=2`: two paired backends (config sync preview).
  // `backends=offline`: a second unreachable backend with cached workspaces.
  const backends = params.get('backends');
  if (backends === '2' || backends === 'offline') {
    const profile = (id: string, name: string, serverUrl: string, labelColor: string) => ({
      id, name, serverUrl, labelColor, tenantId: 'default', encryptionProtocol: 'none', encryptionPublicKey: '', transportVerified: false, createdAt: 0, updatedAt: 0,
    });
    store.set(BACKEND_CONNECTIONS_STORAGE_KEY, [
      profile('default-backend', 'MBP', DEMO_SERVER_URL, '#3b82f6'),
      backends === 'offline'
        ? profile(DEMO_OFFLINE_BACKEND_ID, 'G14', DEMO_OFFLINE_SERVER_URL, '#22c55e')
        : profile('demo-g14', 'G14', DEMO_SECOND_SERVER_URL, '#22c55e'),
    ]);
    if (backends === 'offline') store.set(WORKSPACES_STORAGE_KEY, [...demoWorkspaces, ...demoOfflineWorkspaces]);
    // Never a real key: the fixtures transport neither signs nor checks.
    void saveSealedSecret(`${DEVICE_SECRET_STORAGE_KEY}.default-backend`, 'demo-device-secret');
    void saveSealedSecret(
      `${DEVICE_SECRET_STORAGE_KEY}.${backends === 'offline' ? DEMO_OFFLINE_BACKEND_ID : 'demo-g14'}`,
      'demo-device-secret',
    );
  }

  // `mesh=1`: the demo backend as a node of the demo group; `mesh=local`:
  // reached over IPC with the group link kept as a standby; `mesh=leaving`:
  // this device is leaving, and an offline NAS has not confirmed.
  const meshMode = params.get('mesh');
  if (meshMode === '1' || meshMode === 'local' || meshMode === 'leaving') {
    const mesh = demoMesh(DEMO_SERVER_URL);
    const node = { groupId: mesh.group.groupId, nodeId: mesh.nodeId };
    const profile = { name: 'MBP', labelColor: '#3b82f6', tenantId: 'default', encryptionProtocol: 'none', encryptionPublicKey: '', transportVerified: false, createdAt: 0, updatedAt: 0 };
    store.set(BACKEND_CONNECTIONS_STORAGE_KEY, meshMode === 'local' ? [
      { ...profile, id: 'default-backend', serverUrl: 'todex-ipc://local' },
      { ...profile, id: 'demo-mesh-standby', serverUrl: DEMO_SERVER_URL, disabled: true, mesh: node },
    ] : meshMode === 'leaving' ? [
      { ...profile, id: 'default-backend', serverUrl: DEMO_SERVER_URL, mesh: node },
      { ...profile, id: 'demo-mesh-nas', name: 'NAS', serverUrl: DEMO_OFFLINE_SERVER_URL, mesh: { groupId: mesh.group.groupId, nodeId: DEMO_MESH_NAS_ID } },
    ] : [{ ...profile, id: 'default-backend', serverUrl: DEMO_SERVER_URL, mesh: node }]);
    store.set(MESH_GROUPS_STORAGE_KEY, [meshMode === 'leaving'
      ? { ...mesh.group, leaving: { at: 0, othersCarry: false, nodeCount: 2, pendingNodes: [DEMO_MESH_NAS_ID], nodeNames: { [mesh.nodeId]: 'MBP', [DEMO_MESH_NAS_ID]: 'NAS' } } }
      : mesh.group]);
    void saveSealedSecret(`${DEVICE_SECRET_STORAGE_KEY}.default-backend`, DEMO_MESH_DEVICE_SECRET);
    if (meshMode === 'local') void saveSealedSecret(`${DEVICE_SECRET_STORAGE_KEY}.demo-mesh-standby`, DEMO_MESH_DEVICE_SECRET);
    void saveSealedSecret(meshDeviceSecretKey(mesh.group.groupId), DEMO_MESH_DEVICE_SECRET);
  }

  const theme = params.get('theme');
  if (theme === 'dark' || theme === 'light') {
    window.todexWeb.theme = { ...window.todexWeb.theme, shouldUseDark: async () => theme === 'dark', onUpdated: () => () => undefined };
  }
  if (!params.has('lang')) setLocale('zh-CN');

  overrideBackendTransport((serverUrl) => (serverUrl === DEMO_SECOND_SERVER_URL ? demoSecondTransport
    : serverUrl === DEMO_OFFLINE_SERVER_URL ? demoOfflineTransport : demoTransport));
  installDemoFetch();
}
