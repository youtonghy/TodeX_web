import { describe, expect, it } from 'vitest';
import { planConfigSync, type ConfigSyncItem, type ConfigSyncSnapshot } from '@todex/protocol/configSync';
import { REDACTED, configSyncItemText, configSyncRows, redactConfigValue } from '../../src/renderer/session/configSyncView';

function mcp(name: string, hash: string, config: unknown = {}): ConfigSyncItem {
  return {
    key: `mcp:codex:${name}`, category: 'mcp', kind: 'mcpServer', group: 'codex', label: name, hash,
    payload: { provider: 'codex', name, config }, warnings: [],
  };
}

const snapshot = (items: ConfigSyncItem[]): ConfigSyncSnapshot => ({ categories: ['mcp'], items, errors: [] });

describe('configSyncRows', () => {
  it('lines up planned entries with the target and appends target-only items', () => {
    const source = snapshot([mcp('a', '1'), mcp('b', '2')]);
    const target = snapshot([mcp('b', '2'), mcp('c', '3')]);
    const rows = configSyncRows(planConfigSync(source, target), target);
    expect(rows.map(row => [row.label, row.status, Boolean(row.source), Boolean(row.target), Boolean(row.entry)])).toEqual([
      ['a', 'new', true, false, true],
      ['b', 'same', true, true, true],
      ['c', 'targetOnly', false, true, false],
    ]);
  });
});

describe('redactConfigValue', () => {
  it('hides secrets by key, inside env and header maps, and by shape', () => {
    expect(redactConfigValue({
      command: 'npx',
      args: ['-y', 'server'],
      env: { LOG_LEVEL: 'debug' },
      headers: { 'X-Team': 'core' },
      apiKey: 'abc',
      auth: { OPENAI_API_KEY: 'x', nested: { value: 1 } },
      note: 'sk-live-123',
      port: 8080,
    })).toEqual({
      command: 'npx',
      args: ['-y', 'server'],
      env: { LOG_LEVEL: REDACTED },
      headers: { 'X-Team': REDACTED },
      apiKey: REDACTED,
      auth: { OPENAI_API_KEY: REDACTED, nested: { value: REDACTED } },
      note: REDACTED,
      port: 8080,
    });
  });

  it('keeps empty strings, booleans and null as they are', () => {
    expect(redactConfigValue({ token: '', apiKey: null, secret: true })).toEqual({ token: '', apiKey: null, secret: true });
  });
});

describe('configSyncItemText', () => {
  it('shows an MCP config with its env values hidden', () => {
    const text = configSyncItemText(mcp('a', '1', { command: 'npx', env: { GITHUB_TOKEN: 'ghp_secret' } }));
    expect(text).toContain('"command": "npx"');
    expect(text).not.toContain('ghp_secret');
  });

  it('lists skill files without their content', () => {
    const item: ConfigSyncItem = {
      key: 'skills:codex:demo', category: 'skills', kind: 'skill', group: 'codex', label: 'demo', hash: 'h', warnings: [],
      payload: { provider: 'codex', source: 'user', name: 'demo', files: [{ path: 'SKILL.md', contentBase64: 'aGVsbG8=' }], contentOnly: false },
    };
    expect(configSyncItemText(item)).toBe('SKILL.md  (5 B)');
  });
});
