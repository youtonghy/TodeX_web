import { describe, expect, it } from 'vitest';
import { commandContextKey, piCommandCompatibility, routePiSlashCommand, type ProviderCommandCatalog } from '../../src/renderer/session/providerCommands';

const catalog: ProviderCommandCatalog = { contextKey: 'test', status: 'ready', commands:
  ['compact', 'memory', 'model', 'status', 'review', 'permissions', 'MixedCase'].map(name => ({ name, source: 'extension', description: '', invocation: 'prompt' })) };
describe('Pi command routing', () => {
  it.each(['compact', 'memory', 'model', 'status', 'review', 'permissions'])('routes native /%s before Todex handlers', name => {
    expect(routePiSlashCommand(`/${name} unchanged  args`, catalog)).toEqual({ kind: 'native', input: `/${name} unchanged  args` });
  });
  it('keeps explicit Todex actions available with an empty or failed catalog', () => {
    expect(routePiSlashCommand('/todex compact')).toEqual({ kind: 'todex', command: 'compact' });
    expect(routePiSlashCommand('/todex commands', { ...catalog, status: 'error' })).toEqual({ kind: 'todex', command: 'commands' });
    expect(routePiSlashCommand('/todex model', catalog).kind).toBe('blocked');
  });
  it('does not invent native commands or reuse Codex actions when discovery is empty or fails', () => {
    expect(routePiSlashCommand('/compact', { ...catalog, commands: [] }).kind).toBe('blocked');
    expect(routePiSlashCommand('/compact', { ...catalog, status: 'error' }).kind).toBe('blocked');
    expect(routePiSlashCommand('/MixedCase', catalog).kind).toBe('native');
    expect(routePiSlashCommand('/mixedcase', catalog).kind).toBe('blocked');
  });
  it('separates backend, workspace, provider, conversation and runtime generations', () => {
    const base = { backend: 'b', workspace: 'w', provider: 'pi', conversationId: 'c', runtimeId: 'r', runtimeStatus: 'ready', nativeSessionId: 's' };
    const keys = Object.keys(base).map(key => commandContextKey({ ...base, [key]: 'other' }));
    expect(new Set([commandContextKey(base), ...keys]).size).toBe(8);
    expect(commandContextKey({ ...base, commandEpoch: 10 })).not.toBe(commandContextKey(base));
  });
  it('only blocks known terminal entry points with verified package identity and version', () => {
    const cache = { name: 'cache', source: 'extension', description: '', invocation: 'prompt', packageName: 'pi-cache-graph', packageVersion: '1.0.2' };
    expect(piCommandCompatibility(cache, 'graph').blocked).toBeTruthy();
    expect(piCommandCompatibility(cache, 'export').blocked).toBeUndefined();
    expect(piCommandCompatibility({ ...cache, name: 'different-command' }, 'graph').blocked).toBeUndefined();
    expect(piCommandCompatibility({ ...cache, packageVersion: '9.0.0' }, 'graph')).toEqual({ label: '兼容性未验证' });
    expect(piCommandCompatibility({ ...cache, packageName: undefined }, 'graph').blocked).toBeUndefined();
    expect(routePiSlashCommand('/cache stats', { ...catalog, commands: [cache] }).kind).toBe('blocked');
  });
});
