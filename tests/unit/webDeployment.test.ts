import { describe, expect, it } from 'vitest';
import type { BackendConnectionProfile } from '@todex/protocol/todex';
import { loadWebDeployment, managedBackendProfiles, managedBackendUrl } from '../../src/renderer/lib/webDeployment';

const template: BackendConnectionProfile = {
  id: 'default-backend',
  name: 'Default',
  serverUrl: 'http://127.0.0.1:7345',
  deviceSecret: 'template-secret',
  tenantId: 'local',
  encryptionProtocol: 'x25519',
  encryptionPublicKey: 'template-key',
  transportVerified: true,
  createdAt: 1,
  updatedAt: 1,
};

const deployment = { managed: true, backends: [{ id: 'home', name: 'Home' }, { id: 'office', name: 'Office' }] };
const origin = 'https://todex.example.com';

describe('managed deployment profiles', () => {
  it('reaches each backend through the page origin', () => {
    expect(managedBackendUrl('home', origin)).toBe('https://todex.example.com/backend/home');
  });

  it('lists exactly the deployed backends, unpaired, never inheriting a key', () => {
    const profiles = managedBackendProfiles(deployment, [template], template, origin, 5);
    expect(profiles.map((profile) => [profile.id, profile.name, profile.serverUrl])).toEqual([
      ['deploy-home', 'Home', 'https://todex.example.com/backend/home'],
      ['deploy-office', 'Office', 'https://todex.example.com/backend/office'],
    ]);
    for (const profile of profiles) {
      expect(profile).toMatchObject({ deviceSecret: '', encryptionProtocol: 'none', encryptionPublicKey: '', transportVerified: false, tenantId: 'local', createdAt: 5 });
    }
  });

  it('keeps a paired profile at the same address and drops one whose address moved', () => {
    const paired = { ...template, id: 'deploy-home', name: 'My home', serverUrl: 'https://todex.example.com/backend/home', labelColor: '#f00' };
    const moved = { ...template, id: 'deploy-office', serverUrl: 'https://old.example.com/backend/office' };
    const [home, office] = managedBackendProfiles(deployment, [paired, moved], template, origin, 5);
    expect(home).toEqual(paired);
    expect(office).toMatchObject({ name: 'Office', deviceSecret: '', transportVerified: false });
  });
});

describe('loadWebDeployment', () => {
  const respond = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it('returns the pinned backends', async () => {
    expect(await loadWebDeployment(respond(deployment))).toEqual(deployment);
  });

  it('treats an unmanaged, malformed or failing server as the public site', async () => {
    expect(await loadWebDeployment(respond({ managed: false, backends: [] }))).toBeNull();
    expect(await loadWebDeployment(respond({ managed: true, backends: [{ id: 3 }] }))).toBeNull();
    expect(await loadWebDeployment(respond({}, 404))).toBeNull();
    expect(await loadWebDeployment((async () => { throw new Error('offline'); }) as unknown as typeof fetch)).toBeNull();
  });
});
